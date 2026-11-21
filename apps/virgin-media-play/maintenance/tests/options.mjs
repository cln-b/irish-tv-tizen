import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function element(id = '') {
    return {
        id, textContent: '', style: {}, children: [], parentNode: null,
        get firstChild() { return this.children[0]; },
        appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
        insertBefore(child) { child.parentNode = this; this.children.unshift(child); return child; },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
            child.parentNode = null;
            return child;
        },
        getBoundingClientRect() { return { width: 1280, height: 720 }; }
    };
}
function texts(node, result = []) {
    if (node.textContent) result.push(node.textContent);
    (node.children || []).forEach(child => texts(child, result));
    return result;
}
const listeners = { keydown: [], keyup: [], resize: [] }, selections = [], quality = [];
const root = element(), driver = { _mimeType: 'application/dash+xml', vmOptionsRoot: root, vmTextVisible: false };
const helper = {
    active: () => driver,
    audioTracks: () => [
        { id: 1, language: 'en', label: 'English', active: true },
        { id: 2, language: 'en', label: 'English AD', active: false }
    ],
    textTracks: () => [{ id: 0, language: 'en', label: 'English', active: false }],
    selectAudio() {},
    selectText(id) { selections.push(id); driver.vmTextVisible = id !== null; }
};
const window = {
    innerWidth: 1920, innerHeight: 1080,
    addEventListener(type, handler) { listeners[type].push(handler); },
    vmAvPlay: helper,
    vmQuality: {
        choices: () => [{ label: 'Auto', value: 'auto', selected: true }],
        selected: () => 'auto',
        select(value) { quality.push(value); }
    }
};
vm.runInNewContext(fs.readFileSync(new URL('../tv/options.js', import.meta.url), 'utf8'), { window, document: { createElement: () => element() }, console });
function key(keyCode) {
    const event = { keyCode, preventDefault() {}, stopImmediatePropagation() {} };
    listeners.keydown.forEach(handler => handler(event));
    listeners.keyup.forEach(handler => handler(event));
}
assert(window.vmNativeOptions.open());
const panel = root.children.find(child => child.id === 'vm-native-options');
assert(panel, 'The native options panel must be attached to the player root');
const labels = texts(panel);
for (const label of ['Player options', 'Audio', 'Picture quality', 'Subtitles', 'English', 'English AD']) {
    assert(labels.includes(label), `The combined panel must include ${label}`);
}
assert(labels.some(label => label.includes('Off')), 'The combined panel must include a subtitle Off choice');
key(39); key(40); key(13);
assert.deepEqual(selections, [0], 'OK on the Subtitles column must select the verified text track');
assert(texts(panel).some(label => label.includes('\u2713 English')));
key(461);
assert.equal(root.children.length, 0, 'Return must close the native panel');
helper.textTracks = () => [];
assert(window.vmNativeOptions.open());
assert(texts(root.children[0]).includes('No subtitles detected'));
window.vmNativeOptions.close();
helper.textTracks = () => [{ id: 0, label: 'English', active: false }];
assert(window.vmNativeOptions.open());
assert(texts(root.children[0]).includes('English'), 'A DASH text candidate must show its real language');
console.log('PASS combined native options panel, subtitle selection and Return handling');
