# Current TV playback investigation

Target: UE40K5500, Tizen 2.4 / WebKit 538.1, TV_IP. App: VmPlay2016.Player. Current build: 1.0.0, standalone playback with diagnostics disabled. Confirmed smooth on-demand picture/sound, local resume and a working quality panel. Native reports verified manual 252p/1080p switching. Sustained live playback remains unresolved. Mac media-proxy experiments have stopped.

The original SimpleStream Virgin HbbTV UI, account pairing and stream acquisition work. This TV selects the TAL/Shaka branch, not the newer Bitmovin iframe. Its default response was fragmented-MP4 Widevine HLS with SAMPLE-AES. The existing stream API accepts `protection=playready` and supplies a PlayReady DASH rendition to the same paired session.

The live DASH presentation clock is roughly 60 million seconds from its December 2024 availability origin. `tv/live-timing.js` adapts the working RTÉ normalization to nonzero origins and preserves segment addresses and encrypted sample bytes. The current media library is the exact locally patched Shaka 4.3.5-rte module from RTÉ, exported to AMD by `tools/extract-rte-player.mjs`. The 4.12.7 experiment did not yield working playback.

## Established evidence

- Normal native MP4 pre-rolls play with advancing clocks and decoded video dimensions.
- The final pre-roll reaches completion and the programme DASH manifest is fetched successfully.
- In 0.2.13–0.2.14, native `webkitkeymessage` events contained zero bytes, and the resulting ExpressPlay POST bodies also contained zero bytes.
- Those requests included the ExpressPlay token in their URL. The service returned HTTP 400 and Shaka reported 6007. No nonempty licence challenge has yet been observed in this app.
- The TAL lifecycle called asynchronous unload/detach, then immediately cleared and removed the video element. A following source attached another video before the previous detach completed.

The cleanup race was fixed, but a clean cold-boot test still produced empty challenges. A second run using the media event's own initialization data also produced empty challenges. The reason this particular stream fails through prefixed EME remains unresolved.

## Working native playback

Build 0.2.17 introduced Samsung AVPlay for the protected DASH programme. The same Virgin account, metadata and supplied ExpressPlay licence URL are retained. Samsung's documented PlayReady GetRights flow acquires the licence natively. Confirmed smooth picture and sound and eventual 1080p. They reported a few initial stutters and no visible ads, so that run did not visually verify an ad handoff.

Build 0.2.18 bundled thirteen original player images, including the language icon, close button and subtitle tick. It translates Samsung Return (10009) to TAL Back (461) and gives the language panel its own Back close handler. Confirmed physical Return works. The network remote's KEY_RETURN did not reproduce the physical key event, so it must not be used as proof that Return fails. Restored language icon was oversized.

Build 0.2.19 reduces the icon from 66.82px to 40px within its 65px control. It uses AVPlay for the clear MP4 pre-rolls too, so their visible completion and handoff can be tested through the same native player as the programme. Clear MP4s do not configure DRM. Completion advances the playlist only after the native callback returns. Audio language, subtitle language and subtitle visibility controls delegate to AVPlay. Legacy Shaka remains as the framework's configuration/track interface and fallback.

The low overhead trace receiver is `tools/trace-server.py`, bound to the Mac's DEV_HOST:18784. It appends `.local/tv-playback.log`. The widget logs licence sizes, token presence, numeric errors and sanitized rejection text; it excludes payloads and tokenized URL paths. Native progress appears as `VM AVPlay progress`. Native licensing runs inside Samsung's API, so browser XHR licence logs are not expected for that path. Avoid the legacy inspector during playback; earlier sessions froze the TV.

## Next validation

Observe 0.2.21 through normal Live → Virgin Media One navigation, including ads and sustained programme playback. Verify picture and sound with the user; an advancing native clock is insufficient evidence. The Mac preview cannot simulate Samsung's CDM or native decoder.

## Local checks

Run these against the staged TV build:

```sh
node tests/pairing-finish.mjs
node tests/drm-handoff.mjs
node tests/player-recovery.mjs
node tests/player-lifecycle.mjs
node tests/live-clock.mjs
node tests/avplay.mjs
node tests/remote.mjs
```

All checks have passed for the current source. The legacy player AMD wrapper was also loaded in the local PhantomJS/WebKit 538.1 engine, which confirmed its exported player version and APIs. These checks do not simulate Samsung's native CDM.

## Subsequent steering and stalled recovery

The user supplied Chrome screenshots showing the newer Bitmovin overlay (top-right subtitle/audio icons, live bar and ad countdown). The TV uses the older TAL overlay. They explicitly deferred reproducing the Chrome layout; do not continue that UI redesign. No replacement overlay has been implemented.

At 18:18:19 on 13 November 2026 the 0.2.18 native live clock stopped advancing and the framework entered BUFFERING. At 18:18:36 its timeout path failed with `this.player.onPlayStateChange=null` inside the remote NPAW adapter. That exception also interrupted exit, leaving a spinner. The initial buffering cause is not proven; a live DASH period transition is suspected.

Build 0.2.20 selects the provider-declared SamsungAvplay NPAW adapter, bundled as ES5 in npaw-avplay.js. It passes the actual API object and forwards native playback events. Optional analytics cleanup is guarded so an SDK failure cannot interrupt stopping the player. The native placeholder also uses the expected mediaPlayerVideo ID.

The framework can reacquire a stalled native stream once. It gets fresh normal provider metadata and licensing through its existing acquireStream flow. That retry budget resets only after at least sixty seconds of advancing native playback; repeated immediate failures still reach the existing error path. The final source includes the clear-MP4 native path and the earlier 40px icon change. A new player layout remains deferred.

Physical Return worked in 0.2.18; the extra TAL key-map rewrite and window-level raw-key logger considered for 0.2.19 were removed before any TV installation. The remote bridge remains the tested document-capture translation. The tests also cover native subtitle/audio selection and clear-ad completion without DRM.

## Repeated live sections: timing experiment 0.2.21

The user visually confirmed an advert followed by the programme in 0.2.20, then reported repeating sections of roughly ten seconds, freezing, more ads and further repeats. Native clocks continued advancing through much of that run. The retry mechanism could restart ads without resolving the underlying fault.

The original DASH clocks are about 60 million seconds, while AVPlay reports a clock consistent with a wrapped 32-bit millisecond value. This is a timing hypothesis, not a confirmed root cause. Build 0.2.21 routes live DASH through `tools/timing-proxy.py` on the Mac, configured privately in `.local/timing-proxy.json`. The Mac must remain running for this experimental build's live playback. MP4 ads, VOD, account requests and licence acquisition retain their direct paths.

`tools/dash_timing.py` rebases availabilityStartTime, Period starts, presentationTimeOffset, SegmentTimeline values, fragment tfdt and sidx clocks by one stable session anchor. Requests still resolve to the original media segment addresses. Encrypted sample bytes and DRM metadata are preserved. Real encrypted audio/video fragments passed the metadata check and had aligned rebased clocks. The TV's first native clock in this test was about 6,409 seconds instead of about 430,000; visual stability is still pending.

The private helper binds to the Mac's LAN IP, allows only the TV/Mac peers, requires a private registration key, limits source hosts to the observed broadcaster/CDN domains, caps cached media and expires idle sessions. Do not publish its configuration or a WGT embedding that key. Automatic source reacquisition is disabled when this helper is configured, so a failure reaches the existing error screen without repeatedly restarting ads.

Checks: `python3 tests/timing-proxy.py`, `node tests/native-recovery.mjs`, and the existing native lifecycle/DRM checks. To stop the TV app, use `sdb -s TV_IP:26101 shell 0 kill VmPlay2016` (package ID). Using the application ID instead returns ARGUMENT_INVALID.

### Subsequent observation, 13 November 19:40

The unattended 19:00 timing run was not visually observed by the user. Its native clock advanced until about 19:16:21, then stalled at 7,349 seconds. At 19:16:50 AVPlay emitted `PLAYER_ERROR_NOT_SUPPORTED_FILE` and exited through the existing error path. No automatic ad restart followed. Timestamp rebasing is therefore not yet a complete playback fix.

At 19:35:18 the user's first new selection returned a service error before any native source was staged. At 19:35:40 an immediate second selection succeeded, followed by four completed MP4 adverts and native DASH playback at 19:37:44. The trace does not establish the reason for the first acquisition failure: the original stream-acquisition error prefix was excluded by its console filter. The filter now includes that prefix for the next build; the running 0.2.21 app has not been interrupted or replaced during the user's visual test. Physical picture/sound and absence of repeats remain awaiting confirmation.

## Broadcast midroll and resolution transition investigation: 0.2.22

The user confirmed the 19:37 run played 1080p smoothly after an initial skip and freezes during resolution changes. It failed during a broadcast ad break. Trace: buffering at 19:43:35, stopped native clock at 5,382 seconds, `PLAYER_ERROR_NOT_SUPPORTED_FILE` at 19:44:04, then the service error. This is distinct from pre-roll completion. The user's report establishes that broadcast breaks include inserted midrolls.

The captured 19:45 manifest spans a 210-second period ending at 19:45:37 UTC and the following period. Both periods' video and primary audio initialization bytes have identical SHA-256 fingerprints and the same DRM key ID. The timing helper previously forwarded the period topology intact. Native AVPlay has documented multi-period/SSAI limitations; this is now the main hypothesis for the failure, not merely timestamp magnitude. See [player vendor's AVPlay analysis](https://optiview.dolby.com/resources/blog/playback/going-big-screen-exhaustive-list-of-samsung-tizens-avplay-limitations/).

`ContinuousTimeline` now emits one stable Period, one fixed 1080p video rendition, primary audio and the existing text track. Compatible provider periods are joined by translating each period's own PTO into a per-track fragment correction. All original advert/programme segments and their upstream addresses remain represented. It preserves encrypted sample bytes, licence exchange and DRM descriptors. It rejects changed decoder initialization, codec, resolution or DRM signatures rather than joining incompatible data. Those cases are not yet supported by this continuity strategy. Fixed FHD trades adaptive quality for avoiding the observed decoder switches; lower bandwidth networks may need a different fixed rendition.

The real captured boundary has no video/text timing gap and a 5.333 ms audio overlap. Synthetic regression checks exercise programme → advert → programme, split segments, original Number/Time routing, sliding manifest refreshes, preserved payload bytes and incompatible-period rejection. An 84-refresh live capture and real encrypted-fragment proxy check also passed before installation. These checks do not establish decoded picture/sound on hardware.

`tools/watch-dash.py` captures changing source manifests under private `.local/dash-observations`. The timing helper also preserves private original manifests when period topology changes under `.local/timing-captures/<session>`, with the signed source address in a mode-0600 file. This enables checking actual broadcast boundaries rather than relying on user reports alone. The TV trace now includes stream-acquisition errors and selected native bitrate/resolution event names. The installed build is being tested across a complete broadcast break.

### Four testing and a corrected manifest defect

The live guide is vertical: after entering Live, use Down three times, not Right. A later screen trace confirmed Four's Judge Judy episode and the source's 2024-11-29 availability origin. `tools/tv-remote.mjs` still cannot be used to judge physical Back behavior.

Four uses d1o5wc5bjvzqoa.cloudfront.net rather than One's CDN. The original helper rejected it; the native player then retried rapidly. The helper now permits the verified CDN hosts for all four channels and Four's observed MediaTailor host. Before returning a session to the TV it fetches the selected video/audio initialization files and an encrypted media fragment. All four channel preflights passed. Private selectors/manifests are under `.local/channel-audit`; do not package them.

The first continuous-period implementation removed `SegmentTemplate.startNumber`, leaving the default 1 on every sliding-window refresh. The user saw the episode's intro repeat. Subsequent request tracing showed initialization reloads and earlier video/audio segments being fetched repeatedly. Dropping the advancing startNumber is a defect in our rewrite and is the leading explanation for these repeats. The helper now preserves each track's actual startNumber. `tests/continuous-dash.py` checks that it advances when the old period slides out. `tools/audit-captured-dash.py DIRECTORY --source PRIVATE_SOURCE_JSON` verifies original segment numbering/routing, surviving segment identity, one rendition and boundary timing across real captured refreshes. The audit passed 316 Four refreshes and 549 One refreshes at the time of the fix; later captures continue accumulating.

The helper records numeric request metadata in `.local/media-requests.log` (time, short session label, method, track, time and Range presence), without URL tokens or headers. It can reconstruct timing state from private captures on restart, but this cannot restore every intervening historical segment route; restart playback for a clean comparison after helper changes. Packet capture was unavailable without a local sudo password and was not used.

The clean Four run after the numbering fix started native programme playback at 20:15:22, session label 7653894a. After initial prepare/play probing, audio/video requests remained monotonic with no further init reloads. The native clock crossed the new provider period at normalized time 7190.734 (20:17:04 UTC content time) and continued. The text/application track still periodically re-requests initialization and earlier caption segments; its native behavior has not been resolved. Full return from the broadcast break and physical picture/sound are still pending confirmation.

Another failure-path issue was observed during the rejected-host attempt: repeated calls to pause/resume in the driver's ERROR state generated repeated reports and teardown logs. This is not fixed by the CDN preflight and remains a cleanup concern to address if errors recur. Do not claim all error handling is robust from the successful programme clock.

## Native decoder sync experiment: 0.2.23

The user confirmed the startNumber-corrected Four run played normally initially. It crossed the 210-second break without the former fatal native error, but the video fell roughly five seconds behind the audio. They also reported that the earlier run had eventually degraded to a one-frame-per-second slideshow before it was stopped. Advancing clocks and successful manifest audits do not establish good decoding.

`tools/audit-fragment-clocks.py` inspects clear BMFF sample timing metadata without decrypting samples. Across the captured break return, video PTS and audio PTS remained within about 40 ms; video segments split into 1.64/4.36 seconds and audio into 1.642667/4.352 seconds at the boundary. This does not explain a five-second offset in the source timestamps. A decoder/buffer backlog is suspected, not proven.

Build 0.2.23 adds `tv/boundary-sync.js`. The helper's `/s/<session>/state.json` exposes normalized original period boundaries. The same installed app polls it once a second and performs one native asynchronous seek to its current presentation position after crossing each new boundary. This is a decoder-queue flush experiment: it does not reacquire the source, advance to a later programme time, skip an ad or restart pre-rolls. Requests have generation/stop guards, an eight-second seek deadline and no repeated seek retry. A private-key-authenticated POST `/s/<session>/resync` increments a one-shot manual diagnostic command for the same path. There is no arbitrary code execution endpoint.

Native errors are now deferred out of Samsung's event callback before teardown; duplicate errors and late prepare completions are suppressed. The retired-source error-report guard prevents later pause/resume calls from recursively emitting the same error/teardown chain. Tests: `tests/boundary-sync.mjs`, `tests/native-error-retirement.mjs`, updated `tests/avplay.mjs` and existing lifecycle/recovery checks all passed before installation.

The new Four run entered native playback at 20:29:29. At the next provider boundary (normalized time 4330.734), the controller initiated its first flush at 20:29:53 and completed at 20:30:00, with about six seconds of rebuffering. Playback clocks continued after that. This cost is material and must not be described as seamless. The source announced a 90-second break; the return transition and physical A/V sync are being checked.

## Failed seek experiment; manifest-only native clocks: 0.2.24

The user reported that 0.2.23 froze during the advert, played a few seconds, jumped back to credits from before playback started and repeated a promo three times. Both seek callbacks had returned success and clocks looked normal. The boundary-seek experiment failed and was stopped. Do not infer decoded frame position from AVPlay's clock or successful seek callback on this stream. `tv/boundary-sync.js`, its build injection, polling/state and resync endpoints were removed; no automatic boundary seeks remain. The deferred native-error and retired-source error guards remain.

The next controlled comparison preserves every provider initialization and encrypted media byte, including its original timestamp metadata. `ContinuousTimeline(normalize=False)` keeps the original availabilityStartTime, fixes the output Period start and PTO to the first observed provider period, joins subsequent compatible periods without changing their SegmentTimeline clocks, preserves advancing startNumber and retains one FHD rendition. The helper's fragment transform is a no-op in this mode. The large unsigned native clock may wrap in the JS API; that alone does not establish a decoder fault. Earlier native playback with original media clocks was smooth until period boundaries, so the timestamp-magnitude hypothesis is no longer treated as established.

`tools/check-proxy-media.py PRIVATE_SOURCE_JSON` compared real Four video/audio init files and encrypted fragments against direct CDN responses: both were byte-identical. `tools/audit-captured-dash.py ... --original-clocks` passed 755 Four refreshes and six provider periods, with no inter-segment timing gaps in that capture. The original-clock path and stable Period/PTO through refresh also have regressions in `tests/continuous-dash.py`. Build 0.2.24 is the hardware comparison, not a confirmed playback fix.

## Standalone goal restored; on-demand work: 0.2.25–0.2.28

The final app must work without any Mac server, as RTÉ does, and permitted moving to VOD. The proxy experiments are stopped and their session is not running. `tools/build-tv.mjs` now embeds `vmTimingProxy=null` unless `VM_ENABLE_PROXY=1` is explicitly set. `VM_DIAGNOSTICS=1` separately enables optional Mac trace reporting; normal builds disable it. Diagnostics do not route media or licence requests. Current hardware test builds use optional reporting to verify native resolution; default release artifacts omit enabled reporting.

A review identified a real capture bug: original-clock mode initializes anchor to zero, so using `anchor is None` skipped source.json. `Session.captured` now tracks initial capture independently. `tests/proxy-capture.py` verifies fresh source persistence and reconstruction. Route identity audits now retain immutable canonical addresses and reject reused timestamps/numbers mapped to different media, including reused Period IDs; `tests/continuous-dash.py` covers these collisions. Audits passed 1,102 Four refreshes across eight periods, but this is not evidence of good decoded video.

Both remaining native seek paths now log caller, requested time, current clock, live range, success/error and first subsequent playback timestamp. A positive `beginPlaybackFrom` waits for the seek callback before play. The 1% Club played smoothly in sync with the media proxy stopped. At the programme's broadcast-break cut, the app switched to a five-second clear MP4 and resumed at 664 seconds; the edited programme was cut, this was not necessarily a visible inserted advert. Do not call this a visually verified ad playback. They reported low resolution and stuttering on return until 1080p settled.

Missing on-demand control SVGs caused the DOMParser error document to be inserted into Play/My List controls. `complete-assets.py` now stages 15 validated original SVGs (28 total UI/player assets). The SVG renderer rejects non-SVG/parsererror roots. PhantomJS/WebKit 538.1 rendered the bundled Play icon and rejected an invalid response in `tests/svg-renderer.js`; the native UI trace then showed a clean Play button.

`tv/quality.js` fetches the original VOD MPD directly, derives available heights/bitrates, and adds a Picture quality column to the existing options pane through `tools/quality-hooks.mjs`. Auto sets STARTBITRATE=HIGHEST while allowing adaptation; manual selections set BITRATES/STARTBITRATE/SKIPBITRATE during IDLE, reopening the same source and resuming the current VOD position. This does not trigger new stream acquisition/pre-roll selection. Live switching is deliberately absent. Native 0.2.27 reported 1920×1080 immediately after prepare with Auto high start, but its menu closed with Not available, so manual hardware selection was not yet verified.

That menu failure exposed an initialization race: the trackmanager singleton selected the HTML5 handler before asynchronous Shaka loading, then queried the empty hidden video element forever. Native AVPlay now selects the Shaka/native-track bridge regardless of that load race. The pane also accepts a quality column even if no audio/subtitle options exist. `tests/track-manager.mjs` covers the early-loading selection.

Signed-in `playerutils.getViewRecord` read only the account service's in-memory progress and ignored persistent local records. That service's `setViewingProgress` only mutates its in-memory video list. A recent local record now takes precedence, capture uses the canonical UVID, advert/live clocks are excluded, and native VOD playback saves local progress every thirty seconds. Quality changes capture progress before reopening. Explicit Restart clears both the local record and cached position. `tests/resume-records.mjs` covers local 1048 seconds versus stale cache 9 seconds and exclusion of non-programme clocks. The earlier 0.2.27 hardware run had resumed at 9 seconds despite a normal exit near 17:28; 0.2.28 is being checked against that failure.

The focus is now standalone VOD plus quality/UI/resume behavior. Do not resume proxy live experiments or claim live is fixed. The media helper is stopped; any remaining Mac trace receiver is optional diagnostics only.

## Verified VOD controls; clean release 0.2.30

0.2.28 restored the saved position around 17 minutes; traces showed a local 1048-second record, a matching native seek and periodic local checkpoints thereafter. The old HbbTV options widget still closed. The early handler-selection fix was insufficient to resolve that widget's caught failure; do not describe it as the complete options fix.

Build 0.2.29 replaced only the AVPlay options path with `tv/options.js`, a direct DOM panel for audio, VOD quality and native text choices. It queries the active native driver and does not depend on a Shaka/HTML5 track-manager capability check. A window capture listener installed before TAL consumes its navigation/OK/Return events and their releases, preventing an options key from also acting on the player. Reset removes the panel. The original HbbTV widget remains the non-native fallback. The superseded `quality-hooks.mjs` experiment was removed.

The panel worked, but occupied only the top-left 1280×720 portion of the 1920×1080 viewport. Build 0.2.30 measures the panel's rendered bounds and scales it to the actual viewport, accounting for any ancestor transform; resize re-fits it. Common language codes display as English/Irish/Welsh labels. The PhantomJS test verifies opening without caption tracks, selecting 720p, input isolation and a full 1920×1080 bounding rectangle. The viewport fix is a local-engine validation.

Hardware evidence from 0.2.29: quality 252p requested at 21:43:52, native output 448×252 at 21:43:57; 1080p requested at 21:44:22, native output 1920×1080 at 21:44:28. Both reopened the same source and resumed around the current programme position, with no new stream acquisition. This establishes manual quality enforcement on this TV, not just API acceptance. Caption selection/rendering has not been visually verified; AVPlay has DASH text-selection limitations.

The final normal build sets both `vmTimingProxy=null` and `vmDiagnosticsEnabled=false`. Media proxy and optional trace receiver are stopped. The signed release is `dist/vm-play-hbbtv.wgt` (also `dist/Virgin Media Play.wgt`). It contains no private proxy registration key. Normal playback has no Mac dependency. The diagnostic builds used earlier differed by explicitly enabling optional trace beacons, not by routing VOD media/licences through the Mac.


## Subtitle callback rendering, 0.2.31

News captions did not render and episodes offered subtitles despite lacking them. The previous selection called AVPlay setSelectTrack(TEXT), which Samsung documents as unsupported for DASH; the exception prevented visibility from being enabled. The menu also always included Off, and advertised native TEXT slots were assumed to contain captions.

The native DASH path now retains the default subtitle stream, keeps silent subtitles enabled and renders onsubtitlechange text in an app-owned layer. Text is displayed with textContent after stripping formatting and decoding entities; cue expiry, Off and source teardown clear it. Generation guards reject retired source callbacks. Only receipt of nonempty text enables On; an empty advertised slot does not. Until a cue arrives the panel says No subtitles detected, and an open panel refreshes on first data. This is a detection policy, not proof that an entire programme has no subtitles. Only the default DASH language is offered because native TEXT switching is unsupported.

Node tests and actual PhantomJS/WebKit 538.1 tests cover an empty TEXT slot, nonempty cue detection, entity/line-break rendering, On/Off, source cleanup, and old callback suppression. The standalone build check passes with diagnostics/proxy disabled. Hardware subtitle rendering still needs confirmation; no claim that all DASH subtitle formats are supported.


0.2.32 follow-up: configure setSilentSubtitle(true) immediately after open (IDLE), before prepareAsync. Samsung permits READY only following synchronous prepare; the previous call in the async success handler could throw and be ignored. The native test now rejects that READY call. The user identified News at 7 as the subtitle comparison; visual confirmation is pending. A captured service stream advertised stpp/English but three inspected fragments had zero TTML p elements, confirming that a TEXT slot alone is insufficient availability evidence (this was not a News at 7 VOD capture). No caption text or signed source URLs are printed.


## Deferred investigations: guidance after 0.2.32

The user confirmed News at 7 still says No subtitles detected in 0.2.32, accepted leaving subtitles unresolved for now, and explicitly asked to retain AVPlay rather than pursue a player replacement. Do not describe subtitles as fixed or switch engines based on these hypotheses. No further playback changes or TV tests were requested in this turn.

Astra's legacy-EME comparison is worth preserving separately: extract-rte-player.mjs deliberately overrides RTÉ's manifest-preferred init data and always feeds the hardware event bytes to webkitGenerateKeyRequest. Existing logs contain a 1562-byte PlayReady input followed by an empty keymessage. Astra reports the captured manifest PlayReady PSSH is 714 bytes and Widevine is 67, making two copies of both boxes a plausible input-shape explanation, not proof. A future controlled test should record each PSSH box size/system ID/digest at the actual native key-request call, comparing a known-working RTÉ tune and a Virgin tune. Compare unchanged full event bytes with the exact selected-system manifest PSSH on fresh Virgin sessions, keeping tune/timing/licence source consistent. Record first keymessage length. Never log licence bodies, init-data payloads, signed URLs or tokens. Reverting the override without identifying the supplied bytes would be inconclusive. This is the Shaka/prefixed-EME path, distinct from the current native AVPlay playback path.

Subtitle diagnostics also need correction before any stronger conclusion: subtitle() currently rejects nonzero callback types before logging, then logs only the first nonempty text cue. No callback, empty callback and image callback all yield the same menu label. At one exact News at 7 episode/timestamp with captions visibly verified in Virgin's web player, record callback type, payload length, duration and AVPlay position before filtering (metadata only). A text cue should enable On and paint the current cue. If callbacks are absent, compare the TV rendition's caption fragment at that timestamp with the web player's caption source; distinguish feed/source differences from native delivery. Image callbacks need their own rendering decision, not an assumption that captions are absent. No separate caption-fetcher or player replacement is justified yet.


## Reliability priority after 0.2.32

Prioritizing reliable streaming. Keep AVPlay and standalone playback; subtitles and the legacy EME/PSSH experiment remain deferred. Start with direct Four across a broadcast break, using optional diagnostics to record the exact native failure and source manifest, without a media proxy.

A deterministic cancellation test failed before the fix: a source cancelled while waiting for detach still called quality.resolve after the replacement source was playing, replacing its active quality state. Added generation checks before both asynchronous source resolution and quality setup. The same test also verifies that native close is attempted even if stop throws; these calls now have independent exception handling. These are lifecycle fixes, not a proven explanation or solution for live period-boundary decoding.

0.2.33 adds buffering start/progress/end metadata and onerrormsg details limited to code, codec, demux, resolution and fps. Failure snapshots contain native state, time, source kind and generation. Raw error messages/licence bodies are omitted. With VM_DIAGNOSTICS=1 only, an optional nonblocking source capture sends the original DASH URL to a Mac receiver restricted to the TV IP and approved CDN hosts; files are private mode 0600. Native video/audio/licences remain direct; nothing waits for the receiver. Capturing the exact TV source permits investigating the same personalized ad session, rather than comparing it with a newly acquired session. The default build disables this diagnostic receiver path.


### Direct Four observations and fixed-rendition comparison (0.2.34)

0.2.33 direct Four started a 30-second MP4 advert at 22:22:45. Some subsequent adverts buffered but were replaced around five seconds later before prepare/play was logged. Programme started at 22:23:35. The News at 7 audio was heard over the opening adverts, invalidating clean-start assumptions. Terminated app and confirmed runcheck Not Running before relaunch (no reinstallation). Picture quality Not available on live is expected because the user quality selector is VOD only.

The clean run began programme at 22:26:44. Native clock stalled around 1600231.694 at 22:27:13, then emitted PLAYER_ERROR_NOT_SUPPORTED_FILE at 22:27:49. The second session’s first saved manifest was captured after the error (22:28:29) and contained Period 11039419; a later programme period appeared around 22:29:19. The separately observed first session had also entered 11039419 before the clean tune. This argues against attributing the stall to the later 22:29 period transition, but does not rule out an uncaptured transient boundary in the clean session. The capture started too late to prove period topology at the exact failure. No onerrormsg detail was received before teardown. More ad playback followed the fatal error; whether the user initiated that restart or the app did is not established. Do not label that as verified automatic recovery. The native bitrate/resolution changed in the first run; this motivates, but does not prove, an adaptation issue.

Private source captures direct-20261113T222330138652-source.json and direct-20261113T222640407098-source.json; matching manifest captures direct-four-2233 and direct-four-2226. Observe only the source corresponding to the actual current tune: newly acquired SSAI sources may personalize periods. Earlier stream sessions may differ. No source URLs in documentation/output.

0.2.34 is a controlled direct-native comparison: read the original live MPD, pick the highest advertised rendition at/below 720p (lowest if none below), and apply its fixed bitrate in IDLE before preparation. It never seeks or reopens live based on the VOD quality selector. VOD preference/selection behavior is unchanged. Manifest read has a four-second limit and falls back to native defaults if unavailable. This is an experiment, not established reliable streaming. No proxy, timeline rewrite, alternate DRM or subtitle changes. Buffer-duration diagnostics now clear their start timestamp after completion, and source labels distinguish MP4 adverts from live owners. Native state may continue PLAYING despite a frozen decoded stream; it is not success evidence.


While the 0.2.34 run remains untouched on the TV, an additional cancellation regression reproduced a retired driver closing the replacement driver's singleton native player. close now invalidates its own callbacks but touches the native API only if it owns activeDriver; reset releases native state before clearing that ownership. This change is local source only until the next build. The cancellation, native handoff and old-WebKit caption lifecycle tests pass. It is a defensive lifecycle fix, not hardware evidence explaining the previous mixed audio.

At 22:38 the fixed-720p Four run seems to be playing normally with its own picture/sound. After live reliability is sorted, Auto should try starting at 1080p instead of slowly ramping up (as fixed for VOD). Preserve this request; do not silently replace the current fixed-rendition diagnostic policy or call it Auto. Once adaptation is safe, implement a high initial rendition with downward adaptation permitted. The current run still needs a genuine transition observation.


### 0.2.34 result and the repeated ad-pod defect

Confirmed normal picture/audio/sync early in the fixed-720p run. Native output was 1280x720 at bitrate 3572992 from 22:36:42. Manifest captures began at 22:37:26, before the relevant boundary. Period 11039546 appeared at 22:38:28; old 11039454 disappeared at 22:39:25. Native clock stopped at 1600983.092 around 22:39:46, about 21 seconds after that removal, and PLAYER_ERROR_NOT_SUPPORTED_FILE followed at 22:40:14. Fixed rendition did not prevent the failure. The user described a broadcast advert, then ~20 seconds waiting, ~five inserted ads, another ~20-second wait and another five ads, then late return to the programme. Do not report this as a good break transition or attribute the whole delay solely to decoding. PlayReady PSSH/PRO and Widevine PSSH digests are identical between the two captured periods; no key change is evident in those headers.

A definite retry-policy error was found: live.js init overrides the base MAX_RECOVERY_ATTEMPTS=0 with 3. The previous native-recovery test supplied MAX_RECOVERY_ATTEMPTS=0 in its fixture, so it missed the live override and did not establish that actual live errors could not acquire fresh streams. OnStateChangePlaying resets recoveryAttempts, including while adverts play; native errors were followed by new stream acquisitions and pre-roll pods. The 0.2.35 builder now sets the actual live subclass to zero when native AVPlay is available, retaining upstream 3 otherwise. tests/live-recovery-policy.mjs loads the actual built constructor; it failed (3 vs 0) before this fix and passes after it. This directly addresses repeated fresh pre-roll selection, not the original native window failure.

### Controlled same-session native recovery, 0.2.35

No alternate player or media proxy. An explicit VM_LIVE_RESTART=1 build flag enables a bounded live DASH recovery; default is off until hardware verification. After at least 15 seconds of advancing clocks, either a 12-second frozen clock or a native PLAYER_ERROR can schedule one close/open of the same driver/source/licence. No stream API reacquisition, ad-service call, source change or seek. Close/open is deferred outside the native callback. One further failure stops; budget replenishes only after 60 seconds of continuously advancing playback. Pause is excluded. Stop/reset clear the watchdog and generation guards suppress obsolete callbacks. This is a recovery experiment with possible pause/live-edge discontinuity, not a claim of seamless playback. A future full local-file MPD rewrite is only an idea, not implemented/tested; do not expand scope there prematurely.

Tests native-live-recovery.mjs verify unchanged source and licence, no seek, deferral outside callback, retry cap and cancelled timers. Actual live constructor policy, cancellation ownership, AVPlay handoff and old WebKit tests pass. The explicit diagnostics build also captures the exact TV source privately for independent manifest observation. Do not abandon AVPlay just yet; subtitles and legacy-EME/PSSH experiments remain deferred. Auto starting at 1080p remains requested after reliability; current fixed720p is still only a comparison policy.


Correction to the earlier topology hypothesis: the exact 0.2.34 second stall began at 22:42:50 and errored at 22:43:18; the observed older Period disappeared at 22:42:58. Thus the first fixed720p stall followed period removal by ~21 seconds, but the second began ~8 seconds BEFORE removal. Do not claim that disappearance alone is an established root cause or that both cases match a precise delay. A multi-period / rolling-window interaction remains suspected; the actual ad sequence and the fresh-acquisition retry defect are firmer evidence.


Capture precision caveat: all observed Four acquisitions produced the same nominal source URL (identity d2f554f8990b). At 22:56 two independent requests redirected to the same final URL identity a049ff69546f, with no Set-Cookie. Source equality and these redirects do NOT prove a separately fetched manifest is byte-identical to each native AVPlay response or shares every server-side personalization decision. Native HTTP payloads are not captured. Treat independent captures as correlated provider metadata, not packet-level proof. An unchanged URL in the recovery test does establish that our code does not call stream acquisition or the client ad scheduler, but does not alone prove every server session characteristic is retained. Physical observation remains required.


## Same-source recovery FAILED on hardware; stop it

Confirmed normal picture/audio after 22:57:21 recovery, but measured ~50 seconds behind Chrome (baseline before recovery unknown). A second automatic native reopen occurred 23:05:00, prepare/play returned ~23:05:05 and clocks advanced. A section was replayed THREE times. This fails the mitigation. Do not treat positive clock/API success or initial sync as proof of correct decoded position. Same-source reopen is not reliable on this TV/source; disable it, do not tune the timer or add seeks. No successful live transition is established. Preserve the actual live subclass fresh-retry=0 fix and lifecycle cancellation/close ownership fixes independently.

1.0.0 source/build prepared but NOT yet installed at this point. It restores live Auto STARTBITRATE=HIGHEST (adaptive, rather than forced720); adds native live-range snapshots and a read-only Auto/actual resolution label in options. It still contained the explicit recovery experiment flag at build time, so REBUILD with VM_LIVE_RESTART OFF before signing/installing. Do not install the experimental .35 widget again. Current TV test needs termination immediately. Dist .35-test.wgt is historical failed-test evidence only.


0.2.36 clean source now REMOVES restartLive/watchLive, watchdog timers, retry-budget logic and VM_LIVE_RESTART build flag entirely, rather than retaining an easy-to-enable failed experiment. Deleted its synthetic success tests; retained hardware failure record. Standalone build test asserts no restartLive remains. Actual live-class fresh-retry=0, native cancellation/close ownership fixes, VOD quality/resume and original AVPlay remain. Live Auto now uses STARTBITRATE=HIGHEST; failed fixed720 policy is no longer default. No seek/catch-up hack was added. Native snapshots report GET_LIVE_DURATION, and the options panel shows read-only live Auto plus actual reported height rather than Not available. Auto/high startup and live latency still need hardware verification.

Possible next native-preserving investigation: in the captured Four two-period MPD, all eight representation keys exist across both periods and their resolved initialization and media-template URLs are identical. That permits testing a stable single-Period manifest without rewriting encrypted media or routing fragments through a Mac. Samsung documents AVPlay accepting absolute local file paths; whether it accepts/refreshes a dynamic local MPD on this TV is NOT established. A standalone local-file manifest adapter is not implemented yet. First validate local MPD consumption/refresh independently, preserve source URL/number/timestamp identities and never infer decoded correctness from API clocks alone. The old proxy/normalization/seek experiments were not proven fixes; do not copy them as successful recipes.


## Final time-boxed handoff

The user requested packaging both apps into a shared repository before subscription expiry. The local Git-ready RTÉ folder was renamed irish-tv-legacy; existing RTÉ public files/identity were preserved under apps/rte-player, and native Virgin Media 0.2.36 is under apps/virgin-media-play. Both portable maintenance builds/tests and public release validation passed. Native live remains unreliable.

The selected-manifest PlayReady diagnostic build 0.2.37 was tried separately. At 23:48:32 the app became hidden during its first MP4 advert. The encrypted live stage was not reached; no selected native init/challenge comparison was captured. Result INCONCLUSIVE, not a DRM fix. The clean 0.2.36 native WGT is being restored. Research code is preserved separately and not included in runtime dependencies.


## Subtitle root-cause fix confirmed — build 1.0.2, 20 November 2026

The user supplied the real `The 1% Club S3E7` MPD plus init/media `stpp` segment. It proved two missing pieces: the caption adaptation is `application/mp4` with `codecs="stpp"` (not a `text/*` MIME type), and TTML `begin`/`end` values are absolute media times that must be corrected by the segment template's `presentationTimeOffset`. Offline parsing of that exact attachment now finds the track, requests segment 30 and renders “Why are you so confident? I do well when I’m at home.”

The first TV candidate (1.0.1) still showed “No subtitles detected”. Code inspection found the bootstrap defect: the panel required a verified cue before it would offer any control, but verification only starts once subtitles are requested. Build 1.0.2 adds a **Check subtitles** control when a parsed DASH text candidate exists, without claiming that captions exist. The user then enabled it in the installed 1.0.2 app on *The 1% Club S3E7*, saw captions, and reopening the panel showed **✓ English**. This is hardware confirmation for VOD subtitles; live remains experimental and no web-browser diagnostics were added.
