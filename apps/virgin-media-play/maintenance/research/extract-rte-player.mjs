// Reuse the public player module with the already hardware-tested local fixes.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
export function extractLegacyPlayer({probe=false}={}){
const source=fs.readFileSync(path.join(root,'../../rte-player/tv-app/_next/static/chunks/71008b35.19d0a77927a6a6b1.js'),'utf8');
const tree=parse(source,{ecmaVersion:5});
const property=tree.body[0].expression.arguments[0].elements[1].properties.find(p=>p.key.value===2300);
if(!property)throw Error('RTÉ player module changed');
let factory=source.slice(property.value.start,property.value.end).replaceAll('window.rteLive','window.vmTimeline');
const manifestInit='(window.vmTimeline.legacyEme&&e.g.initData&&e.g.initData.length?e.g.initData.forEach(function(item){Pr(e,item.initDataType,item.initData,true)}):Pr(e,t.initDataType,Re(t.initData),true))';
if(factory.split(manifestInit).length!==2)throw Error('Legacy init-data handler changed');
// Keep RTÉ's wait for the hardware event. Use that event's actual init data
// for Virgin, instead of assuming its manifest has RTÉ's init-data format.
factory=factory.replace(manifestInit,probe?'(Pr(e,t.initDataType,Re(window.vmEmeProbe.choose(e.g,t.initData)),true))':'(console.log("VM native init bytes="+(t.initData&&t.initData.byteLength)+" manifestCount="+(e.g.initData&&e.g.initData.length)),Pr(e,t.initDataType,Re(t.initData),true))');
const nativeRequest='e.j[a](e.i,i)';
if(factory.split(nativeRequest).length!==3)throw Error('Native request calls changed');
factory=factory.replaceAll(nativeRequest,probe?'(window.vmEmeProbe.native(e.i,i),e.j[a](e.i,i))':'(console.log("VM native generate keySystem="+e.i+" bytes="+i.byteLength),e.j[a](e.i,i))');
return '/* Shaka Player 4.3.5-rte. Google LLC. Apache-2.0. Legacy compatibility from the working local RTÉ build. */\n'+
 (probe?'define([window.vmRoot+"eme-probe.js"],function(probe){window.vmEmeProbe=probe;':'define([],function(){')+
 'var exports={};('+factory+')({exports:exports},exports,{g:window});return exports;});\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 fs.mkdirSync(path.join(root,'.local/vendor'),{recursive:true});
 fs.writeFileSync(path.join(root,'.local/vendor/shaka-legacy.js'),extractLegacyPlayer());
 console.log('Staged legacy player with the existing event-input baseline');
}
