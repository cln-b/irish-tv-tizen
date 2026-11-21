# Virgin Media maintenance

The prebuilt app is in `../tv-app`. These build tools reproduce its native-player patches from the frozen, already ES5-transpiled SimpleStream snapshot in `upstream/hbbtv`. The original snapshot is app 1.172.0 / core 1.16.0. Bundled vendor dependencies are in `upstream/vendor`.

With Node.js 24+:

```sh
npm ci
npm run build
npm test
```

Output: `build/tv`. Public builds always disable LAN diagnostics, the Mac timing proxy and forced-720p experiments. VOD playback bypasses client-side ad insertion because the programme MPDs already carry their ad breaks; live ad handling is unchanged. They do not depend on another checkout, a developer's filesystem or a sibling project's node_modules. The frozen legacy Shaka module is included for the existing fallback; AVPlay remains the default.

To promote a checked build, run from the repository root:

```sh
python3 scripts/update-prebuilt.py virgin-media-play
python3 scripts/package-release.py --app virgin-media-play
```

Update `../VERSION` for a release. The builder reads it when generating config.xml. After updating upstream code, recheck signing, pairing, VOD, Return, resume, quality changes and actual picture/sound across ads. Syntax checks and advancing native clocks do not establish reliable playback.

Live multi-period/ad streaming remains unresolved. Subtitle detection/rendering now verifies DASH caption cues before advertising a language, handles text and image AVPlay callbacks, renders verified cues itself and persists On/Off. `The 1% Club S3 E7` MPD and `stpp` segment pass offline, and the same programme was confirmed on the TV in build 1.0.2: **Check subtitles** rendered captions and reopening the panel showed **✓ English**. Do not restore automatic native reopens or fresh-stream retries: hardware tests showed repeated content and extra pre-roll pods. Detailed private captures/HARs/certificates are deliberately excluded. See [STATUS.md](../../../slop/STATUS.md) and the investigation notes for follow-up.
