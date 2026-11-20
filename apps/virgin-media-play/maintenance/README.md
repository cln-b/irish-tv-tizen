# Virgin Media maintenance

The prebuilt app is in `../tv-app`. These build tools reproduce its native-player patches from the frozen, already ES5-transpiled SimpleStream snapshot in `upstream/hbbtv`. The original snapshot is app 1.172.0 / core 1.16.0. Bundled vendor dependencies are in `upstream/vendor`.

With Node.js 24+:

```sh
npm ci
npm run build
npm test
```

Output: `build/tv`. Public builds always disable LAN diagnostics, the Mac timing proxy and forced-720p experiments. They do not depend on another checkout, a developer's filesystem or a sibling project's node_modules. The frozen legacy Shaka module is included for the existing fallback; AVPlay remains the default.

To promote a checked build, run from the repository root:

```sh
python3 scripts/update-prebuilt.py virgin-media-play
python3 scripts/package-release.py --app virgin-media-play
```

Update `../VERSION` for a release. The builder reads it when generating config.xml. After updating upstream code, recheck signing, pairing, VOD, Return, resume, quality changes and actual picture/sound across ads. Syntax checks and advancing native clocks do not establish reliable playback.

Live multi-period/ad streaming and subtitles are unresolved. Do not restore automatic native reopens or fresh-stream retries: hardware tests showed repeated content and extra pre-roll pods. Detailed private captures/HARs/certificates are deliberately excluded. See [STATUS.md](../../../slop/STATUS.md) and the investigation notes for follow-up.
