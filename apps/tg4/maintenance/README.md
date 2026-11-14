# Building TG4+

The ready-to-sign app is already built in `../tv-app`. To regenerate it with Node.js 24 or newer:

```sh
npm ci
npm run build
npm test
```

The builder reads frozen public production assets from `upstream/`, applies the established WebKit 538.1 compatibility patches, transpiles JavaScript to ES5, and copies native playback/widget assets from `widget/`. It recreates `../tv-app`; the version comes from `../VERSION`. No developer workspace paths or external build server are required.

`worldwide.js` maps the Live carousel to the official Worldwide provider ID, keeps polling metadata fresh, and never reuses an Ireland token for another channel. Current metadata is fetched by the original application at playback time. The card and player identify Worldwide. Daily catch-up remains the original on-demand listing.

`native-backend.js` uses the verified Samsung AVPlay backend: clear Worldwide playback skips DRM configuration; protected VOD retains its own licence URL and native resume. Return goes through the app's existing cleanup. The isolated browser/Shaka DRM experiments, HARs, debug scripts and private captures are excluded.

Tests cover channel/credential routing, clear-native startup and cancellation, Return cleanup, and preservation of VOD DRM/resume. They use a simulated native API; physical decoder, captions, account state and long-running live playback require TV checks. The underlying Worldwide stream has physical picture/sound confirmation, but the packaged 0.3.2 UI integration has not been installed/tested on the TV.

From the repository root, package with `python3 scripts/package-release.py --app tg4`. Public releases are unsigned; each recipient signs with their own Samsung TV profile.
