# Package and publish

From the repository root, with Python 3:

```sh
python3 scripts/package-release.py              # all three apps
python3 scripts/package-release.py --app rte-player
python3 scripts/package-release.py --app virgin-media-play
python3 scripts/package-release.py --app tg4
```

The packager validates VERSION/config.xml in each `tv-app`, rejects signatures and configured secrets, and writes unsigned WGTs and SHA256SUMS.

The optional source archive is generated with:

```sh
python3 scripts/package-source.py
python3 scripts/package-bundle.py  # optional Studio-ready bundle
```
