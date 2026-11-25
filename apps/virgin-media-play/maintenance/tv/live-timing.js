// Rebase large DASH presentation clocks without changing segment addresses.
// The 2016 TV exposes its native playback clock as signed 32-bit milliseconds.
(function () {
    var video = document.createElement('video');
    var legacy = typeof window.tizen !== 'undefined' && typeof video.webkitGenerateKeyRequest === 'function' &&
        typeof navigator.requestMediaKeySystemAccess !== 'function';
    var day = 86400;
    var uint32 = 4294967296;
    var anchor = null;
    var sharedShift = 0;
    var baseline = null;

    function active() { return legacy; }

    function periodStart(value) {
        var match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value || '');
        return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : NaN;
    }

    // Some feeds keep Period at zero and put the absolute clock in S@t.
    // DASH addresses segments by their original time or number. Moving the
    // presentationTimeOffset preserves those addresses and the media samples.
    function timelinePlan(period) {
        if (period.getElementsByTagName('SegmentList').length || period.getElementsByTagName('SegmentBase').length) return null;
        var templates = period.getElementsByTagName('SegmentTemplate');
        var plan = [], earliest = Infinity;
        for (var i = 0; i < templates.length; i++) {
            var template = templates[i];
            var segment = template.getElementsByTagName('S')[0];
            var scale = Number(template.getAttribute('timescale') || 1);
            var pto = Number(template.getAttribute('presentationTimeOffset') || 0);
            if (!segment || !segment.hasAttribute('t') || !(scale > 0) || !isFinite(pto)) return null;
            var first = (Number(segment.getAttribute('t')) - pto) / scale;
            if (!isFinite(first) || first < day * 365) return null;
            earliest = Math.min(earliest, first);
            plan.push({template: template, scale: scale, pto: pto});
        }
        return plan.length ? {first: earliest, tracks: plan} : null;
    }

    // Shaka 4.12 uses a lightweight XML tree. Avoid its deprecated DOM-to-XML
    // callback: XML Element.outerHTML is missing on this Samsung engine.
    function xml(node) {
        if (node.getAttribute) return node;
        return {
            getAttribute:function(name){return node.attributes[name] || null;},
            hasAttribute:function(name){return Object.prototype.hasOwnProperty.call(node.attributes,name);},
            setAttribute:function(name,value){node.attributes[name]=String(value);},
            getElementsByTagName:function(name){
                var result=[];
                function walk(parent){
                    (parent.children || []).forEach(function(child){
                        if (!child || typeof child === 'string') return;
                        if (child.tagName.split(':').pop() === name) result.push(xml(child));
                        walk(child);
                    });
                }
                walk(node);
                return result;
            }
        };
    }
    function manifest(mpd) {
        if (!active()) return;
        mpd=xml(mpd);
        // A static VOD MPD can declare a very large minBufferTime. Shaka folds
        // that value into its segment scheduling target even when TAL supplies
        // a smaller streaming.bufferingGoal, so cap it for the VOD MSE route.
        // Segment addresses are unchanged; live feeds keep their own manifest
        // values and timeline handling below.
        if (mpd.getAttribute('type') !== 'dynamic') {
            var minText = mpd.getAttribute('minBufferTime');
            var minSeconds = periodStart(minText);
            if (isFinite(minSeconds) && minSeconds > 10) {
                mpd.setAttribute('minBufferTime', 'PT10.000S');
                console.log('VM manifest minBufferTime ' + minText + ' -> PT10.000S');
            }
        }
        var origin = Date.parse(mpd.getAttribute('availabilityStartTime'));
        if (mpd.getAttribute('type') !== 'dynamic' || !isFinite(origin)) return;
        // This feed grows its rolling DVR window during playback (seen up to
        // 59s), which pushes Shaka's live start point steadily further back.
        // Capping it moves the normal startup point forward without seeking.
        var depthText = mpd.getAttribute('timeShiftBufferDepth');
        var depth = periodStart(depthText);
        if (isFinite(depth) && depth > 49) {
            mpd.setAttribute('timeShiftBufferDepth', 'PT49.000S');
        }
        var periods = mpd.getElementsByTagName('Period');
        if (!periods.length) return;
        var starts = [], timeline = null;
        for (var i = 0; i < periods.length; i++) {
            var start = periodStart(periods[i].getAttribute('start') || (i === 0 ? 'PT0S' : ''));
            if (periods.length === 1 && start === 0) timeline = timelinePlan(periods[i]);
            if (!timeline && (!isFinite(start) || start < day * 365)) return;
            starts.push(start);
        }
        var first = timeline ? timeline.first : Math.min.apply(null, starts);
        if (anchor === null) {anchor = (Math.floor(first / day) - 1) * day;console.log('VM DASH timeline normalized');}
        // Set one shared fragment-clock boundary here. Deriving it later from
        // each SourceBuffer's timestampOffset lets small per-track differences
        // select different days, which desynchronises audio from video.
        sharedShift = Math.floor(anchor / day) * day;
        if (first < anchor) return;
        mpd.setAttribute('availabilityStartTime', new Date(origin + anchor * 1000).toISOString());
        var out = [];
        if (timeline) {
            timeline.tracks.forEach(function (track) {
                track.template.setAttribute('presentationTimeOffset', String(track.pto + anchor * track.scale));
                out.push(track.template.getAttribute('presentationTimeOffset'));
            });
        } else {
            for (i = 0; i < periods.length; i++) {
                periods[i].setAttribute('start', 'PT' + (starts[i] - anchor).toFixed(6) + 'S');
                out.push(periods[i].getAttribute('start'));
            }
        }
    }

    function offset(buffer, seconds) {
        if (active() && anchor !== null) {
            buffer.rteOffset = seconds;
            if (typeof buffer.vmFixedOffset !== 'number') buffer.timestampOffset = seconds + (buffer.rteShift || 0);
        } else {
            delete buffer.rteOffset;
            delete buffer.rteShift;
            delete buffer.vmFixedOffset;
            buffer.timestampOffset = seconds;
        }
    }

    // Shaka supplies a separate SourceBuffer for each MP4 track. An init segment
    // gives its timescale in mdhd. Media fragments carry decode times in tfdt.
    function fragmentTimes(bytes, view, buffer) {
        var positions = [];
        function walk(start, end, depth) {
            if (depth > 5) return;
            for (var p = start; p + 8 <= end;) {
                var size = view.getUint32(p);
                if (!size) size = end - p;
                if (size < 8 || p + size > end) return;
                var kind = String.fromCharCode(bytes[p+4], bytes[p+5], bytes[p+6], bytes[p+7]);
                if (kind === 'mdhd') {
                    var field = p + (bytes[p+8] === 1 ? 28 : 20);
                    if (field + 4 <= p + size) buffer.rteScale = view.getUint32(field);
                } else if (kind === 'hdlr' && size >= 20) {
                    var handler = String.fromCharCode(bytes[p+16], bytes[p+17], bytes[p+18], bytes[p+19]);
                    if (handler === 'soun' || handler === 'vide') buffer.vmKind = handler;
                } else if (kind === 'tfdt' && size >= 20 && bytes[p+8] === 1) {
                    positions.push(p + 12);
                } else if (kind === 'moov' || kind === 'trak' || kind === 'mdia' || kind === 'moof' || kind === 'traf') {
                    walk(p + 8, p + size, depth + 1);
                }
                p += size;
            }
        }
        walk(0, bytes.length, 0);
        return positions;
    }

    function append(buffer, data) {
        if (!active() || anchor === null || typeof buffer.rteOffset !== 'number') {
            buffer.appendBuffer(data);
            return;
        }
        var bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var positions = fragmentTimes(bytes, view, buffer);
        var scale = buffer.rteScale;
        if (positions.length && scale) {
            // Rewrite every track to the same manifest-derived boundary and
            // pin all tracks to one presentation baseline. Shaka can assign
            // audio and video offsets a whole day apart even when the segment
            // times are aligned, so its per-track offset cannot be trusted.
            var candidate = sharedShift;
            var times = positions.map(function (p) { return view.getUint32(p) * uint32 + view.getUint32(p + 4); });
            var first = times[0] / scale;
            var shift = 0;
            var initial = typeof buffer.vmFixedOffset !== 'number';
            if (!initial) {
                if (first > buffer.vmFirst + 0.5) {
                    var gap = first - buffer.vmFirst;
                    if (gap < 30) buffer.vmSegmentDuration = gap;
                }
                // A track switch must not retune the clock. Rewriting tfdt
                // makes this TV seek back to the segment's original time,
                // which disturbs video. New audio is appended on its natural
                // timeline and replaces the old track as the buffer drains.
                buffer.vmFirst = first;
            }
            var ticks = (candidate - (buffer.vmTimeShift || 0)) * scale;
            if (candidate > day * 365 && times.every(function (t) { return t >= ticks && t - ticks < scale * day * 30; })) {
                shift = candidate;
                var copy = new Uint8Array(bytes.length);
                copy.set(bytes);
                var output = new DataView(copy.buffer);
                positions.forEach(function (p, index) {
                    var relative = times[index] - ticks;
                    output.setUint32(p, Math.floor(relative / uint32));
                    output.setUint32(p + 4, relative % uint32);
                });
                data = copy;
                if (initial) {
                    if (baseline === null) baseline = first - candidate;
                    buffer.vmFixedOffset = baseline - first + candidate;
                    buffer.vmTimeShift = 0;
                    buffer.vmFirst = first;
                    buffer.timestampOffset = buffer.vmFixedOffset;
                }
            }
            buffer.rteShift = shift;
        }
        buffer.appendBuffer(data);
    }

    window.vmTimeline = {legacyEme:legacy, active:active, manifest:manifest, offset:offset, append:append,
        reset:function(){anchor=null;sharedShift=0;baseline=null;
            var videos=document.getElementsByTagName('video'),i,buffers;
            for(i=0;i<videos.length;i++){
                try{buffers=videos[i].webkitSourceBuffers||videos[i].sourceBuffers||[];}catch(ignore){continue;}
                for(var j=0;j<buffers.length;j++) delete buffers[j].vmTimeShift;
            }
        }};
}());
