import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {parse}from 'acorn';
const root=new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/player/',import.meta.url);
const code=fs.readFileSync(new URL('live.js',root),'utf8');let init;
function walk(x){if(!x||typeof x!=='object')return;if(x.type==='Property'&&x.key.name==='init')init=x.value;for(const v of Object.values(x))if(Array.isArray(v))v.forEach(walk);else walk(v);}walk(parse(code,{ecmaVersion:5}));
function instance(native){const window=native?{vmAvPlay:{},webapis:{avplay:{}}}:{};const fn=vm.runInNewContext('('+code.slice(init.start,init.end)+')',{window,console});fn.base=()=>{};const component={deviceRaisesSpuriousBufferingEvents:()=>false};fn.call(component);return component;}
assert.equal(instance(true).MAX_RECOVERY_ATTEMPTS,0,'The actual live subclass must not override AVPlay with fresh-stream retries');
assert.equal(instance(false).MAX_RECOVERY_ATTEMPTS,3,'Leave the upstream non-native player policy unchanged');
console.log('PASS actual live component disables fresh acquisition retries for AVPlay');
