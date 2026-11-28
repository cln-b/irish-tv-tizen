# Irish TV apps for old Samsung TVs

Patched Tizen 2.4 apps for **RTÉ Player**, **Virgin Media Play** and **TG4+**, tested on a Samsung UE40K5500.

<div align="center">
   <img width="640" height="360" src="./screenshot.png" alt="App screenshots">
</div>

| App | VOD | Live | Sign&#8209;in | Subtitles | Notes | Setup |
| --- | --- | --- | --- | --- | --- | --- |
| <img src="/apps/rte-player/tv-app/rte-banner.png" alt="RTÉ Player" width="90"/> | ✅ | ✅ | ✅* | ✅ | Very slow to load, occasional restart required | [README](apps/rte-player/README.md) |
| <img src="/apps/virgin-media-play/tv-app/icon.png" alt="Virgin Media Play" width="90"/> | ✅ | ✅ | ✅ | ✅ | | [README](apps/virgin-media-play/README.md) |
| <img src="/apps/tg4/tv-app/icon.png" alt="TG4+" width="90"/> | ✅ | ⚠️ | ✅* | ✅ | Sports blocked/Cúla4 unavailable  | [README](apps/tg4/README.md) |

Download the **unsigned WGTs** from [releases](https://github.com/cln-b/irish-tv-tizen/releases), then import and sign them in Tizen Studio using a Samsung distributor certificate containing your TV's DUID.

## Repository layout

```
apps/
  rte-player/
    tv-app/              # ready-to-sign app, including config.xml
    maintenance/         # build inputs, tools and tests
    README.md
  virgin-media-play/
    tv-app/              # ready-to-sign app, including config.xml
    maintenance/         # frozen frontend, native patches, tools and tests
    README.md
  tg4/
    tv-app/              # TG4+ catalogue, native VOD and Worldwide Live
    maintenance/         # frozen frontend, compatibility patches and tests
    README.md
    worker/              # RTÉ/TG4 login helper
scripts/package-release.py
slop/                    # current limitations and investigation handoff
```

This repository includes third-party broadcaster/player frontend code needed by the packaged apps; their original notices and ownership remain applicable. The patches do not bypass DRM or regional restrictions.

## AI disclaimer
I do not claim to have personally achieved anything here. Could someone more knowledgable than me do this faster and better without using AI? 100%. I just wanted to get the players working on my parents' old TV.