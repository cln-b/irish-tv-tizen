import assert from 'node:assert/strict';
import {handleLogin, handleRequest} from '../../../../worker/index.mjs';
const env = {SECRET_KEY:'test-key'};
const widgetId = '000000000000001';
const forwardedIds = [];
const forwardedBodies = [];
const rtePath = '/servicelayer/api/idm/account/soip/login?isocode=IE';
const url = 'https://example.workers.dev' + rtePath;
let calls = 0;
const upstream = async (target, options) => {
    assert.equal(target, 'https://www.rte.ie' + rtePath);
    assert.equal(new Headers(options.headers).has('Origin'), false);
    forwardedBodies.push(options.body);
    const forwarded = JSON.parse(options.body).deviceId;
    assert.match(forwarded, /^\d{15}$/);
    forwardedIds.push(forwarded);
    calls++;
    return Response.json(calls === 1 ? {activated:false,associationCode:'TEST01'} : {activated:true,mpx_token:'synthetic-session'});
};
function rteRequest(target = url, body, key = env.SECRET_KEY, method = 'POST', origin = 'null') {
    const headers = {'Content-Type':'application/json', 'X-RTE-Helper-Key':key};
    if (origin) headers.Origin = origin;
    return new Request(target, {method, headers, body:method === 'POST' ? body : undefined});
}
for (const [r,status] of [
    [rteRequest(url,'{}','bad'),403], [rteRequest(url,'{'),400],
    [rteRequest(url,JSON.stringify({deviceId:'invalid'})),400],
    [rteRequest(url,'x'.repeat(1025)),413], [rteRequest(url,'{}',env.SECRET_KEY,'POST','https://example.org'),403]
]) assert.equal((await handleLogin(r,env,upstream)).status,status);
assert.equal(calls,0);
const preflight = await handleLogin(rteRequest(url,null,'','OPTIONS'),env,upstream);
assert.equal(preflight.status,204);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'null');
const pairing = await handleLogin(rteRequest(url,JSON.stringify({deviceId:widgetId})),env,upstream);
assert.equal(pairing.headers.get('Cache-Control'),'no-store');
assert.equal((await pairing.json()).activated,false);
const session = await handleLogin(rteRequest(url,JSON.stringify({deviceId:widgetId})),env,upstream);
assert.deepEqual(await session.json(),{activated:true,mpx_token:'synthetic-session'});
assert.equal(forwardedIds[0],widgetId);
assert.equal(forwardedIds[0],forwardedIds[1]);
await handleLogin(rteRequest(url,JSON.stringify({deviceId:'000000000000002'})),env,upstream);
assert.notEqual(forwardedIds[1],forwardedIds[2]);
await handleLogin(rteRequest(url,JSON.stringify({deviceId:widgetId}),'other-key'),{SECRET_KEY:'other-key'},upstream);
assert.equal(forwardedIds[0],forwardedIds[3]);
const originalBody = ' { "deviceId": "000000000000003" } ';
await handleLogin(rteRequest(url,originalBody),env,upstream);
assert.equal(forwardedBodies.at(-1),originalBody);

// The same RTE endpoint is available under /rte for a shared Worker.
const routedRte = await handleRequest(rteRequest('https://example.workers.dev/rte' + rtePath,
    JSON.stringify({deviceId:widgetId})), env, upstream);
assert.equal(routedRte.status,200);
assert.equal((await routedRte.json()).activated,true);
assert.equal(forwardedIds.at(-1),widgetId);
assert.equal((await handleRequest(rteRequest('https://example.workers.dev/rte' + rtePath,'{}','bad'),env,upstream)).status,403);
const routedPreflight = await handleRequest(rteRequest('https://example.workers.dev/rte' + rtePath,null,'','OPTIONS'),env,upstream);
assert.equal(routedPreflight.status,204);
assert.equal(routedPreflight.headers.get('Access-Control-Allow-Headers'),'Content-Type, X-RTE-Helper-Key');
assert.equal((await handleRequest(rteRequest('https://example.workers.dev/RTE' + rtePath,
    JSON.stringify({deviceId:widgetId})),env,upstream)).status,404);

console.log('PASS RTE pairing, shared /rte routing, app-specific helper key, CORS and response passthrough');
