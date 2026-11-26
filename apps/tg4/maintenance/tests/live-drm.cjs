const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'widget','native-backend.js'),'utf8');
function node(){return {style:{backgroundColor:'black',visibility:''},children:[],appendChild(n){n.parentNode=this;this.children.push(n);return n;},insertBefore(n){n.parentNode=this;this.children.unshift(n);},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;}};}
function play(kind){
 const calls=[],events=[],container=node(),video=node(),app=node();video.parentNode=container;container.parentNode=app;
 video.dispatchEvent=e=>events.push(e.type);video.addEventListener=()=>{};video.removeEventListener=()=>{};video.load=()=>{};video.removeAttribute=()=>{};video.pause=()=>{};video.getBoundingClientRect=()=>({left:0,top:0,width:1920,height:1080});
 const license='https://example.invalid/lic/pr';
 const selection={url:'https://example.invalid/current-manifest.mpd'};
 if(kind!=='clear')selection.protData={'com.microsoft.playready':{serverURL:license,priority:1}};
 const proxy={live:kind!=='vod',video:{id:kind==='clear'?'worldwide-id':'6383454185112'},startTime:kind==='vod'?120:0,getPlaybackData:()=>selection};
 let prepared,state='NONE',clock=0;
 const api={getState:()=>state,stop(){calls.push('stop');state='IDLE';},close(){calls.push('close');state='NONE';},open(url){calls.push(['open',url]);state='IDLE';},setDisplayRect(){},setListener(l){this.listener=l;},setDrm(...args){calls.push(['drm',...args]);},prepareAsync(cb){prepared=cb;},play(){calls.push('play');state='PLAYING';},pause(){state='PAUSED';},getCurrentTime:()=>clock,getDuration:()=>300000,seekTo(t,cb){calls.push(['seek',t]);clock=t;if(cb)cb();}};
 const document={getElementById:()=>({__vue__:{_setupProxy:proxy,_setupState:{startTime:{value:proxy.startTime}}}}),createElement:node,createEvent:()=>({initEvent(type){this.type=type;}})};
 const window={__tg4Diagnostics:{},tg4Worldwide:{providerId:'worldwide-id'}};const context={window,webapis:{avplay:api},document};
 vm.runInNewContext(source,context,{filename:'native-backend.js'});
 const dash={destroy(){}};window.__tg4StartPlayer(dash,window.__tg4NativeMedia(video),selection.url);
 return {calls,events,selection,dash,diag:window.__tg4Diagnostics.player,prepare:()=>prepared(),state:()=>state,api};
}
let p=play('protected');p.prepare();
assert.equal(p.state(),'PLAYING');
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='open'&&c[1]===p.selection.url),'Protected Live must open the Brightcove DASH source');
const drm=p.calls.filter(c=>Array.isArray(c)&&c[0]==='drm');
assert.equal(drm.length,1,'Protected Live must configure PlayReady');
assert.equal(drm[0][1],'PLAYREADY');assert.equal(drm[0][2],'SetProperties');
const props=JSON.parse(drm[0][3]);assert.equal(props.DeleteLicenseAfterUse,true);assert.ok(/^https:\/\/example\.invalid\/lic\/pr$/.test(props.LicenseServer));
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='seek').length,0,'Live joins the edge, no VOD resume');
assert.equal(p.diag.worldwide,false,'Protected Live must not be labelled Worldwide');
p.dash.destroy();assert.equal(p.state(),'NONE');
p=play('clear');p.prepare();assert.equal(p.state(),'PLAYING');
assert.equal(p.calls.filter(c=>Array.isArray(c)&&c[0]==='drm').length,0,'Clear Worldwide Live skips DRM');
p.dash.destroy();
p=play('vod');p.prepare();assert.equal(p.state(),'PLAYING');
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='drm'&&c[1]==='PLAYREADY'),'VOD DRM path remains intact');
assert.ok(p.calls.some(c=>Array.isArray(c)&&c[0]==='seek'&&c[1]===120000),'VOD resume remains intact');
p.dash.destroy();
const built=path.join(root,'../tv-app');
const app=fs.readFileSync(path.join(built,'app.js'),'utf8');
assert.ok(app.includes('/epg/current'),'Default SmartTV EPG request must remain in the packaged app');
assert.ok(app.includes('tg4Worldwide.epg'),'The baseline Worldwide-only EPG mapping must remain packaged');
assert.ok(app.includes('tg4Worldwide.homeRails'),'Home live rail must be packaged');
const chunkFile=fs.readdirSync(path.join(built,'js')).find(f=>f.startsWith('627-'));
assert.ok(chunkFile,'DASH player chunk must be packaged');
const chunk=fs.readFileSync(path.join(built,'js',chunkFile),'utf8');
for(const token of ['application/dash+xml','com.microsoft.playready','license_url'])assert.ok(chunk.includes(token),'Browser source/DRM selection must remain: '+token);
for(const file of ['app.js','native-backend.js',path.join('js',chunkFile)]){
 const text=fs.readFileSync(path.join(built,file),'utf8');
 assert.ok(!/license\.live\.brightcove\.com/.test(text),'No licence host may be hardcoded in '+file);
}
console.log('PASS native PlayReady capability, Worldwide-only EPG mapping, clear Live, VOD regression, and no hardcoded licence host');
