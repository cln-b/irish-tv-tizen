# Startup investigation — 14 November 2026

The reported delay was about 15 seconds at launch, then another 15 seconds after sign-in. The user later measured about 10 seconds for the first logo/spinner cycle and 30 seconds until fully loaded. A bounded TV report confirms repeated catalogue work around sign-in. Overall startup speed is unresolved.

## What was checked

The current public `skyqsoip/config.json` contains an `override_channels_logo` entry for RTÉjr. The existing frontend parses it, requests `rtejr_new_ctv_square_logo.svg`, and displays the new artwork in Home and the Live guide in PhantomJS/QtWebKit 538.1. The override is not a map of every channel's artwork.

The physical TV behaved differently. Its download returned HTTP 200 with the new override. The parsed Kotlin map's iteration/string representation contained `rtejr=OverrideChannelLogo(enable=true, pathImage=rtejr_new_ctv_{format}_logo, ...)`, but `map.w1("rtejr")` returned null. The lookup input was `RTEJr`. The tile consequently requested the old `rtejr_square_logo.svg`. This is a parsed-map lookup failure, not a missing download or simply a cached image. The underlying collection/runtime fault has not been established.

The builder now gives the existing logo-override selector an entry-iteration fallback when its key lookup misses. It still checks the configured enable flag and image path, uses the configured background/padding, and handles arbitrary channel keys. It does not replace collection handling elsewhere. The regression test runs the actual Kotlin map and built selector, reproducing a missing lookup with surviving entries.

The user confirmed that the square logo changed after this fix, but the regular logo in the Home live component was blank. The official regular SVG uses a pattern containing a base64 PNG. QtWebKit 538.1 reproduced the blank image at the correct 146×42 layout bounds. The official direct PNG is 146×42 and renders correctly with the same CSS. The regular-logo component now prefers the corresponding PNG URL and falls back once to its original SVG on an image error. Square artwork is unchanged. No broadcaster artwork is bundled or hardcoded per channel.

The local startup trace showed several stages: executing the packaged bundles, fetching configuration and labels, checking country/account state, loading SDKs, fetching Discover, and then fetching the catalogue feeds and images. A slow launch does not mean all this time is spent downloading the configuration.

Two suspected CPU costs were checked before changing them. The instrumented aggregate state hash/equality methods were not called during that local run. Formatting action log messages took about 0.3 seconds in another run. Neither result explains a 15-second delay, so those paths were left alone.

## Candidate change

`widget/startup.js` starts the two public config/English-label GETs while WebKit is still parsing the application. Each successful response is handed to its first ordinary caller, without changing its contents. Later requests use the normal transport. Failed early fetches fall back to the ordinary request.

Only these two exact URLs are eligible. Credentialed requests, custom headers, explicit cancellation and custom request modes bypass this handoff. Login, tokens, country checks, catalogue feeds, adverts, licences and media requests are not cached by it.

In the local trace the config request started at about 1.2 seconds, compared with 8.4–9.7 seconds in the earlier runs. Total Home timings varied with network and rendering work; those runs do not establish an overall speed-up or a TV startup time.

On the TV, config/labels started around 0.9–1.1 seconds and completed around 4.4–4.5 seconds. Login returned HTTP 200 around 15 seconds. Discover and its feeds were then requested a second time as sign-in completed. Scheduled 15/30/50-second callbacks ran late, also showing event-loop pressure. These are observations from an instrumented run, not isolated network or decode timings.

The root configuration gate can unmount/rebuild Layout when account readiness changes. Layout starts the normal association request, while its Home child starts the anonymous catalogue before that request finishes. An attempted saved-account Home-mount gate passed local tests, but the user measured 35 seconds on the TV and saw the sidebar before Home had loaded. That was a regression from the preceding build's loading presentation, so the gate, storage inspection and its test were removed. Do not restore this experiment as a speed fix. Home rendering and the ordinary account flow are retained. No token/account/catalogue response cache was added.

## Verification and deployment

- The builder checks ES5 syntax. `npm test` checks the Worker and startup handoff, including unchanged config/logo data, fresh later requests and failure fallback.
- A separate bounded check used the real packaged Request/Headers/Response polyfill on QtWebKit 538.1. Home and the Live guide loaded in that environment.
- The TV inspector answered one runtime probe but repeatedly failed to answer `Network.enable`. No useful TV startup timing trace was obtained. The debug session was closed and the app relaunched normally.
- The TV update retained the existing `RteOldVst1.Player` identity, helper configuration, artwork and saved storage. Changes are the startup script/link, targeted patches in the main app bundle, and helpers in `compat.js`.
- The user confirmed both the square-logo lookup fallback and the regular PNG fix. The saved-account Home gate regressed loading and was removed. The clean rollback retaining the confirmed artwork changes was installed and reopened normally.
- The temporary reports excluded account data and tokens. The bounded LAN receiver stopped. The diagnostic WGT was replaced with the clean startup/logo candidate and that app was opened normally; diagnostics are absent from the installed candidate. The probe is not a release artifact.
- The checked maintenance build has been copied into the public `tv-app`, with empty helper settings and the current banner retained in both the prebuilt app and maintenance inputs. The source and unsigned release files have been regenerated locally. No commit, push or publication was made.

No playback engine, DRM, ad handoff, navigation, account relay or sign-in response caching was changed.

## 20 November CDP follow-up

A bounded CDP reload on the physical TV measured `load` at 6.7–8.1 s, `DOMContentLoaded` at 4.7–7.7 s and `domInteractive` at 2.1–6.0 s. The slowest individual requests were the IMA SDK scripts (3.9–4.3 s), the 2 MB `_app` chunk (3.9–4.3 s), the early config/label GETs (3.5–3.7 s), the index chunk (2.4 s) and the stylesheet (2.0 s). The OneTrust banner request took about 5 s and started around 15 s. On the live route the MPD was not requested until about 19 s after the reload, before segment and licence requests.

Temporary instrumentation also showed a long wave of thePlatform catalogue feeds during Home, with a second wave after sign-in completed. This is consistent with the user-visible 30–40 s delay: this TV spends several seconds parsing the large upstream ES5 bundles and then waits on external SDK, consent, account and catalogue requests. It is not explained by the DRM privilege, caption CSS, Settings patch or live DAI guard. Repeated CDP reloads also triggered the known legacy PlayReady 6008 failure, so those reload timings are boot measurements only, not a recommended playback test.
