// Standalone quality policy. Samsung applies bitrate policy while IDLE,
// so changing quality reopens the same source and resumes its current position.
(function(){
 var active=null,key='vm-play-quality',preference='auto',selected='auto',cache={};
 try{preference=localStorage.getItem(key)||'auto';}catch(ignore){}
 function variants(text){
  var doc=new DOMParser().parseFromString(text,'application/xml'),nodes=doc.getElementsByTagName('*'),heights={};
  for(var i=0;i<nodes.length;i++){
   var node=nodes[i];if((node.localName||node.nodeName).split(':').pop()!=='Representation')continue;
   var height=Number(node.getAttribute('height')||(node.parentNode&&node.parentNode.getAttribute('height'))),bandwidth=Number(node.getAttribute('bandwidth'));
   if(height>0&&height<=1080&&bandwidth>0&&(!heights[height]||heights[height]<bandwidth))heights[height]=bandwidth;
  }
  var result=[];for(var h in heights)if(Object.prototype.hasOwnProperty.call(heights,h))result.push({value:String(h),label:h+'p',bitrate:heights[h]});
  return result.sort(function(a,b){return Number(b.value)-Number(a.value);}).slice(0,5);
 }
 function choice(){
  if(!active||preference==='auto')return null;
  for(var i=0;i<active.options.length;i++)if(active.options[i].value===preference)return active.options[i];
  return null;
 }
 window.vmQuality={
  resolve:function(driver,source){
   if(driver._mimeType!=='application/dash+xml'||!driver.vmOwner){
    active=null;selected='auto';return Promise.resolve();
   }
   var live=!!driver.vmOwner.isLive();
   if(active&&active.driver===driver&&active.source===source&&active.live===live)return !live&&preference==='auto'?Promise.resolve():active.pending;
   var state=active={driver:driver,source:source,live:live,options:cache[source]||[]};selected='auto';
   if(state.options.length){state.pending=Promise.resolve();return state.pending;}
   state.pending=new Promise(function(resolve){
    var xhr=new XMLHttpRequest();xhr.open('GET',source,true);xhr.timeout=4000;
    function done(){resolve();}
    xhr.onload=function(){if(xhr.status>=200&&xhr.status<300){try{state.options=variants(xhr.responseText);cache[source]=state.options;console.log('VM quality options '+state.options.map(function(option){return option.value;}).join(','));}catch(ignore){}}done();};
    xhr.onerror=xhr.ontimeout=done;
    try{xhr.send();}catch(ignore){done();}
   });
   return !live&&preference==='auto'?Promise.resolve():state.pending;
  },
  apply:function(driver,player){
   selected='auto';if(!active||active.driver!==driver)return;
   var target=choice();
   if(active.live)target=null;
   if(active.live&&window.vmFixedLive720Enabled){for(var i=0;i<active.options.length;i++)if(Number(active.options[i].value)<=720){target=active.options[i];break;}if(!target&&active.options.length)target=active.options[active.options.length-1];}
   try{
    player.setStreamingProperty('ADAPTIVE_INFO',target?'BITRATES='+target.bitrate+'|STARTBITRATE='+target.bitrate+'|SKIPBITRATE='+target.bitrate:'STARTBITRATE=HIGHEST');
    if(target){selected=target.value;console.log('VM AVPlay quality requested '+target.label+' bitrate='+target.bitrate+' live='+active.live);}
    else console.log('VM AVPlay quality Auto high start');
   }catch(error){console.log('VM AVPlay quality unavailable '+error.name);}
  },
  choices:function(){return active&&!active.live&&active.options.length?[{value:'auto',label:'Auto'}].concat(active.options):[];},
  selected:function(){return selected;},
  liveStatus:function(){if(!active||!active.live)return null;var height=active.driver.vmVideoHeight;return (window.vmFixedLive720Enabled?'Fixed':'Auto')+(height?' ('+height+'p)':'');},
  select:function(value){
   if(!active||active.live||value===selected)return;
   var options=this.choices(),allowed=false;
   for(var i=0;i<options.length;i++)if(options[i].value===value)allowed=true;
   if(!allowed)return;
   preference=value;try{localStorage.setItem(key,value);}catch(ignore){}
   var driver=active.driver,position=window.vmAvPlay.current(driver);
   try{if(driver.vmOwner&&driver.vmOwner.capturePlayhead)driver.vmOwner.capturePlayhead();}catch(ignore){}
   console.log('VM AVPlay quality change to='+value+' resume='+position);
   window.vmAvPlay.begin(driver,position);
  },
  clear:function(driver){if(active&&active.driver===driver){active=null;selected='auto';}},
  variants:variants
 };
}());
