# Handoff — 13 November 2026

## TG4+ — added 14 November 2026

* Version 0.3.2 retains the production catalogue, daily catch-up and native VOD backend, with `TG4+` as the manifest display name.
* Worldwide Live uses the broadcaster's official clear DASH feed, fetched fresh by provider ID. Moving picture and sound were confirmed on the physical TV in the temporary native control.
* The packaged Live carousel exposes only Worldwide and labels it in the card/player. Ireland tokens are never sent for the Worldwide channel. No Mac playback server is required.
* Native VOD picture/sound, pause/play, Return and resume were verified in the 0.3.1 baseline. Local checks cover 0.3.2 Live integration, cancellation/cleanup and preservation of VOD DRM/resume. The 0.3.2 WGT itself has not been installed/tested on the TV.
* Protected Ireland/Cúla4 Live remains unresolved: browser PlayReady challenges receive HTTP 400 and native setup fails. Those channels and their timeshift variants are excluded from this release.
* Worldwide may have different programme availability or rights blackouts. Subtitles and account-saved Continue remain unverified.

## RTÉ

Release 1.2 (manifest 1.2.0) uses frontend 0.170.54075_2 and the existing Worker, blank public helper configuration and app identity. Use your own Worker and SECRET_KEY for sign-in. The build includes the Samsung DRM privilege, legacy PlayReady workarounds, readable captions, no-pause Settings with a quality picker, and live-only disabling of DAI/SSAI. A private WGT can carry a configured helper for testing; the public `tv-app` and unsigned release keep it blank.

20 November: a 20-minute RTÉ One live watch passed at 1920×1080 with no DAI/SSAI URLs and no errors. Controlled reloads and forced 6008 tests exposed the legacy PlayReady session limitation; automatic 6008 retry was reverted after it produced `HTTP_ERROR 1002` on live. Clean relaunch remains the reliable recovery. A signed-in session and the login helper were confirmed working on the TV after reinstalling the private WGT. The public release checker passes for RTÉ; the repository-wide checker is blocked by an unrelated TG4 validation error.

14 November: the user confirmed the square RTÉjr logo after a targeted map-lookup fallback and the regular logo after using the official direct PNG (SVG fallback retained). Public config/label downloads start earlier, but total startup can still take 30–40 seconds. A saved-account Home-mount gate made loading worse and exposed the sidebar before Home loaded; it was removed. Do not reintroduce that failed experiment. The checked build has been promoted into the public prebuilt files and repackaged locally for GitHub; it has not been published. See [RTE-STARTUP.md](RTE-STARTUP.md).

14 November sidebar/watchlist follow-up: Sign in and Settings are anchored at the bottom of the sidebar; actual-app QtWebKit geometry checks passed at 1920×1080 and 1280×720, expanded and collapsed. On the TV, a bounded probe in the normal RTÉ app removed a saved series through both DOM click and Right/OK navigation (DELETE 200), updated the button to Add, and restored the saved series (POST 201). The user then confirmed watchlist, sidebar and Recommended all work in the clean installed app with the physical remote. No watchlist or playback patch was needed. Temporary diagnostics are removed and the receiver is stopped.

## Virgin Media

* Default: standalone Samsung AVPlay, with direct programme/DRM requests.
* Confirmed: on-demand picture/sound (The 1% Club), local resume, manual native 252p/1080p quality switching.
* UI: corrected programme icons and full-viewport native options.
* Live Auto requests HIGHEST at startup; hardware verification of this latest policy remains pending. Fixed720p was tested and did not solve live freezes.
* Definite bug fixed: live.js overrode the base zero-retry policy with three fresh acquisitions. Those acquisitions could select fresh pre-roll pods after a native error. The actual built live subclass is now regression-tested with native fresh retries disabled.
* Definite lifecycle bugs fixed: cancelled asynchronous startup could overwrite another source's quality state; a failed stop prevented close; a retired driver could close its replacement.
* Still broken: live multi-period/ad transitions can freeze and raise PLAYER_ERROR_NOT_SUPPORTED_FILE. “Playing” state and advancing clocks do not establish correct decoded frames. Automatic same-source reopens produced repeats and have been removed. A ~50s gap to Chrome was reported; its pre-recovery baseline was unknown.
* Subtitle detection/rendering reworked and confirmed on hardware: the combined panel is retained; an advertised DASH text slot must yield a real cue before a language is offered; text/image AVPlay callbacks are logged and rendered; verified cues are drawn in the app layer and On/Off is remembered. On 20 November, the user enabled **Check subtitles** in test build 1.0.2 on *The 1% Club S3E7*, saw captions, and reopening the panel showed **✓ English**. “No subtitles detected” still means no verified cue yet, not proof that captions are absent.

## Useful next experiment

Keep the native baseline and working VOD. In a separately flagged comparison in the existing app, audit PSSH box size/system ID/SHA256 at the actual prefixed key-request call. Compare full media-event input with the exact manifest PlayReady box, retaining media-event readiness timing. Earlier logs recorded a 1562-byte input and an empty keymessage, while the manifest PlayReady box was 714 bytes. Duplication/input-format incompatibility is a hypothesis, not a confirmed fix. Record first keymessage length before any licence POST, without logging payloads or tokens. Compare with working RTÉ if necessary. A diagnostic probe is preserved in Virgin Media maintenance/research, but is not enabled in this release. The final TV attempt became hidden during the opening advert before DRM; its hardware result is inconclusive.

A metadata-only single-Period prototype preserved 224 normal source refreshes, but rejected a genuine injected-ad period with different resources. It was **not deployed** and is not included in the release. Do not present simple flattening, clock rebasing, seeks or native reopens as successful fixes.

Private captures remain in the original development workspace and are not safe to publish. `virgin-media-development.md` contains the detailed historical investigation, including superseded experiments; this STATUS file takes precedence for current support claims.
