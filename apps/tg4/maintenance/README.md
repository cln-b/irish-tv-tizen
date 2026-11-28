# Building TG4+

`../tv-app` is the generated app source. Make changes in `maintenance/`, then rebuild:

```sh
npm ci
npm run build
npm test
```

From the repository root, validate the unsigned public package with:

```sh
python3 scripts/package-release.py --app tg4
```


## What this build does

- Live uses TG4's clear international feed, plus its one-hour timeshift. The +1 entry uses the normalised DVR manifest from the configured Cloudflare Worker. When accessing from an Irish IP, the clear feed and +1 timeshift are synthesised from the Ireland EPG metadata. TG4's separate ONDEMAND stream is preserved unchanged. Protected Ireland and Cúla4 IDs are excluded.
- Home replaces TG4's API LIVE rail, matching the Live page. The existing UI creates the rail when Home is scrolled down. Programme titles, artwork and times are passed through from TG4 unchanged, with no added “Worldwide” labels.
- Playback uses AVPlay for on-demand and clear Live. Setting `STARTBITRATE=HIGHEST` through `ADAPTIVE_INFO` while the player is IDLE, so DASH opens at the highest available rendition. On-demand keeps its DRM, resume and WebVTT subtitle support. Return removes the AVPlay object and captions; diagnostics are redacted.
- WebKit 538.1 UI fixes live in `profile-ui.css`. The player chunk recreates the play/pause `<img>` on each toggle and uses 60px intrinsic SVG sizes so the icon keeps its geometry after selection.
- A whole-overlay scaling workaround was tried and removed. It was not the cause of the icon problem.
- Protected Ireland/Cúla4 Live is not supported: AVPlay `setDrm` reports `UnknownError` and the legacy CDM challenge receives `{"error": "retrieving license: 400"}`.

## Checks

Tests cover Live/Home mapping, token isolation, native playback/cleanup, VOD DRM/subtitles, login routing, CSS and the play/pause icon fix. Physical TV checks are still needed for decoder output, captions, account state and long-running Live playback.
