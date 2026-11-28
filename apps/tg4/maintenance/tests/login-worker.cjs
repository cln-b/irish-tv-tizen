const assert=require('node:assert/strict');

(async()=>{
 const {handleRequest}=await import('../../../../worker/index.mjs');
 const calls=[];
 const dvrMpd='<?xml version="1.0"?><MPD type="dynamic" availabilityStartTime="2024-01-01T00:00:00Z" minimumUpdatePeriod="PT6S" mediaPresentationDuration="PT0S"><Period start="PT25439H47M20S"><SegmentTemplate timescale="50000" media="media_$RepresentationID$_$Number$.mp4" initialization="media_$RepresentationID$_init.mp4" presentationTimeOffset="89782522000000"><SegmentTimeline><S t="89788602800000" d="300000" r="4799"/></SegmentTimeline></SegmentTemplate></Period></MPD>';
 const upstream=async(target,options)=>{
  calls.push({target,options,body:options.body?Buffer.from(options.body).toString('utf8'):null});
  if(String(target).endsWith('/playlist-dash-dvr.mpd'))return new Response(dvrMpd,{status:200,headers:{'Content-Type':'application/dash+xml'}});
  return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json','ETag':'synthetic','Last-Modified':'Wed, 21 Oct 2015 07:28:00 GMT'}});
 };
 const base='https://worker.invalid';
 const env={TG4_SECRET_KEY:'tg4-test-key'};
 const keyHeaders=(extra={})=>({'X-TG4-Helper-Key':env.TG4_SECRET_KEY,...extra});
 const token=await handleRequest(new Request(base+'/tg4/sso/token?kind=pair',{
  method:'POST',
  headers:keyHeaders({'Content-Type':'application/json','Authorization':'Bearer synthetic','Token-Type':'Bearer'}),
  body:'{"code":"synthetic"}'
 }),env,upstream);
 assert.equal(token.status,200);
 assert.equal(token.headers.get('Access-Control-Allow-Origin'),'*');
 assert.equal(token.headers.get('Access-Control-Allow-Headers'),'Content-Type, Authorization, Token-Type, Accept, X-TG4-Helper-Key');
 assert.equal(token.headers.get('ETag'),'synthetic');
 assert.equal(token.headers.get('Last-Modified'),'Wed, 21 Oct 2015 07:28:00 GMT');
 assert.equal(token.headers.get('Content-Type'),'application/json');
 assert.equal(token.headers.get('Cache-Control'),'no-store');
 assert.equal(await token.text(),'{"ok":true}');
 assert.equal(calls[0].target,'https://sso.tg4.ie/token?kind=pair');
 assert.equal(calls[0].body,'{"code":"synthetic"}');
 const h=new Headers(calls[0].options.headers);
 assert.equal(h.get('Accept'),'application/json');
 assert.equal(h.get('Authorization'),'Bearer synthetic');
 assert.equal(h.get('Token-Type'),'Bearer');
 assert.equal(h.get('X-TG4-Helper-Key'),null,'The helper key must not be forwarded to TG4');

 const profile=await handleRequest(new Request(base+'/tg4/sso/api/v2/session/user/profile',{headers:keyHeaders()}),env,upstream);
 assert.equal(profile.status,200);
 assert.equal(calls[1].target,'https://sso.tg4.ie/api/v2/session/user/profile');
 assert.equal(calls[1].options.method,'GET');
 await profile.body.cancel();

 const history=await handleRequest(new Request(base+'/tg4/user/api/history/v2',{
  method:'POST',headers:keyHeaders({'Content-Type':'application/json'}),body:'[]'
 }),env,upstream);
 assert.equal(history.status,200);
 assert.equal(calls[2].target,'https://user.tg4.ie/api/history/v2');
 assert.equal(calls[2].body,'[]');
 await history.body.cancel();

 const bookmarks=await handleRequest(new Request(base+'/tg4/user/api/playlist/v3/watch_later/bookmarks?limit=5',{headers:keyHeaders()}),env,upstream);
 assert.equal(bookmarks.status,200);
 assert.equal(calls.at(-1).target,'https://user.tg4.ie/api/playlist/v3/watch_later?limit=5');
 await bookmarks.body.cancel();

 const dvrSource='https://fastly.live.brightcove.com/sample/playlist-dash-dvr.mpd';
 const dvr=await handleRequest(new Request(base+'/tg4/dvr?u='+encodeURIComponent(dvrSource)),env,upstream);
 assert.equal(dvr.status,200,'The clear DVR route must not require the login key');
 assert.equal(dvr.headers.get('Content-Type'),'application/dash+xml');
 const dvrText=await dvr.text();
 assert.equal(calls.at(-1).target,dvrSource);
 assert.equal(new Headers(calls.at(-1).options.headers).get('X-TG4-Helper-Key'),null,'The login key must not be forwarded with a manifest request');
 assert.ok(dvrText.includes('type="static"'));
 assert.ok(dvrText.includes('mediaPresentationDuration="PT8H"'));
 assert.ok(dvrText.includes('<Period start="PT0S">'));
 assert.ok(dvrText.includes('presentationTimeOffset="0"'));
 assert.ok(dvrText.includes('<S t="0" d="300000" r="4799"/>'));
 assert.ok(dvrText.includes('media="https://fastly.live.brightcove.com/sample/media_$RepresentationID$_$Number$.mp4"'));
 assert.ok(!dvrText.includes('availabilityStartTime'));
 assert.ok(!dvrText.includes('minimumUpdatePeriod'));
 const dvrSigned=await handleRequest(new Request(base+'/tg4/dvr?u='+encodeURIComponent(dvrSource+'?sig=synthetic')),env,upstream);
 assert.equal(dvrSigned.status,200);
 assert.equal(calls.at(-1).target,dvrSource+'?sig=synthetic','Manifest query parameters must pass through unchanged');
 await dvrSigned.body.cancel();
 assert.equal((await handleRequest(new Request(base+'/tg4/dvr?u='+encodeURIComponent('https://example.invalid/playlist-dash-dvr.mpd')),env,upstream)).status,400,'Only the clear live host may be proxied');
 assert.equal((await handleRequest(new Request(base+'/tg4/dvr'),env,upstream)).status,400);
 assert.equal((await handleRequest(new Request(base+'/tg4/dvr?u='+encodeURIComponent('https://fastly.live.brightcove.com/sample/playlist-dash.mpd')),env,upstream)).status,400);

 const before=calls.length;
 assert.equal((await handleRequest(new Request(base+'/tg4/sso/token',{
  method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
 }),env,upstream)).status,403);
 assert.equal((await handleRequest(new Request(base+'/tg4/sso/token',{
  method:'POST',headers:keyHeaders({'X-TG4-Helper-Key':'bad'}),body:'{}'
 }),env,upstream)).status,403);
 assert.equal((await handleRequest(new Request(base+'/tg4/sso/token',{
  method:'POST',headers:keyHeaders(),body:'{}'
 }),{},upstream)).status,503);
 assert.equal((await handleRequest(new Request(base+'/tg4/sso/token',{method:'GET',headers:keyHeaders()}),env,upstream)).status,404);
 assert.equal((await handleRequest(new Request(base+'/TG4/sso/token',{method:'POST',headers:keyHeaders(),body:'{}'}),env,upstream)).status,404);
 assert.equal((await handleRequest(new Request(base+'/tg4/unknown',{headers:keyHeaders()}),env,upstream)).status,404);
 const preflight=await handleRequest(new Request(base+'/tg4/sso/token',{method:'OPTIONS'}),env,upstream);
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('Access-Control-Allow-Methods'),'GET, POST, DELETE, OPTIONS');
 assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Content-Type, Authorization, Token-Type, Accept, X-TG4-Helper-Key');
 assert.equal(calls.length,before);
 console.log('PASS TG4 Worker routes with app-specific key, no key forwarded upstream, and key rejection');
})().catch(e=>{console.error(e);process.exit(1)});
