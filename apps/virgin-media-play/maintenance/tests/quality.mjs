import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let xhr,stored={},restarts=[];const policies=[];
function node(height,bandwidth){return {localName:'Representation',getAttribute:name=>({height,bandwidth}[name]||''),parentNode:{getAttribute:()=>''}};}
class Parser{parseFromString(){return {getElementsByTagName:()=>[node('720','3000000'),node('1080','5000000'),node('720','2000000'),node('360','800000'),node('','128000')]};}}
class XHR{constructor(){xhr=this;}open(method,url){assert.equal(url,'https://example.invalid/vod.mpd');}send(){}}
const window={vmAvPlay:{current:()=>123.4,begin:(driver,position)=>restarts.push(position)}};
vm.runInNewContext(fs.readFileSync(new URL('../tv/quality.js',import.meta.url),'utf8'),{window,console,Promise,DOMParser:Parser,XMLHttpRequest:XHR,localStorage:{getItem:key=>stored[key],setItem:(key,value)=>stored[key]=value}});
const q=window.vmQuality,driver={_mimeType:'application/dash+xml',vmOwner:{isLive:()=>false}},player={setStreamingProperty:(type,value)=>policies.push([type,value])};
await q.resolve(driver,'https://example.invalid/vod.mpd');assert.equal(q.choices().length,0);
xhr.status=200;xhr.responseText='<MPD/>';xhr.onload();
assert.deepEqual(Array.from(q.choices(),x=>x.value),['auto','1080','720','360']);
q.select('720');assert.deepEqual(restarts,[123.4]);
await q.resolve(driver,'https://example.invalid/vod.mpd');q.apply(driver,player);
assert.deepEqual(policies,[['ADAPTIVE_INFO','BITRATES=3000000|STARTBITRATE=3000000|SKIPBITRATE=3000000']]);
assert.equal(q.selected(),'720');q.select('720');assert.equal(restarts.length,1);
q.select('auto');await q.resolve(driver,'https://example.invalid/vod.mpd');q.apply(driver,player);assert.equal(policies.length,2);assert.deepEqual(policies[1],['ADAPTIVE_INFO','STARTBITRATE=HIGHEST']);assert.equal(q.selected(),'auto');
driver.vmOwner.isLive=()=>true;await q.resolve(driver,'https://example.invalid/vod.mpd');assert.equal(q.choices().length,0);q.apply(driver,player);assert.deepEqual(policies.at(-1),['ADAPTIVE_INFO','STARTBITRATE=HIGHEST'],'Live Auto must request the highest startup rendition without locking adaptation');driver.vmVideoHeight=1080;assert.equal(q.liveStatus(),'Auto (1080p)');window.vmFixedLive720Enabled=true;q.apply(driver,player);assert.deepEqual(policies.at(-1),['ADAPTIVE_INFO','BITRATES=3000000|STARTBITRATE=3000000|SKIPBITRATE=3000000']);const count=restarts.length;q.select('1080');assert.equal(restarts.length,count,'Live policy must never use VOD resume/seek');
console.log('PASS actual manifest choices, fixed bitrate, same-source VOD resume, Auto and no quality restarts for live/ad sources');
