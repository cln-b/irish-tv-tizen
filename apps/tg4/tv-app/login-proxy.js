(function(){
 // TG4's browser login endpoints reject the WGT's null Origin. A private
 // helper may be injected at build time; release builds leave it blank and
 // keep the original endpoints.
 var helper=(window.__tg4LoginHelper||'').replace(/\/+$/,'');
 window.__tg4LoginProxy={enabled:!!helper,requests:[]};
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
 window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&typeof input.url==='string'?input.url:null);
  var target=rewrite(url);
  if(target!==url)note(target.replace(helper,'')||'/');
  if(typeof input==='string'&&target!==url)input=target;
  else if(input&&typeof input.url==='string'&&target!==url&&typeof Request!=='undefined'){
   try{input=new Request(target,input);}catch(error){}
  }
  return nativeFetch.call(window,input,init);
 };
})();
