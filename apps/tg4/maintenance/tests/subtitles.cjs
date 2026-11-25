const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'widget','native-backend.js'),'utf8');
const mpd='<?xml version="1.0"?><MPD><Period><AdaptationSet mimeType="text/vtt" lang="ga"><Label>Gaeilge</Label><BaseURL>https://example.invalid/ga.vtt</BaseURL></AdaptationSet><AdaptationSet mimeType="text/vtt" lang="en"><Label>English</Label><BaseURL>https://example.invalid/en.vtt</BaseURL></AdaptationSet></Period></MPD>';
const vtts={
 'https://example.invalid/ga.vtt':'WEBVTT\n\n00:17.400 --> 00:19.160\n&quot;Gaeilge&quot; cue &#39;test&#39; &#x27;hex&#x27;\n\n',
 'https://example.invalid/en.vtt':'WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0\n\n00:17.400 --> 00:19.160\nEnglish cue line one\nline two\n\n01:00.000 --> 01:02.000\nLater cue\n'
};
function node(){const n={style:{backgroundColor:'black',visibility:''},children:[],textContent:'',appendChild(child){child.parentNode=this;this.children.push(child);return child;},insertBefore(child){child.parentNode=this;this.children.unshift(child);return child;},removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentNode=null;}};return n;}
const container=node(),video=node(),app=node();video.parentNode=container;container.parentNode=app;
video.dispatchEvent=()=>{};video.pause=()=>{};video.load=()=>{};video.removeAttribute=()=>{};
let clock=0;
const api={getState:()=>'NONE',stop(){},close(){},open(){},setDisplayRect(){},setListener(listener){this.listener=listener;},setDrm(){},prepareAsync(cb){this.prepared=cb;},play(){},pause(){},getCurrentTime:()=>clock,getDuration:()=>300000,seekTo(t){clock=t;}};
const refs={textTracks:{value:null},textTracksEnabled:{value:false},selectedTrackIndex:{value:0},updateTextTracks:{value:true},startTime:{value:0}};
const proxy={live:false,video:{id:'vod-id'},startTime:0,getPlaybackData:()=>({url:'https://example.invalid/manifest.mpd'})};
const view={__vue__:{_setupProxy:proxy,_setupState:refs}};
const document={getElementById:()=>view,createElement:node,createEvent:()=>({initEvent(type){this.type=type;}})};
const requested=[];
class XHR{
 open(method,url){this.url=url;requested.push(url);}
 send(){this.readyState=4;this.status=200;this.responseText=this.url==='https://example.invalid/manifest.mpd'?mpd:(vtts[this.url]||'');this.onreadystatechange();}
}
const window={tg4Worldwide:{providerId:'worldwide-id'},__tg4Diagnostics:{}};
const context={window,webapis:{avplay:api},document,XMLHttpRequest:XHR};
vm.runInNewContext(source,context,{filename:'native-backend.js'});
const dash={destroy(){}};
window.__tg4StartPlayer(dash,video,'https://example.invalid/manifest.mpd');
api.prepared();
api.listener.oncurrentplaytime(17400);
assert.equal(refs.textTracks.value.length,2,'MPD text AdaptationSets must populate the Captions menu');
assert.equal(Array.prototype.map.call(refs.textTracks.value,track=>track.language).join(','),'ga,en','Preserve MPD track order/languages');
assert.equal(requested.filter(url=>/\.vtt$/.test(url)).length,1,'Fetch Irish VTT first, before selection');
const initialCaption=container.children.filter(child=>child.className==='tg4-native-caption')[0];
assert.ok(initialCaption,'Initial Irish caption overlay must exist');
assert.equal(initialCaption.children[0].textContent,"\"Gaeilge\" cue 'test' 'hex'",'WebVTT entities must be decoded before rendering');
dash.setTextTrack(1);
assert.equal(requested.filter(url=>/\.vtt$/.test(url)).length,2,'Fetch English VTT on setTextTrack');
api.listener.oncurrentplaytime(17400);
const caption=container.children.filter(child=>child.className==='tg4-native-caption')[0];
assert.ok(caption,'Native caption overlay must exist');
assert.match(caption.children[0].textContent,/English cue line one/,'Selected English cue must render');
api.listener.oncurrentplaytime(17500);
assert.match(caption.children[0].textContent,/English cue line one/,'Cue remains visible inside its time range');
api.listener.oncurrentplaytime(20000);
assert.equal(caption.children[0].textContent,'','Expired cue must be cleared');
api.listener.oncurrentplaytime(17400);
dash.setTextTrack(0);
api.listener.oncurrentplaytime(17400);
assert.equal(caption.children[0].textContent,"\"Gaeilge\" cue 'test' 'hex'",'Selected Irish cue must render decoded entities');
dash.enableText(false);
api.listener.oncurrentplaytime(17400);
assert.equal(caption.style.display,'none','Off must hide captions');
assert.equal(refs.textTracksEnabled.value,false,'Off must clear the menu active state');
dash.setTextTrack(1);
assert.equal(refs.textTracksEnabled.value,true,'Selecting a language must restore the menu active state');
dash.destroy();
assert.equal(container.children.filter(child=>child.className==='tg4-native-caption').length,0,'Return must remove the caption overlay');
console.log('PASS VOD VTT manifest discovery, cue parsing, EN/GA/Off switching, and caption cleanup');
