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
  text+='/* Only show footer on active carousel tile */\n';
  text+='.WRAPPINGcarousel .widget.container.button.carouselItem:not(.active) .tilefooter {display: none}\n';
 }
 return text;
}
function script(text,name=''){
 if(name.endsWith('/appui/components/details/episodic.js') && name.includes('/1.172.0/')){
  const deps='define("whitelabelapp/appui/components/details/episodic",["whitelabelapp/appui/components/details","whitelabelapp/appui/widgets/detailsmetadata","whitelabelapp/services/continuewatching","antie/widgets/horizontallist"],(function(t,e,i,s){';
  if(text.split(deps).length!==2)throw Error('Continue Watching dependency list changed');
  text=text.replace(deps,'define("whitelabelapp/appui/components/details/episodic",["whitelabelapp/appui/components/details","whitelabelapp/appui/widgets/detailsmetadata","whitelabelapp/services/continuewatching","antie/widgets/horizontallist","whitelabelapp/utils/playerheartbeat","whitelabelapp/utils/network/api"],(function(t,e,i,s,heartbeat,api){');

  const init='this.playButtonId="playBtn",this.setShowData()';
  if(text.split(init).length!==2)throw Error('Continue Watching button id anchor changed');
  text=text.replace(init,'this.playButtonId="playBtn",this.continueWatchingButtonId="continueWatchingBtn",this.setShowData()');

  const addControl='this.appendFavouritesButton(this.buttonHorizontalList),this.appendTrailorButton(this.buttonHorizontalList)';
  if(text.split(addControl).length!==2)throw Error('Continue Watching addControls anchor changed');
  text=text.replace(addControl,'this.appendFavouritesButton(this.buttonHorizontalList),this.appendContinueWatchingButton(this.buttonHorizontalList),this.appendTrailorButton(this.buttonHorizontalList)');

  const styleAnchor='this.styleManager.setRules(n),this.setPlayIconStyle()';
  if(text.split(styleAnchor).length!==2)throw Error('Continue Watching style anchor changed');
  text=text.replace(styleAnchor,'n.push(["#"+this.id+" #"+this.continueWatchingButtonId,["width","167px"],["height","92px"],["border-radius",o.buttonCorner],["left","64px"],["margin-left","10px"]]),n.push(["#"+this.id+" #"+this.continueWatchingButtonId+"Label",["position","absolute"],["font-size",o.getFontSize("detailsControlButton")+"px"],["line-height","61px"],["height","57px"],["top","36px"],["left","0px"],["text-align","center"],["width","167px"],["white-space","normal"]]),n.push(["#"+this.continueWatchingButtonId+"icon",["margin-left","62px"]]),'+styleAnchor);

  const anchor='this.favouritesButton=this.appendControlButton(i,t)}},addButtonHorizontalList:function(){';
  if(text.split(anchor).length!==2)throw Error('Continue Watching handler anchor changed');
  const methods=[
   'shouldDisplayContinueWatchingButton:function(){',
    'var asset=this.assetData||{},progress=i.getViewingProgress(asset.id);',
    'if(!progress||0===Number(progress))progress=i.getViewingProgress(asset.uvid);',
    'return Number(progress)>0',
   '},',
   'appendContinueWatchingButton:function(t){',
    'if(this.shouldDisplayContinueWatchingButton()){',
     'var e=this,s={image:{id:this.continueWatchingButtonId+"icon",url:this.utils.getAssetPath()+"/continuewatchingremove/white.svg",width:30,height:30},button:{id:this.continueWatchingButtonId,class:"controlbutton",text:this.utils.localiser.getString("button_mark_as_watched","Mark as watched"),callback:function(t){e.handleRemoveContinueWatching(t)}}};',
     'this.continueWatchingButton=this.appendControlButton(s,t),this.continueWatchingButton.setAccessibleLabel(s.button.text)',
    '}',
   '},',
   'handleRemoveContinueWatching:function(t){',
         'var asset=this.assetData||{},duration=Number(asset.duration),contentId=this.utils.getUvid(asset,!0),self=this;',
    'if(!contentId||!isFinite(duration)||duration<=0)return;',
    'var config=this.Models.readModelData("config");',
    'if(config&&config.companyId)heartbeat.setCompanyId(config.companyId);',
     'var stream=this.Models.readModelData("stream"),streamHeartbeat=stream&&stream.response&&stream.response.heartbeat,endpoint=api.getEndpoint("heartBeatStart"),host=streamHeartbeat&&streamHeartbeat.url?streamHeartbeat.url:endpoint&&endpoint.host&&endpoint.host.replace("//api-","//heartbeat-");',
     'if(host)api.updateHost("heartBeatHost",host);',
    'heartbeat.setMediaId(contentId);heartbeat.send("heartBeatStart",{user_id:heartbeat.getUserId(),company_id:heartbeat.getCompanyId(),content_id:heartbeat.getMediaId(),content_type:String(asset.type||"show").toLowerCase(),platform_id:heartbeat.getPlatformId(),play_head:duration},function(){',
     'console.log("VM continue watching removal accepted for "+contentId);',
      'window.vmContinueWatchingRemoved=!0;',
     'var data=i.Models.readModelData(i.modelId),videos=data&&data.videos;',
     'if(videos)for(var r=videos.length-1;r>=0;r--){',
      'var v=videos[r],matched=String(v.id)===String(asset.id)||String(v.uvid)===String(asset.uvid)||String(v.id)===String(contentId)||String(v.uvid)===String(contentId);',
      'matched&&videos.splice(r,1);',
     '}',
     'self.objMetaData&&self.objMetaData.updateProgressIndicator&&self.objMetaData.updateProgressIndicator({id:asset.id,duration:asset.duration,isAuthAuthorised:self.isAuthAuthorised(),uvid:asset.uvid});',
     'if(self.continueWatchingButton){var removedButton=self.continueWatchingButton,list=self.buttonHorizontalList;if(list){list.removeChildWidget(removedButton);if(list.getActiveChildWidget&&list.getActiveChildWidget()===removedButton){var next=self.favouritesButton||list.getChildWidgets&&list.getChildWidgets()[0];next&&list.setActiveChildWidget&&list.setActiveChildWidget(next);}}self.continueWatchingButton=null;self.setPlayButtonFocus();}',
    '},function(){console.warn("VM continue watching removal heartbeat failed for "+contentId);});',
   '},'
  ].join('');
  text=text.replace(anchor,'this.favouritesButton=this.appendControlButton(i,t)}},'+methods+'addButtonHorizontalList:function(){');
 }

  if(name.endsWith('/appui/components/details/seasonal.js') && name.includes('/1.172.0/')){
   const deps='define("whitelabelapp/appui/components/details/seasonal",["whitelabelapp/appui/components/details","whitelabelapp/appui/widgets/horizontallist","whitelabelapp/appui/widgets/verticallist","whitelabelapp/utils/state","antie/widgets/label"],(function(e,t,s,i,n){';
   if(text.split(deps).length!==2)throw Error('Seasonal Continue Watching dependency list changed');
   text=text.replace(deps,'define("whitelabelapp/appui/components/details/seasonal",["whitelabelapp/appui/components/details","whitelabelapp/appui/widgets/horizontallist","whitelabelapp/appui/widgets/verticallist","whitelabelapp/utils/state","antie/widgets/label","whitelabelapp/services/continuewatching","whitelabelapp/utils/playerheartbeat","whitelabelapp/utils/network/api"],(function(e,t,s,i,n,cw,heartbeat,api){');

   const init='e.base.call(this,"seasonalDetailsScreen"),console.warn("Skip calling addRentalsSupport")';
   if(text.split(init).length!==2)throw Error('Seasonal Continue Watching button id anchor changed');
   text=text.replace(init,init+',this.continueWatchingButtonId="continueWatchingBtn"');

   const style='["border-radius",n.buttonCorner],["top","0px"],["left","0px"]]),this.styleManager.setRules(a)}';
   if(text.split(style).length!==2)throw Error('Seasonal Continue Watching style anchor changed');
   text=text.replace(style,'["border-radius",n.buttonCorner],["top","0px"],["left","0px"]]),a.push(["#"+this.id+" #"+this.continueWatchingButtonId,["width","167px"],["height","92px"],["border-radius",n.buttonCorner],["left","0px"],["margin-left","10px"]]),a.push(["#"+this.id+" #"+this.continueWatchingButtonId+"Label",["position","absolute"],["font-size",n.getFontSize("detailsControlButton")+"px"],["line-height","61px"],["height","57px"],["top","36px"],["left","0px"],["text-align","center"],["width","167px"],["white-space","normal"]]),a.push(["#"+this.continueWatchingButtonId+"icon",["margin-left","62px"]]),a.push(["#vmContinueWatchingButtonRow",["white-space","nowrap !important"]]),a.push(["#vmContinueWatchingButtonRow > #"+this.favouritesButtonId+",#vmContinueWatchingButtonRow > #"+this.continueWatchingButtonId,["display","inline-block !important"],["vertical-align","middle"]]),this.styleManager.setRules(a)}');

   const anchor='this.buildProgrammeInfo(),this.appendFavouritesButton(this.seasonPanel),this.buildSeasonsList()},fillEpisodePanel:function(e){';
   if(text.split(anchor).length!==2)throw Error('Seasonal Continue Watching button insertion anchor changed');
   const methods=[
    'buildContinueWatchingButtonRow:function(){var e=new t("vmContinueWatchingButtonRow");this.vmButtonRow=e,this.seasonPanel.appendChildWidget(e),this.appendFavouritesButton(e),this.appendContinueWatchingButton(e)},',
    'findContinueWatchingEntry:function(){',
     'var data=cw.Models.readModelData(cw.modelId)||{},videos=data.videos||[],seasons=((this.getDataItem()||{}).series||{}).seasons||[];',
     'for(var v=0;v<videos.length;v++){',
      'var video=videos[v],progress=Number(cw.getViewingProgress(video.id));',
      'if(!progress||0===Number(progress))progress=Number(cw.getViewingProgress(video.uvid));',
      'if(!(Number(progress)>0))continue;',
      'for(var s=0;s<seasons.length;s++){',
       'var tiles=(seasons[s]&&seasons[s].tiles)||[];',
       'for(var e=0;e<tiles.length;e++){',
        'var ep=tiles[e];',
        'if(String(video.id)===String(ep.id)||String(video.id)===String(ep.uvid)||String(video.uvid)===String(ep.id)||String(video.uvid)===String(ep.uvid))return{video:video,asset:ep,progress:progress};',
       '}',
      '}',
     '}',
     'return null',
    '},',
    'shouldDisplayContinueWatchingButton:function(){return!!this.findContinueWatchingEntry()},',
    'appendContinueWatchingButton:function(t){',
     'var entry=this.findContinueWatchingEntry();',
     'if(entry){',
      'var e=this,s={image:{id:this.continueWatchingButtonId+"icon",url:this.utils.getAssetPath()+"/continuewatchingremove/white.svg",width:30,height:30},button:{id:this.continueWatchingButtonId,class:"controlbutton",text:this.utils.localiser.getString("button_mark_as_watched","Mark as watched"),callback:function(t){e.handleRemoveContinueWatching(t)}}};',
      'this.continueWatchingEntry=entry;',
      'this.continueWatchingButton=this.appendControlButton(s,t),this.continueWatchingButton.setAccessibleLabel(s.button.text)',
     '}',
    '},',
    'handleRemoveContinueWatching:function(t){',
     'var entry=this.continueWatchingEntry||this.findContinueWatchingEntry(),asset=entry&&entry.asset,duration=Number(asset&&asset.duration),contentId=asset&&this.utils.getUvid(asset,!0),self=this;',
     'if(!asset||!contentId||!isFinite(duration)||duration<=0)return;',
     'var config=this.Models.readModelData("config");',
     'if(config&&config.companyId)heartbeat.setCompanyId(config.companyId);',
     'var stream=this.Models.readModelData("stream"),streamHeartbeat=stream&&stream.response&&stream.response.heartbeat,endpoint=api.getEndpoint("heartBeatStart"),host=streamHeartbeat&&streamHeartbeat.url?streamHeartbeat.url:endpoint&&endpoint.host&&endpoint.host.replace("//api-","//heartbeat-");',
     'if(host)api.updateHost("heartBeatHost",host);',
     'heartbeat.setMediaId(contentId);heartbeat.send("heartBeatStart",{user_id:heartbeat.getUserId(),company_id:heartbeat.getCompanyId(),content_id:heartbeat.getMediaId(),content_type:String(asset.type||entry.video.type||"show").toLowerCase(),platform_id:heartbeat.getPlatformId(),play_head:duration},function(){',
      'console.log("VM continue watching removal accepted for "+contentId);',
      'window.vmContinueWatchingRemoved=!0;',
      'var data=cw.Models.readModelData(cw.modelId),videos=data&&data.videos;',
      'if(videos)for(var r=videos.length-1;r>=0;r--){',
       'var v=videos[r],matched=String(v.id)===String(asset.id)||String(v.uvid)===String(asset.uvid)||String(v.id)===String(contentId)||String(v.uvid)===String(contentId);',
       'matched&&videos.splice(r,1);',
      '}',
      'if(self.continueWatchingButton){var removedButton=self.continueWatchingButton,list=self.vmButtonRow||removedButton.parentWidget;if(list){list.removeChildWidget(removedButton);if(list.getActiveChildWidget&&list.getActiveChildWidget()===removedButton){var next=self.favouritesButton||list.getChildWidgets&&list.getChildWidgets()[0];if(next&&list.setActiveChildWidget&&list.setActiveChildWidget(next)&&list._setActiveChildFocussed)list._setActiveChildFocussed(!0);}}self.continueWatchingButton=null;self.continueWatchingEntry=null;}',
     '},function(){console.warn("VM continue watching removal heartbeat failed for "+contentId);});',
    '},'
   ].join('');
   text=text.replace(anchor,'this.buildProgrammeInfo(),this.buildContinueWatchingButtonRow(),this.buildSeasonsList()},'+methods+'fillEpisodePanel:function(e){');
  }

  if(name.endsWith('/utils/utils.js') && name.includes('/1.172.0/')){
   const postParse='postParseContentData:function(t){t&&t.sections&&t.sections.map((function(t){var e;return null===(e=t.tiles)||void 0===e?void 0:e.map((function(t){return t.originalTitle=t.title}))}))}';
   if(text.split(postParse).length!==2)throw Error('Post-parse title anchor changed');
   text=text.replace(postParse,'postParseContentData:function(t){t&&t.sections&&t.sections.map((function(t){var e;return null===(e=t.tiles)||void 0===e?void 0:e.map((function(t){return t.originalTitle=t.title&&" "!==t.title?t.title:t.originalTitle||t.title}))}))}');
  }

  if(name.endsWith('/appui/components/home.js') && name.includes('/1.172.0/')){
   const pruneAnchor='s.buildContentView({data:s.parseSectionsShowAllButtons(a),pageSize:i,calcEdgeDistance:false})}))()}},getCarouselSections:function';
   if(text.split(pruneAnchor).length!==2)throw Error('Home Continue Watching prune anchor changed');
   text=text.replace(pruneAnchor,'s.buildContentView({data:s.parseSectionsShowAllButtons(a),pageSize:i,calcEdgeDistance:false})}))()}},vmPruneEmptyContinueWatchingSection:function(e){var t,n=-1,o=this.getCarouselSections((e||[]).slice());for(t=0;t<o.length;t++)if(o[t]&&("resume_play"===o[t].id||"resume_play"===o[t].type)&&(!o[t].tiles||0===o[t].tiles.length)){n=t;break}if(n<0)return;var i=this[this.listViewId],s=i&&i._widgetStrip&&i._widgetStrip._childWidgetOrder,a=s&&s[n];if(a){var r=s.length;if(i.getActiveChildWidget&&i.getActiveChildWidget()===a){var l=s[n-1]||s[n+1];l&&i.setActiveChildWidget&&i.setActiveChildWidget(l)}this.removeCarousel({component:this,carousel:a,scaffold:i,config:this["section"+n+"Config"]});for(t=n;t<r-1;t++)this["section"+t]=this["section"+(t+1)],this["section"+t+"Config"]=this["section"+(t+1)+"Config"];delete this["section"+(r-1)];delete this["section"+(r-1)+"Config"]}for(t=e.length-1;t>=0;t--)if(e[t]&&("resume_play"===e[t].id||"resume_play"===e[t].type)&&(!e[t].tiles||0===e[t].tiles.length))e.splice(t,1);this.hideLoader()},getCarouselSections:function');
   const contentAnchor='var t=e.sections[0];if("carousel"===t.displayType&&t.tiles.length<3)for(var n=0;t.tiles.length<5;){var o=t.tiles[n++];t.tiles.push(o)}var a=s.getCarouselSections(_toConsumableArray(e.sections));';
   if(text.split(contentAnchor).length!==2)throw Error('Home build content anchor changed');
   text=text.replace(contentAnchor,'if(s.vmRemovalReturn&&window.vmContinueWatchingRemoved){s.vmPruneEmptyContinueWatchingSection(e.sections),window.vmContinueWatchingRemoved=!1,s.vmRemovalReturn=!1}var t=e.sections[0];if("carousel"===t.displayType&&t.tiles.length<3)for(var n=0;t.tiles.length<5;){var o=t.tiles[n++];t.tiles.push(o)}var a=s.getCarouselSections(_toConsumableArray(e.sections));');
   const showAnchor='onBeforeShow:function(e){if(this.redraw=this.canReDrawContent(),this.loggedIn()){var t=this;t.shouldShowCMPUI()?t._showsourcePointCMP(e):t._buildUI(e)}else this.shouldResumeSession()?this.resumeSession(e):this.shouldShowPromoUI()?this._showPromoUI(e):this.shouldShowCMPUI()?this._showsourcePointCMP(e):this._buildUI(e)},onAfterHide:function(e){';
   if(text.split(showAnchor).length!==2)throw Error('Home show anchor changed');
   text=text.replace(showAnchor,'onBeforeShow:function(e){var vmReturning=this.openedNewScreen,vmHome=this;if(this.redraw=this.canReDrawContent(),this.loggedIn()){var t=this;t.shouldShowCMPUI()?t._showsourcePointCMP(e):t._buildUI(e)}else this.shouldResumeSession()?this.resumeSession(e):this.shouldShowPromoUI()?this._showPromoUI(e):this.shouldShowCMPUI()?this._showsourcePointCMP(e):this._buildUI(e);vmHome.vmRemovalReturn=vmReturning&&vmHome.openedNewScreen&&window.vmContinueWatchingRemoved},onAfterHide:function(e){');
  }

  if(name.endsWith('/services/streams.js') && name.includes('/1.172.0/')){
  const field='device_type:"smarttv"';
  if(text.split(field).length!==3)throw Error('Stream request shapes changed');
  text=text.replaceAll(field,field+',protection:"playready"');
  const liveStart='liveStreamAcquisitionCall:function(e,t,i,a){var s=this;';
  if(text.split(liveStart).length!==2)throw Error('Live stream acquisition changed');
  text=text.replace(liveStart,'liveStreamAcquisitionCall:function(e,t,i,a){this.vmLiveStreamRequest=!0;var s=this;');
  const extra='this.addDeeplinkParam(e),e}';
  if(text.split(extra).length!==2)throw Error('Stream parameter chain changed');
  text=text.replace(extra,'this.addDeeplinkParam(e),this.vmLiveStreamRequest&&(console.log("VM live SSAI disabled for stable DASH"),e.disableSsai="1"),e}');
  const handoff='r=this.addAdditionalParams(r,d);var u=this.Models.readModelData("account")';
  if(text.split(handoff).length!==2)throw Error('Network request handoff changed');
  text=text.replace(handoff,'r=this.addAdditionalParams(r,d);this.vmLiveStreamRequest=!1;var u=this.Models.readModelData("account")');
 }

 if(name.endsWith('/devices/mediaplayer/shaka.js') && name.includes('/1.16.0/')){
  const library='"//cdn.jsdelivr.net/npm/shaka-player@"+a+"/dist/shaka-player.compiled."+s+".js"';
  if(!text.includes(library))throw Error('Shaka library URL changed');
  text=text.replace(library,'window.vmRoot+"shaka-legacy.js"');
  text=text.replace('window.playerVersion||"4.12.7"','window.playerVersion||"4.3.5-rte"');
  text=text.replace('this.shaka=new n.Player,this.overrideHeadWithGetRequest()',
   'this.shaka=new n.Player,window.vmShakaPlayer=this.shaka,this.shaka.configure({abr:{enabled:true},drm:{preferredKeySystems:["com.microsoft.playready"]},preferredAudioChannelCount:2,preferredVideoCodecs:["avc1"]}),this.shaka.addEventListener("error",function(event){var d=event.detail||{};console.log("VM Shaka error code="+d.code+" category="+d.category+" severity="+d.severity)}),this.overrideHeadWithGetRequest()');
  text=text.replace('setSource:function setSource(e,t,n){',
   'setSource:function setSource(e,t,n){this.vmSourceRetries=0;this.vmVodStartupGate=!this.vmIsLive&&e!==i.TYPE.LIVE_VIDEO&&e!==i.TYPE.LIVE_AUDIO;this.vmVodStartupGateLogged=!1;if(window.vmTimeline)window.vmTimeline.reset();');

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
  const setup='this.setupLanguageControl(),this._addInvisibleButton()';
  if(text.split(setup).length!==2)throw Error('Media control setup changed');
  text=text.replace(setup,'this.setupLanguageControl(),this.setupResolutionControl(),this._addInvisibleButton()');
  const setupFn='setupLanguageControl:function(){this.btnLanguage=new o("language")},_addInvisibleButton';
  if(text.split(setupFn).length!==2)throw Error('Language control factory changed');
  text=text.replace(setupFn,'setupLanguageControl:function(){this.btnLanguage=new o("language")},setupResolutionControl:function(){this.btnResolution=new o("resolution")},_addInvisibleButton');
  const listener='this.btnLanguage.addEventListener("select",(function(e){t.onLanguageSelect(e)}))';
  if(text.split(listener).length!==2)throw Error('Language listener changed');
  text=text.replace(listener,listener+',this.btnResolution.addEventListener("select",(function(e){t.onResolutionSelect(e)}))');
  const patchedLanguage='onLanguageSelect:function(){var t;null===(t=this.playerComponent)||void 0===t||t.showUI(),this.hidden||null===(t=this.playerComponent)||void 0===t||t.showLanguagePicker()}';
  const resolutionSelect='onResolutionSelect:function(){var t;null===(t=this.playerComponent)||void 0===t||t.showUI(),this.hidden||null===(t=this.playerComponent)||void 0===t||t.showResolutionPicker()}';
  if(text.split(patchedLanguage).length!==2)throw Error('Language handler changed');
  text=text.replace(patchedLanguage,patchedLanguage+','+resolutionSelect);
  const add='this.containerPlayerControlButtons.appendChildWidget(this.btnLanguage))';
  if(text.split(add).length!==2)throw Error('Language button append changed');
  const cog='<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M22.5201 14.2482C22.5681 13.8482 22.6001 13.4322 22.6001 13.0002C22.6001 12.5682 22.5681 12.1522 22.5041 11.7522L25.2081 9.6402C25.4481 9.4482 25.5121 9.0962 25.3681 8.8242L22.8081 4.3922C22.6481 4.1042 22.3121 4.0082 22.0241 4.1042L18.8401 5.3842C18.1681 4.8722 17.4641 4.4562 16.6801 4.1362L16.2001 0.744195C16.1521 0.424195 15.8801 0.200195 15.5601 0.200195H10.4401C10.1201 0.200195 9.86406 0.424195 9.81606 0.744195L9.33606 4.1362C8.55206 4.4562 7.83206 4.8882 7.17606 5.3842L3.99206 4.1042C3.70406 3.9922 3.36806 4.1042 3.20806 4.3922L0.648061 8.8242C0.488061 9.1122 0.552061 9.4482 0.808061 9.6402L3.51206 11.7522C3.44806 12.1522 3.40006 12.5842 3.40006 13.0002C3.40006 13.4162 3.43206 13.8482 3.49606 14.2482L0.792061 16.3602C0.552061 16.5522 0.488061 16.9042 0.632061 17.1762L3.19206 21.6082C3.35206 21.8962 3.68806 21.9922 3.97606 21.8962L7.16006 20.6162C7.83206 21.1282 8.53606 21.5442 9.32006 21.8642L9.80006 25.2562C9.86406 25.5762 10.1201 25.8002 10.4401 25.8002H15.5601C15.8801 25.8002 16.1521 25.5762 16.1841 25.2562L16.6641 21.8642C17.4481 21.5442 18.1681 21.1122 18.8241 20.6162L22.0081 21.8962C22.2961 22.0082 22.6321 21.8962 22.7921 21.6082L25.3521 17.1762C25.5121 16.8882 25.4481 16.5522 25.1921 16.3602L22.5201 14.2482ZM13.0001 17.8002C10.3601 17.8002 8.20006 15.6402 8.20006 13.0002C8.20006 10.3602 10.3601 8.2002 13.0001 8.2002C15.6401 8.2002 17.8001 10.3602 17.8001 13.0002C17.8001 15.6402 15.6401 17.8002 13.0001 17.8002Z" fill="white"></path></svg>';
  const cogData='data:image/svg+xml;base64,'+Buffer.from(cog).toString('base64');
  text=text.replace(add,'this.containerPlayerControlButtons.appendChildWidget(this.btnResolution),this.containerPlayerControlButtons.appendChildWidget(this.btnLanguage))');
  const remove='this.containerPlayerControlButtons.removeChildWidget(this.btnLanguage)';
  if(text.split(remove).length!==2)throw Error('Language button removal changed');
  text=text.replace(remove,remove+',this.containerPlayerControlButtons.removeChildWidget(this.btnResolution)');
  const styles='h.push(w),h.push(f),';
  if(text.split(styles).length!==2)throw Error('Footer styles changed');
  text=text.replace(styles,styles+'h.push(["#"+this.id+" #resolution",["background-image","url('+cogData+')"],["background-size","36px"],["background-position","center"],["background-repeat","no-repeat"],["position","absolute"],["right","210px"],["padding","0px"],["box-sizing","border-box"]]),h.push(["#"+this.id+" #resolution.button.buttonFocussed",["background-color",d]]),');
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
  text=text.replace(adStart,'beginADsAndStreamPlayback:function(e,t){console.log("VM client ad insertion disabled");this.adTypeParser=new f({});return void this.beginPlayback(this.url,!0);');
  const capture='capturePlayhead:function(){var e=o.getDuration(),t=this.getCurrentTime(),i=w.getDataItem(),s=this.utils.getUvid(i);this.loggedIn()&&p.setViewingProgress(s,t),this.adActive||t>30&&t<.95*e&&(i.airdate||(i.airdate=Date.now()),this.viewTracker.capture({uvid:i.id,airdate:i.airdate,playhead:t}))}';
  if(text.split(capture).length!==2)throw Error('Progress capture changed');
  text=text.replace(capture,'capturePlayhead:function(){if(this.isLive()||this.getAdPlaying())return;var duration=o.getDuration(),time=this.getCurrentTime(),data=w.getDataItem(),id=this.utils.getUvid(data);if(!isFinite(time)||time<=0)return;if(this.loggedIn())p.setViewingProgress(id,time);if(time>30&&time<.95*duration){if(!data.airdate)data.airdate=Date.now();this.viewTracker.capture({uvid:id,airdate:data.airdate,playhead:time});console.log("VM resume stored position="+time);}}');
  text=text.replace('a.viewTracker.deleteRecord(i)','a.viewTracker.deleteRecord(i),p.setViewingProgress(i,0)');
  text=text.replace('this.setActiveChildWidget(this.languagePicker)},hideLanguagePicker:', 'this.setActiveChildWidget(this.languagePicker),window.vmPickerTheme=(function(){var h=document.getElementById("languageHeading"),p=document.getElementById("languagePicker"),d=document.getElementById("divider"),pb=document.getElementById("enmainButton"),hs=h&&getComputedStyle(h),ps=p&&getComputedStyle(p),ds=d&&getComputedStyle(d),bs=pb&&getComputedStyle(pb),m=bs&&bs.boxShadow&&bs.boxShadow.match(/rgb\\([^)]*\\)/);return {headingFont:hs&&hs.fontFamily,textFont:bs&&bs.fontFamily,text:ps&&ps.color,background:ps&&ps.backgroundColor,divider:ds&&ds.backgroundColor,button:m&&m[0]};})(),console.log("VM subtitle panel opened")},hideLanguagePicker:');
  text=text.replace('showLanguagePicker:function(){','showLanguagePicker:function(){if(window.vmNativeOptions&&window.vmNativeOptions.open())return;');
  text=text.replace('onBeforeShow:function(e){','onBeforeShow:function(e){this.vmNativeRecoveryCount=0;this.player.vmOwner=this;');
  text=text.replace('hideLanguagePicker:function(){', 'hideLanguagePicker:function(){if(this.languagePicker)console.log("VM subtitle panel closed");');
  const incapability='handleLanguagePickingIncapability:function(){';
  if(text.split(incapability).length!==2)throw Error('Language picker incapability handler changed');
  text=text.replace(incapability,'showResolutionPicker:function(){this.hideLanguagePicker();this.hideInfoPanel();if(window.vmResolutionPanel&&window.vmResolutionPanel.open(this.hideResolutionPicker.bind(this))){this.overlayPanelVisible=!0;this.previousActiveWidget=this.getActiveChildWidget();this.hideUI(0);console.log("VM resolution panel opened");return;}var t;(t=this.footer)||void 0===t||t.showPlayerControlWarning("not_available_now")},hideResolutionPicker:function(){window.vmResolutionPanel&&window.vmResolutionPanel.close();this.overlayPanelVisible=!1;this.showUI();this.previousActiveWidget&&this.setActiveChildWidget(this.previousActiveWidget);console.log("VM resolution panel closed")},'+incapability);
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
  const sourceHook='setPlaybackSource:function(e,t,i,r,s,n){var a=n?r:null;';
  if(!text.includes(sourceHook))throw Error('Playback source handoff changed');
  text=text.replace(sourceHook,'setPlaybackSource:function(e,t,i,r,s,n){this.player.vmIsLive=!!n;console.log("VM source live flag="+!!n);var a=n?r:null;');
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
  html=html.replace('</script>','</script><script src="$WEBAPIS/webapis/webapis.js"></script><script src="'+relative+'/live-timing.js"></script><script src="'+relative+'/quality.js"></script><script src="'+relative+'/avplay.js"></script><script src="'+relative+'/subtitles.js"></script><script src="'+relative+'/options.js"></script><script src="'+relative+'/resolution.js"></script><script src="'+relative+'/remote.js"></script>');
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
fs.copyFileSync(path.join(root,'tv/resolution.js'),path.join(dest,'resolution.js'));
fs.rmSync(path.join(dest,'boundary-sync.js'),{force:true});
fs.copyFileSync(path.join(root,'tv/live-timing.js'),path.join(dest,'live-timing.js'));
fs.copyFileSync(path.join(root,'widget/icon.png'),path.join(dest,'icon.png'));
fs.writeFileSync(path.join(dest,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><script>location.replace("./whitelabel/app/release/1.172.0/default-webkit-default.html?env=prd&cid=vmtv&platform=sam&platformenv=prd&httpforced=1");</script></head><body style="background:black"></body></html>');
const widgetId='https://example.invalid/virgin-media-play';
const appName='Virgin Media Play';
const appId='VmPlay2016.Player';
const packageId='VmPlay2016';
fs.writeFileSync(path.join(dest,'config.xml'),`<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="${widgetId}" version="${manifestVersion}" viewmodes="maximized">
<name>${appName}</name><icon src="icon.png"/><content src="index.html"/>
<tizen:application id="${appId}" package="${packageId}" required_version="2.4"/>
<tizen:profile name="tv-samsung"/><access origin="*" subdomains="true"/>
<tizen:privilege name="http://tizen.org/privilege/internet"/>
<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
<tizen:privilege name="http://developer.samsung.com/privilege/drmplay"/>
<tizen:setting screen-orientation="landscape" context-menu="disable" hwkey-event="enable"/>
</widget>
`);
for(const name of fs.readdirSync(dest,{recursive:true})){
 if(path.basename(name)==='.DS_Store')fs.rmSync(path.join(dest,name),{force:true});
}
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
