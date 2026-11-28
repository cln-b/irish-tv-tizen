const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function load(file,context){vm.runInNewContext(fs.readFileSync(path.join(root,'widget',file),'utf8'),context,{filename:file});}
const context={window:{}};load('worldwide.js',context);const worldwide=context.window.tg4Worldwide;
const protectedIds=['6383454185112','6383455473112'];
function noProtected(streams){for(const id of protectedIds)assert.ok(!JSON.stringify(streams).includes(id),'Only clear stream IDs are exposed');}
function show(title){return {startTime:1,endTime:2,title,seriesTitle:'Series',descriptionEn:'English',descriptionGa:'Irish',image:{url:'image'}};}

const initialRails=worldwide.homeRails([]);
assert.equal(initialRails.length,1,'Home rail must exist before the Live EPG has polled');
assert.equal(initialRails[0].id,'tg4-live-rail');assert.equal(initialRails[0].type,'LIVE');
assert.equal(initialRails[0].items.length,1);
assert.equal(initialRails[0].items[0].stream.streamId,worldwide.providerId);
assert.equal(initialRails[0].items[0].stream.liveToken,undefined);
assert.equal(initialRails[0].items[0].stream.currentShow.title,'Live');

const ireland={pollIntervalSeconds:30,streams:[
 {stream:'TG4',streamId:protectedIds[0],liveToken:'ireland-token',region:'IOI',offsetSeconds:0,state:'ONAIR',currentShow:show('Current programme'),nextShow:show('Next programme')},
 {stream:'TG4PLUSONE',streamId:protectedIds[0],liveToken:'ireland-token',region:'IOI',offsetSeconds:3600,state:'ONAIR',currentShow:show('Plus one current'),nextShow:show('Plus one next')},
 {stream:'ONDEMAND',streamId:null,region:'IOI',state:'DISABLED'},
 {stream:'CULA4',streamId:protectedIds[1],liveToken:'cula-token',region:'IOI',state:'ONAIR'}
]};
const before=JSON.stringify(ireland),mapped=worldwide.epg(ireland);
assert.equal(JSON.stringify(ireland),before,'Polling input must remain unmodified');
assert.equal(mapped.streams.length,2,'Live must expose the clear channel plus its one-hour timeshift');
assert.equal(mapped.streams[0].streamId,worldwide.providerId);
assert.equal(mapped.streams[0].region,'WW');
assert.equal(mapped.streams[0].offsetSeconds,0);
assert.equal(mapped.streams[0].liveToken,undefined,'Worldwide streams carry only Worldwide tokens');
assert.equal(JSON.stringify(mapped.streams[0].currentShow),JSON.stringify(ireland.streams[0].currentShow));
assert.equal(JSON.stringify(mapped.streams[0].nextShow),JSON.stringify(ireland.streams[0].nextShow));
assert.equal(mapped.streams[1].streamId,worldwide.providerId);
assert.equal(mapped.streams[1].stream,'TG4PLUSONE');
assert.equal(mapped.streams[1].offsetSeconds,3600,'Preserve the +1 DVR offset');
assert.equal(mapped.streams[1].liveToken,undefined);
assert.equal(JSON.stringify(mapped.streams[1].currentShow),JSON.stringify(ireland.streams[1].currentShow));
assert.equal(JSON.stringify(mapped.streams[1].nextShow),JSON.stringify(ireland.streams[1].nextShow));
assert.equal(mapped.pollIntervalSeconds,30);
noProtected(mapped.streams);

const worldWide={streams:[
 {stream:'TG4',streamId:worldwide.providerId,liveToken:'worldwide-token',region:'WW',offsetSeconds:0,state:'ONAIR',currentShow:show('News'),nextShow:show('Later')},
 {stream:'TG4PLUSONE',streamId:worldwide.providerId,liveToken:'worldwide-token',region:'WW',offsetSeconds:3600,state:'ONAIR',currentShow:show('One hour earlier'),nextShow:show('News')},
 {stream:'ONDEMAND',streamId:null,region:'WW',state:'DISABLED'}
]};
const apiMapped=worldwide.epg(worldWide);
assert.equal(apiMapped.streams.length,2,'API-supplied Worldwide streams stay unique');
assert.equal(apiMapped.streams[0].liveToken,'worldwide-token');
assert.equal(apiMapped.streams[0].offsetSeconds,0);
assert.equal(apiMapped.streams[1].liveToken,'worldwide-token');
assert.equal(apiMapped.streams[1].offsetSeconds,3600);
assert.equal(JSON.stringify(apiMapped.streams[0].currentShow),JSON.stringify(worldWide.streams[0].currentShow));
assert.equal(JSON.stringify(apiMapped.streams[1].currentShow),JSON.stringify(worldWide.streams[1].currentShow));

const extra={stream:'ONDEMAND',streamId:'6393022623112',region:'WW',offsetSeconds:0,state:'ONAIR',logoUrl:'live-logo',currentShow:show('Éire v An tSeapáin'),nextShow:show('Later')};
const withExtra=worldwide.epg({streams:[worldWide.streams[0],worldWide.streams[1],extra]});
assert.equal(withExtra.streams.length,3,'A clear on-air extra stream must be preserved');
assert.equal(JSON.stringify(withExtra.streams[2]),JSON.stringify(extra),'Extra stream title, logo and metadata must pass through unchanged');
const upcomingWw=Object.assign({},extra,{state:'UPCOMING'});
const upcomingIoi=Object.assign({},extra,{region:'IOI',state:'UPCOMING'});
const upcomingWwMapped=worldwide.epg({streams:[worldWide.streams[0],upcomingWw]});
assert.equal(upcomingWwMapped.streams.length,2,'UPCOMING ONDEMAND must be visible in WW so the frontend can grey it out');
assert.equal(JSON.stringify(upcomingWwMapped.streams[1]),JSON.stringify(upcomingWw),'UPCOMING WW metadata must pass through unchanged');
const upcomingIoiMapped=worldwide.epg({streams:[worldWide.streams[0],upcomingIoi]});
assert.equal(upcomingIoiMapped.streams.length,2,'UPCOMING ONDEMAND must be visible in IOI so the frontend can grey it out');
assert.equal(JSON.stringify(upcomingIoiMapped.streams[1]),JSON.stringify(upcomingIoi),'UPCOMING IOI metadata must pass through unchanged');
const duplicateRegions=worldwide.epg({streams:[worldWide.streams[0],upcomingWw,upcomingIoi]});
assert.equal(duplicateRegions.streams.length,2,'The same ONDEMAND stream labelled WW and IOI is listed once');
assert.equal(worldwide.epg({streams:[worldWide.streams[0],Object.assign({},extra,{region:'IOI',state:'ONAIR'})]}).streams.length,2,'ONDEMAND IOI ONAIR must be kept as a clear tile');
assert.equal(worldwide.epg({streams:[]}).streams.length,0);

const apiLive={id:'15',type:'LIVE',items:[
 {type:'LIVE_STREAM',stream:ireland.streams[0]},
 {type:'LIVE_STREAM',stream:ireland.streams[1]},
 {type:'LIVE_STREAM',stream:ireland.streams[3]}
]};
const rails=worldwide.homeRails([{id:'api-rail',type:'HORIZONTAL',items:[{type:'VIDEO'}]},apiLive]);
assert.equal(rails.length,2,'API LIVE rails resolve to one clear rail');
assert.equal(rails[1].id,'tg4-live-rail');assert.equal(rails[1].type,'LIVE');
assert.equal(rails[1].items.length,2,'Home must match Live with the clear channel and +1 timeshift');
assert.equal(rails[1].items[0].stream.streamId,worldwide.providerId);
assert.equal(rails[1].items[0].stream.region,'WW');
assert.equal(rails[1].items[0].stream.liveToken,undefined);
assert.equal(rails[1].items[1].stream.offsetSeconds,3600);
noProtected(rails[1].items.map(item=>item.stream));
assert.equal(JSON.stringify(rails[1].items[0].stream.currentShow),JSON.stringify(ireland.streams[0].currentShow));
assert.equal(JSON.stringify(rails[1].items[1].stream.currentShow),JSON.stringify(ireland.streams[1].currentShow));
assert.equal(worldwide.homeRails(rails).length,2,'Home rail replacement must be idempotent');
assert.equal(worldwide.homeRails(rails)[1].items.length,2);
assert.ok(!JSON.stringify(worldwide).includes('Worldwide'),'Programme metadata passes through without an added locale label');

function node(){return {style:{backgroundColor:'black',visibility:''},children:[],appendChild(n){n.parentNode=this;this.children.push(n);return n;},insertBefore(n){n.parentNode=this;this.children.unshift(n);},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;}};}
function bridge(live,resume,offset,helper){
  const calls=[],events=[],container=node(),video=node(),app=node();video.parentNode=container;container.parentNode=app;
  video.dispatchEvent=e=>events.push(e.type);video.pause=()=>{};video.load=()=>{};video.removeAttribute=()=>{};
  const selection={url:'https://example.invalid/playlist-dash.mpd'};if(!live)selection.protData={'com.microsoft.playready':{serverURL:'https://example.invalid/authorized-vod-licence'}};
  const proxy={live,video:{id:live?worldwide.providerId:'vod-id'},startTime:resume,offset:offset||0,getPlaybackData:()=>selection};
  let prepared,state='NONE',clock=0;
  const api={getState:()=>state,stop(){calls.push('stop');state='IDLE';},close(){calls.push('close');state='NONE';},open(url){calls.push(['open',url]);state='IDLE';},setStreamingProperty(name,value){calls.push(['property',name,value,state]);},setDisplayRect(){},setListener(l){calls.push(['listener']);this.listener=l;},setDrm(...args){calls.push(['drm',...args]);},prepareAsync(cb){calls.push(['prepare']);prepared=cb;},play(){calls.push('play');state='PLAYING';},pause(){state='PAUSED';},getCurrentTime:()=>clock,getDuration:()=>7200000,seekTo(t,cb){calls.push(['seek',t]);clock=t;if(cb)cb();}};
  const document={getElementById:()=>({__vue__:{_setupProxy:proxy,_setupState:{startTime:{value:resume},offset:{value:offset||0}}}}),createElement:node,createEvent:()=>({initEvent(type){this.type=type;}})};
  const window={tg4Worldwide:worldwide,__tg4Diagnostics:{},__tg4LoginHelper:helper===undefined?{url:'https://worker.invalid/tg4',key:'synthetic'}:helper};const ctx={window,webapis:{avplay:api},document};
  load('native-backend.js',ctx);const facade=window.__tg4NativeMedia(video),dash={destroy(){}};window.__tg4StartPlayer(dash,facade,selection.url);
  return {calls,events,container,video,dash,diag:window.__tg4Diagnostics.player,prepare:()=>prepared(),state:()=>state};
}
function highestStart(calls){
  return calls.find(c=>Array.isArray(c)&&c[0]==='property'&&c[1]==='ADAPTIVE_INFO'&&c[2]==='STARTBITRATE=HIGHEST');
}
function callIndex(calls,name){return calls.findIndex(c=>Array.isArray(c)&&c[0]===name);}
let p=bridge(true,120);p.prepare();assert.equal(p.state(),'PLAYING');
const liveStart=highestStart(p.calls);
assert.ok(liveStart,'Clear Live requests the highest rendition first');
assert.equal(liveStart[3],'IDLE','AVPlay receives the adaptive-info property while IDLE');
assert.ok(callIndex(p.calls,'property')<callIndex(p.calls,'listener'),'Adaptive info is set before listeners');
assert.ok(callIndex(p.calls,'property')<callIndex(p.calls,'prepare'),'Adaptive info is set before preparation');
assert.ok(p.diag.setup.some(entry=>entry[0]==='adaptive-info'&&entry[1]==='STARTBITRATE=HIGHEST'));
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='drm').length,0,'Clear Live uses the clear AVPlay path');
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='seek').length,0,'Live starts at the live edge');
assert.ok(p.events.includes('loadedmetadata')&&p.events.includes('playing'));
assert.ok(!p.container.children.some(n=>n.textContent==='TG4 Worldwide'),'Worldwide state stays in diagnostics');assert.equal(p.diag.worldwide,true,'Worldwide state remains diagnosable without UI');
p.dash.destroy();assert.equal(p.state(),'NONE');assert.equal(p.container.children.length,0);assert.equal(p.video.style.visibility,'');
p=bridge(false,120);p.prepare();assert.equal(p.state(),'PLAYING');
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='drm'&&c[1]==='PLAYREADY'));
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='seek'&&c[1]===120000),'Preserve the verified VOD resume path');
const vodStart=highestStart(p.calls);
assert.ok(vodStart,'VOD requests the highest rendition first');
assert.equal(vodStart[3],'IDLE','VOD adaptive-info is set while IDLE');
assert.ok(callIndex(p.calls,'property')<callIndex(p.calls,'drm'),'Adaptive info is set before DRM configuration');
p.dash.destroy();p=bridge(true,0);p.dash.destroy();p.prepare();assert.equal(p.state(),'NONE');assert.ok(!p.calls.includes('play'),'Cancelled preparation leaves playback idle');
p=bridge(true,0,-3600);p.prepare();assert.equal(p.state(),'PLAYING');
const dvrOpen=p.calls.find(c=>Array.isArray(c)&&c[0]==='open');
assert.ok(String(dvrOpen[1]).indexOf('http://worker.invalid/tg4/dvr?u=')===0,'Live +1 must use the AVPlay-compatible Worker redirect for the normalized DVR manifest');
assert.ok(String(dvrOpen[1]).includes(encodeURIComponent('https://example.invalid/playlist-dash-dvr.mpd')));
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='seek'&&c[1]===3600000),'Live +1 seeks one hour behind the DVR end through AVPlay');
assert.equal(p.diag.offsetRequested,3600);assert.equal(p.diag.offsetTarget,3600);assert.equal(p.diag.offsetCompleted,3600);
assert.equal(p.diag.timeshift.normalized,true);
p.dash.destroy();
p=bridge(true,0,-3600,'');p.prepare();assert.equal(p.state(),'PLAYING');
assert.ok(!p.calls.some(c=>Array.isArray(c)&&c[0]==='seek'),'A blank helper keeps the original live manifest and live edge');
assert.equal(p.diag.timeshift.normalized,false);
p.dash.destroy();
const built=path.join(root,'../tv-app'),builtApp=fs.readFileSync(path.join(built,'app.js'),'utf8');
const builtNative=fs.readFileSync(path.join(built,'native-backend.js'),'utf8');
assert.ok(builtNative.includes("setStreamingProperty('ADAPTIVE_INFO','STARTBITRATE=HIGHEST')"),'Packaged AVPlay must request the highest rendition first');
assert.ok(builtApp.includes('/epg/current'));assert.ok(builtApp.includes('tg4Worldwide.epg'),'The Worldwide EPG mapping must be packaged');
assert.ok(builtApp.includes('tg4Worldwide.homeRails'),'The Home live rail must be packaged');
assert.ok(!builtApp.includes('e.id==="tg4-live-rail"'),'RailsContainer stays untouched; the rail is created lazily on scroll');
assert.ok(builtApp.includes('img/playerIconPink.b24924ee.svg'),'Header logo must be bundled locally');
assert.ok(!builtApp.includes('https://smarttv.tg4.ie/img/playerIconPink.b24924ee.svg'),'Header logo resolves from the bundled asset');
assert.ok(fs.existsSync(path.join(built,'img/playerIconPink.b24924ee.svg')),'Bundled logo asset must exist');
const config=fs.readFileSync(path.join(built,'config.xml'),'utf8');assert.match(config,/<name>TG4\+<\/name>/);assert.match(config,/id="Tg4Live001.Player"/);
console.log('PASS clear Worldwide Live with +1 timeshift, API WW stream preservation, protected-ID isolation, VOD regression, and packaged integration');
