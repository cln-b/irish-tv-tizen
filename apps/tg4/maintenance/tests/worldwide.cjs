const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function load(file,context){vm.runInNewContext(fs.readFileSync(path.join(root,'widget',file),'utf8'),context,{filename:file});}
const context={window:{}};load('worldwide.js',context);const worldwide=context.window.tg4Worldwide;
const original={pollIntervalSeconds:30,streams:[{stream:'TG4',streamId:'ireland-id',liveToken:'ireland-token',offsetSeconds:0,state:'ONAIR',currentShow:{title:'Irish-only show',availability:'IRELAND_ONLY'}},{stream:'CULA4',streamId:'cula-id'},{stream:'TG4PLUSONE',streamId:'ireland-id',offsetSeconds:3600}]};
const before=JSON.stringify(original),mapped=worldwide.epg(original);
assert.equal(JSON.stringify(original),before,'Polling input must remain unmodified');
assert.equal(mapped.streams.length,1);assert.equal(mapped.streams[0].streamId,worldwide.providerId);
assert.equal(mapped.streams[0].liveToken,undefined,'Never send Ireland token for Worldwide');
assert.equal(mapped.streams[0].offsetSeconds,0);assert.equal(mapped.streams[0].currentShow.title,'TG4 Worldwide');
assert.equal(mapped.pollIntervalSeconds,30);
const existing=worldwide.epg({streams:[{stream:'TG4',streamId:worldwide.providerId,liveToken:'own-worldwide-token',currentShow:{title:'News',availability:'WORLDWIDE'}}]});
assert.equal(existing.streams[0].liveToken,'own-worldwide-token');assert.match(existing.streams[0].currentShow.title,/TG4 Worldwide.*News/);
assert.equal(worldwide.epg({streams:[]}).streams.length,0);

function node(){return {style:{backgroundColor:'black',visibility:''},children:[],appendChild(n){n.parentNode=this;this.children.push(n);return n;},insertBefore(n){n.parentNode=this;this.children.unshift(n);},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;}};}
function bridge(live,resume){
 const calls=[],events=[],container=node(),video=node(),app=node();video.parentNode=container;container.parentNode=app;
 video.dispatchEvent=e=>events.push(e.type);video.pause=()=>{};video.load=()=>{};video.removeAttribute=()=>{};
 const selection={url:'https://example.invalid/current-manifest.mpd'};if(!live)selection.protData={'com.microsoft.playready':{serverURL:'https://example.invalid/authorized-vod-licence'}};
 const proxy={live,video:{id:live?worldwide.providerId:'vod-id'},startTime:resume,getPlaybackData:()=>selection};
 let prepared,state='NONE',clock=0;
 const api={getState:()=>state,stop(){calls.push('stop');state='IDLE';},close(){calls.push('close');state='NONE';},open(url){calls.push(['open',url]);state='IDLE';},setDisplayRect(){},setListener(l){this.listener=l;},setDrm(...args){calls.push(['drm',...args]);},prepareAsync(cb){prepared=cb;},play(){calls.push('play');state='PLAYING';},pause(){state='PAUSED';},getCurrentTime:()=>clock,getDuration:()=>300000,seekTo(t,cb){calls.push(['seek',t]);clock=t;if(cb)cb();}};
 const document={getElementById:()=>({__vue__:{_setupProxy:proxy,_setupState:{startTime:{value:resume}}}}),createElement:node,createEvent:()=>({initEvent(type){this.type=type;}})};
 const window={tg4Worldwide:worldwide,__tg4Diagnostics:{}};const ctx={window,webapis:{avplay:api},document};
 load('native-backend.js',ctx);const facade=window.__tg4NativeMedia(video),dash={destroy(){}};window.__tg4StartPlayer(dash,facade,selection.url);
 return {calls,events,container,video,dash,prepare:()=>prepared(),state:()=>state};
}
let p=bridge(true,120);p.prepare();assert.equal(p.state(),'PLAYING');
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='drm').length,0,'Clear Live must skip DRM setup');
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='seek').length,0,'Live must not inherit VOD resume');
assert.ok(p.events.includes('loadedmetadata')&&p.events.includes('playing'));
assert.ok(p.container.children.some(n=>n.textContent==='TG4 Worldwide'),'The live feed must be identified');
p.dash.destroy();assert.equal(p.state(),'NONE');assert.equal(p.container.children.length,0);assert.equal(p.video.style.visibility,'');
p=bridge(false,120);p.prepare();assert.equal(p.state(),'PLAYING');
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='drm'&&c[1]==='PLAYREADY'));
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='seek'&&c[1]===120000),'Preserve the verified VOD resume path');
p.dash.destroy();p=bridge(true,0);p.dash.destroy();p.prepare();assert.equal(p.state(),'NONE');assert.ok(!p.calls.includes('play'),'A cancelled preparation must not restart playback');
const built=path.join(root,'../tv-app');assert.match(fs.readFileSync(path.join(built,'app.js'),'utf8'),/tg4Worldwide\.epg/);
const config=fs.readFileSync(path.join(built,'config.xml'),'utf8');assert.match(config,/<name>TG4\+<\/name>/);assert.match(config,/id="Tg4Live001.Player"/);
console.log('PASS Worldwide EPG/token isolation, native clear playback/cleanup, VOD DRM/resume, cancelled startup, and packaged integration');
