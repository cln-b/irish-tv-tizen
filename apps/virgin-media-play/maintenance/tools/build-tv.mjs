import fs from 'node:fs';
import path from 'node:path';
import {avplayHooks} from './avplay-hooks.mjs';
import {parse} from 'acorn';
const root=path.resolve(import.meta.dirname,'..');
const version=fs.readFileSync(path.join(root,'../VERSION'),'utf8').trim();
const manifestVersion=version.split('.').length===2?version+'.0':version;
const source=path.join(root,'upstream/hbbtv'), dest=path.join(root,'build/tv');
fs.mkdirSync(dest,{recursive:true});
const timingConfig=null;
const diagnosticsEnabled=false;
const fixedLive720Enabled=false;
function style(text,name=''){
 if(name.endsWith('/static/style/base.css')){
  text+='\n/* VM Tizen search keyboard and horizontal menu alignment */\n';
  text+='.keyboardButton:not(.keySPACE):not(.keySEARCH) {padding: 14px 0px; height: 1.1em; font-size: 26px}\n';
  text+='.keyDEL svg {margin-bottom: 2px}\n';
  text+='.keySPACE {width: 346px !important}\n';
  text+='.keySEARCH {padding: 17px 7px; margin-left: -14px; font-size: 20px !important}\n';
  text+='/* Dynamic keyboard CSS is injected later with equal specificity. */\n';
  text+='.keySEARCH.keySEARCH {padding: 17px 7px}\n';
  text+='#horizontalMainMenuCullingCarousel > .widget.container.button {vertical-align: bottom}\n';
  text+='/* Search and More icon optical alignment */\n';
  text+='#search > svg {margin-top: -2px;}\n';
  text+='#more > svg {margin-top: -1px;}\n';
  text+='/* Home page tile footer and poster spacing */\n';
  text+='.tilefooter {overflow: visible !important; z-index: auto !important}\n';
  text+='.CULLINGposter .tilefooter {overflow: hidden !important; z-index: -1 !important}\n';
  text+='.CULLINGposter {margin: 14px 0px 9px !important}\n';
 }
 return text;
}
function script(text,name=''){
 if(name.endsWith('/services/streams.js') && name.includes('/1.172.0/')){
  const field='device_type:"smarttv"';
  if(text.split(field).length!==3)throw Error('Stream request shapes changed');
  text=text.replaceAll(field,field+',protection:"playready"');
 }

 if(name.endsWith('/devices/mediaplayer/shaka.js') && name.includes('/1.16.0/')){
  const library='"//cdn.jsdelivr.net/npm/shaka-player@"+a+"/dist/shaka-player.compiled."+s+".js"';
  if(!text.includes(library))throw Error('Shaka library URL changed');
  text=text.replace(library,'window.vmRoot+"shaka-legacy.js"');
  text=text.replace('window.playerVersion||"4.12.7"','window.playerVersion||"4.3.5-rte"');
  text=text.replace('this.shaka=new n.Player,this.overrideHeadWithGetRequest()',
   'this.shaka=new n.Player,this.shaka.configure({drm:{preferredKeySystems:["com.microsoft.playready"]},restrictions:{maxHeight:576},preferredAudioChannelCount:2,preferredVideoCodecs:["avc1"]}),this.shaka.addEventListener("error",function(event){var d=event.detail||{};console.log("VM Shaka error code="+d.code+" category="+d.category+" severity="+d.severity)}),this.overrideHeadWithGetRequest()');
  text=text.replace('setSource:function setSource(e,t,n){',
   'setSource:function setSource(e,t,n){this.vmSourceRetries=0;if(window.vmTimeline)window.vmTimeline.reset();');

  const replacements=[
   ['this.shaka.attach(this._mediaElement),this.isAttached=!0',
    'this.vmAttach=Promise.resolve(this.vmDetach).then((function(player,video,self){return function(){if(self._mediaElement===video)return player.attach(video)}})(this.shaka,this._mediaElement,this)),this.isAttached=!0'],
   ['this.shaka&&this._mediaElement&&this.shaka.detach(this._mediaElement)',
    'this.shaka&&this._mediaElement&&(this.vmDetach=this.shaka.detach().catch(function(){console.log("VM native detach failed")}))'],
   ['t._unloadMediaSrc(),i.removeElement(t._mediaElement),delete t._mediaElement,delete t._sourceElement',
    '(function(video,pending){Promise.resolve(pending).then(function(){video.removeAttribute("src");video.load();i.removeElement(video);console.log("VM native video released")})})(t._mediaElement,t.vmDetach),delete t._mediaElement,delete t._sourceElement'],
   ['_cleanupAndStartPlayback:function(e){var t=this;if(this._unloadMediaSrc(),this.isVMTV()&&this.imaLoaded)return this.loadPlugin((function(){t._startPlayback(e)}));setTimeout((function(){t._startPlayback(e)}),50)}',
    '_cleanupAndStartPlayback:function(e){var t=this,video=this._mediaElement;Promise.resolve(this.vmAttach).then(function(){if(t._mediaElement===video)t._startPlayback(e)}).catch(function(error){t._toError("Player attachment failed")})}']
  ];
  for(const [from,to] of replacements){if(text.split(from).length!==2)throw Error('Native lifecycle code changed: '+from);text=text.replace(from,to);}

  text=text.replace('_onEndOfMedia:function _onEndOfMedia(){this._toComplete()}',
   '_onEndOfMedia:function _onEndOfMedia(){if(this.vmEndScheduled)return;this.vmEndScheduled=true;var self=this,video=this._mediaElement;setTimeout(function(){self.vmEndScheduled=false;if(self._mediaElement===video){console.log("VM native ended callback");self._toComplete()}},0)}');

  text=avplayHooks(text);
  text=text.replace('handleSwitchSourceError:function(e,t){','handleSwitchSourceError:function(e,t){console.log("VM Shaka source error code="+(e&&e.code));this._pendingSource=null;if(e&&e.code===7000)return;if(this.vmSourceRetries++>=1)return this._toError("Playback failed: "+(e&&e.code));');
 }

 if(name.endsWith('/utils/analytics/npaw.js') && name.includes('/1.172.0/')){
  text=text.replace('sources:{Html5:', 'sources:{SamsungAvplay:window.vmRoot+"npaw-avplay.js",Html5:');
  text=text.replace('setPlatformSelector:function(){','setPlatformSelector:function(){if(window.vmAvPlay&&window.webapis&&window.webapis.avplay){this.platformSelector="SamsungAvplay";return;}');
  text=text.replace('getPlayerId:function(){var t="null";', 'getPlayerId:function(){if(this.platformSelector==="SamsungAvplay")return "native-avplay";var t=null;');
  text=text.replace('this.youbora&&this.youbora[this.adapterModes[o]](new youbora.adapters[a](e))','this.youbora&&this.youbora[this.adapterModes[o]](new youbora.adapters[a](e)),a==="SamsungAvplay"&&this.youbora&&(window.vmNativeAnalytics=this.youbora._adapter)');
  text=text.replace('new youbora.adapters[a](e)','new youbora.adapters[a](a==="SamsungAvplay"?window.webapis.avplay:e)');
  const cleanup='endTracking:function(){var t;null===(t=this.youbora)||void 0===t||t.removeAdapter(),this.paused=!1}';
  if(text.split(cleanup).length!==2)throw Error('Analytics cleanup changed');
  text=text.replace(cleanup,'endTracking:function(){clearTimeout(this.sendTrackingDataTimeout);try{if(this.youbora)this.youbora.removeAdapter();}catch(error){console.log("VM analytics cleanup recovered");}finally{window.vmNativeAnalytics=null;this.paused=false;}}');
 }
 if(name.endsWith('/widgets/playerfooter.js') && name.includes('/1.172.0/')){
  if(text.split('["background-size","66.82px"]').length!==3)throw Error('Language icon sizing changed');
  text=text.replaceAll('["background-size","66.82px"]','["background-size","40px"]');
  const language='onLanguageSelect:function(){var t;null===(t=this.playerComponent)||void 0===t||t.showLanguagePicker()}';
  if(text.split(language).length!==2)throw Error('Language control changed');
  text=text.replace(language,'onLanguageSelect:function(){var t;null===(t=this.playerComponent)||void 0===t||t.showUI(),this.hidden||null===(t=this.playerComponent)||void 0===t||t.showLanguagePicker()}');
 }
 if(name.endsWith('/widgets/svgimage.js') && name.includes('/1.172.0/')){
  const marker='["title","desc"].forEach';
  if(text.split(marker).length!==2)throw Error('SVG renderer changed');
  text=text.replace(marker,'if(!i.documentElement||i.documentElement.localName!=="svg"||i.getElementsByTagName("parsererror").length){console.log("VM invalid SVG rejected");return;}'+marker);
 }
 if(name.endsWith('/trackmanagement/shakatrackmanagementhandler.js')){
  text=text.replace('_setSubtitleVisibilty:function(e){','_setSubtitleVisibilty:function(e){this.getPlayer().setTextTrackVisibility(e);');
 }
 if(name.endsWith('/services/playback/trackmanager.js')){
  const marker='.getMediaPlayer().shaka?new a:new t';
  if(text.split(marker).length!==2)throw Error('Track manager selection changed');
  text=text.replace(marker,'.getMediaPlayer().shaka||window.vmAvPlay&&window.webapis&&window.webapis.avplay?new a:new t');
 }
 if(name.endsWith('/components/player/playerutils.js')&&name.includes('/1.172.0/')){
  text=text.replace('getViewRecord:function(e){','getViewRecord:function(e){var local=this.viewTracker&&this.viewTracker.readRecord(e);if(local&&local.playhead>0){console.log("VM resume selected local position="+local.playhead);return local;}');
 }
 if(name.endsWith('/components/player/live.js') && name.includes('/1.172.0/')){
  const marker='this.MAX_RECOVERY_ATTEMPTS=3';
  if(text.split(marker).length!==2)throw Error('Live retry policy changed');
  text=text.replace(marker,'this.MAX_RECOVERY_ATTEMPTS=window.vmAvPlay&&window.webapis&&window.webapis.avplay?0:3');
 }
 if(name.endsWith('/components/player/base.js') && name.includes('/1.172.0/')){
  const adStart='beginADsAndStreamPlayback:function(e,t){this.adTypeParser=new f(e);';
  if(text.split(adStart).length!==2)throw Error('Ad handoff changed');
  text=text.replace(adStart,'beginADsAndStreamPlayback:function(e,t){if(!this.isLive()){console.log("VM VOD client ad insertion disabled");this.adTypeParser=new f({});return void this.beginPlayback(this.url,!0)}this.adTypeParser=new f(e);');
  const capture='capturePlayhead:function(){var e=o.getDuration(),t=this.getCurrentTime(),i=w.getDataItem(),s=this.utils.getUvid(i);this.loggedIn()&&p.setViewingProgress(s,t),this.adActive||t>30&&t<.95*e&&(i.airdate||(i.airdate=Date.now()),this.viewTracker.capture({uvid:i.id,airdate:i.airdate,playhead:t}))}';
  if(text.split(capture).length!==2)throw Error('Progress capture changed');
  text=text.replace(capture,'capturePlayhead:function(){if(this.isLive()||this.getAdPlaying())return;var duration=o.getDuration(),time=this.getCurrentTime(),data=w.getDataItem(),id=this.utils.getUvid(data);if(!isFinite(time)||time<=0)return;if(this.loggedIn())p.setViewingProgress(id,time);if(time>30&&time<.95*duration){if(!data.airdate)data.airdate=Date.now();this.viewTracker.capture({uvid:id,airdate:data.airdate,playhead:time});console.log("VM resume stored position="+time);}}');
  text=text.replace('a.viewTracker.deleteRecord(i)','a.viewTracker.deleteRecord(i),p.setViewingProgress(i,0)');
  text=text.replace('this.setActiveChildWidget(this.languagePicker)},hideLanguagePicker:', 'this.setActiveChildWidget(this.languagePicker),console.log("VM subtitle panel opened")},hideLanguagePicker:');
  text=text.replace('showLanguagePicker:function(){','showLanguagePicker:function(){if(window.vmNativeOptions&&window.vmNativeOptions.open())return;');
  text=text.replace('onBeforeShow:function(e){','onBeforeShow:function(e){this.vmNativeRecoveryCount=0;this.player.vmOwner=this;');
  text=text.replace('hideLanguagePicker:function(){', 'hideLanguagePicker:function(){if(this.languagePicker)console.log("VM subtitle panel closed");');
 }
 if(name.endsWith('/widgets/player/languagepicker.js') && name.includes('/1.172.0/')){
  const marker='this.languageButtons=[],this.subtitleButtons=[],this.addClass';
  if(!text.includes(marker))throw Error('Language picker lifecycle changed');
  text=text.replace(marker,'this.languageButtons=[],this.subtitleButtons=[],this.addEventListener("keydown",function(event){if(event.keyCode===461||event.keyCode===8||event.keyCode===10009){event.stopPropagation();console.log("VM subtitle panel Return");this.closeCallback();}}.bind(this)),this.addClass');
 }

 if(name.endsWith('/utils/mediaplayercoupling.js') && name.includes('/1.172.0/')){
  text=text.replace('this.player.cleanUpVideo,this.player.stop(),this.player.reset()',
   'console.log("VM complete stop begin"),this.player.stop(),console.log("VM complete reset begin"),this.player.reset(),console.log("VM complete teardown done")');
  const condition='if(c&&!n&&this.hasPlayedAds)';
  if(!text.includes(condition))throw Error('DRM handoff condition changed');
  text=text.replace(condition,'if(c&&!n&&this.hasPlayedAds&&!this.player.shaka)');
  text=text.replace('this.setPlaybackSource(e,t,i,r,s,a)},setPlayerConfig:',
   'if(!n&&this.player.shaka)console.log("VM EME source handoff");this.setPlaybackSource(e,t,i,r,s,a)},setPlayerConfig:');
 }


 text=text.replace('i.status>=200&&i.status<300?', '(i.status>=200&&i.status<300||i.status===0&&/^file:/.test(t))?');
 const tree=parse(text,{ecmaVersion:5,allowReturnOutsideFunction:true}), edits=[];
 function visit(node,parent){
  if(!node||typeof node!=='object')return;
  if(node.type==='Literal'&&typeof node.value==='string'){
   const match=/^(?:https?:)?\/\/127\.0\.0\.1:18782\/?(.*)$/.exec(node.value);
   if(match)edits.push({start:node.start,end:node.end,value:'(window.vmRoot+'+JSON.stringify(match[1])+')'});
   else if(!(parent&&parent.type==='BinaryExpression'&&parent.right===node) && node.value!=='//hybridtv.ss7.tv/whitelabel' && /^\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(node.value))
    edits.push({start:node.start,end:node.end,value:JSON.stringify('https:'+node.value)});
  }
  for(const key of Object.keys(node))if(key!=='loc'){
   if(Array.isArray(node[key]))node[key].forEach(child=>visit(child,node));
   else if(node[key]&&typeof node[key]==='object')visit(node[key],node);
  }
 }
 visit(tree);
 for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end);
 parse(text,{ecmaVersion:5,allowReturnOutsideFunction:true});
 return text;
}
for(const name of fs.readdirSync(source,{recursive:true})){
 if(name.includes('/1.163.1/'))continue;
 const input=path.join(source,name);
 if(!fs.statSync(input).isFile())continue;
 let bytes=fs.readFileSync(input);
 if(name.endsWith('.js'))bytes=script(bytes.toString(),name);
 if(name.endsWith('.css')){
  const prefix=path.posix.relative(path.posix.dirname(name),'.')||'.';
  bytes=style(bytes.toString(),name).replace(/url\((["']?)\/\//g,'url($1https://').replace(/(?:https?:)?\/\/127\.0\.0\.1:18782\//g,prefix+'/');
 }
 if(name.endsWith('.html')){
  const dir=path.posix.dirname(name), relative=path.posix.relative(dir,'.')||'.';
  let html=bytes.toString().replace('x.readyState === 4 && x.status === 200','x.readyState === 4 && (x.status === 200 || x.status === 0 && /^file:/.test(x.responseURL || location.href))');
  html=html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_m,open,body,close)=>open+(body.trim()?script(body):body)+close);
  html=html.replace(/((?:src|href)=["'])(?:(?:https?:)?\/\/127\.0\.0\.1:18782\/|\/)([^"']+)/g,(_m,prefix,asset)=>prefix+relative+'/'+asset);
  html=html.replace(/((?:src|href)=["'])\/\//g,'$1https://');
  html=html.replace('<head>','<head><script>var vmPath=location.href,vmPos=vmPath.lastIndexOf("/whitelabel/app/");if(vmPos<0)vmPos=vmPath.lastIndexOf("/apps/bitmovin/");window.vmRoot=vmPath.slice(0,vmPos)+"/";window.vmTimingProxy='+JSON.stringify(timingConfig)+';window.vmDiagnosticsEnabled='+JSON.stringify(diagnosticsEnabled)+';window.vmFixedLive720Enabled='+JSON.stringify(fixedLive720Enabled)+';</script>');
  html=html.replace('</script>','</script><script src="$WEBAPIS/webapis/webapis.js"></script><script src="'+relative+'/live-timing.js"></script><script src="'+relative+'/quality.js"></script><script src="'+relative+'/avplay.js"></script><script src="'+relative+'/subtitles.js"></script><script src="'+relative+'/options.js"></script><script src="'+relative+'/remote.js"></script>');
  bytes=html;
 }
 const output=path.join(dest,name);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
}
fs.copyFileSync(path.join(root,'upstream/vendor/npaw-avplay.js'),path.join(dest,'npaw-avplay.js'));
fs.copyFileSync(path.join(root,'upstream/vendor/shaka-legacy.js'),path.join(dest,'shaka-legacy.js'));
fs.rmSync(path.join(dest,'shaka-4.12.7.js'),{force:true});
fs.copyFileSync(path.join(root,'tv/remote.js'),path.join(dest,'remote.js'));
fs.copyFileSync(path.join(root,'tv/avplay.js'),path.join(dest,'avplay.js'));
fs.copyFileSync(path.join(root,'tv/subtitles.js'),path.join(dest,'subtitles.js'));
fs.copyFileSync(path.join(root,'tv/quality.js'),path.join(dest,'quality.js'));
fs.copyFileSync(path.join(root,'tv/options.js'),path.join(dest,'options.js'));
fs.rmSync(path.join(dest,'boundary-sync.js'),{force:true});
fs.copyFileSync(path.join(root,'tv/live-timing.js'),path.join(dest,'live-timing.js'));
fs.copyFileSync(path.join(root,'widget/icon.png'),path.join(dest,'icon.png'));
fs.writeFileSync(path.join(dest,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><script>location.replace("./whitelabel/app/release/1.172.0/default-webkit-default.html?env=prd&cid=vmtv&platform=sam&platformenv=prd&httpforced=1");</script></head><body style="background:black"></body></html>');
fs.writeFileSync(path.join(dest,'config.xml'),`<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://example.invalid/virgin-media-play" version="${manifestVersion}" viewmodes="maximized">
<name>Virgin Media Play</name><icon src="icon.png"/><content src="index.html"/>
<tizen:application id="VmPlay2016.Player" package="VmPlay2016" required_version="2.4"/>
<tizen:profile name="tv-samsung"/><access origin="*" subdomains="true"/>
<tizen:privilege name="http://tizen.org/privilege/internet"/>
<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
<tizen:privilege name="http://developer.samsung.com/privilege/drmplay"/>
<tizen:setting screen-orientation="landscape" context-menu="disable" hwkey-event="enable"/>
</widget>
`);
console.log('Built TV widget',dest);

// Public builds contain no LAN diagnostic reporting.

// Check the offline module graph, including definitions bundled inside TAL.
const definitions=new Set(), dependencies=new Set();
for(const name of fs.readdirSync(dest,{recursive:true})){
 if(!name.endsWith('.js') || name.startsWith('apps/') || name.includes('/1.14.1/'))continue;
 const text=fs.readFileSync(path.join(dest,name),'utf8');
 for(const match of text.matchAll(/define\(["']([^"']+)["'](?:,\[([^\]]*)\])?/g)){
  definitions.add(match[1]);
  if(match[2])for(const dep of match[2].matchAll(/["']([^"']+)["']/g))dependencies.add(dep[1]);
 }
}
for(const name of dependencies){
 let filename;
 if(name.startsWith('whitelabelapp/'))filename=name.replace('whitelabelapp/','whitelabel/app/release/1.172.0/static/script/')+'.js';
 else if(name.startsWith('antie/'))filename=name.replace('antie/','core/1.16.0/tal/static/script/')+'.js';
 else if(name.startsWith('crypto-js/'))filename='core/1.16.0/'+name+'.js';
 if(filename && !definitions.has(name) && !fs.existsSync(path.join(dest,filename)))
  throw Error('Missing packaged module '+name);
}
if(!fs.existsSync(path.join(dest,'whitelabel/app/release/1.172.0/static/script/appui/components/player/live.js')))
 throw Error('Missing lazy live-player entry point');
console.log('Verified packaged module dependencies');
