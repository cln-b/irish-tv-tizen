import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/utils/utils.js', import.meta.url), 'utf8');
const buildScript = fs.readFileSync(new URL('../tools/build-tv.mjs', import.meta.url), 'utf8');
const hiddenTitle = ' ';
const preserved = 't.originalTitle=t.title&&" "!==t.title?t.title:t.originalTitle||t.title';

assert.ok(source.includes(preserved), 'Post-parse must preserve originalTitle when a tile title was already hidden');
assert.doesNotMatch(source, /originalTitle=t\.title\}\)\)\}/,
  'Post-parse must not overwrite the recovered title with the hidden placeholder');
assert.match(buildScript, /Post-parse title anchor changed/, 'Build must guard the post-parse title anchor');

const method = source.match(/postParseContentData:function\(t\)\{(.+?)\},calculateLuminance:function/);
assert(method, 'Built utils must expose postParseContentData');
const postParseContentData = new Function('t', method[1]);

const title = "I'm a Celebrity... Get Me Out Of Here!";
const tile = {title};
const data = {sections: [{tiles: [tile]}]};
postParseContentData(data);
assert.equal(tile.originalTitle, title, 'First render must record the real original title');

tile.title = hiddenTitle;
postParseContentData(data);
assert.equal(tile.originalTitle, title,
  'Return render must not replace originalTitle with the hidden title placeholder');
assert.equal(tile.title, hiddenTitle, 'Hidden title placeholder itself must remain unchanged');

const renamed = {title: 'A real new title', originalTitle: 'Old title'};
postParseContentData({sections: [{tiles: [renamed]}]});
assert.equal(renamed.originalTitle, renamed.title,
  'A real title change must still refresh originalTitle');

console.log('PASS tile footer titles survive a Home return');
