import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/player/base.js',import.meta.url);
const text=fs.readFileSync(source,'utf8');
const guarded='beginADsAndStreamPlayback:function(e,t){console.log("VM client ad insertion disabled");this.adTypeParser=new f({});return void this.beginPlayback(this.url,!0);';
assert(text.includes(guarded),'Live and VOD playback must bypass every client-side ad type');
assert(!text.includes('beginADsAndStreamPlayback:function(e,t){this.adTypeParser=new f(e);'),'The unguarded ad handoff must not remain in the generated player');
console.log('PASS client ad insertion disabled for live and VOD');
