(function(){
 var root=window.__tg4Root;
 // core-js covers JavaScript, but these DOM helpers also postdate this WebKit.
 if(!Element.prototype.matches)Element.prototype.matches=Element.prototype.webkitMatchesSelector||function(selector){
  var nodes=(this.ownerDocument||document).querySelectorAll(selector),i=nodes.length;
  while(i--)if(nodes[i]===this)return true;return false;
 };
 if(!Element.prototype.closest)Element.prototype.closest=function(selector){
  var node=this;while(node&&node.nodeType===1){if(node.matches(selector))return node;node=node.parentElement||node.parentNode;}return null;
 };
 // Older WebKit has scrollLeft/scrollTop but lacks the element scrolling API.
 function scrollPosition(element,x,y,relative){
  var object=x&&typeof x==='object',left=object?x.left:x,top=object?x.top:y;
  if(left!==undefined)element.scrollLeft=(relative?element.scrollLeft:0)+(Number(left)||0);
  if(top!==undefined)element.scrollTop=(relative?element.scrollTop:0)+(Number(top)||0);
 }
 if(!Element.prototype.scrollTo)Element.prototype.scrollTo=function(x,y){scrollPosition(this,x,y,false);};
 if(!Element.prototype.scroll)Element.prototype.scroll=Element.prototype.scrollTo;
 if(!Element.prototype.scrollBy)Element.prototype.scrollBy=function(x,y){scrollPosition(this,x,y,true);};
 // Replace the CSS custom property with a numeric transform on old WebKit.
 window.__tg4SetScale=function(scale){
  if(!(scale>0&&scale<=1))return;
  var style=document.getElementById('__tg4-scale');if(!style){style=document.createElement('style');style.id='__tg4-scale';document.head.appendChild(style);}
  style.textContent='html[data-scaled] .design-canvas{-webkit-transform:scale('+scale+');transform:scale('+scale+');}';
 };
 // Resolve app resources independently of the hosted page's base URI.
 var xhrOpen=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method,url){if(typeof url==='string'&&/^(?:\.\/|\/)?assets\//.test(url))arguments[1]='https://smarttv.tg4.ie/'+url.replace(/^(?:\.\/|\/)/,'');return xhrOpen.apply(this,arguments);};
 var append=Node.prototype.appendChild,insert=Node.prototype.insertBefore;
 function prepare(n){if(!n||!n.tagName)return;if(n.tagName==='SCRIPT'){
  var u=n.getAttribute('src')||'';
  if(u.indexOf('$WEBAPIS/')>=0)n.setAttribute('src',root+'$WEBAPIS/webapis/webapis.js');
  // Keep the existing experimental measurement isolation until playback works.
  if(u.indexOf('cdn-gl.nmrodam.com/novms/js/2/nlsSDK600.bundle.min.js')>=0){n.text='/* measurement SDK omitted in compatibility test */';n.removeAttribute('src');}
 }}
 Node.prototype.appendChild=function(n){prepare(n);return append.apply(this,arguments)};
 Node.prototype.insertBefore=function(n){prepare(n);return insert.apply(this,arguments)};
 window.__tg4Diagnostics={events:[]};
 function record(e){var a=window.__tg4Diagnostics.events;if(a.length>60)a.shift();a.push(String(e).split('?')[0].slice(0,180));}
 window.__tg4DestroyPlayer=function(player){
  try{player.destroy();}catch(error){
   window.__tg4Diagnostics.cleanup={error:String(error)};
   // DASH can reject disposal before media initialization (e.g. no MSE).
   // Keep this visible in diagnostics; other cleanup failures still propagate.
   if(String(error)!=='MediaPlayer not initialized!')throw error;
  }
 };
 window.__tg4StartPlayer=function(player,video,url){
  if(window.__tg4EnsurePerformance)window.__tg4EnsurePerformance();
  var d=window.__tg4Diagnostics.player={videoPresent:!!video,mse:typeof window.MediaSource,legacyEme:!!(video&&video.webkitGenerateKeyRequest),initializeCalled:false};
  player.on('error',function(e){var err=e&&e.error||e||{};d.error={code:err.code,message:String(err.message||'').split('?')[0].slice(0,200)};});
  player.on('streamInitialized',function(){d.streamInitialized=true;});
  try{d.initializeCalled=true;player.initialize(video,url,true);}catch(e){d.thrown=String(e);throw e;}
 };
 window.addEventListener('error',function(e){record('Error '+e.message+' '+e.filename+':'+e.lineno+':'+e.colno+' '+(e.error&&e.error.stack||''))});
 window.addEventListener('unhandledrejection',function(e){record('Promise '+String(e.reason&&e.reason.message||e.reason))});
})();
