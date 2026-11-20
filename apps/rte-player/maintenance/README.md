# Building and updating

The app in `../tv-app` is already built. These tools are for changing the patches or updating the RTÉ frontend, currently **0.170.54075_2**.

## Build

With Node.js 24 or newer and Python 3 installed, run these from this directory.

```sh
npm ci
RTE_PUBLIC_BUILD=1 npm run build -- vestel
npm test
```

The output goes into `build/vestel`, with empty helper settings. The current frontend files are included in `upstream/vestel`.

`tools/build.mjs` transpiles the JavaScript to ES5 and applies the upstream code patches. The files in `widget` handle routing, layout, polyfills and older Tizen playback behaviour. Generated JavaScript has JSHint skip comments because Studio’s checker stalls on the large bundles.

## PlayReady on Tizen 2.4

The legacy WebKit EME path only produces a licence challenge when the widget
declares Samsung's DRM privilege:

```xml
<tizen:privilege name="http://developer.samsung.com/privilege/drmplay"/>
```

Without it `webkitGenerateKeyRequest` succeeds but the `webkitkeymessage`
event has empty `message` and `initData`, so Shaka posts a zero-length licence
body and playback stops with media error 3. The privilege is added to the
vestel `config.xml` by `tools/build.mjs`. The licence request itself is left
alone: Shaka reads the challenge and headers straight from the CDM's
`PlayReadyKeyMessage`.

## Update the RTÉ frontend

Capture https://www.rte.ie/rpng-static/ctv/vestel in a browser and export a HAR with response content. Include the public translation dictionary. Keep the HAR outside Git; it may contain account data.

Stage it in a fresh directory and try building it.

```sh
python3 tools/assets.py /path/to/capture.har vestel --output upstream/vestel-next
RTE_PUBLIC_BUILD=1 RTE_UPSTREAM_DIR=upstream/vestel-next npm run build -- vestel
```

The staging script copies public static assets from the capture and fetches missing chunks from that build’s manifest.

Some patches match exact snippets of minified JavaScript. If a match fails, check what changed upstream and adjust `tools/build.mjs`. Transpilation handles newer syntax, but player and application changes can need new patches.

Test on the TV before replacing the current build. Check sign-in, menus, Return, live channels, box sets, seeking, progress bars and playback after ads. ES5 syntax checks won’t catch native DRM or decoder problems.

Once it works, replace `upstream/vestel` with the new snapshot and copy `build/vestel` into the repository’s `../tv-app` directory. Keep the public helper URL and key empty. Update `VERSION` and `tv-app/config.xml` for the next release.

## Package a release

Run this from the repository root.

```sh
python3 scripts/package-release.py --app rte-player
```

It packages the prebuilt files in `../tv-app`, checks for empty helper settings, and writes an unsigned WGT to the ignored `dist` directory. Attach that file to the GitHub Release for the matching commit/tag.

## What still needs testing

The bundled frontend won’t update itself. RTÉ’s live services and external SDKs can change independently, so future fixes may involve more than rebuilding the JavaScript.

The automated login tests use fake session data. We still need to check that a real signed-in session renews after 24 hours on the TV.

The prebuilt app includes the tested channel-logo fixes and early config/label downloads. Startup remains slow. The failed saved-account Home gate was removed. See [RTE-STARTUP.md](/slop/RTE-STARTUP.md) for the investigation and test results.
