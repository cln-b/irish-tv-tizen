import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {parse} from 'acorn';
const source=fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/player/base.js',import.meta.url),'utf8');
let method;
function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='Property'&&node.key.name==='onMaxBuffering')method=node.value;
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(parse(source,{ecmaVersion:5}));assert(method);
const context={console,window:{}};
const buffering=vm.runInNewContext('('+source.slice(method.start,method.end)+')',context);
let attempts=0,stops=0,alerts=0;
const component={player:{vmNative:true},vmNativeRecoveryCount:0,recoveryAttempts:0,MAX_RECOVERY_ATTEMPTS:0,
    autoRecover(){attempts++;},MediaPlayerCoupling:{stop(){stops++;}},showModal(){alerts++;}};
buffering.call(component);
assert.equal(attempts,0);assert.equal(stops,1);assert.equal(alerts,1);
buffering.call(component);
assert.equal(attempts,0);assert.equal(stops,2);assert.equal(alerts,2);
// Standalone and diagnostic modes both stop instead of restarting adverts.
context.window.vmTimingProxy={url:'http://test.invalid'};
component.vmNativeRecoveryCount=0;
buffering.call(component);
assert.equal(attempts,0);assert.equal(stops,3);assert.equal(alerts,3);
console.log('PASS native buffering failure stops without reacquiring the source or restarting ads');
