import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let release,prepared,state='NONE',closes=0,throwStop=false;const opened=[],quality=[];
const api={getState:()=>state,stop(){if(throwStop)throw Error('Native stop failed');state='IDLE';},close(){closes++;state='NONE';},open(url){opened.push(url);state='IDLE';},setSilentSubtitle(){},setListener(){},setDisplayRect(){},prepareAsync(callback){prepared=callback;},play(){state='PLAYING';},getCurrentTime:()=>0,getDuration:()=>0};
function element(){return {style:{},parentNode:null,insertBefore(child){child.parentNode=this;},appendChild(child){child.parentNode=this;},removeChild(child){child.parentNode=null;}};}
const window={webapis:{avplay:api},vmQuality:{resolve(driver,source){quality.push(source);return Promise.resolve();},apply(){},clear(){}},dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync('tv/avplay.js','utf8'),{window,document:{createElement:element},console,Promise,Event,setTimeout,clearTimeout});
const helper=window.vmAvPlay,root=element();
function driver(){return {_clearSentinels(){},_toStopped(){},_toBuffering(){},_toPlaying(){},_toError(){throw Error('Unexpected playback failure');}};}
const old=driver(),next=driver();old.vmDetach=new Promise(resolve=>{release=resolve;});
helper.stage(old,'video','https://example.invalid/cancelled.mpd','application/dash+xml',root);helper.begin(old);helper.reset(old);
helper.stage(next,'video','https://example.invalid/current.mpd','application/dash+xml',root);helper.begin(next);
await new Promise(resolve=>setTimeout(resolve,0));prepared();
release();await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(quality,['https://example.invalid/current.mpd'],'Cancelled setup must not replace the current source quality state');
assert.deepEqual(opened,['https://example.invalid/current.mpd']);
const beforeOldReset=closes;helper.reset(old);assert.equal(closes,beforeOldReset,'A retired driver must not close the replacement native session');assert.equal(state,'PLAYING');
throwStop=true;const before=closes;helper.reset(next);
assert.equal(closes,before+1,'Native close must still run when stop throws');
console.log('PASS cancelled source isolation and native close after stop failure');
