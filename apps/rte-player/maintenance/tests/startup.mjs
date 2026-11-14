import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../widget/startup.js', import.meta.url), 'utf8');
const config = 'https://www.rte.ie/wordpress/wp-content/uploads/standard/skyqsoip/config.json';
const labels = config.replace('config.json', 'en_IE/label.json');
const payload = JSON.stringify({override_channels_logo:{RTEJr:{enable:true,path_image:'current_{format}_logo'}}});
function run(transport = async () => new Response(payload)) {
    const calls = [];
    const window = {fetch(...args) { calls.push(args); return transport(...args); }};
    vm.runInNewContext(code, {window, Request, Object});
    return {window, calls};
}

const {window, calls} = run();
assert.deepEqual(calls.map(x => x[0]), [config, labels]);
const boot = await window.fetch(config, {method:'GET', credentials:'omit', headers:{}});
assert.equal(await boot.text(), payload); // The live logo override is unmodified.
assert.equal(calls.length, 2);
await window.fetch(config, {credentials:'omit'});
assert.equal(calls.length, 3); // No stale config after sign-in or later navigation.
await window.fetch(labels, {credentials:'omit'});
assert.equal(calls.length, 3);

for (const options of [
    {method:'POST',body:'{}'}, {credentials:'include'}, {headers:{Authorization:'test'}},
    {cache:'reload'}, {mode:'cors'}, {signal:new AbortController().signal}
]) {
    const probe = run();
    await probe.window.fetch(config, options);
    assert.equal(probe.calls.length, 3);
    assert.equal(probe.calls[2][1], options);
}
const other = run();
for (const url of [config+'?fresh=1', 'https://example.com/config.json',
    'https://www.rte.ie/servicelayer/api/idm/account/soip/login?isocode=IE',
    'https://media.example/manifest.mpd', 'https://licence.example/playready']) {
    await other.window.fetch(url);
    assert.equal(other.calls.at(-1)[0], url);
}
for (const failure of [() => Promise.reject(new Error('offline')),
    async () => new Response('unavailable', {status:503})]) {
    let attempts = 0;
    const probe = run((url) => url === config && ++attempts === 1 ? failure() : Promise.resolve(new Response(payload)));
    assert.equal(await (await probe.window.fetch(config, {credentials:'omit'})).text(), payload);
    assert.equal(attempts, 2);
}
console.log('PASS early boot fetches, unchanged live config, one-use responses, fallback and untouched account/media requests');
