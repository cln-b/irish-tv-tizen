// Verify DASH subtitle tracks from the manifest/caption segments and render
// cues when Samsung AVPlay does not deliver usable onsubtitlechange events.
(function () {
    var cache = {};
    var resolver = document.implementation.createHTMLDocument('');
    var resolverBase = resolver.createElement('base');
    var resolverLink = resolver.createElement('a');
    resolver.head.appendChild(resolverBase);

    function name(node) {
        return String((node && (node.localName || node.nodeName)) || '').split(':').pop();
    }
    function children(node, tag) {
        var result = [], nodes = node && node.childNodes ? node.childNodes : [];
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 1 && (!tag || name(nodes[i]) === tag)) result.push(nodes[i]);
        }
        return result;
    }
    function first(node, tag) { return children(node, tag)[0] || null; }
    function attr(node, key) { return node && node.getAttribute ? String(node.getAttribute(key) || '') : ''; }
    function absolute(base, path) {
        if (!path) return '';
        resolverBase.href = base || '';
        resolverLink.href = path;
        return resolverLink.href;
    }
    function baseFor(base, node) {
        var element = first(node, 'BaseURL');
        return element ? absolute(base, String(element.textContent || '').trim()) : base;
    }
    function clock(value) {
        var text = String(value || '').trim();
        if (!text) return 0;
        var match = /^([0-9]+(?:\.[0-9]+)?)s$/i.exec(text);
        if (match) return Number(match[1]);
        if (/^[0-9]+(?:\.[0-9]+)?$/.test(text)) return Number(text);
        var parts = text.split(':').map(Number);
        if (parts.some(function (part) { return !isFinite(part); })) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0];
    }
    function isoSeconds(value) {
        var match = /^P(?:([0-9]+(?:\.[0-9]+)?)D)?(?:T(?:([0-9]+(?:\.[0-9]+)?)H)?(?:([0-9]+(?:\.[0-9]+)?)M)?(?:([0-9]+(?:\.[0-9]+)?)S)?)?$/.exec(String(value || 'PT0S'));
        if (!match) return 0;
        return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
    }
    function language(lang) {
        var names = { en: 'English', eng: 'English', ga: 'Irish', gle: 'Irish', cy: 'Welsh', cym: 'Welsh' };
        return names[String(lang || '').toLowerCase()] || lang || 'Subtitles';
    }
    function expand(template, token, value) {
        var pattern = new RegExp('\\$' + token + '(?:%0([0-9]+)d)?\\$', 'g');
        return template.replace(pattern, function (unused, width) {
            var result = String(value);
            while (width && result.length < Number(width)) result = '0' + result;
            return result;
        });
    }
    function mediaUrl(template, segment) {
        var result = template;
        result = expand(result, 'RepresentationID', segment.representation);
        result = expand(result, 'Bandwidth', segment.bandwidth);
        result = expand(result, 'Number', segment.number);
        result = expand(result, 'Time', segment.time);
        return result;
    }
    function timeline(template, scale, startNumber) {
        var node = first(template, 'SegmentTimeline'), entries = [], time = null, number = Number(startNumber || 1);
        if (!node) return null;
        children(node, 'S').forEach(function (item) {
            if (item.hasAttribute('t')) time = Number(attr(item, 't'));
            if (!isFinite(time)) return;
            var duration = Number(attr(item, 'd')), repeat = Number(attr(item, 'r') || 0);
            if (!isFinite(duration) || duration <= 0 || !isFinite(repeat) || repeat < 0) return;
            for (var i = 0; i <= repeat && i < 10000; i++) {
                entries.push({ key: 'n' + number + 't' + time, number: number, time: time, duration: duration });
                number++;
                time += duration;
            }
        });
        return entries.length && scale > 0 ? { entries: entries } : null;
    }
    function parseManifest(xml, source) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length || !doc.documentElement) throw Error('Invalid subtitle manifest');
        var root = doc.documentElement, tracks = [], periods = children(root, 'Period');
        var rootBase = baseFor(source, root);
        periods.forEach(function (period, periodIndex) {
            var periodStart = isoSeconds(attr(period, 'start') || 'PT0S');
            var periodBase = baseFor(rootBase, period);
            children(period, 'AdaptationSet').forEach(function (adaptation) {
                var mime = attr(adaptation, 'mimeType'), contentType = attr(adaptation, 'contentType');
                var codecs = attr(adaptation, 'codecs');
                var roles = children(adaptation, 'Role').map(function (role) { return attr(role, 'value').toLowerCase(); });
                var text = contentType === 'text' || /vtt|ttml|stpp|text\/plain/i.test(mime + ' ' + codecs) ||
                    roles.some(function (role) { return role === 'caption' || role === 'subtitle'; });
                if (!text) return;
                var reps = children(adaptation, 'Representation');
                if (!reps.length) reps = [adaptation];
                reps.forEach(function (rep) {
                    var template = first(rep, 'SegmentTemplate') || first(adaptation, 'SegmentTemplate') || first(period, 'SegmentTemplate') || first(root, 'SegmentTemplate');
                    if (!template) return;
                    var scale = Number(attr(template, 'timescale') || 1) || 1;
                    var pto = Number(attr(template, 'presentationTimeOffset') || 0) || 0;
                    var startNumber = Number(attr(template, 'startNumber') || 1) || 1;
                    var media = attr(template, 'media'), base = baseFor(baseFor(periodBase, adaptation), rep);
                    if (!media) return;
                    var listing = timeline(template, scale, startNumber);
                    var duration = Number(attr(template, 'duration') || 0);
                    if (!listing && duration > 0) listing = { duration: duration };
                    if (!listing) return;
                    var lang = attr(adaptation, 'lang') || attr(rep, 'lang');
                    var key = lang + '|' + roles.join(',');
                    var track = null;
                    for (var i = 0; i < tracks.length; i++) if (tracks[i].key === key) track = tracks[i];
                    if (!track) {
                        track = { id: tracks.length, key: key, language: lang, label: language(lang), verified: false, streams: [] };
                        tracks.push(track);
                    }
                    track.streams.push({
                        key: periodIndex + '|' + tracks.length + '|' + track.streams.length + '|' + media,
                        periodStart: periodStart, scale: scale, pto: pto, startNumber: startNumber,
                        listing: listing, base: base, media: media,
                        representation: attr(rep, 'id'), bandwidth: attr(rep, 'bandwidth') || '0', cache: {}
                    });
                });
            });
        });
        return tracks;
    }
    function parseAudio(xml, source) {
        var doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length || !doc.documentElement) return [];
        var root = doc.documentElement, tracks = [];
        children(root, 'Period').forEach(function (period) {
            children(period, 'AdaptationSet').forEach(function (adaptation) {
                var mime = attr(adaptation, 'mimeType'), contentType = attr(adaptation, 'contentType');
                if (contentType !== 'audio' && !/^audio\//i.test(mime)) return;
                var reps = children(adaptation, 'Representation');
                var rep = reps[0] || adaptation;
                var labelNode = first(adaptation, 'Label') || first(rep, 'Label');
                var label = clean(nodeText(labelNode));
                var lang = attr(adaptation, 'lang') || attr(rep, 'lang');
                var id = attr(adaptation, 'id') || String(tracks.length + 1);
                var roles = children(adaptation, 'Role').map(function (role) { return attr(role, 'value').toLowerCase(); });
                if (!label) label = language(lang);
                for (var i = 0; i < tracks.length; i++) {
                    if (tracks[i].adaptationId === id || (tracks[i].language === lang && tracks[i].label === label)) return;
                }
                tracks.push({ id: id, adaptationId: id, language: lang, label: label, roles: roles });
            });
        });
        return tracks;
    }
    function segmentFor(stream, time) {
        var relative = time - stream.periodStart, listing = stream.listing, scale = stream.scale;
        var entries = listing.entries;
        if (entries) {
            for (var i = 0; i < entries.length; i++) {
                var start = (entries[i].time - stream.pto) / scale;
                if (relative >= start && relative < start + entries[i].duration / scale) {
                    return { key: entries[i].key, number: entries[i].number, time: entries[i].time,
                        start: start, duration: entries[i].duration / scale };
                }
            }
            return null;
        }
        var duration = listing.duration / scale;
        if (!(duration > 0) || relative < 0) return null;
        var number = stream.startNumber + Math.floor((relative + stream.pto / scale) / duration);
        return { key: 'n' + number, number: number, time: (number - stream.startNumber) * listing.duration,
            start: (number - stream.startNumber) * duration - stream.pto / scale, duration: duration };
    }
    function nodeText(node) {
        if (!node) return '';
        if (node.nodeType === 3) return String(node.nodeData || node.data || '');
        if (name(node) === 'br') return '\n';
        var result = '';
        for (var i = 0; i < node.childNodes.length; i++) result += nodeText(node.childNodes[i]);
        return result;
    }
    function clean(text) {
        var decoder = document.createElement('textarea');
        decoder.innerHTML = String(text || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\n{2,}/g, '\n');
        return String(decoder.value || decoder.textContent || '').trim();
    }
    function parseCues(text, segment, stream) {
        var result = [], trimmed = String(text || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
        if (!trimmed) return result;
        // stpp samples can arrive inside an MP4 payload; recover the TTML XML
        // rather than asking the XML parser to consume the binary container.
        var wrapped = /<tt\b[\s\S]*<\/tt>/i.exec(trimmed);
        if (wrapped) trimmed = wrapped[0];
        else {
            var paragraphs = /<p\b[\s\S]*<\/p>/i.exec(trimmed);
            if (paragraphs) trimmed = '<tt>' + paragraphs[0] + '</tt>';
        }
        var offset = stream ? Number(stream.pto || 0) / (Number(stream.scale) || 1) : 0;
        function inSegment(cue) {
            return cue.start >= segment.start - 0.5 && cue.start < segment.start + segment.duration + 0.5;
        }
        function timing(begin, end, duration) {
            var span = duration > 0 ? duration : segment.duration;
            var media = { start: begin - offset, end: end > 0 ? end - offset : begin - offset + span };
            var relative = { start: segment.start + begin, end: end > 0 ? segment.start + end : segment.start + begin + span };
            var chosen = inSegment(media) ? media : inSegment(relative) ? relative :
                Math.abs(media.start - segment.start) <= Math.abs(relative.start - segment.start) ? media : relative;
            if (chosen.end <= chosen.start) chosen.end = chosen.start + span;
            return chosen;
        }
        if (/^\s*<tt\b/i.test(trimmed) || /<p\b/i.test(trimmed)) {
            var doc = new DOMParser().parseFromString(trimmed, 'application/xml');
            var nodes = doc.getElementsByTagName('*');
            for (var i = 0; i < nodes.length; i++) {
                if (name(nodes[i]) !== 'p') continue;
                var begin = clock(attr(nodes[i], 'begin'));
                var hasEnd = !!(nodes[i].hasAttribute && nodes[i].hasAttribute('end'));
                var end = hasEnd ? clock(attr(nodes[i], 'end')) : 0;
                var duration = clock(attr(nodes[i], 'dur'));
                var body = clean(nodeText(nodes[i])), cueTime = timing(begin, end, duration);
                if (body) result.push({ start: cueTime.start, end: cueTime.end, text: body });
            }
            if (!result.length && /^\s*<tt\b/i.test(trimmed)) {
                var bodyText = clean(nodeText(doc.documentElement));
                if (bodyText) result.push({ start: segment.start, end: segment.start + segment.duration, text: bodyText });
            }
            return result;
        }
        var lines = trimmed.split(/\r?\n/);
        for (var line = 0; line < lines.length; line++) {
            var parts = /^([^\s]+)\s+-->\s+([^\s]+)/.exec(lines[line].trim());
            if (!parts) continue;
            var from = clock(parts[1]), to = clock(parts[2]);
            var caption = [];
            while (line + 1 < lines.length && lines[line + 1].trim()) caption.push(lines[++line].trim());
            var body2 = clean(caption.join('\n'));
            if (!body2 || to <= from) continue;
            var webvtt = timing(from, to, 0);
            result.push({ start: webvtt.start, end: webvtt.end, text: body2 });
        }
        if (!result.length) result.push({ start: segment.start, end: segment.start + segment.duration, text: clean(trimmed) });
        return result;
    }
    function markVerified(driver, track, stream) {
        if (track.verified) return;
        track.verified = true;
        console.log('VM subtitle cues verified lang=' + (track.language || 'und'));
        if (window.vmNativeOptions && window.vmNativeOptions.refresh) window.vmNativeOptions.refresh();
        if (driver.vmTextWanted && !driver.vmTextVisible && window.vmAvPlay && window.vmAvPlay.selectText) {
            try { window.vmAvPlay.selectText(track.id); } catch (ignore) {}
        }
    }
    function restoreVerified(driver, state) {
        if (!driver || !driver.vmTextWanted || driver.vmTextVisible || !state) return;
        for (var i = 0; i < state.tracks.length; i++) {
            var track = state.tracks[i];
            if (!track.verified) continue;
            if (window.vmAvPlay && window.vmAvPlay.restoreText) window.vmAvPlay.restoreText(driver, track.id);
            else driver.vmSubtitleTrackId = track.id;
            driver.vmTextVisible = true;
            return;
        }
    }
    function load(driver, track, stream, segment) {
        var key = stream.key + '|' + segment.key;
        var entry = stream.cache[key];
        if (entry) {
            if (entry.loaded && entry.cues.length && !track.verified) markVerified(driver, track, stream);
            return entry.cues;
        }
        entry = stream.cache[key] = { loaded: false, cues: [] };
        var xhr = new XMLHttpRequest();
        xhr.open('GET', absolute(stream.base, mediaUrl(stream.media, segment)), true);
        xhr.timeout = 5000;
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { entry.cues = parseCues(xhr.responseText, segment, stream); } catch (ignore) {}
            }
            entry.loaded = true;
            if (entry.cues.length) markVerified(driver, track, stream);
            if (window.vmAvPlay && window.vmAvPlay.current) {
                try { tick(driver, window.vmAvPlay.current(driver)); } catch (ignore) {}
            }
        };
        xhr.onerror = xhr.ontimeout = function () { entry.loaded = true; };
        try { xhr.send(); } catch (ignore) { entry.loaded = true; }
        return entry.cues;
    }
    function tick(driver, time) {
        var state = driver && driver.vmSubtitles;
        if (!state || !isFinite(time)) return;
        var track = null, i;
        for (i = 0; i < state.tracks.length; i++) if (state.tracks[i].id === driver.vmSubtitleTrackId) track = state.tracks[i];
        if (!track && driver.vmTextWanted && state.tracks.length) {
            track = state.tracks[0];
            driver.vmSubtitleTrackId = track.id;
        }
        if (!track) return;
        var active = null, activeStream = null;
        for (i = 0; i < track.streams.length; i++) {
            var stream = track.streams[i], segment = segmentFor(stream, time);
            if (!segment) continue;
            var cues = load(driver, track, stream, segment), relative = time - stream.periodStart;
            for (var j = 0; j < cues.length; j++) {
                if (relative >= cues[j].start && relative < cues[j].end) { active = cues[j]; activeStream = stream; break; }
            }
            if (active) break;
        }
        if (!driver.vmTextVisible) return;
        if (active && active.text !== driver.vmSubCueText) {
            driver.vmSubCueText = active.text;
            var remaining = activeStream ? active.end - (time - activeStream.periodStart) : 3;
            if (window.vmAvPlay && window.vmAvPlay.cue) window.vmAvPlay.cue(driver, Math.max(100, remaining * 1000), active.text);
        } else if (!active && driver.vmSubCueText) {
            driver.vmSubCueText = null;
            if (window.vmAvPlay && window.vmAvPlay.cue) window.vmAvPlay.cue(driver, 0, '');
        }
    }
    window.vmSubtitles = {
        begin: function (driver, source) {
            if (!driver || driver._mimeType !== 'application/dash+xml') return Promise.resolve();
            var state = cache[source];
            if (!state) {
                state = cache[source] = { pending: new Promise(function (resolve) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', source, true);
                    xhr.timeout = 5000;
                    function done() { resolve(); }
                    xhr.onload = function () {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                state.tracks = parseManifest(xhr.responseText, source);
                                state.audioTracks = parseAudio(xhr.responseText, source);
                            } catch (error) {
                                console.log('VM subtitle manifest ignored ' + error.name);
                            }
                        }
                        done();
                    };
                    xhr.onerror = xhr.ontimeout = done;
                    try { xhr.send(); } catch (ignore) { done(); }
                }), tracks: [] };
            }
            driver.vmSubtitles = state;
            if (!driver.vmSubtitleTrackId && driver.vmTextWanted && state.tracks.length) driver.vmSubtitleTrackId = state.tracks[0].id;
            return state.pending.then(function () { restoreVerified(driver, state); });
        },
        tracks: function (driver) {
            var state = driver && driver.vmSubtitles;
            if (!state) return [];
            return state.tracks.filter(function (track) { return track.verified; }).map(function (track) {
                return { id: track.id, language: track.language, label: track.label,
                    active: driver.vmTextVisible && driver.vmSubtitleTrackId === track.id,
                    audioRoles: [], roles: [], type: 'text' };
            });
        },
        candidates: function (driver) {
            var state = driver && driver.vmSubtitles;
            if (!state) return [];
            return state.tracks.filter(function (track) { return !track.verified; }).map(function (track) {
                return { id: track.id, language: track.language, label: track.label };
            });
        },
        audioTracks: function (driver) {
            var state = driver && driver.vmSubtitles;
            return state && state.audioTracks ? state.audioTracks : [];
        },
        tick: tick,
        select: function (driver, id) { if (driver) driver.vmSubtitleTrackId = id; },
        clear: function (driver) { if (driver) driver.vmSubCueText = null; }
    };
}());
