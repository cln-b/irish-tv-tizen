const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'widget','login-proxy.js'),'utf8');
function run(helper){
 const calls=[],window={fetch:function(url,init){calls.push({url,init});return Promise.resolve({ok:true});}};
 if(helper)window.__tg4LoginHelper=helper;
 vm.runInNewContext(source,{window,Request:function(url){this.url=url;}});
 return {window,calls};
}
let p=run('http://private-helper.invalid/');
assert.equal(p.window.__tg4LoginProxy.enabled,true);
p.window.fetch('https://sso.tg4.ie/token',{method:'POST'});
p.window.fetch('https://sso.tg4.ie/api/v2/session/user/profile');
p.window.fetch('https://user.tg4.ie/api/playlist/v3/watch_later/bookmarks');
p.window.fetch('https://user.tg4.ie/api/history/v2',{method:'POST'});
assert.deepEqual(p.calls.map(c=>c.url),[
 'http://private-helper.invalid/sso/token',
 'http://private-helper.invalid/sso/api/v2/session/user/profile',
 'http://private-helper.invalid/user/api/playlist/v3/watch_later/bookmarks',
 'http://private-helper.invalid/user/api/history/v2'
]);
p.window.fetch('https://api.qrserver.com/v1/create-qr-code/?data=x');
p.window.fetch('https://api.tg4dev.com/api/content/v2/Home');
assert.equal(p.calls[4].url,'https://api.qrserver.com/v1/create-qr-code/?data=x');
assert.equal(p.calls[5].url,'https://api.tg4dev.com/api/content/v2/Home');
assert.ok(p.window.__tg4LoginProxy.requests.every(r=>r.indexOf('private-helper')<0),'Diagnostics must not expose the helper host');
p=run();
assert.equal(p.window.__tg4LoginProxy.enabled,false);
p.window.fetch('https://sso.tg4.ie/register',{method:'POST'});
assert.equal(p.calls[0].url,'https://sso.tg4.ie/register','Release builds keep the official endpoint');
const index=fs.readFileSync(path.join(root,'../tv-app','index.html'),'utf8');
assert.match(index,/window\.__tg4LoginHelper=""/,'Generated release must default to a blank helper');
assert.match(index,/login-proxy\.js/,'Generated release must include the proxy');
console.log('PASS TG4 login helper routing, blank release default, and diagnostics redaction');
