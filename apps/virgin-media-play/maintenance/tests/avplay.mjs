import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const calls=[];let listener,prepared,state='NONE',appState='NONE',release,source,clock=1000;
const native={
    getState:()=>state,stop(){calls.push('stop');state='IDLE';},close(){calls.push('close');state='NONE';},
    open(url){calls.push('open');assert(['https://example.invalid/live.mpd','https://example.invalid/ad.mp4'].includes(url));source=url;state='IDLE';},
    setListener(value){listener=value;},setDisplayRect(){},setDrm(type,op,data){calls.push('drm');assert.equal(type,'PLAYREADY');assert.equal(op,'SetProperties');assert.equal(JSON.parse(data).LicenseServer,'https://example.invalid/licence?ExpressPlayToken=test');},
    prepareAsync(success){calls.push('prepare');prepared=success;},play(){calls.push('play');state='PLAYING';},
    pause(){state='PAUSED';},seekTo(){},getCurrentTime:()=>12000,getDuration:()=>source.endsWith('.mp4')?20000:0,
    getTotalTrackInfo:()=>[{type:'AUDIO',index:1,extra_info:'{"language":"en"}'},{type:'TEXT',index:3,extra_info:'{"track_lang":"ga"}'}],
    setSilentSubtitle(value){assert(['IDLE','PLAYING','PAUSED'].includes(state),'Do not configure silent subtitles in asynchronous READY');calls.push('silent='+value);},setSelectTrack(type,index){calls.push(type+'='+index);}
};
function element(){return {style:{backgroundColor:'black'},parentNode:null,children:[],appendChild(child){child.parentNode=this;this.children.push(child);},insertBefore(child){child.parentNode=this;this.children.unshift(child);},removeChild(child){child.parentNode=null;this.children.splice(this.children.indexOf(child),1);}};}
const body=element(),root=element();root.parentNode=body;
const window={webapis:{avplay:native},dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync(new URL('../tv/avplay.js',import.meta.url),'utf8'),{
    window,document:{createElement:element},console,Promise,Event,setTimeout,clearTimeout,Date:{now:()=>clock}
});
const helper=window.vmAvPlay;
const driver={vmDetach:new Promise(resolve=>{release=resolve;}),_clearSentinels(){},_toStopped(){appState='STOPPED';calls.push('stopped');},_toBuffering(){appState='BUFFERING';calls.push('buffering');},_toPlaying(){appState='PLAYING';calls.push('playing');},_toPaused(){appState='PAUSED';calls.push('paused');},getState(){return appState;},_toComplete(){calls.push('complete');},_onStatus(){calls.push('status');},_toError(){throw Error('unexpected error');},
    shaka:Object.fromEntries(['getVariantTracks','getTextTracks','selectVariantTrack','selectTextTrack','setTextTrackVisibility'].map(name=>[name,()=>[]]))};
helper.config(driver,{drm:{servers:{'com.microsoft.playready':'https://example.invalid/licence?ExpressPlayToken=test'}}});
assert(helper.wants('application/dash+xml'));assert(helper.wants('video/mp4'));
helper.stage(driver,'video','https://example.invalid/live.mpd','application/dash+xml',root);
helper.begin(driver);
assert(!calls.includes('open'),'native player must wait for the ad detach');
release();await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(calls.filter(s=>['open','drm','prepare'].includes(s)),['open','drm','prepare']);
state='READY';prepared();
assert(calls.includes('play'));assert(calls.includes('playing'));
assert.equal(driver.shaka.getVariantTracks()[0].language,'en');
driver.shaka.selectAudioLanguage('en');assert(calls.includes('AUDIO=1'));
assert.equal(driver.shaka.getTextTracks().length,0,'An advertised TEXT slot alone does not establish subtitle availability');
window.vmSubtitles={tracks:()=>[],candidates:()=>[{id:0,language:'eng',label:'English'}],audioTracks:()=>[
    {id:'714560027',adaptationId:'714560027',language:'eng',label:'English',roles:[]},
    {id:'219062576',adaptationId:'219062576',language:'eng',label:'English AD',roles:[]}
],tick(){},select(){},clear(){},begin:()=>Promise.resolve()};
assert.equal(driver.shaka.getTextTracks()[0]?.label,'English','A DASH text candidate must show its real language before a cue is verified');
driver.shaka.selectTextTrack(driver.shaka.getTextTracks()[0]);
assert(driver.vmTextWanted,'Selecting the subtitle language must enable caption-segment probing');
assert.equal(JSON.stringify(driver.shaka.getVariantTracks().map(track=>track.label)),JSON.stringify(['English','English AD']),'Manifest audio labels must be exposed alongside native indices');
assert.equal(driver.shaka.getVariantTracks()[1].id,2,'An unexposed manifest audio track gets the next native index');
delete window.vmSubtitles;
listener.onsubtitlechange('5000','', '0');assert.equal(driver.shaka.getTextTracks().length,0,'Empty samples must not advertise captions');
listener.onsubtitlechange('5000','News caption<br/>second line', '0');
assert.equal(driver.shaka.getTextTracks().length,1);
helper.selectText(0);
assert.equal(driver.vmSubtitleElement.textContent,'News caption\nsecond line');
assert(!calls.includes('TEXT=3'),'DASH must not call unsupported TEXT track selection');
assert(!calls.includes('silent=false'),'Custom captions require silent native callbacks');
assert(driver.shaka.getTextTracks()[0].active);
driver.shaka.setTextTrackVisibility(false);assert(!driver.shaka.getTextTracks()[0].active);assert.equal(driver.vmSubtitleElement.textContent,'');
// Rolling TTML samples replace the line in place instead of blanking it.
const painted=[];let captionText='';
Object.defineProperty(driver.vmSubtitleElement,'textContent',{configurable:true,
 get(){return captionText;},set(value){captionText=String(value);painted.push(captionText);}});
helper.selectText(0);
listener.onsubtitlechange('160','rolling line','0');
listener.onsubtitlechange('160','rolling line added','0');
assert.equal(captionText,'rolling line added');
assert(!painted.includes(''),'Rolling caption samples must not clear the visible cue');
// Image callbacks must no longer be mistaken for "no subtitles detected".
helper.selectText(0);
listener.onsubtitlechange('5000','https://example.invalid/caption.png','1');
assert.equal(driver.vmSubtitleImage,'https://example.invalid/caption.png');
assert.equal(driver.vmSubtitleElement.children[0].src,'https://example.invalid/caption.png');
helper.selectText(null);
listener.oncurrentplaytime(12000);assert(calls.includes('status'));
driver.vmOwner={vmNativeRecoveryCount:1};
for(let i=1;i<=6;i++){clock+=10000;listener.oncurrentplaytime(12000+i*10000);}
assert.equal(driver.vmOwner.vmNativeRecoveryCount,0,'recovery budget resets only after a minute of advancing playback');
helper.reset(driver);
assert(!driver.vmNative);assert.equal(root.children.length,0);assert.equal(root.style.backgroundColor,'black');
const plays=calls.filter(c=>c==='play').length;
prepared();assert.equal(calls.filter(c=>c==='play').length,plays,'stale prepare completion cannot restart a closed programme');
const licences=calls.filter(c=>c==='drm').length;
const stopsBefore=calls.filter(c=>c==='stop').length;
const opensBefore=calls.filter(c=>c==='open').length;
helper.stage(driver,'video','https://example.invalid/ad.mp4','video/mp4',root);
helper.begin(driver);await new Promise(resolve=>setTimeout(resolve,0));
const flushPrepared=prepared;
state='IDLE';flushPrepared();
await new Promise(resolve=>setTimeout(resolve,210));
assert.equal(calls.filter(c=>c==='open').length,opensBefore+2,'the first MP4 source is opened once to take over stale native audio, then opened for playback');
assert(calls.filter(c=>c==='stop').length>stopsBefore,'native playback must be stopped before opening a new source');
state='READY';prepared();
listener.onstreamcompleted();
assert(!calls.includes('complete'),'ad teardown must wait until the native completion callback returns');
await new Promise(resolve=>setTimeout(resolve,5));
assert(calls.includes('complete'));assert.equal(calls.filter(c=>c==='drm').length,licences,'clear ads do not start DRM');
helper.reset(driver);
// Error teardown must leave Samsung's callback before touching native close,
// emit once, and invalidate any late preparation completion.
let errors=0,inNative=false;
driver._toError=function(){assert(!inNative);errors++;helper.reset(driver);};
helper.stage(driver,'video','https://example.invalid/ad.mp4','video/mp4',root);
helper.begin(driver);await new Promise(resolve=>setTimeout(resolve,0));
inNative=true;listener.onerror('DECODE');listener.onerror('DECODE');inNative=false;
const before=calls.filter(c=>c==='play').length;prepared();
assert.equal(calls.filter(c=>c==='play').length,before);
assert.equal(errors,0);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(errors,1);assert(!driver.vmNative);
// A VOD resume waits for the actual seek callback before play. Its first
// following clock is recorded, and a callback from a closed source is ignored.
let seekDone;
native.seekTo=function(target,success){assert.equal(target,30000);seekDone=success;};
helper.stage(driver,'video','https://example.invalid/live.mpd','application/dash+xml',root);
helper.begin(driver,30);await new Promise(resolve=>setTimeout(resolve,0));state='READY';
const beforeResume=calls.filter(c=>c==='play').length;prepared();assert(seekDone);
assert.equal(calls.filter(c=>c==='play').length,beforeResume);
seekDone();assert.equal(calls.filter(c=>c==='play').length,beforeResume+1);
assert(driver.vmSeekPending.completed);listener.oncurrentplaytime(30000);assert.equal(driver.vmSeekPending,null);
helper.reset(driver);seekDone();assert.equal(calls.filter(c=>c==='play').length,beforeResume+1);
// A completed seek while paused must leave BUFFERING. Otherwise the upstream
// max-buffering monitor fires and replaces playback with Media Source Error.
helper.stage(driver,'video','https://example.invalid/live.mpd','application/dash+xml',root);
helper.begin(driver);await new Promise(resolve=>setTimeout(resolve,0));state='READY';prepared();
const pausedCount=calls.filter(c=>c==='paused').length;
state='PAUSED';appState='BUFFERING';listener.onbufferingcomplete();
assert.equal(calls.filter(c=>c==='paused').length,pausedCount+1);
assert.equal(appState,'PAUSED');
helper.reset(driver);
console.log('PASS native ad handoff, PlayReady configuration, track bridge, paused seek and cancelled playback cleanup');
