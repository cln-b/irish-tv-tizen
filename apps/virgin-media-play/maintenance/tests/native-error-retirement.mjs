import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {parse} from 'acorn';
const source=fs.readFileSync(new URL('../build/tv/core/1.16.0/tal/static/script/devices/mediaplayer/shaka.js',import.meta.url),'utf8');let method;
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='Property'&&n.key.name==='_reportError')method=n.value;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
visit(parse(source,{ecmaVersion:5}));assert(method);
const report=vm.runInNewContext('('+source.slice(method.start,method.end)+')',{i:{EVENT:{ERROR:'error'}}});let emitted=0;
const driver={vmNativeRetired:true,log(){},_emitEvent(){emitted++;}};
report.call(driver,'decode');report.call(driver,'cannot resume');report.call(driver,'cannot pause');assert.equal(emitted,1);
driver.vmNativeRetired=false;driver.vmNativeErrorReported=false;report.call(driver,'new source error');assert.equal(emitted,2);
console.log('PASS a retired native source emits one error instead of recursive pause/resume teardown errors');
