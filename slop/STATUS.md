# Handoff — updated 26 November 2026

## TG4+ — current 1.0.0

* Version 1.0.0 is the installed and hardware-verified build. It retains the production catalogue, daily catch-up and native VOD backend, with `TG4+` as the manifest display name.
* Native VOD picture/sound, Irish/English/Off WebVTT subtitles, Return cleanup and resume were verified on the physical TV in the installed 1.0.0 build.
* Live is restricted to the clear TG4 international provider (`6384196213112`) only. The unsupported PlayReady TG4/Cúla4/TG4+1 streams are not exposed. TG4's own API LIVE rail is discarded from **Home** and replaced by one bottom `live-rail` with only that clear Worldwide channel; the frontend creates it lazily when the page is scrolled down. Hardware-verified after scrolling Home: one WW/no-token tile using TG4's `currentShow`/`nextShow`, artwork and times unchanged (for example `An Aimsir Láithreach` then `Cheers`), with no app-added “Worldwide” text anywhere on screen; opening it reached `AVPlay`/`PLAYING` with no DRM setup or events, and `#/live` contains only that stream. It uses the official clear DASH feed, fetched fresh by provider ID. No Mac playback server is required.
* Public build: `window.__tg4LoginHelper={"url":"","key":""}`. A privately signed WGT can carry a user-owned helper for sign-in; the shared Cloudflare Worker serves it at `/tg4` and requires a separate `TG4_SECRET_KEY` in `X-TG4-Helper-Key`. Never publish or commit that helper URL or key.
* Protected Ireland/Cúla4 Live remains unresolved on 1.0.0. The native backend reaches the real PlayReady source, but AVPlay `setDrm('PLAYREADY','SetProperties',...)` fails after `open` with `UnknownError::Unknown Error in AVPlayManager.setDrm().`. The legacy-EME CDM challenge is rejected HTTP 400. Manifest, LA_URL, timeline, initData, setup-order and Widevine experiments did not fix it. Do not claim protected Live as supported.
* WebKit 538.1 UI is packaged and hardware-verified: the four supplied Home rules in `profile-ui.css` are intact, and the play/pause button now uses a changing Vue key plus 60px intrinsic SVGs. On TV, selecting the button creates a fresh focused node; both `pause_icon.svg` and `play_icon.svg` report `60x60`, the element stays `68x68` with `transform:none`, and the rejected whole-overlay `data-scaled` workaround is absent.
* Worldwide may have different programme availability or rights blackouts. Live subtitles remain unverified.

## RTÉ

Release 1.2 (manifest 1.2.0) uses frontend 0.170.54075_2 and the shared Worker, with RTÉ at the Worker root or `/rte` and TG4 at `/tg4`, blank public helper configuration and unchanged app identity. Use your own Worker with separate `SECRET_KEY` and `TG4_SECRET_KEY` values for sign-in. The build includes the Samsung DRM privilege, legacy PlayReady workarounds, readable captions, no-pause Settings with a quality picker, and live-only disabling of DAI/SSAI. A private WGT can carry a configured helper for testing; the public `tv-app` and unsigned release keep it blank.

20 November: a 20-minute RTÉ One live watch passed at 1920×1080 with no DAI/SSAI URLs and no errors. Controlled reloads and forced 6008 tests exposed the legacy PlayReady session limitation; automatic 6008 retry was reverted after it produced `HTTP_ERROR 1002` on live. Clean relaunch remains the reliable recovery. A signed-in session and the login helper were confirmed working on the TV after reinstalling the private WGT. The public release checker passes for RTÉ; the TG4 validation error was fixed and `scripts/package-release.py --app tg4` now passes.

14 November: the user confirmed the square RTÉjr logo after a targeted map-lookup fallback and the regular logo after using the official direct PNG (SVG fallback retained). Public config/label downloads start earlier, but total startup can still take 30–40 seconds. A saved-account Home-mount gate made loading worse and exposed the sidebar before Home loaded; it was removed. Do not reintroduce that failed experiment. The checked build has been promoted into the public prebuilt files and repackaged locally for GitHub; it has not been published. See [RTE-STARTUP.md](RTE-STARTUP.md).

14 November sidebar/watchlist follow-up: Sign in and Settings are anchored at the bottom of the sidebar; actual-app QtWebKit geometry checks passed at 1920×1080 and 1280×720, expanded and collapsed. On the TV, a bounded probe in the normal RTÉ app removed a saved series through both DOM click and Right/OK navigation (DELETE 200), updated the button to Add, and restored the saved series (POST 201). The user then confirmed watchlist, sidebar and Recommended all work in the clean installed app with the physical remote. No watchlist or playback patch was needed. Temporary diagnostics are removed and the receiver is stopped.

## Virgin Media

* Historical baseline: standalone Samsung AVPlay with direct programme/DRM requests. Current 1.2 default is MSE for DASH with AVPlay fallback (see the 24 November note below).
* Confirmed: on-demand picture/sound (The 1% Club), local resume, manual native 252p/1080p quality switching.
* UI: corrected programme icons and full-viewport native options.
* Live Auto requests HIGHEST at startup; hardware verification of this latest policy remains pending. Fixed720p was tested and did not solve live freezes.
* Definite bug fixed: live.js overrode the base zero-retry policy with three fresh acquisitions. Those acquisitions could select fresh pre-roll pods after a native error. The actual built live subclass is now regression-tested with native fresh retries disabled.
* Definite lifecycle bugs fixed: cancelled asynchronous startup could overwrite another source's quality state; a failed stop prevented close; a retired driver could close its replacement.
* Still broken: live multi-period/ad transitions can freeze and raise PLAYER_ERROR_NOT_SUPPORTED_FILE. “Playing” state and advancing clocks do not establish correct decoded frames. Automatic same-source reopens produced repeats and have been removed. A ~50s gap to Chrome was reported; its pre-recovery baseline was unknown.
* Subtitle detection/rendering reworked and confirmed on hardware: the custom combined panel was retained on the AVPlay/native path at that time; an advertised DASH text slot must yield a real cue before a language is offered; text/image AVPlay callbacks are logged and rendered; verified cues are drawn in the app layer and On/Off is remembered. On 20 November, the user enabled **Check subtitles** in test build 1.0.2 on *The 1% Club S3E7*, saw captions, and reopening the panel showed **✓ English**. “No subtitles detected” still means no verified cue yet, not proof that captions are absent.

### 24 November 2026 — version 1.2 source/prebuilt sync

* One public build uses MSE by default for live and VOD DASH when MediaSource supports `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`. MP4 ads and native audio takeover stay on AVPlay, with hidden `vm-live-mse=off` / `vm-vod-mse=off` local-storage fallbacks. PlayReady init data is manifest-first, with WebKit `needkey` bytes only as fallback.
* Audio/subtitles keep the stock TAL picker for MSE including VOD MSE; the custom combined panel is limited to AVPlay/native/VOD. Names come from `track.label` or MPD `<Label>`; no hardcoded IDs, names or AD heuristics. Subtitles use the bottom 36px cue fix.
* Resolution uses a 36px cog and maps `abr.restrictions.minHeight`/`maxHeight`; Return closes the panel. ABR regression checks covered `4200000` → 720p id `6`, `12000000` → 1080p id `5`, and `setBandwidth(0)` restoring measured bandwidth.
* Episodic and seasonal detail pages have **Mark as watched** beside My List. It sends the real `heartBeatStart` with the episode uvid and full-duration `play_head`, and splices the local model only after success. Detail → Return without clicking preserves real titles; a confirmed removal → Return prunes the empty Continue Watching row before Home parsing, so Home does not go blank/spinner.
* Live ad/period transitions remain experimental. Do not reintroduce proactive reload, same-URL reopen, boundary seek, single-Period flattening, client-side SSAI or 15-minute refresh.

## Useful next experiment

Keep the native baseline and working VOD. In a separately flagged comparison in the existing app, audit PSSH box size/system ID/SHA256 at the actual prefixed key-request call. Compare full media-event input with the exact manifest PlayReady box, retaining media-event readiness timing. Earlier logs recorded a 1562-byte input and an empty keymessage, while the manifest PlayReady box was 714 bytes. Duplication/input-format incompatibility is a hypothesis, not a confirmed fix. Record first keymessage length before any licence POST, without logging payloads or tokens. Compare with working RTÉ if necessary. A diagnostic probe is preserved in Virgin Media maintenance/research, but is not enabled in this release. The final TV attempt became hidden during the opening advert before DRM; its hardware result is inconclusive.

A metadata-only single-Period prototype preserved 224 normal source refreshes, but rejected a genuine injected-ad period with different resources. It was **not deployed** and is not included in the release. Do not present simple flattening, clock rebasing, seeks or native reopens as successful fixes.

Private captures remain in the original development workspace and are not safe to publish. `virgin-media-development.md` contains the detailed historical investigation, including superseded experiments; this STATUS file takes precedence for current support claims.
