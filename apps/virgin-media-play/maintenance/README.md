# Virgin Media maintenance

The prebuilt app is in `../tv-app`. These build tools reproduce its native-player patches from the frozen, already ES5-transpiled SimpleStream snapshot in `upstream/hbbtv`. The original snapshot is app 1.172.0 / core 1.16.0. Bundled vendor dependencies are in `upstream/vendor`.

With Node.js 24+:

```sh
npm ci
npm run build
npm test
```

Output: `build/tv`. Public builds always disable LAN diagnostics, the Mac timing proxy and forced-720p experiments. Client-side and Server-side ad insertion is bypassed for both VOD and live stream requests as the TV struggles with ad transitions, and the SSAI-less manifests already carry ad breaks. "Live DASH restarts" for manual quality join the *current edge* rather than seeking to the stale pre-restart playhead.

The app uses MSE by default for live and VOD DASH where `MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')` succeeds. MP4 ads and native audio takeover remain on AVPlay, which is also the capability fallback. Hidden `vm-live-mse=off` / `vm-vod-mse=off` local-storage values restore the old DASH route for diagnosis. PlayReady init data is manifest-first with WebKit `needkey` bytes as fallback.

To promote a checked build, run from the repository root:

```sh
python3 scripts/update-prebuilt.py virgin-media-play
python3 scripts/package-release.py --app virgin-media-play
```

`update-prebuilt.py` copies `maintenance/build/tv` into `../tv-app` and keeps the previous copy in `.tv-app-previous`. Do not consider a change promoted until `tv-app` matches the generated `build/tv` (ignoring `.DS_Store` and `.buildResult`). The generated `build/` directory, `.tv-app-previous/`, `dist/` and `__pycache__/` are local artifacts and are not retained in the clean tree; `npm run build` regenerates `build/tv` when needed. `../VERSION` is currently `1.2`; the builder reads it when generating `config.xml` and produces manifest version `1.2.0`. After updating upstream code, recheck signing, pairing, VOD, Return, resume, quality changes and actual picture/sound across ads. Syntax checks and advancing native clocks do not establish reliable playback.

Current 1.2 source includes the MSE default, manifest-first PlayReady, stock TAL pickers for MSE with the custom combined panel only for AVPlay/native/VOD, bottom 36px subtitles, the ABR-backed resolution panel, episodic/seasonal **Mark as watched** with real heartbeat removal, the `originalTitle` retention fix, targeted empty-Continue-Watching pruning before Home parsing, and the user-approved inactive wrapping-footer rule. Diffing against `irish-tv-tizen unmodified` removed the speculative wrapping opacity override, the speculative loader-completion helper and the extra first-section guard; the root-cause fixes were retained.

Live multi-period/ad streaming remains unresolved. Subtitle detection/rendering verifies DASH caption cues before advertising a language, handles text and image AVPlay callbacks, renders verified cues itself and persists On/Off. `The 1% Club S3 E7` MPD and `stpp` segment pass offline, and the same programme was confirmed on the TV in build 1.0.2: **Check subtitles** rendered captions and reopening the panel showed **✓ English**. Do not restore automatic native reopens or fresh-stream retries: hardware tests showed repeated content and extra pre-roll pods. Detailed private captures/HARs/certificates are deliberately excluded. See [STATUS.md](../../../slop/STATUS.md) and [virgin-media-development.md](../../../slop/virgin-media-development.md) for the full history.
