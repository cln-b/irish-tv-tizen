(function(){
 window.__tg4NativeMedia=function(video){
  if(video._nativeVideo)return video;
  var facade={_nativeVideo:video};
  ['parentNode','parentElement','ownerDocument','style','id','tagName','nodeName','nodeType','textTracks','offsetWidth','offsetHeight','clientWidth','clientHeight','src','poster','currentSrc','muted','volume','ended','autoplay','preload'].forEach(function(key){Object.defineProperty(facade,key,{configurable:true,get:function(){return video[key]},set:function(value){video[key]=value}});});
  ['addEventListener','removeEventListener','dispatchEvent','getAttribute','setAttribute','removeAttribute','getBoundingClientRect','load','play','pause'].forEach(function(key){facade[key]=function(){return video[key].apply(video,arguments)}});
  return facade;
 };

 window.__tg4StartPlayer=function(dash,video,url){
  var api=webapis.avplay,root=video.parentNode,view=document.getElementById('tg4-player').__vue__,proxy=view._setupProxy,selected=proxy.getPlaybackData(proxy.video),ready=false,paused=true,error=null,closed=false;
  var diag=window.__tg4Diagnostics.player={backend:'AVPlay',videoPresent:!!video,initializeCalled:true,events:[]};
  function note(type,value){diag.events.push([type,value]);if(diag.events.length>25)diag.events.shift();}
  function emit(type){var e=document.createEvent('Event');e.initEvent(type,true,false);video.dispatchEvent(e);}
  function call(name,fallback){try{return api[name]();}catch(e){return fallback;}}
  function stop(){if(closed)return;closed=true;try{api.stop();}catch(e){}try{api.close();}catch(e){}if(object.parentNode)object.parentNode.removeChild(object);video.style.visibility='';backgrounds.forEach(function(x){x.node.style.backgroundColor=x.value;});}
  try{dash.destroy();}catch(ignore){}try{video.pause();video.removeAttribute('src');video.load();}catch(ignore){}
  try{if(api.getState()!=='NONE'){try{api.stop();}catch(ignore){}api.close();}}catch(ignore){}
  var object=document.createElement('object');object.type='application/avplayer';object.style.cssText='position:absolute;left:0;top:0;width:1920px;height:1080px;background:transparent;z-index:0';root.insertBefore(object,root.firstChild);video.style.visibility='hidden';
  var backgrounds=[];for(var node=root;node&&node.style;node=node.parentNode){backgrounds.push({node:node,value:node.style.backgroundColor});node.style.backgroundColor='transparent';}
  function property(name,get,set){try{Object.defineProperty(video,name,{configurable:true,get:get,set:set});}catch(e){note('property',name+':'+e);}}
  property('currentTime',function(){return call('getCurrentTime',0)/1000},function(v){if(ready)api.seekTo(v*1000)});property('duration',function(){return call('getDuration',0)/1000});property('paused',function(){return paused});property('readyState',function(){return ready?4:0});property('error',function(){return error});
  video.play=function(){if(ready){api.play();paused=false;emit('play');emit('playing')}};video.pause=function(){if(ready){api.pause();paused=true;emit('pause')}};
  dash.time=function(){return video.currentTime};dash.duration=function(){return video.duration};dash.isReady=function(){return ready};dash.isPaused=function(){return paused};dash.play=video.play;dash.pause=video.pause;dash.seek=function(t){video.currentTime=t};dash.getBufferLength=function(){return NaN};dash.getDvrWindow=function(){return {start:0,end:video.duration}};dash.seekToPresentationTime=dash.seek;dash.destroy=stop;dash.reset=stop;
  function fail(e){diag.error=String(e&&e.message||e);error={code:4,message:diag.error};note('error',diag.error);emit('error');}
  try{
   api.open(url);api.setDisplayRect(0,0,1920,1080);api.setListener({onbufferingstart:function(){emit('waiting')},onbufferingcomplete:function(){emit('canplay');emit('playing')},oncurrentplaytime:function(t){diag.time=t;emit('timeupdate')},onerror:fail,onerrormsg:function(c,m){note(c,String(m).split('?')[0].slice(0,140))},ondrmevent:function(t,d){note('drm',t+':'+(d&&d.name||'')+':'+(d&&d.error_code||''))},onstreamcompleted:function(){emit('ended')}});
   var license=selected.protData&&selected.protData['com.microsoft.playready'];if(license)api.setDrm('PLAYREADY','SetProperties',JSON.stringify({DeleteLicenseAfterUse:true,LicenseServer:license.serverURL}));
   api.prepareAsync(function(){if(closed)return;ready=true;diag.prepared=true;var resume=Number(proxy.startTime)||0;function begin(){emit('loadedmetadata');video.play();}if(resume>0){diag.resumeRequested=resume;api.seekTo(Math.round(resume*1000),function(){diag.resumeCompleted=api.getCurrentTime()/1000;try{view._setupState.startTime.value=0;}catch(ignore){}begin();},function(e){note('resume-error',String(e));begin();});}else begin();},fail);
  }catch(e){fail(e)}
 };
})();
