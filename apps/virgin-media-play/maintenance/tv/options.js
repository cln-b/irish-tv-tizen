// Native-player options, independent of the HbbTV HTML5 track widget.
(function(){
 var panel=null,groups=[],column=1,row=0,lastKey=null;
 function clear(element){while(element.firstChild)element.removeChild(element.firstChild);}
 function make(tag,text,css){var element=document.createElement(tag);if(text)element.textContent=text;if(css)element.style.cssText=css;return element;}
 function close(){if(panel&&panel.parentNode)panel.parentNode.removeChild(panel);panel=null;groups=[];console.log('VM native options closed');}
 function fit(){
  if(!panel)return;
  panel.style.webkitTransform=panel.style.transform='none';
  var bounds=panel.getBoundingClientRect(),scaleX=window.innerWidth/(bounds.width||1280),scaleY=window.innerHeight/(bounds.height||720);
  panel.style.webkitTransformOrigin=panel.style.transformOrigin='0 0';
  panel.style.webkitTransform=panel.style.transform='scale('+scaleX+','+scaleY+')';
 }
 function label(track,fallback){
  var language=String(track.language||'').toLowerCase(),names={en:'English',eng:'English',ga:'Irish',gle:'Irish',cy:'Welsh',cym:'Welsh'};
  return names[language]||track.label||track.language||fallback;
 }
 function draw(){
  if(!panel)return;clear(panel);
  panel.appendChild(make('div','Player options','position:absolute;left:70px;top:45px;font-size:30px;font-weight:bold'));
  for(var c=0;c<groups.length;c++){
   var group=groups[c],left=70+c*395;
   panel.appendChild(make('div',group.title,'position:absolute;left:'+left+'px;top:125px;font-size:25px'));
   for(var r=0;r<group.items.length;r++){
    var item=group.items[r],focused=c===column&&r===row;
    panel.appendChild(make('div',(item.selected?'\u2713 ':'')+item.label,
     'position:absolute;box-sizing:border-box;left:'+left+'px;top:'+(175+r*60)+'px;width:345px;height:50px;padding:10px 14px;font-size:22px;border-radius:5px;border:2px solid '+(focused?'#ff0033':'transparent')+';background:'+(focused?'#292929':'transparent')));
   }
  }
  panel.appendChild(make('div','Use arrow keys to choose, OK to select, Return to close','position:absolute;left:70px;top:650px;font-size:20px;color:#ccc'));
 }
 function choose(){
  var item=groups[column].items[row];if(item.disabled)return;
  if(column===1){close();window.vmQuality.select(item.value);return;}
  try{item.choose();for(var i=0;i<groups[column].items.length;i++)groups[column].items[i].selected=i===row;draw();}
  catch(error){console.log('VM native track selection failed '+error.name);}
 }
 function handle(event){
  if(!panel)return;
  var code=event.keyCode;
  if([13,37,38,39,40,8,27,461,10009].indexOf(code)<0)return;
  lastKey=code;event.preventDefault();event.stopImmediatePropagation();
  if(code===8||code===27||code===461||code===10009){close();return;}
  if(code===37){column=Math.max(0,column-1);row=0;}
  if(code===39){column=Math.min(groups.length-1,column+1);row=0;}
  if(code===38)row=Math.max(0,row-1);
  if(code===40)row=Math.min(groups[column].items.length-1,row+1);
  if(code===13){choose();return;}draw();
 }
 window.addEventListener('keydown',handle,true);
 window.addEventListener('resize',fit,false);
 window.addEventListener('keyup',function(event){if(event.keyCode===lastKey){lastKey=null;event.preventDefault();event.stopImmediatePropagation();}},true);
 window.vmNativeOptions={close:close,refresh:function(){if(!panel)return;var c=column,r=row;close();this.open();column=c;row=Math.min(r,groups[c].items.length-1);draw();},open:function(){
  var helper=window.vmAvPlay,driver=helper&&helper.active();
  if(!driver||driver._mimeType!=='application/dash+xml')return false;
  if(panel)return true;
  var audio=helper.audioTracks(),text=helper.textTracks(),quality=window.vmQuality?window.vmQuality.choices():[];
  groups=[{title:'Audio',items:audio.map(function(track){return {label:label(track,'Audio'),selected:track.active,choose:function(){helper.selectAudio(track.id);}};})},
   {title:'Picture quality',items:quality.map(function(choice){return {label:choice.label,value:choice.value,selected:choice.value===window.vmQuality.selected()};})},
   {title:'Subtitles',items:(text.length?[{label:'Off',selected:!driver.vmTextVisible,choose:function(){helper.selectText(null);}}].concat(text.map(function(track){return {label:label(track,'Subtitles'),selected:track.active,choose:function(){helper.selectText(track.id);}};})):[])}];
  var liveQuality=window.vmQuality&&window.vmQuality.liveStatus&&window.vmQuality.liveStatus();
  for(var i=0;i<groups.length;i++)if(!groups[i].items.length)groups[i].items=[{label:i===2?'No subtitles detected':i===1&&liveQuality?liveQuality:'Not available',disabled:true}];
  column=quality.length?1:0;row=0;
  for(i=0;i<groups[column].items.length;i++)if(groups[column].items[i].selected)row=i;
  panel=make('div','','position:absolute;left:0;top:0;width:1280px;height:720px;z-index:2147483640;background:rgba(0,0,0,.95);color:white;font-family:Arial,sans-serif');
  panel.id='vm-native-options';driver.vmOptionsRoot.appendChild(panel);draw();fit();
  console.log('VM native options opened quality='+quality.length+' audio='+audio.length+' text='+text.length);return true;
 }};
}());
