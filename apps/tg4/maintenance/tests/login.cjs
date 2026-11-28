const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'widget','login-proxy.js'),'utf8');
function RequestCtor(url,from){this.url=url;this.headers=from&&from.headers?from.headers:{};this.method=from&&from.method?from.method:'GET';}
function run(config){
 const calls=[];
 const window={fetch:function(input,init){calls.push({url:typeof input==='string'?input:(input&&input.url),input:input,init:init||{}});return Promise.resolve({ok:true});}};
 if(config!==undefined)window.__tg4LoginHelper=config;
 vm.runInNewContext(source,{window,Request:RequestCtor});
 return {window,calls};
}
const helper='http://private-helper.invalid/',key='synthetic-helper-key';
let p=run({url:helper+'/',key:key});
assert.equal(p.window.__tg4LoginProxy.enabled,true);
assert.equal(p.window.__tg4LoginProxy.keyed,true);
p.window.fetch('https://sso.tg4.ie/token',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'}});
assert.equal(p.calls[0].url,'http://private-helper.invalid/sso/token');
assert.equal(p.calls[0].init.method,'POST');
assert.equal(p.calls[0].init.headers['X-TG4-Helper-Key'],key);
assert.equal(p.calls[0].init.headers.Authorization,'Bearer synthetic');
assert.equal(p.calls[0].init.headers['Content-Type'],'application/json');
p.window.fetch('https://sso.tg4.ie/api/v2/session/user/profile');
assert.equal(p.calls[1].url,'http://private-helper.invalid/sso/api/v2/session/user/profile');
assert.equal(p.calls[1].init.headers['X-TG4-Helper-Key'],key);
p.window.fetch('https://user.tg4.ie/api/playlist/v3/watch_later/bookmarks');
assert.equal(p.calls[2].url,'http://private-helper.invalid/user/api/playlist/v3/watch_later/bookmarks');
assert.equal(p.calls[2].init.headers['X-TG4-Helper-Key'],key);
p.window.fetch(new RequestCtor('https://user.tg4.ie/api/history/v2',{method:'POST',headers:{'Token-Type':'Bearer'}}));
assert.equal(p.calls[3].url,'http://private-helper.invalid/user/api/history/v2');
assert.equal(p.calls[3].input.url,'http://private-helper.invalid/user/api/history/v2');
assert.equal(p.calls[3].init.headers['Token-Type'],'Bearer');
assert.equal(p.calls[3].init.headers['X-TG4-Helper-Key'],key);
p.window.fetch('https://api.qrserver.com/v1/create-qr-code/?data=x',{headers:{Accept:'image/png'}});
p.window.fetch('https://api.tg4dev.com/api/content/v2/Home');
assert.equal(p.calls[4].url,'https://api.qrserver.com/v1/create-qr-code/?data=x');
assert.equal(p.calls[5].url,'https://api.tg4dev.com/api/content/v2/Home');
assert.equal(p.calls[4].init.headers['X-TG4-Helper-Key'],undefined);
assert.equal((p.calls[5].init.headers||{})['X-TG4-Helper-Key'],undefined);
const diagnostics=JSON.stringify(p.window.__tg4LoginProxy);
assert.ok(diagnostics.indexOf('private-helper')<0,'Diagnostics must not expose the helper host');
assert.ok(diagnostics.indexOf(key)<0,'Diagnostics must not expose the helper key');
p=run({url:helper,key:''});
assert.equal(p.window.__tg4LoginProxy.enabled,true);
assert.equal(p.window.__tg4LoginProxy.keyed,false);
p.window.fetch('https://sso.tg4.ie/token',{method:'POST'});
assert.equal(p.calls[0].init.headers,undefined);
p=run({url:'',key:key});
assert.equal(p.window.__tg4LoginProxy.enabled,false);
p.window.fetch('https://sso.tg4.ie/register',{method:'POST'});
assert.equal(p.calls[0].url,'https://sso.tg4.ie/register','Release builds keep the official endpoint');
assert.equal((p.calls[0].init.headers||{})['X-TG4-Helper-Key'],undefined);
const expected='window.__tg4LoginHelper={"url":"","key":""};';
const index=fs.readFileSync(path.join(root,'../tv-app','index.html'),'utf8');
for(const file of [path.join(root,'widget','login-helper-config.js'),path.join(root,'../tv-app','login-helper-config.js')]){
 assert.ok(fs.readFileSync(file,'utf8').trim()===expected,'Helper config must be an object with blank URL and key');
}
assert.match(index,/src="login-helper-config\.js"/,'Generated release must load the helper config');
assert.match(index,/login-proxy\.js/,'Generated release must include the proxy');
console.log('PASS TG4 keyed helper routing, no key sent to TG4, blank release config and diagnostics redaction');
