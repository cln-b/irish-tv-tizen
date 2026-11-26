(function(){
 function decodeEntities(value){
  var named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'",'#x27':"'"};
  return String(value||'').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|#\d+|#x[0-9a-f]+);/gi,function(entity){
   var key=entity.slice(1,-1).toLowerCase(),code;
   if(named[key])return named[key];
   code=/^#x/i.test(key)?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
   return isNaN(code)?entity:String.fromCharCode(code);
  });
 }
 function absoluteUrl(base,ref){
  ref=String(ref||'').replace(/^\s+|\s+$/g,'');
  if(/^https?:\/\//i.test(ref))return ref;
  var match=/^([a-z]+:\/\/[^/]+)(\/.*)$/i.exec(String(base||''));
  if(!match)return ref;
  if(ref.charAt(0)==='/')return match[1]+ref;
  var prefix=match[2].slice(0,match[2].lastIndexOf('/')+1);
  return match[1]+prefix+ref;
 }
 function parseManifest(text,base){
  var tracks=[],re=/<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/gi,match,langMatch,labelMatch,baseMatch,lang,label;
  while((match=re.exec(String(text||'')))){
   if(!/mimeType\s*=\s*["']text\/vtt["']/i.test(match[1]))continue;
   langMatch=/lang\s*=\s*["']([^"']+)["']/i.exec(match[1]);
   labelMatch=/<Label\b[^>]*>([\s\S]*?)<\/Label>/i.exec(match[2]);
   baseMatch=/<BaseURL\b[^>]*>([\s\S]*?)<\/BaseURL>/i.exec(match[2]);
   if(!baseMatch)continue;
   lang=langMatch?decodeEntities(langMatch[1]):'';
   label=labelMatch?decodeEntities(labelMatch[1].replace(/<[^>]*>/g,'')):lang;
   tracks.push({kind:'subtitles',language:lang,label:label||lang,mode:'disabled',cues:[],url:absoluteUrl(base,decodeEntities(baseMatch[1]))});
  }
  return tracks;
 }
 function parseTime(value){
  value=String(value||'').replace(/^\s+|\s+$/g,'').split(/\s+/)[0];
  var parts=value.split(':'),seconds=0,i;
  for(i=0;i<parts.length;i++)seconds=seconds*60+parseFloat(parts[i]||'0');
  return isNaN(seconds)?NaN:seconds;
 }
 function parseVtt(text){
  var cues=[],lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),i=0,timing,start,end,payload;
  while(i<lines.length){
   timing=/--\s*>/.test(lines[i])?lines[i].split(/--\s*>/):null;
   if(!timing||timing.length<2){i++;continue;}
   start=parseTime(timing[0]);end=parseTime(timing[1]);
   i++;payload=[];
   while(i<lines.length&&String(lines[i]).replace(/^\s+|\s+$/g,'')!==''){payload.push(lines[i]);i++;}
   if(!isNaN(start)&&!isNaN(end))cues.push({start:start,end:end,text:decodeEntities(payload.join('\n'))});
  }
  return cues;
 }
 window.__tg4NativeMedia=function(video){
  if(video._nativeVideo)return video;
  var facade={_nativeVideo:video};
  ['parentNode','parentElement','ownerDocument','style','id','tagName','nodeName','nodeType','textTracks','offsetWidth','offsetHeight','clientWidth','clientHeight','src','poster','currentSrc','muted','volume','ended','autoplay','preload'].forEach(function(key){Object.defineProperty(facade,key,{configurable:true,get:function(){return video[key]},set:function(value){video[key]=value}});});
  ['addEventListener','removeEventListener','dispatchEvent','getAttribute','setAttribute','removeAttribute','getBoundingClientRect','load','play','pause'].forEach(function(key){facade[key]=function(){return video[key].apply(video,arguments)}});
  return facade;
 };

 window.__tg4StartPlayer=function(dash,video,url){
  var api=webapis.avplay,root=video.parentNode,view=document.getElementById('tg4-player').__vue__,proxy=view._setupProxy,selected=proxy.getPlaybackData(proxy.video),ready=false,paused=true,error=null,closed=false;
  var live=!!proxy.live,worldwide=live&&String(proxy.video.id)===window.tg4Worldwide.providerId;
  var nativeTracks=[],activeTrack=null,selectedTextIndex=-1,pendingTextIndex=0,captionNode=null,captionText=null,lastCaption='';
  var media=video._nativeVideo||video;
  var diag=window.__tg4Diagnostics.player={backend:'AVPlay',videoPresent:!!video,initializeCalled:true,worldwide:worldwide,events:[],setup:[]};
  function note(type,value){diag.events.push([type,String(value).slice(0,200)]);if(diag.events.length>40)diag.events.shift();}
  function setupNote(type,value){diag.setup.push([type,String(value).slice(0,200)]);if(diag.setup.length>40)diag.setup.shift();}
  function urlShape(target){
   var text=String(target||''),match=/^([a-z]+:\/\/[^/?#]+)([^?#]*)(\?[^#]*)?/i.exec(text);
   if(!match)return {length:text.length};
   return {protocol:match[1].split(':')[0],host:match[1].replace(/^[a-z]+:\/\//i,''),path:match[2].replace(/eyJ[A-Za-z0-9_.-]+/g,'<JWT>').replace(/[A-Za-z0-9_-]{32,}/g,'<SEG>'),queryKeys:(match[3]||'').slice(1).split('&').filter(Boolean).map(function(item){return item.split('=')[0];}),length:text.length};
  }
  function emit(type){var e=document.createEvent('Event');e.initEvent(type,true,false);video.dispatchEvent(e);}
  function call(name,fallback){try{return api[name]();}catch(e){return fallback;}}
  function setState(name,value){try{if(view._setupState&&view._setupState[name])view._setupState[name].value=value;}catch(e){}try{if(view._setupProxy)view._setupProxy[name]=value;}catch(e){}}
  function ensureCaptionNode(){
   if(captionNode||!root||!document.createElement)return;
   captionNode=document.createElement('div');captionNode.className='tg4-native-caption';captionNode.style.cssText='position:absolute;left:8%;right:8%;bottom:12%;z-index:1000;text-align:center;pointer-events:none;display:none;';
   captionText=document.createElement('div');captionText.style.cssText='display:inline-block;max-width:92%;padding:6px 14px;background:rgba(0,0,0,0.72);color:#fff;font:32px/1.25 sans-serif;white-space:pre-line;text-shadow:2px 2px 2px #000;';
   captionNode.appendChild(captionText);root.appendChild(captionNode);
  }
  function updateCaptions(position){
   if(!activeTrack||!captionText)return;
   var cues=activeTrack.cues||[],text='',i,cue;
   for(i=0;i<cues.length;i++){cue=cues[i];if(position>=cue.start&&position<=cue.end)text+=(text?'\n':'')+cue.text;}
   if(text===lastCaption)return;
   lastCaption=text;captionText.textContent=text;captionNode.style.display=text?'block':'none';
  }
  function fetchTrack(track){
    if(!track||(track.cues&&track.cues.length)||track.loading)return;
    track.loading=true;
    requestText(track.url,function(body,status){
     track.loading=false;
     if(body){try{track.cues=parseVtt(body);}catch(e){note('subtitle-vtt-parse',track.language);}}else note('subtitle-vtt-failed',track.language+':'+status);
     diag.subtitleCues=(diag.subtitleCues||0)+(track.cues?track.cues.length:0);
     note('subtitle-ready',track.language+':'+(track.cues?track.cues.length:0));
     if(activeTrack===track)updateCaptions(video.currentTime);
    });
   }
   function selectText(index){
   selectedTextIndex=index;pendingTextIndex=index;
   var i,track=null;
   if(index>=0&&index<nativeTracks.length)track=nativeTracks[index];
   activeTrack=track;
   for(i=0;i<nativeTracks.length;i++)nativeTracks[i].mode=i===index?'showing':'hidden';
   setState('textTracksEnabled',!!track);setState('selectedTrackIndex',index<0?0:index);
   if(!track){lastCaption='';if(captionText)captionText.textContent='';if(captionNode)captionNode.style.display='none';return;}
   ensureCaptionNode();fetchTrack(track);updateCaptions(video.currentTime);
  }
  function disableText(){selectText(-1);}
  function publishTracks(){
   try{Object.defineProperty(video,'textTracks',{configurable:true,get:function(){return nativeTracks;}});}catch(e){note('textTracks-property',e&&e.message||e);}
   setState('textTracks',nativeTracks);setState('updateTextTracks',true);
   if(pendingTextIndex>=0)selectText(pendingTextIndex);
  }
  function requestText(target,onDone){
   try{
    if(typeof XMLHttpRequest==='undefined'){onDone(null,'XMLHttpRequest unavailable');return;}
    var xhr=new XMLHttpRequest();xhr.open('GET',target,true);
    xhr.onreadystatechange=function(){if(xhr.readyState===4)onDone(xhr.status>=200&&xhr.status<300?xhr.responseText:null,xhr.status);};
    xhr.send();
   }catch(e){onDone(null,e&&e.message||e);}
  }
  function loadSubtitles(){
   if(live||!url)return;
   requestText(url,function(manifest,status){
    if(!manifest){note('subtitle-manifest-failed',status);return;}
    try{nativeTracks=parseManifest(manifest,url);}catch(e){note('subtitle-manifest-parse',e&&e.message||e);return;}
    diag.subtitleTracks=nativeTracks.length;
    if(!nativeTracks.length){note('subtitle-tracks',0);return;}
    note('subtitle-tracks',nativeTracks.length);
    publishTracks();
    var initial=pendingTextIndex>=0?pendingTextIndex:0;
    fetchTrack(nativeTracks[initial]);
   });
  }
  function stop(){
   if(closed)return;closed=true;
   try{api.stop();}catch(e){}
   try{api.close();}catch(e){}
   if(object.parentNode)object.parentNode.removeChild(object);
   if(captionNode&&captionNode.parentNode)captionNode.parentNode.removeChild(captionNode);
   captionNode=null;captionText=null;lastCaption='';activeTrack=null;nativeTracks=[];
   video.style.visibility='';backgrounds.forEach(function(x){x.node.style.backgroundColor=x.value;});
  }
  try{dash.destroy();}catch(ignore){}try{video.pause();video.removeAttribute('src');video.load();}catch(ignore){}
  try{if(api.getState()!=='NONE'){try{api.stop();}catch(ignore){}api.close();}}catch(ignore){}
  var object=document.createElement('object');object.type='application/avplayer';object.style.cssText='position:absolute;left:0;top:0;width:1920px;height:1080px;background:transparent;z-index:0';root.insertBefore(object,root.firstChild);video.style.visibility='hidden';
  var backgrounds=[];for(var node=root;node&&node.style;node=node.parentNode){backgrounds.push({node:node,value:node.style.backgroundColor});node.style.backgroundColor='transparent';}
  function property(name,get,set){try{Object.defineProperty(video,name,{configurable:true,get:get,set:set});}catch(e){note('property',name+':'+e);}}
  property('currentTime',function(){return call('getCurrentTime',0)/1000},function(v){if(ready)api.seekTo(v*1000)});property('duration',function(){return call('getDuration',0)/1000});property('paused',function(){return paused});property('readyState',function(){return ready?4:0});property('error',function(){return error});
  video.play=function(){if(ready){api.play();paused=false;emit('play');emit('playing')}};video.pause=function(){if(ready){api.pause();paused=true;emit('pause')}};
  dash.time=function(){return video.currentTime};dash.duration=function(){return video.duration};dash.isReady=function(){return ready};dash.isPaused=function(){return paused};dash.play=video.play;dash.pause=video.pause;dash.seek=function(t){video.currentTime=t};dash.getBufferLength=function(){return NaN};dash.getDvrWindow=function(){return {start:0,end:video.duration}};dash.seekToPresentationTime=dash.seek;dash.destroy=stop;dash.reset=stop;
  dash.setTextTrack=function(index){selectText(Number(index)||0)};
  dash.enableText=function(enabled){if(enabled)selectText(selectedTextIndex>=0?selectedTextIndex:0);else disableText()};
  function fail(e){diag.error=String(e&&e.message||e);error={code:4,message:diag.error};note('error',diag.error);emit('error');}
  try{
   var license=selected.protData&&selected.protData['com.microsoft.playready'];
   if(worldwide&&selected.protData)throw Error('Worldwide source unexpectedly requires DRM');
   setupNote('state-before-open',api.getState());setupNote('media-url',JSON.stringify(urlShape(url)));
   api.open(url);
   setupNote('state-after-open',api.getState());
   api.setDisplayRect(0,0,1920,1080);api.setListener({onbufferingstart:function(){emit('waiting')},onbufferingcomplete:function(){emit('canplay');emit('playing');updateCaptions(video.currentTime)},oncurrentplaytime:function(t){diag.time=t;updateCaptions(t/1000);emit('timeupdate')},onerror:fail,onerrormsg:function(c,m){note(c,String(m).split('?')[0].slice(0,140))},ondrmevent:function(t,d){note('drm',t+':'+(d&&d.name||'')+':'+(d&&d.error_code||''))},onstreamcompleted:function(){emit('ended')}});
   if(license){
    setupNote('license-url',JSON.stringify(urlShape(license.serverURL)));setupNote('state-before-drm',api.getState());
    try{api.setDrm('PLAYREADY','SetProperties',JSON.stringify({DeleteLicenseAfterUse:true,LicenseServer:license.serverURL}));setupNote('setDrm-ok',api.getState());}
    catch(e){setupNote('setDrm-error',(e&&e.name||'Error')+':'+(e&&e.code||'')+':'+String(e&&e.message||e));throw e;}
   }
   setupNote('state-before-prepare',api.getState());
   api.prepareAsync(function(){if(closed)return;ready=true;diag.prepared=true;var resume=live?0:Number(proxy.startTime)||0;function begin(){emit('loadedmetadata');video.play();}if(resume>0){diag.resumeRequested=resume;api.seekTo(Math.round(resume*1000),function(){diag.resumeCompleted=api.getCurrentTime()/1000;try{view._setupState.startTime.value=0;}catch(ignore){}begin();},function(e){note('resume-error',String(e));begin();});}else begin();},fail);
   loadSubtitles();
  }catch(e){fail(e)}
 };
})();
