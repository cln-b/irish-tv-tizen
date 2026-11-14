# Unreleased research — not enabled in the TV app

`eme-probe.js` audits PSSH box sizes/system IDs/SHA256 at the actual native prefixed key-request call. It can select the unique original manifest PlayReady box after media readiness, or retain the full event as a baseline. It blocks empty keymessages before licence POST. It depends on the original CryptoJS bundle already under upstream/hbbtv/core/1.16.0/crypto-js. No payloads/tokens should be logged.

`extract-rte-player.mjs` contains the frozen 4.3.5-rte extraction and optional probe hooks, adapted to this multi-app repository. It reads the bundled RTÉ tv-app chunk and uses maintenance’s acorn dependency. It is not wired into the release builder.

The final TV probe on 13 November became hidden during its opening MP4 advert before reaching encrypted live playback. No selected-PSSH native call/challenge was captured; the hardware comparison is INCONCLUSIVE. Do not claim this fixes DRM or ship it as a replacement player. Offline container selection/SHA256 tests passed in the development workspace.

`local-manifest.js` is a metadata-only continuous-period prototype. It preserved 224 ordinary captured refreshes but rejected a real injected-ad period with different resources. No filesystem/local-MPD refresher was implemented and no TV trial was made. Do not deploy it as a live-stream fix. Private captures are intentionally excluded.
