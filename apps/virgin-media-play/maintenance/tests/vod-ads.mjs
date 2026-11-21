import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/player/base.js',import.meta.url);
const text=fs.readFileSync(source,'utf8');
const guarded='beginADsAndStreamPlayback:function(e,t){if(!this.isLive()){console.log("VM VOD client ad insertion disabled");this.adTypeParser=new f({});return void this.beginPlayback(this.url,!0)}this.adTypeParser=new f(e);';
assert(text.includes(guarded),'VOD playback must bypass every client-side ad type, including mixed IMA pods');
assert(!text.includes('beginADsAndStreamPlayback:function(e,t){this.adTypeParser=new f(e);'),'The unguarded ad handoff must not remain in the generated player');
assert(text.includes('i===m.GOOGLE_IMA_DAI'),'Live ad handling must remain available');
console.log('PASS VOD client ad insertion disabled, live ad handling retained');
