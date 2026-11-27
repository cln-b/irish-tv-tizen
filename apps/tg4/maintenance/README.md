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

- Live is limited to TG4's clear international feed, provider `6384196213112`. Protected Ireland, Cúla4 and TG4+1 streams are excluded on this TV.
- Home replaces TG4's API LIVE rail with one bottom LIVE rail for that feed. The existing UI creates the rail when Home is scrolled down. Programme titles, artwork and times are passed through from TG4 unchanged, with no added “Worldwide” labels.
- Playback uses AVPlay for on-demand and clear Live. On-demand keeps its DRM, resume and WebVTT subtitle support. Return removes the AVPlay object and captions; diagnostics are redacted.
- WebKit 538.1 UI fixes live in `profile-ui.css`. The player chunk recreates the play/pause `<img>` on each toggle and uses 60px intrinsic SVG sizes to avoid the icon repaint bug.
- A whole-overlay scaling workaround was tried and removed. It was not the cause of the icon problem.
- Protected Ireland/Cúla4 Live is not supported on this TV: AVPlay `setDrm` fails and the legacy CDM challenge is rejected. No hardcoded licence URLs, manifest rewrites or private credentials are included.

## Checks

Tests cover Live/Home mapping, token isolation, native playback/cleanup, VOD DRM/subtitles, login routing, CSS and the play/pause icon fix. Physical TV checks are still needed for decoder output, captions, account state and long-running Live playback.
