import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let methods,release;
const events=[];
function video(name){return {style:{},removeEventListener(){},removeAttribute(){events.push(name+' remove source');},load(){events.push(name+' load');}};}
const old=video('old'),next=video('next');
const device={removeElement(){events.push('old removed');},_createElement(){return next;}};
vm.runInNewContext(fs.readFileSync(new URL('../build/tv/core/1.16.0/tal/static/script/devices/mediaplayer/shaka.js',import.meta.url),'utf8'),{
    console,Promise,define(_name,_deps,factory){factory({getDevice:()=>device},function Device(){},{TYPE:{AUDIO:'audio',LIVE_AUDIO:'liveaudio'},extend(spec){methods=spec;return function Driver(){};}});}
});
const driver={log(){},_mediaElement:old,vmDetach:new Promise(resolve=>{release=resolve;}),shaka:{attach(){events.push('next attached');return Promise.resolve();}}};
methods._destroyMediaElement.call(driver);
assert.equal(driver._mediaElement,undefined);
assert.deepEqual(events,[],'old native source stays alive until detach completes');
methods.createMediaElement.call(driver,'video',device);
assert.deepEqual(events,[],'next native attach waits for the previous detach');
release();await driver.vmAttach;
assert.deepEqual(events,['old remove source','old load','old removed','next attached']);
driver._startPlayback=()=>events.push('next started');
methods._cleanupAndStartPlayback.call(driver,true);
await Promise.resolve();await Promise.resolve();
assert.equal(events.at(-1),'next started');
assert.equal(events.filter(e=>e==='next load').length,0,'starting Shaka does not reset its native media source');
console.log('PASS ad video release, next attachment and playback are serialized');
