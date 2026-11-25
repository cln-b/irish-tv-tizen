import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../build/tv/', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const handlerSource = read('whitelabel/app/release/1.172.0/static/script/services/playback/handlers/trackmanagement/shakatrackmanagementhandler.js');
const pickerSource = read('whitelabel/app/release/1.172.0/static/script/appui/widgets/player/languagepicker.js');
const utilsSource = read('whitelabel/app/release/1.172.0/static/script/utils/utils.js');
const shakaSource = read('core/1.16.0/tal/static/script/devices/mediaplayer/shaka.js');

// The names and ids below describe the supplied Coronation Street MPD only as
// test data. None of these values may appear in the player sources.
const forbidden = [/English \(AD\)/, /\(ad\)/i, /audio_description_tag/,
  /getLegacy_audioDescriptionPreferred/, /isAudioDescriptionTrack/];
for (const [name, source] of Object.entries({handler: handlerSource, picker: pickerSource, utils: utilsSource, shaka: shakaSource})) {
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${name} must not use name/label/legacy AD heuristics`);
}

function variants(activeVideoId = 3) {
  const tracks = [];
  for (let videoId = 1; videoId <= 5; videoId++) {
    tracks.push({id: tracks.length, active: false, audioId: 6, videoId, language: 'en', label: 'English', height: 720, bandwidth: 2000000});
    tracks.push({id: tracks.length, active: false, audioId: 7, videoId, language: 'en', label: 'English AD', height: 720, bandwidth: 2000000});
  }
  const active = tracks.find((track) => track.videoId === activeVideoId && track.audioId === 6);
  active.active = true;
  return tracks;
}

function basePrototype(storage) {
  return {
    init() {},
    getPlayer() { return this.player; },
    getUserAudioPreference() { return storage.preference; },
    setUserAudioPreference(value) { storage.savedPreference = value; },
    setUserSubtitlePreference() {},
    getUserSubtitlePreference() { return ''; },
    getLegacy_subtitlesEnabled() { return false; },
    getLegacy_audioDescriptionPreferred() { return false; }
  };
}

function loadHandler(allVariants, preference = '') {
  const storage = {preference};
  const base = basePrototype(storage);
  const extend = (methods) => {
    for (const name of Object.keys(methods)) {
      if (typeof methods[name] === 'function') methods[name].base = base[name] || function () {};
    }
    function Handler() {}
    Handler.prototype = Object.assign(Object.create(base), methods);
    return Handler;
  };
  let Handler;
  const sandbox = {
    console,
    window: {},
    setTimeout,
    define(name, deps, factory) { Handler = factory({extend}, {setRules() {}}, {}); }
  };
  vm.runInNewContext(handlerSource, sandbox, {filename: 'shakatrackmanagementhandler.js'});
  const handler = new Handler();
  const selection = {calls: []};
  handler.player = {shaka: {
    getVariantTracks() { return allVariants; },
    getTextTracks() { return []; },
    configure(config) { selection.config = config; },
    selectVariantTrack(track, clearBuffer) { selection.calls.push({track, clearBuffer}); },
    addEventListener() {},
    removeEventListener() {},
    setTextTrackVisibility() {}
  }};
  handler.init();
  return {handler, selection, storage};
}

const allVariants = variants();
const {handler, selection, storage} = loadHandler(allVariants);
const tracks = handler.getAudioTracks();

// Every MPD audio AdaptationSet is represented once; the ten Shaka variants
// collapse to two tracks by their runtime audio identity, not by a name.
assert.equal(tracks.length, 2);
const json = (value) => JSON.stringify(value);
assert.equal(json(tracks.map((track) => track.label)), json(['English', 'English AD']));
assert.equal(json(tracks.map((track) => track.audioId)), json([6, 7]));
assert.equal(json(tracks.map((track) => track.videoId)), json([3, 3]), 'each track must keep the active video id');
assert.equal(json(tracks.map((track) => track.roles)), json([[], []]));
assert.ok(tracks.some((track) => track.active));

// Selection must use the exact same-audio/same-video variant and no clear.
handler.setActiveAudioTrack(1, tracks[1].language, 'main', tracks[1].label, tracks[1]);
assert.equal(selection.calls.length, 1);
assert.equal(selection.calls[0].clearBuffer, false);
assert.equal(selection.calls[0].track.audioId, 7);
assert.equal(selection.calls[0].track.videoId, 3);
assert.equal(storage.savedPreference, 'en:main~7~English%20AD');
assert.doesNotMatch(handlerSource, /clearBuffer|timestampOffset/);

// A stored preference resolves through identity/label/identity-only data
// without any knowledge of track names. The selected track differs from the
// active one, so a variant change is required.
for (const preference of ['en:main~7~English AD', 'en:main~~English AD', 'en:main~7']) {
  const installed = loadHandler(allVariants, preference);
  installed.handler.applyExistingUserAudioPreference();
  assert.equal(installed.selection.calls.length, 1, `preference ${preference} must select a variant`);
  assert.equal(installed.selection.calls[0].track.audioId, 7);
  assert.equal(installed.selection.calls[0].track.videoId, 3);
  assert.equal(installed.selection.calls[0].clearBuffer, false);
}

const unknown = loadHandler(allVariants, 'fr:main');
unknown.handler.applyExistingUserAudioPreference();
assert.equal(unknown.selection.calls.length, 0, 'a fallback that resolves to the already active audio must not call selectVariantTrack again');
assert.match(decodeURIComponent(unknown.storage.savedPreference), /English/, 'unknown preferences must still fall back to the first enumerated track');

// Restoring a preference that already matches the active audio identity must
// not issue a second startup selectVariantTrack against the same video track.
const alreadySelected = loadHandler(allVariants, 'en:main~6~English');
alreadySelected.handler.applyExistingUserAudioPreference();
assert.equal(alreadySelected.selection.calls.length, 0, 'matching startup audio must not be selected twice');
assert.match(handlerSource, /this\._vmAudioKey\(target\)===this\._vmAudioKey\(active\)&&target\.videoId===active\.videoId/);

// Drive the generated picker with the same two tracks. Button labels are the
// MPD labels verbatim, ids are unique, and selection forwards the exact track.
function loadPicker(audioTracks) {
  let module;
  const widgets = [];
  const buttons = [];
  const labels = [];
  const calls = [];
  class Widget {
    constructor(id) { this.id = id; this.children = []; this.listeners = {}; widgets.push(this); }
    addClass() {}
    appendChildWidget(widget) { this.children.push(widget); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  }
  class Button extends Widget {
    constructor(id) { super(id); buttons.push(this); }
  }
  class Label extends Widget {
    constructor(id, text) { super(id); this.text = text; labels.push(this); }
  }
  Widget.extend = (methods) => methods;
  const deps = [Widget, Widget, Widget, Button, Label, {}, {}, {
    localiser: {getString(key, fallback) { return fallback === undefined ? key : fallback; }},
    sanitiseStringForCSSid(value) { return String(value); },
    getQParams() { return {}; }
  }];
  const sandbox = {
    console,
    window: {},
    setInterval() { return 0; },
    clearInterval() {},
    clearTimeout() {},
    define(name, dependencyNames, factory) { module = factory(...deps); }
  };
  vm.runInNewContext(pickerSource, sandbox, {filename: 'languagepicker.js'});
  const picker = Object.create(module);
  picker.id = 'languagePicker';
  picker.languageButtons = [];
  picker.subtitleButtons = [];
  picker.closeCallback = () => {};
  picker.errorCallback = () => {};
  picker.setStyles = () => {};
  picker.getClasses = () => [];
  picker.removeChildWidgets = () => {};
  picker.assertCapability = () => {};
  picker.updateInstructions = () => {};
  picker.updateSubtitlePrompt = () => {};
  picker.appendChildWidget = (widget) => { widgets.push(widget); };
  picker.service = {
    getAudioTracks() { return audioTracks; },
    getSubtitleTracks() { return []; },
    setActiveAudioTrack(...args) { calls.push(args); },
    setActiveSubtitle() {},
    getActiveAudioTrackIndex() { return 0; },
    getActiveSubtitleIndex() { return -1; }
  };
  const device = {createContainer(id) { return new Widget(id); }, appendChildElement() {}};
  picker.render(device);
  return {buttons, labels, calls};
}

const picked = loadPicker(tracks);
const audioLabels = picked.labels.map((label) => label.text).filter((text) => text === 'English' || text === 'English AD');
assert.equal(json(audioLabels), json(['English', 'English AD']));
assert.equal(picked.buttons[0].id, 'enmainButton', 'the first main English button must keep the theme detection id');
assert.equal(new Set(picked.buttons.map((button) => button.id)).size, picked.buttons.length, 'picker ids must be unique');
assert.equal(picked.buttons.length, 4, 'two audio tracks, subtitles off and close');
picked.buttons[0].listeners.select[0]();
picked.buttons[1].listeners.select[0]();
assert.deepEqual(picked.calls.map((call) => call[0]), [0, 1]);
assert.strictEqual(picked.calls[0][4], tracks[0]);
assert.strictEqual(picked.calls[1][4], tracks[1]);
assert.match(pickerSource, /e=t\.label/);

console.log('PASS MPD audio tracks are enumerated generically and selected by exact identity');
