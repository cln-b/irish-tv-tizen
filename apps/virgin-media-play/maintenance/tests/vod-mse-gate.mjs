import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const stored = {};
const native = {};
const logs = [];
const mediaSource = {isTypeSupported(type){return type === 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';}};
const window = {webapis:{avplay:native},dispatchEvent(){},MediaSource:mediaSource};
vm.runInNewContext(fs.readFileSync(new URL('../tv/avplay.js',import.meta.url),'utf8'),{
    window,
    console:{log(message){logs.push(message);},warn(){},error(){}},
    localStorage:{getItem(key){return stored[key] ?? null;},setItem(key,value){stored[key]=value;}},
    document:{createElement(){return {};}},
    Promise,Event,setTimeout,clearTimeout,Date,Math,String,Number,JSON,RegExp,Error,Object,Array
});
const wants = window.vmAvPlay.wants;
const dash = 'application/dash+xml', mp4 = 'video/mp4';
const liveDriver = {vmIsLive:true}, vodDriver = {vmIsLive:false};

function check(mime, type, driver, key, value, expected, label) {
    window.MediaSource = mediaSource;
    delete stored['vm-live-mse'];
    delete stored['vm-vod-mse'];
    if(key)stored[key]=value;
    assert.equal(wants(mime,type,driver),expected,label);
}

check(dash,'video',liveDriver,null,null,false,'Live DASH uses MSE by default');
check(dash,'video',liveDriver,'vm-live-mse','off',true,'vm-live-mse=off restores AVPlay for live');
check(dash,'video',vodDriver,null,null,false,'VOD DASH uses MSE by default');
check(dash,'video',vodDriver,'vm-vod-mse','off',true,'vm-vod-mse=off restores AVPlay for VOD');
check(dash,'video',liveDriver,'vm-vod-mse','off',false,'VOD fallback does not disable live MSE');
check(dash,'video',vodDriver,'vm-live-mse','off',false,'Live fallback does not disable VOD MSE');
check(dash,'live-video',null,null,null,false,'Type-only live DASH detection keeps working');
check(dash,'live-video',null,'vm-live-mse','off',true,'Type-only live fallback keeps working');
check(mp4,'video',vodDriver,null,null,true,'MP4 is never routed to MSE');
check(mp4,'video',liveDriver,'vm-vod-mse','off',true,'MP4 keeps the AVPlay guard');

// A device without MediaSource/fMP4 support must keep the native route.
window.MediaSource = null;
delete stored['vm-live-mse'];
delete stored['vm-vod-mse'];
assert.equal(wants(dash,'video',vodDriver),true,'No fMP4 MediaSource leaves DASH on AVPlay');
assert(logs.includes('VM MSE gate: MediaSource unavailable, DASH stays on AVPlay'),'Capability fallback must be identifiable in logs');
window.MediaSource = mediaSource;

window.webapis = {};
assert(!wants(dash,'video',vodDriver),'No AVPlay API leaves DASH on the stock player');

assert(logs.includes('VM MSE gate: routing live DASH to Shaka'),'Live route must remain identifiable in logs');
assert(logs.includes('VM MSE gate: routing VOD DASH to Shaka'),'VOD route must be identifiable in logs');

const build = (path) => fs.readFileSync(new URL('../build/tv/'+path, import.meta.url), 'utf8');
const builtBase = build('whitelabel/app/release/1.172.0/static/script/appui/components/player/base.js');
const builtShaka = build('core/1.16.0/tal/static/script/devices/mediaplayer/shaka.js');
const builtHandler = build('whitelabel/app/release/1.172.0/static/script/services/playback/handlers/trackmanagement/shakatrackmanagementhandler.js');
const builtTiming = build('live-timing.js');
const builtResolution = build('resolution.js');
const builtLegacy = build('shaka-legacy.js');
const builtAvplay = build('avplay.js');
const builtHtml = build('whitelabel/app/release/1.172.0/default-webkit-default.html');
const builtConfig = build('config.xml');

assert.match(builtBase, /encourageResumePlayback:function\(\)\{if\(!this\.isLive\(\)\)/,
  'MSE VOD must not pause/resume itself while a seek settles');
assert.match(builtShaka, /if\(!this\._isLiveMedia\(\)\)this\._vmVodSeekSettleUntil=Date\.now\(\)\+1e4/,
  'VOD seeks must get a settle window without changing live timing');
assert.match(builtShaka, /_enterBufferingSentinel:function _enterBufferingSentinel\(\)\{if\(!this\._isLiveMedia\(\)&&Date\.now\(\)<\(this\._vmVodSeekSettleUntil\|\|0\)\)return!1/,
  'TAL must not report a second buffering event during VOD MSE seek settle');
assert.match(builtShaka, /vmVodStartupGate=!this\.vmIsLive&&e!==i\.TYPE\.LIVE_VIDEO&&e!==i\.TYPE\.LIVE_AUDIO/,
  'VOD MSE startup gate must be unconditional in the single build');
assert.match(builtShaka, /_exitBuffering:function _exitBuffering\(\)\{this\._metadataLoaded\(\);if\(this\.vmVodStartupGate&&this\.getCurrentTime\(\)<\.1\)/,
  'TAL must hold PLAYING until the VOD MSE clock advances');
assert.match(builtShaka, /_onStatus:function _onStatus\(\)\{if\(this\.vmVodStartupGate&&this\.getCurrentTime\(\)>\.1\)/,
  'TAL must release the VOD startup gate on the first real frame');
assert.match(builtTiming, /if \(mpd\.getAttribute\('type'\) !== 'dynamic'\) \{\s*var minText = mpd\.getAttribute\('minBufferTime'\)/,
  'minBufferTime cap must apply to all VOD MSE manifests');
assert.match(builtTiming, /mpd\.setAttribute\('minBufferTime', 'PT10\.000S'\)/,
  'VOD MSE must cap a large static minBufferTime instead of waiting for 30s');
assert.match(builtHandler, /this\._vmAudioKey\(target\)===this\._vmAudioKey\(active\)&&target\.videoId===active\.videoId\)return/,
  'Matching startup audio must still avoid a second variant selection');

const buildScript = fs.readFileSync(new URL('../tools/build-tv.mjs', import.meta.url), 'utf8');
for (const [name, source] of Object.entries({buildScript, builtAvplay, builtShaka, builtBase, builtHandler, builtTiming, builtResolution, builtLegacy, builtHtml})) {
    assert.doesNotMatch(source, /vmTestMse|vmMseDefault/, `${name} must not carry a second MSE flag`);
    assert.doesNotMatch(source, /VMTest0001/, `${name} must not carry the removed test app id`);
}
assert.doesNotMatch(buildScript, /VM_TEST/, 'There must be only one public build mode');
assert.match(builtConfig, /id="VmPlay2016\.Player" package="VmPlay2016"/,
  'The only shipped widget must be VmPlay2016');
assert.match(builtConfig, /<name>Virgin Media Play<\/name>/,
  'The only shipped app name must be Virgin Media Play');

console.log('PASS single public MSE-default build, capability/fallback checks, AVPlay MP4 guard and startup gating');
