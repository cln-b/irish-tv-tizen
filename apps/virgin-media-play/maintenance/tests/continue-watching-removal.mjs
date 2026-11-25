import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const builtPath = '../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/details/episodic.js';
const source = fs.readFileSync(new URL(builtPath, import.meta.url), 'utf8');
const homeSource = fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/home.js', import.meta.url), 'utf8');
const buildScript = fs.readFileSync(new URL('../tools/build-tv.mjs', import.meta.url), 'utf8');

const originalHomeFilter = 'return e=e.filter((function(e){var t;return"resume_play"===e.id||"personalised"===e.type||(null===(t=e.tiles)||void 0===t?void 0:t.length)>0}))';
assert.ok(homeSource.includes(originalHomeFilter), 'Home carousel filter must stay unchanged');
assert.doesNotMatch(homeSource, /"resume_play"===e\.id&&\(null===\(t=e\.tiles\)/,
  'Do not remove empty Continue Watching sections globally');
assert.match(buildScript, /Home Continue Watching prune anchor changed/,
  'Build must guard the Home prune anchor');

const pruneMethod = homeSource.match(/vmPruneEmptyContinueWatchingSection:function\(e\)\{(.+?)\},getCarouselSections:function/);
assert(pruneMethod, 'Home must be able to prune an empty Continue Watching row after a local removal');
assert.match(pruneMethod[1], /removeCarousel/,
  'Pruning must remove only the stale row widget');
assert.doesNotMatch(pruneMethod[1], /buildContentView/,
  'Pruning must not rebuild Home rows and reset their carousel/culling state');
const invokePrune = new Function('e', pruneMethod[1]);
const carouselFilter = (sections) => sections.filter((s) =>
  s.id === 'resume_play' || s.type === 'resume_play' || (s.tiles && s.tiles.length > 0));
const makePruneContext = (rows) => {
  const ctx = {
    listViewId: 'listview',
    listview: {_widgetStrip: {_childWidgetOrder: rows}, getActiveChildWidget() { return null; }},
    getCarouselSections: carouselFilter,
    removed: [],
    rebuilt: 0,
    hides: 0,
    removeCarousel({carousel, scaffold, config}) {
      this.removed.push({carousel, config});
      const order = scaffold._widgetStrip._childWidgetOrder;
      const index = order.indexOf(carousel);
      if (index >= 0) order.splice(index, 1);
    },
    buildContentView() { this.rebuilt++; },
    hideLoader() { this.hides++; }
  };
  rows.forEach((row, index) => {
    ctx['section' + index] = row;
    ctx['section' + index + 'Config'] = {index};
  });
  return ctx;
};
const pruneSections = [
  {id: 'carousel', tiles: [{id: 1}]},
  {id: 'resume_play', type: 'resume_play', tiles: []},
  {id: 'other', tiles: [{id: 2}]}
];
const rows = [{id: 'section0'}, {id: 'section1'}, {id: 'section2'}];
const staleRow = rows[1];
const trailingRow = rows[2];
const pruneContext = makePruneContext(rows);
invokePrune.call(pruneContext, pruneSections);
assert.equal(pruneSections.length, 2, 'Empty Continue Watching section must be removed from the Home model');
assert.equal(pruneSections[1].id, 'other', 'Rows after the empty Continue Watching row must flow up in the model');
assert.equal(pruneContext.removed.length, 1, 'Only the stale Continue Watching widget must be removed');
assert.equal(pruneContext.removed[0].carousel, staleRow, 'The empty row widget must be removed');
assert.deepEqual(pruneContext.removed[0].config, {index: 1}, 'The empty row config must be used for teardown');
assert.deepEqual(rows, [{id: 'section0'}, {id: 'section2'}], 'Other row widgets must stay untouched');
assert.equal(pruneContext.section0, rows[0], 'Earlier row references must stay');
assert.equal(pruneContext.section1, trailingRow, 'Later row references must be reindexed');
assert.deepEqual(pruneContext.section1Config, {index: 2}, 'Later row configs must be reindexed');
assert.equal(pruneContext.section2, undefined, 'The removed row reference must be cleared');
assert.equal(pruneContext.section2Config, undefined, 'The removed row config must be cleared');
assert.equal(pruneContext.rebuilt, 0, 'Pruning must not rebuild the Home content view');
assert.equal(pruneContext.hides, 1, 'Pruning must also close the loader');
const populatedSections = [{id: 'resume_play', type: 'resume_play', tiles: [{id: 1}]}];
const populatedRows = [{id: 'section0'}];
const populatedContext = makePruneContext(populatedRows);
invokePrune.call(populatedContext, populatedSections);
assert.equal(populatedSections.length, 1, 'Populated Continue Watching section must stay');
assert.equal(populatedContext.removed.length, 0, 'Populated Continue Watching widget must stay');
assert.equal(populatedContext.rebuilt, 0, 'Populated Continue Watching section must not trigger a rebuild');
assert.equal(populatedContext.hides, 0, 'Populated Continue Watching section must not hide the loader again');

assert.ok(homeSource.includes('vmReturning=this.openedNewScreen,vmHome=this'),
  'Home must remember a tile return before rebuilding the menu');
assert.ok(homeSource.includes('vmHome.vmRemovalReturn=vmReturning&&vmHome.openedNewScreen&&window.vmContinueWatchingRemoved'),
  'Home cleanup must be armed only after a confirmed Continue Watching removal, not on ordinary episode returns');
assert.doesNotMatch(homeSource, /setTimeout\(function\(\)\{if\(vmReturning&&vmHome\.openedNewScreen&&window\.vmContinueWatchingRemoved\)/,
  'Home cleanup must not be deferred until after the content render has already failed');
assert.ok(homeSource.includes('if(s.vmRemovalReturn&&window.vmContinueWatchingRemoved){s.vmPruneEmptyContinueWatchingSection(e.sections),window.vmContinueWatchingRemoved=!1,s.vmRemovalReturn=!1}'),
  'Home must prune the empty Continue Watching section before rendering and consume the removal flag there');
const buildHomeUiBody = homeSource.match(/buildHomeUi:function\(e\)\{(.+?)\},getCarouselSections:function/);
assert(buildHomeUiBody, 'Home build path must exist');
const pruneCallIndex = buildHomeUiBody[1].indexOf('s.vmPruneEmptyContinueWatchingSection(e.sections)');
const parseCallIndex = buildHomeUiBody[1].indexOf('s.parseSectionsShowAllButtons(a)');
assert.ok(pruneCallIndex >= 0 && parseCallIndex > pruneCallIndex,
  'The targeted empty-section prune must happen before parseSectionsShowAllButtons reads tiles[length-1]');
assert.match(buildScript, /Home build content anchor changed/, 'Build must guard the Home build content anchor');
assert.match(buildScript, /Home show anchor changed/, 'Build must guard the Home show anchor');

const required = [
  'continueWatchingButtonId',
  'shouldDisplayContinueWatchingButton:function()',
  'appendContinueWatchingButton:function(t)',
  'handleRemoveContinueWatching:function(t)',
  'contentId=this.utils.getUvid(asset,!0)',
  'heartbeat.setMediaId(contentId)',
  'streamHeartbeat&&streamHeartbeat.url',
  'api.updateHost("heartBeatHost",host)',
  'list.getActiveChildWidget()===removedButton',
  'list.setActiveChildWidget(next)',
  'content_id:heartbeat.getMediaId()',
  'String(v.id)===String(asset.id)',
  'button_mark_as_watched","Mark as watched"',
  'heartbeat.send("heartBeatStart"',
  'window.vmContinueWatchingRemoved=!0',
  'play_head:duration',
  'heartbeat.getUserId()',
  'heartbeat.getCompanyId()',
  'heartbeat.getPlatformId()',
  'setAccessibleLabel(s.button.text)'
];
for (const token of required) {
  assert(source.includes(token) || source.includes(token.replace(/",\n"/, '","')), `Built episodic screen must contain ${token}`);
}
assert.match(source, /appendFavouritesButton\(this\.buttonHorizontalList\),this\.appendContinueWatchingButton\(this\.buttonHorizontalList\),this\.appendTrailorButton\(this\.buttonHorizontalList\)/,
  'The button must be added directly after favourites');
assert.match(source, /"whitelabelapp\/services\/continuewatching","antie\/widgets\/horizontallist","whitelabelapp\/utils\/playerheartbeat","whitelabelapp\/utils\/network\/api"/,
  'Heartbeat module must be injected from the app’s existing source');
assert.doesNotMatch(source, /removeFromContinueWatching/, 'No guessed service removal method is allowed');
assert.doesNotMatch(source, /ondemand-|indexOf\("\/"\+contentId\+"\."\)/,
  'Content id must come from the app’s uvid helper, not parsed entitlements or thumbnails');
assert.doesNotMatch(source, /https?:[^"']*start_session/, 'The heartbeat URL must come from the heartBeatStart endpoint');
assert.doesNotMatch(source, /heartbeat-virginmedia/, 'The heartbeat host must come from the stream response or app endpoint, not be hardcoded');
assert.doesNotMatch(source, /53508245|19565835|user_id:\s*["']\d+["']|company_id:\s*["']\d+["']/,
  'No sample or hardcoded heartbeat values are allowed');
assert.ok(source.includes('font-size",o.getFontSize("detailsControlButton")+"px"'),
  'Remove button label must use the same font size as My List');
assert.ok(source.includes('"#"+this.id+" #"+this.continueWatchingButtonId,["width","167px"],["height","92px"],["border-radius",o.buttonCorner],["left","64px"],["margin-left","10px"]'),
  'Remove button must match the Play button edge with the same 10px gap as Play/My List');
assert.match(source, /line-height","61px"\]/, 'Remove button label must use My List vertical rhythm');
assert.match(source, /top","36px"\]/, 'Single-line label must sit at the same vertical position as My List');
assert.ok(source.includes('["left","0px"],["text-align","center"],["width","167px"]'),
  'Single-line label must be centred across the widened button');
assert.match(source, /white-space","normal"\]/, 'Label may wrap only if the platform font forces it');
assert.ok(source.includes('"#"+this.continueWatchingButtonId+"icon",["margin-left","62px"]'),
  'Remove button icon must centre in the widened button');
assert.ok(source.includes('this.utils.getAssetPath()+"/continuewatchingremove/white.svg"'),
  'Remove button must use the dedicated cross icon');
assert.doesNotMatch(source, /button_remove_continue_watching|Remove from Continue Watching/,
  'The old long label must not be used');
assert.match(buildScript, /Continue Watching dependency list changed/, 'Build must guard the injected heartbeat dependency');
assert.match(buildScript, /Continue Watching style anchor changed/, 'Build must guard the style injection point');
assert.match(buildScript, /Continue Watching handler anchor changed/, 'Build must guard the button insertion point');

let factory;
vm.runInNewContext(source, {
  define(name, dependencies, build) {
    assert.equal(name, 'whitelabelapp/appui/components/details/episodic');
    assert.deepEqual(Array.from(dependencies), [
      'whitelabelapp/appui/components/details',
      'whitelabelapp/appui/widgets/detailsmetadata',
      'whitelabelapp/services/continuewatching',
      'antie/widgets/horizontallist',
      'whitelabelapp/utils/playerheartbeat',
      'whitelabelapp/utils/network/api'
    ]);
    factory = build;
  },
  console: {log(){}, warn(){}, error(){}},
  window: {}
});
assert.equal(typeof factory, 'function', 'Built episodic module must be loadable');

const appended = [];
const removed = [];
let focusCalls = 0;
const progressUpdates = [];
const cwVideos = [{
  id: 19565835,
  uvid: 19565835,
  duration: 1351,
  play_position: 1024,
  thumbnail: 'https://thumbnails.simplestreamcdn.com/virginmedia/live/53508245.jpg?width=700',
  entitlements: ['ondemand-53508245']
}];
const continueWatching = {
  modelId: 'continuewatching',
  Models: {readModelData(name) {
    assert.equal(name, 'continuewatching');
    return {videos: cwVideos};
  }},
  getViewingProgress(id) {
    return id === 19565835 || id === 53508245 ? 1024 : 0;
  }
};
const baseMethods = {
  addRentalsSupport() {},
  appendPlayButton() {},
  appendTrailorButton() {},
  shouldDisplayFavouritesButton() { return true; },
  getShowId() { return 'show'; },
  handleFavourites() {},
  onAuthorised(success) { success(); },
  getDataItem() { return {show: this.assetData}; },
  isAuthAuthorised() { return true; },
  appendControlButton(config, list) {
    const button = {config, list, setAccessibleLabel(label) { this.accessibleLabel = label; }};
    appended.push(button);
    return button;
  },
  favouriteslist: {readRecord() { return false; }},
  userUtil: {isFree() { return true; }},
  favouritesButtonIconAdd: 'add.svg',
  favouritesButtonIconRemove: 'remove.svg',
  favouritesButtonTextAdd: 'Add',
  favouritesButtonTextRemove: 'Remove',
  playButtonIcon: 'play.svg',
  utils: {
    getAssetPath() { return '/assets'; },
    getUvid(asset, preferUvid) { return preferUvid && asset.uvid ? asset.uvid : asset.id || asset.uvid; },
    localiser: {getString(key, fallback) { return fallback || key; }}
  },
  Models: {readModelData(name) {
    if (name === 'config') return {companyId: 196};
    if (name === 'stream') return {response: {heartbeat: {url: 'https://heartbeat-virginmedia.simplestreamcdn.com/concurrency/v1/'}}};
    assert.fail(`Unexpected model ${name}`);
  }}
};
function extend(methods) {
  if (methods.init && !methods.init.base) methods.init.base = function () {};
  const Component = function () {
    if (this.init) this.init.apply(this, arguments);
  };
  Component.prototype = Object.assign({}, baseMethods, methods);
  Component.base = function () {};
  return Component;
}
function DetailsMetaData() {}
function HorizontalList(id) {
  this.id = id;
  this.children = [];
  this.appendChildWidget = function (widget) { this.children.push(widget); };
  this.getChildWidgets = function () { return this.children.slice(); };
  this.getActiveChildWidget = function () { return this.active; };
  this.setActiveChildWidget = function (widget) { this.active = widget; };
  this.removeChildWidget = function (widget) {
    removed.push(widget);
    const index = this.children.indexOf(widget);
    if (index >= 0) this.children.splice(index, 1);
  };
}

const heartbeats = [];
let heartbeatFail = false;
const heartbeat = {
  setCompanyId(id) { this.companyId = id; },
  setMediaId(id) { this.mediaId = id; },
  getMediaId() { return this.mediaId; },
  getUserId() { return '16269'; },
  getCompanyId() { return this.companyId; },
  getPlatformId() { return 'hybridtv'; },
  send(endpoint, params, success, fail) {
    heartbeats.push({endpoint, params});
    if (heartbeatFail) fail({error: 'offline'});
    else success({session_id: 'session'});
  }
};

const hostUpdates = [];
const api = {
  getEndpoint(name) {
    assert.equal(name, 'heartBeatStart');
    return {host: 'https://api-virginmedia.simplestreamcdn.com/concurrency/v1'};
  },
  updateHost(name, value) { hostUpdates.push([name, value]); }
};

const Episodic = factory({extend}, DetailsMetaData, continueWatching, HorizontalList, heartbeat, api);
const screen = new Episodic();
screen.scaffoldId = 'pagescaffold';
screen._childWidgets = {
  pagescaffold: {
    _childWidgets: {},
    appendChildWidget(widget) { this._childWidgets[widget.id] = widget; },
    removeChildWidget() {}
  }
};
screen.playButtonId = 'playBtn';
screen.favouritesButtonId = 'favBtn';
screen.continueWatchingButtonId = 'continueWatchingBtn';
screen.assetData = {
  id: 19565835,
  uvid: 53508245,
  duration: 1351,
  type: 'REPLAY',
  entitlements: ['free', 'simplestream-vip'],
  title: 'Emmerdale • Mon, 23 Nov'
};
screen.objMetaData = {updateProgressIndicator(data) { progressUpdates.push(data); }};
screen.setPlayButtonFocus = function () { focusCalls++; };

screen.addControls();
const button = appended.find(entry => entry.config && entry.config.button && entry.config.button.id === 'continueWatchingBtn');
assert(button, 'Continue Watching button must be appended');
assert.equal(button.config.button.class, 'controlbutton');
assert.equal(button.config.button.text, 'Mark as watched');
assert.equal(button.config.image.url, '/assets/continuewatchingremove/white.svg');
assert.equal(button.config.image.id, 'continueWatchingBtnicon');
assert.equal(button.config.button.left, undefined, 'The wrapped label must not use the favourites label offset');
assert.equal(button.accessibleLabel, 'Mark as watched');
assert.equal(button.list, screen.buttonHorizontalList, 'Button must live in the favourites horizontal list');
assert.equal(removed.length, 0, 'Nothing is removed before the user selects the button');
assert.equal(heartbeats.length, 0, 'Merely rendering the button must not send a heartbeat');
screen.buttonHorizontalList.setActiveChildWidget(button);

button.config.button.callback({});
assert.equal(heartbeats.length, 1, 'Selecting the button must send one heartbeat');
assert.equal(heartbeats[0].endpoint, 'heartBeatStart');
assert.deepEqual(JSON.parse(JSON.stringify(heartbeats[0].params)), {
  user_id: '16269',
  company_id: 196,
  content_id: 53508245,
  content_type: 'replay',
  platform_id: 'hybridtv',
  play_head: 1351
});
assert.equal(heartbeat.mediaId, 53508245, 'Heartbeat media id must be the episode uvid, as the real player sets it');
assert.deepEqual(hostUpdates, [['heartBeatHost', 'https://heartbeat-virginmedia.simplestreamcdn.com/concurrency/v1/']],
  'Heartbeat host must come from the real stream response, as the player does before starting playback');
assert.deepEqual(cwVideos, [], 'Local Continue Watching cache is refreshed after the accepted request');
assert.deepEqual(JSON.parse(JSON.stringify(progressUpdates)), [{
  id: 19565835,
  duration: 1351,
  isAuthAuthorised: true,
  uvid: 53508245
}]);
assert.equal(screen.continueWatchingButton, null, 'Button is removed after a successful removal');
assert.equal(removed.length, 1, 'Button widget is removed from its list');
assert.equal(screen.buttonHorizontalList.getActiveChildWidget(), screen.favouritesButton,
  'Horizontal list active child moves off the removed button so down-navigation still works');
assert.equal(focusCalls, 1, 'Focus returns to Play after removal');

const failedScreen = new Episodic();
failedScreen.scaffoldId = 'pagescaffold';
failedScreen._childWidgets = screen._childWidgets;
failedScreen.assetData = screen.assetData;
failedScreen.objMetaData = {updateProgressIndicator() { throw Error('Progress must not clear on a failed request'); }};
failedScreen.setPlayButtonFocus = function () { throw Error('Focus must not move on a failed request'); };
heartbeatFail = true;
const before = heartbeats.length;
failedScreen.handleRemoveContinueWatching();
assert.equal(heartbeats.length, before + 1, 'Failed path still uses the real heartbeat call');
assert.equal(failedScreen.continueWatchingButton, undefined, 'Failed path leaves the button state untouched');


const seasonalSource = fs.readFileSync(new URL('../build/tv/whitelabel/app/release/1.172.0/static/script/appui/components/details/seasonal.js', import.meta.url), 'utf8');
assert.match(seasonalSource, /"whitelabelapp\/services\/continuewatching","whitelabelapp\/utils\/playerheartbeat","whitelabelapp\/utils\/network\/api"/,
  'Seasonal screen must use the app’s Continue Watching service, heartbeat and API modules');
assert.ok(seasonalSource.includes('this.buildProgrammeInfo(),this.buildContinueWatchingButtonRow(),this.buildSeasonsList()'),
  'Seasonal buttons must be built in a dedicated row');
assert.ok(seasonalSource.includes('buildContinueWatchingButtonRow:function(){var e=new t("vmContinueWatchingButtonRow")'),
  'Seasonal My List and remove button must share a horizontal row');
assert.ok(seasonalSource.includes('"#"+this.id+" #"+this.continueWatchingButtonId,["width","167px"],["height","92px"],["border-radius",n.buttonCorner],["left","0px"],["margin-left","10px"]'),
  'Seasonal remove button must align with My List instead of being shifted right');
for (const token of [
  '["#vmContinueWatchingButtonRow",["white-space","nowrap !important"]]',
  '["#vmContinueWatchingButtonRow > #"+this.favouritesButtonId+",#vmContinueWatchingButtonRow > #"+this.continueWatchingButtonId,["display","inline-block !important"],["vertical-align","middle"]]'
]) {
  assert.ok(seasonalSource.includes(token), `Built seasonal row must contain ${token}`);
}
for (const token of [
  'findContinueWatchingEntry:function()',
  'appendContinueWatchingButton:function(t)',
  'handleRemoveContinueWatching:function(t)',
  'button_mark_as_watched","Mark as watched"',
  'var entry=this.continueWatchingEntry||this.findContinueWatchingEntry()',
  'contentId=asset&&this.utils.getUvid(asset,!0)',
  'heartbeat.setMediaId(contentId)',
  'streamHeartbeat&&streamHeartbeat.url?streamHeartbeat.url',
  'api.updateHost("heartBeatHost",host)',
  'play_head:duration',
  'heartbeat.getUserId()',
  'heartbeat.getCompanyId()',
  'heartbeat.getPlatformId()',
  'list.getActiveChildWidget()===removedButton',
  'list.setActiveChildWidget(next)',
  'white.svg',
  'window.vmContinueWatchingRemoved=!0'
]) {
  assert.ok(seasonalSource.includes(token), `Built seasonal screen must contain ${token}`);
}
assert.doesNotMatch(seasonalSource, /removeFromContinueWatching/, 'Seasonal screen must not guess a service removal method');
assert.doesNotMatch(seasonalSource, /heartbeat-virginmedia/, 'Seasonal heartbeat host must come from the app, not be hardcoded');
assert.doesNotMatch(seasonalSource, /53089455|53508245|user_id:\s*["']\d+["']|company_id:\s*["']\d+["']/,
  'Seasonal screen must not contain sample heartbeat values');

let seasonalFactory;
vm.runInNewContext(seasonalSource, {
  define(name, dependencies, build) {
    assert.equal(name, 'whitelabelapp/appui/components/details/seasonal');
    assert.deepEqual(Array.from(dependencies), [
      'whitelabelapp/appui/components/details',
      'whitelabelapp/appui/widgets/horizontallist',
      'whitelabelapp/appui/widgets/verticallist',
      'whitelabelapp/utils/state',
      'antie/widgets/label',
      'whitelabelapp/services/continuewatching',
      'whitelabelapp/utils/playerheartbeat',
      'whitelabelapp/utils/network/api'
    ]);
    seasonalFactory = build;
  },
  console: {log(){}, warn(){}, error(){}},
  window: {}
});
assert.equal(typeof seasonalFactory, 'function', 'Built seasonal module must be loadable');

const seasonVideos = [{
  id: 53089455,
  uvid: 53089455,
  title: 'Gogglebox Ireland Ep.1',
  duration: 2665,
  play_position: 43,
  type: 'show'
}];
const seasonCw = {
  modelId: 'continuewatching',
  Models: {readModelData(name) {
    assert.equal(name, 'continuewatching');
    return {videos: seasonVideos};
  }},
  getViewingProgress(id) { return id === 53089455 ? 43 : 0; }
};
const seasonAppended = [];
const seasonRemoved = [];
function SeasonList(id) {
  this.id = id;
  this.children = [];
  this.appendChildWidget = function (widget) { this.children.push(widget); };
  this.getChildWidgets = function () { return this.children.slice(); };
  this.getActiveChildWidget = function () { return this.active; };
  this.setActiveChildWidget = function (widget) { this.active = widget; return true; };
  this._setActiveChildFocussed = function () { this.focused = true; };
  this.removeChildWidget = function (widget) {
    seasonRemoved.push(widget);
    const index = this.children.indexOf(widget);
    if (index >= 0) this.children.splice(index, 1);
  };
}
const seasonBase = {
  getDataItem() {
    return {series: {id: 'series-1', title: 'Gogglebox Ireland', seasons: [{tiles: [{
      id: '53089455', uvid: '53089455', title: 'Gogglebox Ireland Ep.1', duration: 2665, type: 'show'
    }]}]}};
  },
  buildProgrammeInfo() {},
  buildSeasonsList() {},
  appendFavouritesButton(list) {
    this.favouritesButton = {id: 'favBtn'};
    if (list && list.appendChildWidget) list.appendChildWidget(this.favouritesButton);
  },
  appendControlButton(config, list) {
    const button = {config, list, setAccessibleLabel(label) { this.accessibleLabel = label; }};
    seasonAppended.push(button);
    if (list && list.appendChildWidget) list.appendChildWidget(button);
    return button;
  },
  utils: {
    getAssetPath() { return '/assets'; },
    getUvid(asset, preferUvid) { return preferUvid && asset.uvid ? asset.uvid : asset.id || asset.uvid; },
    localiser: {getString(key, fallback) { return fallback || key; }}
  },
  Models: {readModelData(name) {
    if (name === 'config') return {companyId: 196};
    if (name === 'stream') return {response: {heartbeat: {url: 'https://heartbeat-virginmedia.simplestreamcdn.com/concurrency/v1/'}}};
    assert.fail(`Unexpected model ${name}`);
  }}
};
function seasonExtend(methods) {
  if (methods.init && !methods.init.base) methods.init.base = function () {};
  const Component = function () {
    if (this.init) this.init.apply(this, arguments);
  };
  Component.prototype = Object.assign({}, seasonBase, methods);
  Component.base = function () {};
  return Component;
}
function SeasonalDetails() {}
SeasonalDetails.extend = seasonExtend;
SeasonalDetails.base = function () {};
function SeasonHorizontalList(id) { SeasonList.call(this, id); }
SeasonHorizontalList.prototype = Object.create(SeasonList.prototype);
function SeasonVerticalList(id) { SeasonList.call(this, id); }
SeasonVerticalList.prototype = Object.create(SeasonList.prototype);
function SeasonState() {}
function SeasonLabel() {}

const seasonHeartbeats = [];
const seasonHostUpdates = [];
let seasonHeartbeatFail = false;
const seasonHeartbeat = {
  setCompanyId(id) { this.companyId = id; },
  setMediaId(id) { this.mediaId = id; },
  getMediaId() { return this.mediaId; },
  getUserId() { return '16269'; },
  getCompanyId() { return this.companyId; },
  getPlatformId() { return 'hybridtv'; },
  send(endpoint, params, success, fail) {
    seasonHeartbeats.push({endpoint, params});
    if (seasonHeartbeatFail) fail({error: 'offline'});
    else success({session_id: 'session'});
  }
};
const seasonApi = {
  getEndpoint(name) {
    assert.equal(name, 'heartBeatStart');
    return {host: 'https://api-virginmedia.simplestreamcdn.com/concurrency/v1'};
  },
  updateHost(name, value) { seasonHostUpdates.push([name, value]); }
};

const Seasonal = seasonalFactory(SeasonalDetails, SeasonHorizontalList, SeasonVerticalList, SeasonState, SeasonLabel, seasonCw, seasonHeartbeat, seasonApi);
const seasonScreen = new Seasonal();
seasonScreen.seasonPanel = new SeasonList('seasonPanel');
seasonScreen.buildProgrammeInfo = function () {};
seasonScreen.buildSeasonsList = function () {};
seasonScreen.fillSeasonPanel();
const seasonButton = seasonAppended.find(entry => entry.config && entry.config.button && entry.config.button.id === 'continueWatchingBtn');
assert(seasonButton, 'Seasonal Continue Watching button must be appended');
assert.equal(seasonButton.config.button.text, 'Mark as watched');
assert.equal(seasonButton.config.button.class, 'controlbutton');
assert.equal(seasonButton.config.image.url, '/assets/continuewatchingremove/white.svg');
assert.equal(seasonButton.accessibleLabel, 'Mark as watched');
assert.equal(seasonButton.list, seasonScreen.vmButtonRow, 'Seasonal button must share the row with My List');
assert.equal(seasonScreen.vmButtonRow.children[0], seasonScreen.favouritesButton, 'My List must be first in the button row');
assert.equal(seasonScreen.vmButtonRow.children[1], seasonButton, 'Remove button must sit directly beside My List');
assert.equal(seasonHeartbeats.length, 0, 'Rendering the seasonal button must not send a heartbeat');
seasonScreen.vmButtonRow.setActiveChildWidget(seasonButton);
seasonButton.config.button.callback({});
assert.equal(seasonHeartbeats.length, 1, 'Selecting the seasonal button must send one real heartbeat');
assert.equal(seasonHeartbeats[0].endpoint, 'heartBeatStart');
assert.deepEqual(JSON.parse(JSON.stringify(seasonHeartbeats[0].params)), {
  user_id: '16269',
  company_id: 196,
  content_id: '53089455',
  content_type: 'show',
  platform_id: 'hybridtv',
  play_head: 2665
});
assert.deepEqual(seasonHostUpdates, [['heartBeatHost', 'https://heartbeat-virginmedia.simplestreamcdn.com/concurrency/v1/']],
  'Seasonal heartbeat host must come from the stream response');
assert.deepEqual(seasonVideos, [], 'Seasonal local Continue Watching cache is refreshed after acceptance');
assert.equal(seasonScreen.continueWatchingButton, null, 'Seasonal button is removed after a successful removal');
assert.equal(seasonRemoved.length, 1, 'Seasonal button widget is removed from its list');
assert.equal(seasonScreen.vmButtonRow.getActiveChildWidget(), seasonScreen.favouritesButton,
  'Seasonal button row active child moves off the removed button so navigation still works');
assert.equal(seasonScreen.vmButtonRow.focused, true, 'Seasonal button row refocuses after removal');

seasonVideos.push({id: 53089455, uvid: 53089455, duration: 2665, play_position: 43, type: 'show'});
seasonHeartbeatFail = true;
const failedSeasonScreen = new Seasonal();
failedSeasonScreen.seasonPanel = new SeasonList('seasonPanel');
failedSeasonScreen.buildProgrammeInfo = function () {};
failedSeasonScreen.buildSeasonsList = function () {};
failedSeasonScreen.fillSeasonPanel();
const failedSeasonButton = seasonAppended[seasonAppended.length - 1];
const beforeSeasonFail = seasonHeartbeats.length;
failedSeasonButton.config.button.callback({});
assert.equal(seasonHeartbeats.length, beforeSeasonFail + 1, 'Failed seasonal path still uses the real heartbeat call');
assert.equal(seasonVideos.length, 1, 'Failed seasonal heartbeat must leave the local Continue Watching cache untouched');
assert.equal(failedSeasonScreen.continueWatchingButton, failedSeasonButton, 'Failed seasonal path leaves the button in place');

console.log('PASS Continue Watching removal button, real heartBeatStart call and local-only UI refresh');
