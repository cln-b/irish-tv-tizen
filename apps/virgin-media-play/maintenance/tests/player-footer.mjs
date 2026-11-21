import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let methods;
const base = {extend(spec) { methods = spec; return function () {}; }};
vm.runInNewContext(fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/widgets/playerfooter.js', import.meta.url), 'utf8'), {
    console,
    define(_name, _dependencies, factory) {
        factory(base, function () {}, function () {}, function () {}, function () {}, function () {}, function () {}, function () {});
    }
});
assert(methods && typeof methods.onLanguageSelect === 'function', 'Player footer language control must be present');

const events = [];
const footer = {
    hidden: true,
    playerComponent: {
        showUI() { events.push('showUI'); },
        showLanguagePicker() { events.push('menu'); }
    }
};
methods.onLanguageSelect.call(footer);
assert.equal(JSON.stringify(events), JSON.stringify(['showUI']), 'First OK with hidden controls must restore the overlay, not open subtitles');
events.length = 0;
footer.hidden = false;
methods.onLanguageSelect.call(footer);
assert.equal(JSON.stringify(events), JSON.stringify(['showUI', 'menu']), 'Visible controls must still open the subtitle panel');
console.log('PASS hidden player controls consume OK before opening the subtitle panel');
