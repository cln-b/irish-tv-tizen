(function(){
 // TG4's browser login endpoints reject the WGT's null Origin. A private
 // helper may be injected at build time; release builds leave it blank and
 // keep the original endpoints. The helper key authenticates requests to the
 // Worker and is added only to rewritten helper URLs.
 var config=window.__tg4LoginHelper||{};
 var helper=(typeof config==='string'?config:(config.url||'')).replace(/\/+$/,'');
 var helperKey=typeof config==='string'?'':(config.key||'');
 window.__tg4LoginProxy={enabled:!!helper,keyed:!!(helper&&helperKey),requests:[]};
 if(!helper||typeof window.fetch!=='function')return;
 var nativeFetch=window.fetch;
 var ssoPaths=['/register','/associate','/token','/api/v2/session/user/profile','/api/v2/session/logout'];
 var userPrefixes=['/api/playlist/v3/watch_later','/api/history/v2'];
 function exact(path){
  for(var i=0;i<ssoPaths.length;i++)if(path===ssoPaths[i])return true;
  return false;
 }
 function prefixed(path){
  for(var i=0;i<userPrefixes.length;i++)if(path===userPrefixes[i]||path.indexOf(userPrefixes[i]+'/')===0)return true;
  return false;
 }
 function rewrite(url){
  if(typeof url!=='string')return url;
  var prefix='https://sso.tg4.ie',path=url.slice(prefix.length);
  if(url.indexOf(prefix+'/')===0&&exact(path.split('?')[0]))return helper+'/sso'+path;
  prefix='https://user.tg4.ie';path=url.slice(prefix.length);
  if(url.indexOf(prefix+'/')===0&&prefixed(path.split('?')[0]))return helper+'/user'+path;
  return url;
 }
 function note(url){
  var items=window.__tg4LoginProxy.requests;
  items.push(String(url).split('?')[0].slice(0,160));
  if(items.length>20)items.shift();
 }
 function owns(object,name){return Object.prototype.hasOwnProperty.call(object,name);}
 function copyObject(source){
  var out={};
  if(source&&typeof source==='object')for(var name in source)if(owns(source,name))out[name]=source[name];
  return out;
 }
 function setHeader(headers,name,value){
  if(!headers)return;
  if(typeof headers.set==='function')headers.set(name,value);
  else headers[name]=value;
 }
 function applyHeaders(target,source){
  if(!target||!source)return;
  if(typeof source.forEach==='function'&&source!==target){
   source.forEach(function(value,name){setHeader(target,name,value);});
   return;
  }
  for(var name in source)if(owns(source,name))setHeader(target,name,source[name]);
 }
 function keyedInit(init,request){
  var out=copyObject(init),headers;
  if(typeof Headers!=='undefined')headers=new Headers();
  else headers={};
  if(request&&request.headers)applyHeaders(headers,request.headers);
  if(init&&init.headers)applyHeaders(headers,init.headers);
  setHeader(headers,'X-TG4-Helper-Key',helperKey);
  out.headers=headers;
  return out;
 }
 window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&typeof input.url==='string'?input.url:null);
  var target=rewrite(url),rewritten=target!==url;
  if(rewritten)note(target.replace(helper,'')||'/');
  if(rewritten&&helperKey)init=keyedInit(init,input&&typeof input.url==='string'?input:null);
  if(typeof input==='string'&&rewritten)input=target;
  else if(input&&typeof input.url==='string'&&rewritten&&typeof Request!=='undefined'){
   try{input=new Request(target,input);}catch(error){}
  }
  return nativeFetch.call(window,input,init);
 };
})();
