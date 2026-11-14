(function(){
 var proto=HTMLMediaElement.prototype,generate=proto.webkitGenerateKeyRequest,add=proto.webkitAddKey;if(!generate||proto.__tg4DeferredEme)return;proto.__tg4DeferredEme=true;
 function key(bytes){var a=new Uint8Array(bytes),s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return s;}
 document.addEventListener('webkitneedkey',function(e){var v=e.target;v.__tg4NativeKeyData=e.initData;var pending=v.__tg4PendingSystems||[];v.__tg4PendingSystems=[];pending.forEach(function(system){v.webkitGenerateKeyRequest(system,e.initData);});},true);
 document.addEventListener('webkitkeymessage',function(e){var v=e.target;v.__tg4SessionData=v.__tg4SessionData||{};v.__tg4SessionData[e.sessionId]=v.__tg4LastKeyData;},true);
 proto.webkitGenerateKeyRequest=function(system,data){if(!this.__tg4NativeKeyData){this.__tg4PendingSystems=this.__tg4PendingSystems||[];if(this.__tg4PendingSystems.indexOf(system)<0)this.__tg4PendingSystems.push(system);return;}var actual=this.__tg4NativeKeyData,k=system+key(actual);this.__tg4SentKeys=this.__tg4SentKeys||{};if(this.__tg4SentKeys[k])return;this.__tg4SentKeys[k]=true;this.__tg4LastKeyData=actual;return generate.call(this,system,actual);};
 if(add)proto.webkitAddKey=function(system,license,data,session){return add.call(this,system,license,this.__tg4SessionData&&this.__tg4SessionData[session]||data,session);};
})();
