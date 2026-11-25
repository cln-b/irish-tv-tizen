// MSE-only resolution picker. Exact clone of the stock language-picker DOM,
// styles and layout, with the right column showing live media information.
(function(){
 var panel=null,onClose=null,timer=null,lastKey=null,selected=0,chosenValue=0,rows=[];
 function make(tag,text,css){var element=document.createElement(tag);if(text)element.textContent=text;if(css)element.style.cssText=css;return element;}
 function clear(element){while(element.firstChild)element.removeChild(element.firstChild);}
 function cached(){return window.vmPickerTheme||{};}
 function headingFont(){return cached().headingFont||'FigtreeBold, sans-serif';}
 function textFont(){return cached().textFont||'FigtreeRegular, sans-serif';}
 function textColor(){return cached().text||'rgb(255, 255, 255)';}
 function background(){return cached().background||'rgba(30, 40, 51, 0.882353)';}
 function dividerColor(){return cached().divider||'rgba(255, 255, 255, 0.247059)';}
 function buttonColor(){return cached().button||'rgb(237, 0, 0)';}
 function parent(){
  return document.getElementById('mediaplayer')||document.getElementById('maincontainer')||document.body;
 }
 function choices(){
  var list=window.vmVideoQuality&&window.vmVideoQuality.choices()||[],auto=null,rest=[];
  for(var i=0;i<list.length;i++){if(list[i].value===0)auto=list[i];else rest.push(list[i]);}
  return auto?[auto].concat(rest):rest;
 }
 function mediaInfo(){
  var player=window.vmShakaPlayer,tracks=player&&player.getVariantTracks()||[],active=null,lines=[];
  for(var i=0;i<tracks.length;i++)if(tracks[i].active){active=tracks[i];break;}
  if(active){
   lines.push('Video: '+(active.height||'?')+'p / '+Math.round((active.bandwidth||0)/1000)+' kbps / id '+active.id);
   lines.push('Audio: '+(active.label||active.language||'?')+' / audioId '+active.audioId);
   lines.push('Audio lock: '+(active.label||'none'));
  }else lines.push('Video: not available');
  var quality=window.vmVideoQuality,pin=quality&&quality.selected()||0;
  lines.push('ABR: '+(pin?('Pinned '+pin+'p'):'Auto (audio locked)'));
  var forced=window.vmForcedBandwidth||0;
  lines.push('Bandwidth: '+(forced?Math.round(forced/1000)+' kbps (forced)':(active?Math.round((active.bandwidth||0)/1000)+' kbps (measured)':'unknown')));
  var video=document.getElementById('mediaPlayerVideo');
  if(video&&video.buffered&&video.buffered.length){
   var ahead=Math.max(0,video.buffered.end(video.buffered.length-1)-video.currentTime);
   lines.push('Buffer: '+ahead.toFixed(1)+'s ahead');
  }
  return lines;
 }
 function draw(){
  if(!panel)return;
  clear(panel);
  var hf=headingFont(),tf=textFont(),tc=textColor(),bc=buttonColor();
  panel.style.background=background();
  panel.style.color=tc;
  panel.style.fontFamily=tf;
  panel.appendChild(make('div','Resolution','position:absolute;left:225px;top:120px;font-family:'+hf+';font-size:28px;color:'+tc));
  panel.appendChild(make('div','Media info','position:absolute;left:775px;top:120px;font-family:'+hf+';font-size:28px;color:'+tc));
  panel.appendChild(make('div','','position:absolute;left:640px;top:120px;width:1px;height:400px;background-color:'+dividerColor()));
  var selectedValue=chosenValue;
  for(var i=0;i<rows.length;i++){
   var focused=i===selected,marked=rows[i].value===selectedValue;
   var row=make('div','','position:absolute;left:265px;top:'+(175+i*56)+'px;width:235px;height:18px;margin:8px 0;padding:15px;font-family:'+tf+';font-size:18px;border-radius:8px;background-image:url(static/img/tick-small.png);background-position:'+(marked?'230px 50%':'285px 50%')+';background-repeat:no-repeat;box-shadow:'+(focused?'0 0 0 2px '+bc:'none'));
   row.appendChild(make('span',rows[i].label,'opacity:'+(marked?'1':'0.6')));
   panel.appendChild(row);
  }
  var info=mediaInfo();
  for(var j=0;j<info.length;j++)panel.appendChild(make('div',info[j],'position:absolute;left:830px;top:'+(175+j*56+15)+'px;width:415px;font-family:'+tf+';font-size:18px;color:'+tc+';opacity:.6'));
  panel.appendChild(make('div','','position:absolute;right:40px;top:40px;width:40px;height:40px;background:url(static/img/icon-close.png) center no-repeat;background-size:80%;border-radius:5px'));
 }
 function close(){
  if(panel&&panel.parentNode)panel.parentNode.removeChild(panel);
  panel=null;
  if(timer){clearInterval(timer);timer=null;}
  return true;
 }
 function dismiss(){
  var callback=onClose;onClose=null;
  close();
  if(callback)callback();
 }
 function choose(){
  var row=rows[selected];if(!row)return;
  chosenValue=row.value;
  if(window.vmVideoQuality)window.vmVideoQuality.set(row.value);
  draw();
 }
 function open(callback){
  if(panel)return true;
  if(!window.vmShakaPlayer||!window.vmVideoQuality)return false;
  if(document.getElementById('languagePicker')||document.getElementById('vm-native-options'))return false;
  onClose=callback||null;
  rows=choices();selected=0;
  var pin=window.vmVideoQuality.selected()||0;
  chosenValue=pin;
  for(var i=0;i<rows.length;i++)if(rows[i].value===pin){selected=i;break;}
  panel=make('div','','position:absolute;left:0;top:0;width:1280px;height:720px;z-index:2147483641;-webkit-animation:fadein .5s;animation:fadein .5s');
  panel.id='vm-resolution-picker';
  parent().appendChild(panel);
  draw();
  timer=setInterval(function(){if(panel)draw();},700);
  console.log('VM resolution panel opened choices='+rows.length);
  return true;
 }
 function handle(event){
  var code=event.keyCode,target=event.target||{};
  if(target&&/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName||''))return;
  if(!panel)return;
  if([13,37,38,39,40,8,27,461,10009].indexOf(code)<0)return;
  lastKey=code;event.preventDefault();event.stopImmediatePropagation();
  if(code===8||code===27||code===461||code===10009){dismiss();return;}
  if(code===38)selected=Math.max(0,selected-1);
  if(code===40)selected=Math.min(rows.length-1,selected+1);
  if(code===13){choose();return;}
  draw();
 }
 window.addEventListener('keydown',handle,true);
 window.addEventListener('keyup',function(event){if(event.keyCode===lastKey){lastKey=null;event.preventDefault();event.stopImmediatePropagation();}},true);
 window.vmResolutionPanel={open:open,close:close,isOpen:function(){return !!panel;}};
}());
