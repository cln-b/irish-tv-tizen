import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {parse} from 'acorn';

// Use the real bundled Kotlin collection and the actual generated selector.
const upstream = fs.readFileSync(new URL('../upstream/vestel/_next/static/chunks/pages/_app-d698cd0395626efb.js', import.meta.url), 'utf8');
const tree = parse(upstream, {ecmaVersion:'latest'});
const modules = tree.body[0].expression.arguments[0].elements[1].properties;
const factory = modules.find(p => p.key.value === 7212).value;
const module = {exports:{}};
vm.runInNewContext('(' + upstream.slice(factory.start, factory.end) + ')')(module);
const createMap = module.exports.$_$.h;
const built = fs.readFileSync(new URL('../build/vestel/_next/static/chunks/pages/_app-d698cd0395626efb.js', import.meta.url), 'utf8');
const start = built.indexOf('function $w(e,t,n){');
assert.ok(start >= 0);
const end = built.indexOf('function Mw(', start);
const select = vm.runInNewContext('(' + built.slice(start, end) + ')', {Mn:s=>s.length, Error});
const entry = {j1q_1:true, k1q_1:'fresh_{format}_logo', l1q_1:'#FF647F', m1q_1:true};
function state(map) { return {v16_1:{a17_1:{x18_1:map}}, depsState:{log(){}}}; }
const map = createMap();
map.h2('rtejr', entry);
const app = state(map);
assert.equal(select('RTEJr', app, x=>x.k1q_1), 'fresh_{format}_logo');
assert.equal(select('other', app, x=>x.k1q_1), null);
// Reproduce the observed condition: entries survive but the hash lookup misses.
map.s3_1.i6_1.fill(0);
assert.equal(map.w1('rtejr'), null);
assert.ok(String(map).includes('rtejr'));
assert.equal(select('RTEJr', app, x=>x.k1q_1), 'fresh_{format}_logo');
assert.equal(select('RTEJr', app, x=>x.l1q_1), '#FF647F');
assert.equal(select('RTEJr', app, x=>x.m1q_1), true);
entry.j1q_1 = false;
assert.equal(select('RTEJr', app, x=>x.k1q_1), null);
entry.j1q_1 = true;
entry.k1q_1 = '';
assert.equal(select('RTEJr', app, x=>x.k1q_1), null);
assert.equal(select('RTEJr', state(createMap()), x=>x.k1q_1), null);
console.log('PASS actual Kotlin map/selector, missing-key fallback, config-driven artwork, disabled and absent overrides');

const window = {__rteBase:'/rpng-static/ctv/vestel', addEventListener(){}, setTimeout(){}};
vm.runInNewContext(fs.readFileSync(new URL('../widget/compat.js', import.meta.url), 'utf8'), {
    window, document:{addEventListener(){}}, setTimeout(){}, clearTimeout(){}
});
const widget = window.rteWidget;
const svg = 'https://example.org/channel_regular_logo.svg?version=2#art';
assert.equal(widget.channelLogo(svg), 'https://example.org/channel_regular_logo.png?version=2#art');
assert.equal(widget.channelLogo('https://example.org/channel.png'), 'https://example.org/channel.png');
assert.equal(widget.channelLogo(undefined), undefined);
let assignments=0;
const image={value:widget.channelLogo(svg),getAttribute(){return this.value},set src(value){this.value=value;assignments++}};
widget.channelLogoError(image, svg);
assert.equal(image.value, svg);
widget.channelLogoError(image, svg);
assert.equal(assignments, 1);
assert.ok(built.includes('src:window.rteWidget.channelLogo(o),onError:'));
console.log('PASS regular PNG selection, original SVG fallback without retry loops, and built component integration');
