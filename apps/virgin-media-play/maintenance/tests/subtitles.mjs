import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function attributes(values) {
    return {
        getAttribute: (key) => (key in values ? String(values[key]) : null),
        hasAttribute: (key) => key in values
    };
}
function element(localName, values = {}, childNodes = []) {
    return Object.assign(attributes(values), { nodeType: 1, localName, childNodes });
}
function text(data) { return { nodeType: 3, data }; }
function mpd(caption) {
    const timeline = element('SegmentTimeline', {}, [element('S', { t: '0', d: '10', r: '0' })]);
    const template = element('SegmentTemplate', {
        timescale: '1', startNumber: '1', media: caption ? 'captions/$Number$.ttml' : 'empty/$Number$.ttml'
    }, [timeline]);
    const rep = element('Representation', { id: 'text', bandwidth: '1000' }, [template]);
    const adaptation = element('AdaptationSet', { contentType: 'text', lang: 'en' }, [rep]);
    const period = element('Period', { start: 'PT0S' }, [adaptation]);
    return element('MPD', {}, [period]);
}
function ttml(body) {
    const p = body ? element('p', { begin: '1', end: '5' }, [text('Caption line')]) : element('p', { begin: '1', end: '5' }, []);
    return element('tt', {}, [p]);
}
function audioAdaptation(id, label) {
    return element('AdaptationSet', { id, mimeType: 'audio/mp4', lang: 'eng' }, [
        element('Label', {}, [text(label)]),
        element('Representation', { id: 'audio', bandwidth: '128000' })
    ]);
}
function stppMpd() {
    const timeline = element('SegmentTimeline', {}, [element('S', { t: '6598', d: '180000', r: '1388' })]);
    const template = element('SegmentTemplate', {
        timescale: '90000', startNumber: '1', presentationTimeOffset: '6598', media: 'captions/$Number$.mp4'
    }, [timeline]);
    const rep = element('Representation', { id: '8', bandwidth: '2000' }, [template]);
    const adaptation = element('AdaptationSet', { mimeType: 'application/mp4', codecs: 'stpp', lang: 'eng' }, [rep]);
    return element('MPD', {}, [element('Period', { start: 'PT0S' }, [
        audioAdaptation('714560027', 'English'), audioAdaptation('219062576', 'English AD'), adaptation
    ])]);
}
function stppTtml(body) {
    const p = body ? element('p', { begin: '00:00:58.073', end: '00:00:58.713' }, [text('Real caption')])
        : element('p', { begin: '00:00:58.073', end: '00:00:58.713' }, []);
    return element('tt', {}, [p]);
}
function contextFor(caption, stpp = false) {
    const requests = [], cues = [], restored = [];
    class XMLHttpRequest {
        open(method, url) { this.url = url; requests.push(url); }
        send() {
            this.status = 200;
            this.responseText = this.url.includes('captions/') ? (stpp ? '\u0000moof\u0000mdat<tt>stpp</tt>' : '<tt>caption</tt>')
                : this.url.includes('empty/') ? '<tt>empty</tt>' : '<mpd />';
            Promise.resolve().then(() => this.onload && this.onload());
        }
    }
    class DOMParser {
        parseFromString(value) {
            if (String(value).indexOf('<tt') >= 0) {
                const root = stpp ? stppTtml(String(value).indexOf('stpp') >= 0) : ttml(String(value).indexOf('caption') >= 0);
                const p = root.childNodes[0];
                return { documentElement: root, getElementsByTagName: () => [p] };
            }
            return { documentElement: stpp ? stppMpd() : mpd(caption), getElementsByTagName: () => [] };
        }
    }
    const resolverState = { base: '', path: '' };
    const document = {
        createElement: (tag) => {
            if (tag === 'base') return { set href(value) { resolverState.base = value; } };
            if (tag === 'a') return {
                set href(value) { resolverState.path = value; },
                get href() { return /^https?:\/\//.test(resolverState.path) ? resolverState.path : new URL(resolverState.path, resolverState.base).href; }
            };
            if (tag === 'textarea') {
                const node = { value: '' };
                Object.defineProperty(node, 'innerHTML', {
                    get() { return node.value; },
                    set(value) { node.value = String(value); }
                });
                Object.defineProperty(node, 'textContent', {
                    get() { return node.value; },
                    set(value) { node.value = String(value); }
                });
                return node;
            }
            return { innerHTML: '', value: '', textContent: '' };
        },
        implementation: { createHTMLDocument: () => ({
            createElement: (tag) => document.createElement(tag),
            head: { appendChild() {} }
        }) }
    };
    const window = {
        vmAvPlay: {
            current: () => stpp ? 58.2 : 2,
            cue(driver, ms, value) { cues.push({ ms, value }); },
            restoreText(driver, id) { restored.push(id); driver.vmSubtitleTrackId = id; driver.vmTextVisible = true; }
        },
        vmNativeOptions: { refresh() {} }
    };
    vm.runInNewContext(fs.readFileSync(new URL('../tv/subtitles.js', import.meta.url), 'utf8'), {
        window, document, DOMParser, XMLHttpRequest, Promise, console, isFinite, Error, RegExp, Number, String, Math, Array, URL
    });
    return { window, requests, cues, restored };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

const working = contextFor(true), driver = {
    _mimeType: 'application/dash+xml', vmTextWanted: true, vmTextVisible: true,
    vmSubtitleTrackId: null, vmSubCueText: null
};
await working.window.vmSubtitles.begin(driver, 'https://example.invalid/programme.mpd');
await flush();
assert.equal(working.window.vmSubtitles.tracks(driver).length, 0, 'An advertised text adaptation is not proof of captions');
working.window.vmSubtitles.tick(driver, 2);
assert(working.requests.some(url => url === 'https://example.invalid/captions/1.ttml'), 'The current caption segment must be fetched');
await flush();
const tracks = working.window.vmSubtitles.tracks(driver);
assert.equal(tracks.length, 1, 'A non-empty TTML cue verifies the subtitle track');
assert.equal(tracks[0].label, 'English');
working.window.vmSubtitles.select(driver, tracks[0].id);
working.window.vmSubtitles.tick(driver, 2);
assert.deepEqual(working.cues, [{ ms: 3000, value: 'Caption line' }], 'The verified cue must be rendered');
// A VOD ad break creates a fresh driver. Its remembered subtitle preference
// must be restored from the verified cache, not wait for another cue callback.
const afterAd = {
    _mimeType: 'application/dash+xml', vmTextWanted: true, vmTextVisible: false,
    vmSubtitleTrackId: null, vmSubCueText: null
};
await working.window.vmSubtitles.begin(afterAd, 'https://example.invalid/programme.mpd');
await flush();
assert.deepEqual(working.restored, [0], 'Subtitles must be restored after an ad-break source handoff');
assert.equal(afterAd.vmTextVisible, true);
assert.equal(afterAd.vmSubtitleTrackId, 0);

const empty = contextFor(false), emptyDriver = {
    _mimeType: 'application/dash+xml', vmTextWanted: false, vmTextVisible: false,
    vmSubtitleTrackId: null, vmSubCueText: null
};
await empty.window.vmSubtitles.begin(emptyDriver, 'https://example.invalid/empty.mpd');
empty.window.vmSubtitles.tick(emptyDriver, 2);
await flush();
assert.equal(empty.window.vmSubtitles.tracks(emptyDriver).length, 0, 'Empty caption segments must not advertise subtitles');
assert.equal(empty.cues.length, 0);

const stpp = contextFor(true, true), stppDriver = {
    _mimeType: 'application/dash+xml', vmTextWanted: true, vmTextVisible: true,
    vmSubtitleTrackId: null, vmSubCueText: null
};
await stpp.window.vmSubtitles.begin(stppDriver, 'https://example.invalid/stpp.mpd');
await flush();
assert.equal(JSON.stringify(stpp.window.vmSubtitles.audioTracks(stppDriver).map(track => track.label)), JSON.stringify(['English', 'English AD']));
stpp.window.vmSubtitles.tick(stppDriver, 58.2);
assert(stpp.requests.includes('https://example.invalid/captions/30.mp4'), 'The real stpp segment number must be derived from the MPD timeline');
await flush();
const stppTracks = stpp.window.vmSubtitles.tracks(stppDriver);
assert.equal(stppTracks.length, 1, 'application/mp4 with codecs=stpp must be recognized as captions');
stpp.window.vmSubtitles.select(stppDriver, stppTracks[0].id);
stpp.window.vmSubtitles.tick(stppDriver, 58.2);
assert(stpp.cues.some(cue => cue.value === 'Real caption'), 'Media-timed TTML cues must be rendered at the playback timestamp');

console.log('PASS manifest-verified subtitles, stpp TTML-in-MP4 timing, cue rendering and empty-segment false-positive guard');
