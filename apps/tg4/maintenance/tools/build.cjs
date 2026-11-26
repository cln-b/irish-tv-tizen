const fs=require('fs'),path=require('path');
const project=path.resolve(__dirname,'..'),widget=path.join(project,'widget');
const deps=process.env.TG4_BUILD_NODE_MODULES||path.join(project,'node_modules');
const version=fs.readFileSync(path.join(project,'../VERSION'),'utf8').trim();
// A private helper is injected only into a locally built WGT. Release builds
// leave this empty so no helper host is committed to the repository.
const loginHelper=(process.env.TG4_LOGIN_HELPER||'').replace(/\/+$/,'');
const babel=require(deps+'/@babel/core'),preset=require(deps+'/@babel/preset-env'),acorn=require(deps+'/acorn'),postcss=require(deps+'/postcss'),prefix=require(deps+'/autoprefixer');
const src=path.join(project,'upstream'),out=path.join(project,'../tv-app');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out+'/js',{recursive:true});fs.mkdirSync(out+'/css',{recursive:true});
const root='window.__tg4Root+';
fs.cpSync(path.join(widget,'static'),out,{recursive:true});
fs.mkdirSync(out+'/assets/npaw',{recursive:true});fs.copyFileSync(path.join(widget,'dash-adapter.json'),out+'/assets/npaw/dash.json');
function js(text,name){
 text=text.replace(/\b\w+\.p\+"(img|fonts|assets)\//g,'"https://smarttv.tg4.ie/$1/');
 // The header logo must load from the WGT: the TV intermittently resets the
 // smarttv.tg4.ie request, leaving an empty broken-image box in the top bar.
 text=text.replace(/"https:\/\/smarttv\.tg4\.ie\/img\/playerIconPink\.b24924ee\.svg"/g,'"img/playerIconPink.b24924ee.svg"');
 // Rename loop-local bindings before ES5 conversion so they cannot shadow an
 // outer loader variable when block scoping becomes function scoping.
 text=babel.transformSync(text,{configFile:false,babelrc:false,plugins:[function(){return{visitor:{ForStatement(p){if(p.node.init?.type==='VariableDeclaration'&&p.node.init.kind==='let')for(const d of p.node.init.declarations){if(d.id.type==='Identifier')p.scope.rename(d.id.name,p.scope.generateUidIdentifier(d.id.name).name);}}}}}]}).code;
 let code=babel.transformSync(text,{configFile:false,babelrc:false,presets:[[preset,{targets:{safari:'6'},modules:false,exclude:['@babel/plugin-transform-function-name']}]],plugins:[function(){return{visitor:{FunctionExpression(p){if(p.node.id&&p.node.params.some(n=>n.type==='Identifier'&&n.name===p.node.id.name))p.node.id=null;}}}}],sourceType:'script',compact:true,comments:false}).code;code=babel.transformSync(code,{configFile:false,babelrc:false,compact:true,comments:false,plugins:[function(){return{visitor:{FunctionExpression(p){if(p.node.id&&p.node.params.some(n=>n.type==='Identifier'&&n.name===p.node.id.name))p.node.id=null;}}}}]}).code;acorn.parse(code,{ecmaVersion:5,allowReserved:true});fs.writeFileSync(out+'/'+name,code);
}
(async()=>{
 let app=fs.readFileSync(src+'/app.js','utf8');
 const start=app.indexOf('try{yield null===p||void 0===p?void 0:p("/js/webOSTV-dev.js")');if(start<0)throw Error('LG probe not found');const end=app.indexOf('}catch(c){}',start);if(end<0)throw Error('LG probe end missing');app=app.slice(0,start)+app.slice(end+'}catch(c){}'.length);
 const sdk='p("$WEBAPIS/webapis/webapis.js")';if(!app.includes(sdk))throw Error('Samsung SDK reference missing');app=app.replace(sdk,'(window.webapis?Promise.resolve():p(window.__tg4Root+"$WEBAPIS/webapis/webapis.js"))');
 for(const part of ['js','css']){let old=part==='js'?'r.u=e=>"js/"':'r.miniCssF=e=>"css/"';if(!app.includes(old))throw Error('Chunk loader changed');app=app.replace(old,old.replace('=>','=>'+root));}
 app=app.replace('r.p="/"','r.p=""');
 // Preserve the official SmartTV EPG live token. Bare EPG requests omit the
 // SmartTV header and return a different format token; that diagnostic result
 // must not change the production app's metadata selection.
 const liveToken='const o=r.liveToken||void 0,i=yield a.A.Brightcove.getVideo';if(!app.includes(liveToken))throw Error('Live metadata action changed');
 const epg='return yield e.request.get(`${e.baseUrl}/epg/current`)';if(app.split(epg).length!==2)throw Error('Live EPG request changed');app=app.replace(epg,'return yield e.request.get(`${e.baseUrl}/epg/current`).then(window.tg4Worldwide.epg)');
 const scale='e.style.setProperty("--app-scale",`${a}`)';if(!app.includes(scale))throw Error('Scaling code changed');app=app.replace(scale,'window.__tg4SetScale(a)');
 app=app.replace('"//peach-static.ebu.io/peach-collector.min.js"',root+'"peach.js"');
 js(app,'app.js');js(fs.readFileSync(src+'/vendors.js','utf8'),'vendors.js');js(fs.readFileSync(src+'/peach.js','utf8'),'peach.js');
 for(const file of fs.readdirSync(src+'/chunks')){let chunk=fs.readFileSync(src+'/chunks/'+file,'utf8');if(file.startsWith('627-')){const load='if(yield he(null===h||void 0===h?void 0:h.params.videoId,G.value,j.value,n),C.value)';if(!chunk.includes(load))throw Error('Player startup changed');chunk=chunk.replace('if(kt.value&&z.value&&O.value){let t=z.value.time();try{','if(kt.value&&z.value&&O.value&&m.value&&m.value.readyState>0){try{let t=z.value.time();');
chunk=chunk.replace(',z.value&&(z.value.destroy(),gt("destroyed dash player"));const n=Ut.getAdapter();n&&(gt("NPAW: Fire Stop"),n.fireStop())',';try{const n=Ut.getAdapter();n&&(gt("NPAW: Fire Stop"),n.fireStop())}catch(error){gt("Analytics cleanup: "+error)}finally{z.value&&(z.value.destroy(),gt("destroyed dash player"))}');chunk=chunk.replace('z.value.destroy()','window.__tg4DestroyPlayer(z.value)');chunk=chunk.replace('const r=m.value;z.value=dashjs.MediaPlayer().create()','const r=m.value=window.__tg4NativeMedia(m.value);z.value=dashjs.MediaPlayer().create()');chunk=chunk.replace('t.initialize(r,n.url,!0)','window.__tg4StartPlayer(t,r,n.url)');chunk=chunk.replace(load,load.replace(',C.value)',',yield new Promise(resolve=>s.proxy.$nextTick(resolve)),C.value)'));}
chunk=chunk.replace('"./assets/npaw/dash.json"','window.__tg4Root+"assets/npaw/dash.json"');js(chunk,'js/'+file);}
 for(const [name,file] of [['main.css',src+'/app.css'],['profile-ui.css',path.join(widget,'profile-ui.css')],...fs.readdirSync(src+'/css').map(f=>['css/'+f,src+'/css/'+f])]){let css=fs.readFileSync(file,'utf8').replace(/url\((["']?)((?:\.\.\/|\/)[^)"']+)\1\)/g,(_,q,u)=>'url("'+new URL(u,'https://smarttv.tg4.ie/css/app.css').href+'")');css=css.replace('scale(var(--app-scale,1))','scale(1)');// profile-ui.css is already written for WebKit 538.1: autoprefixer's safari 6
  // target strips -webkit-flex-direction and would leave empty override rules.
  if(name==='profile-ui.css'){fs.writeFileSync(out+'/'+name,css);continue;}
  const result=await postcss([prefix({overrideBrowserslist:['safari 6']})]).process(css,{from:undefined});result.root.walkRules(rule=>{if(!rule.selector)return;const extra=rule.selectors.filter(selector=>/\.(series-container|carousel-container|episode-container|dynamic-rail-loading-state)(?:[:.\[ ]|$)/.test(selector)&&selector.includes(':focus')).map(selector=>selector.replace(/:focus\b/g,'.focus'));if(extra.length)rule.selectors=[...rule.selectors,...extra];});css=result.root.toString();if(name==='main.css')css+='\n.nav_wrapper{position:relative;} .nav_wrapper > .top_bar{position:absolute;top:0;left:0;right:0;height:150px;} .nav_wrapper > .main_area{position:absolute;top:150px;bottom:0;left:0;right:0;display:block;} .main_area > .sidebar{position:absolute;top:0;bottom:0;left:0;width:160px;overflow:hidden;} .main_area > .content{position:absolute;top:0;bottom:0;left:160px;right:0;min-height:0;min-width:0;height:auto;width:auto;display:block;overflow-y:auto;overflow-x:hidden;}\n';fs.writeFileSync(out+'/'+name,css);}
 fs.copyFileSync(deps+'/core-js-bundle/minified.js',out+'/polyfills.js');fs.copyFileSync(deps+'/whatwg-fetch/dist/fetch.umd.js',out+'/fetch.js');
 fs.copyFileSync(path.join(widget,'icon.png'),out+'/icon.png');
 const cssLinks=fs.readdirSync(out+'/css').sort().map(f=>'<link rel="stylesheet" href="css/'+f+'">').join('')+'<link rel="stylesheet" href="profile-ui.css">';
 fs.writeFileSync(out+'/index.html','<!doctype html><html><head><meta charset="utf-8"><script>window.__tg4Root=location.href.split("#")[0].split("?")[0].replace(/[^/]*$/,"");</script><script>window.__tg4LoginHelper='+JSON.stringify(loginHelper).replace(/</g,'\\u003c')+';</script><script src="polyfills.js"></script><script src="fetch.js"></script><script src="login-proxy.js"></script><script src="compat.js"></script><script src="worldwide.js"></script><script src="'+ '$WEBAPIS/webapis/webapis.js'+'"></script><link rel="stylesheet" href="main.css">'+cssLinks+'</head><body><div id="app"></div><script src="vendors.js"></script><script src="performance-shim.js"></script><script src="native-backend.js"></script><script src="app.js"></script></body></html>');
 for(const file of ['compat.js','login-proxy.js','native-backend.js','performance-shim.js','worldwide.js']){const code=fs.readFileSync(path.join(widget,file),'utf8');acorn.parse(code,{ecmaVersion:5,allowReserved:true});fs.writeFileSync(out+'/'+file,code);}
 fs.writeFileSync(out+'/config.xml','<?xml version="1.0" encoding="UTF-8"?><widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://example.invalid/tg4" version="'+version+'.0" viewmodes="maximized"><name>TG4+</name><icon src="icon.png"/><content src="index.html"/><tizen:application id="Tg4Live001.Player" package="Tg4Live001" required_version="2.4"/><access origin="*" subdomains="true"/><tizen:allow-navigation href="*"/><tizen:privilege name="http://tizen.org/privilege/internet"/><tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/><tizen:content-security-policy>default-src * data: blob: &apos;unsafe-inline&apos; &apos;unsafe-eval&apos;;</tizen:content-security-policy><tizen:privilege name="http://developer.samsung.com/privilege/drmplay"/><tizen:profile name="tv-samsung"/><tizen:setting screen-orientation="landscape" context-menu="disable" hwkey-event="enable"/></widget>');
 console.log('Built TG4+ '+version+' with Worldwide Live and the native VOD backend: '+out);
})().catch(e=>{console.error(e);process.exit(1)});
