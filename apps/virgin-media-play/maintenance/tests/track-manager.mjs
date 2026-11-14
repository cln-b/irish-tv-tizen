import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/services/playback/trackmanager.js',import.meta.url),'utf8');
let selected;
function load(native,shaka){
 const window=native?{vmAvPlay:{},webapis:{avplay:{}}}:{};
 vm.runInNewContext(source,{window,define(name,deps,factory){selected=factory({getCurrentApplication:()=>({getDevice:()=>({getMediaPlayer:()=>({shaka})})})},class ShakaHandler{constructor(){this.type='shaka';}},class NativeHandler{constructor(){this.type='html5';}});}});
 return selected.type;
}
assert.equal(load(true,null),'shaka','AVPlay must use the native-aware bridge before asynchronous Shaka initialization completes');
assert.equal(load(false,{}),'shaka');assert.equal(load(false,null),'html5');
console.log('PASS asynchronous engine loading cannot permanently select the empty hidden-video track handler for AVPlay');
