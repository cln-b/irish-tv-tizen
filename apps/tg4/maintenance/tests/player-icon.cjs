const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),app=path.join(root,'../tv-app');
const chunkName=fs.readdirSync(path.join(app,'js')).find(f=>/^627-.*\.js$/.test(f));
assert.ok(chunkName,'Player chunk must be generated');
const chunk=fs.readFileSync(path.join(app,'js',chunkName),'utf8');
assert.ok(chunk.includes('key:n.playbackPaused?"play":"pause"'),'Play/pause must be a fresh VNode on each toggle so WebKit 538.1 does not mis-paint a second SVG src');
assert.ok(chunk.includes('src:n.playbackPaused?"assets/images/play_icon.svg":"assets/images/pause_icon.svg"'),'Play/pause icon source mapping must be preserved');
for(const name of ['play_icon.svg','pause_icon.svg']){
 const svg=fs.readFileSync(path.join(app,'assets/images',name),'utf8');
 assert.match(svg,/<svg width="60px" height="60px" viewBox="0 0 96 96"/,name+' must match the 60px CSS content box while keeping its 96-unit artwork');
}
console.log('PASS play/pause VNode replacement and WebKit SVG intrinsic geometry');
