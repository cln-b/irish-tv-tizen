import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/services/streams.js',import.meta.url),'utf8');
let methods;
const logs=[];
const requests=[];
const base={extend(spec){methods=spec;return function(){}}};
const Models={
 createModel(){},
 mapData(){},
 readModelData(name){
  if(name==='account')return {user:{ad_fields:''}};
  if(name==='config')return {companyUuid:'company'};
  return {};
 }
};
const network={setApiParameters(){},loadUrl(options){requests.push(options.queryParameters||{})}};
const utils={
 getAppVersionNumber:()=>'1.172.0',
 getCid:()=>'vmtv',
 getUvid:(asset)=>asset.id,
 getTizenTIFA:()=>'ifa',
 getTizenLAT:()=>'0',
 getConsentString:()=>'consent'
};
const runtime={getCurrentApplication:()=>({qparams:{},getUser:()=>({uuid:'user'}),getUserHash:()=>''})};
const consoleStub={log:(...args)=>logs.push(args.join(' ')),debug(){},warn(){},error(){}};

vm.runInNewContext(code,{
 define(_name,_dependencies,factory){factory(base,()=>'hash',Models,network,utils,runtime,{}, {}, {isDeepLink:()=>false})},
 console:consoleStub
});
assert(methods,'Streams service spec must load');

const service={Models,utils};
Object.assign(service,methods);
service.getPlatform=()=>'tizen';
service.getDeviceID=()=>'dev';
methods.liveStreamAcquisitionCall.call(service,{id:'1242',liveChannel:true},{},()=>{},()=>{});
assert.equal(requests.length,1,'Live acquisition must issue one streams request');
assert.equal(requests[0].disableSsai,'1','Live streams request must disable server-side ad stitching');
assert.equal(service.vmLiveStreamRequest,false,'Live request marker must be cleared after handoff');
assert(logs.some((line)=>line.includes('VM live SSAI disabled for stable DASH')),'Live SSAI disable must be visible in telemetry');

const before=requests.length;
methods.streamAcquisitionCall.call(service,{id:'episode',media_type:'single_episode'},{},()=>{},()=>{});
assert.equal(requests.length,before+1,'VOD acquisition must still issue one streams request');
assert.equal(requests[before].disableSsai,undefined,'VOD streams request must keep its existing ad behaviour');
console.log('PASS live streams request disables SSAI, VOD ad request unchanged');
