import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/style/base.css',import.meta.url),'utf8');
const rules=[
 '.keyboardButton:not(.keySPACE):not(.keySEARCH) {padding: 14px 0px; height: 1.1em; font-size: 26px}',
 '.keyDEL svg {margin-bottom: 2px}',
 '.keySPACE {width: 346px !important}',
 '.keySEARCH {padding: 17px 7px; margin-left: -14px; font-size: 20px !important}',
 '#search > svg {margin-top: -2px;}',
 '#more > svg {margin-top: -1px;}',
 '.tilefooter {overflow: visible !important; z-index: auto !important}',
 '.CULLINGposter .tilefooter {overflow: hidden !important; z-index: -1 !important}',
 '.CULLINGposter {margin: 14px 0px 9px !important}'
];
for(const rule of rules)assert(css.includes(rule),'Search keyboard CSS missing: '+rule);
assert(css.includes('.keySEARCH.keySEARCH {padding: 17px 7px}'),'SEARCH padding must outrank the later injected keyboard rule');
assert(css.includes('#horizontalMainMenuCullingCarousel > .widget.container.button {vertical-align: bottom}'),'Horizontal menu buttons must bottom-align to the taller Home tile');
console.log('PASS menu, keyboard and home-page CSS applied');
