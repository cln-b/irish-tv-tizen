// Diagnostic-only AMD module. Never log init-data contents or licence bodies.
define([window.vmRoot+'crypto-js.js'],function(CryptoJS){
 var PLAYREADY='9a04f07998404286ab92e65be0885f95';
 function bytes(value){return value&&value.buffer?new Uint8Array(value.buffer,value.byteOffset||0,value.byteLength):new Uint8Array(value||0);}
 function digest(value){var data=bytes(value),words=[];for(var i=0;i<data.length;i++)words[i>>>2]=(words[i>>>2]||0)|(data[i]<<(24-(i%4)*8));return CryptoJS.SHA256(CryptoJS.lib.WordArray.create(words,data.length)).toString();}
 function u32(b,p){return b[p]*16777216+b[p+1]*65536+b[p+2]*256+b[p+3];}
 function hex(b,start,end){var out='';for(var i=start;i<end;i++)out+=('0'+b[i].toString(16)).slice(-2);return out;}
 function boxes(value){
  var data=bytes(value),out=[],offset=0;
  while(offset<data.length){
   if(offset+8>data.length)throw Error('Truncated CENC box');
   var size=u32(data,offset),header=8,type=String.fromCharCode.apply(null,data.subarray(offset+4,offset+8));
   if(size===1){if(offset+16>data.length)throw Error('Truncated extended box');size=u32(data,offset+8)*4294967296+u32(data,offset+12);header=16;}else if(size===0)size=data.length-offset;
   if(size<header||offset+size>data.length)throw Error('Invalid CENC box size');
   if(type==='pssh'){
    if(size<header+24)throw Error('Truncated PSSH');
    var copy=new Uint8Array(size);copy.set(data.subarray(offset,offset+size));
    out.push({size:size,system:hex(data,offset+header+4,offset+header+20),version:data[offset+header],data:copy,sha256:digest(copy)});
   }
   offset+=size;
  }return out;
 }
 function describe(label,value){
  var data=bytes(value);console.log('VM EME '+label+' bytes='+data.length+' sha256='+digest(data));
  var result=[];try{result=boxes(data);}catch(error){console.log('VM EME '+label+' parse='+error.message);}
  result.forEach(function(box,index){console.log('VM EME '+label+' box='+index+' size='+box.size+' system='+box.system+' version='+box.version+' sha256='+box.sha256);});return result;
 }
 var probe={boxes:boxes,digest:digest,choose:function(info,eventData){
  var mode=window.vmEmeProbeMode||'event',entries=info&&info.initData||[],candidates=[],seen={};
  console.log('VM EME media-ready mode='+mode+' manifestEntries='+entries.length+' keySystem='+(info&&info.keySystem||'unknown'));
  describe('event-input',eventData);
  entries.forEach(function(item,index){describe('manifest-'+index,item.initData).forEach(function(box){if(box.system===PLAYREADY&&!seen[box.sha256]){seen[box.sha256]=true;candidates.push(box);}});});
  if(mode==='event')return eventData;
  if(mode!=='manifest-playready'||candidates.length!==1)throw Error('No unique broadcaster PlayReady PSSH for controlled comparison');
  console.log('VM EME selected manifest PlayReady size='+candidates[0].size+' sha256='+candidates[0].sha256);return candidates[0].data;
 },native:function(system,data){console.log('VM EME native-call system='+system);describe('native-input',data);}};
 if(window.vmEmeProbeMode)document.addEventListener('webkitkeymessage',function(event){
  var count=event.message&&event.message.byteLength||0;console.log('VM EME keymessage bytes='+count);
  if(!count){console.log('VM EME empty keymessage blocked before licence POST');event.stopImmediatePropagation();}
 },true);
 return probe;
});
