# TG4+ for older Samsung TVs

Patched TG4+ for Tizen 2.4, based on version `2.0.0`, tested on a Samsung UE40K5500.

## What works

- **On demand:** Working via native AVPlay. Might take a while to reach 1080p
- **Subtitles:** Irish and English subtitles available on supported programmes.
- **Live:** Working via the "Worldwide" stream. Programme rights may differ from the Ireland feed.

## Limitations

- TG4+1, Cúla4 and Spórt TG4 live streams are not supported.
- Subtitles are not available for live programmes (not supplied by TG4 for any device)
- Sign in not currently implemented

## Install

You’ll need [Tizen Studio](https://download.tizen.org/sdk/Installer/tizen-sdk_10.0/) with `TV Extensions-XX.X` and `Samsung Certificate Extension` from Package Manager, and developer mode enabled on the TV.

1. Download the unsigned WGT from [releases](https://www.github.com/cln-b/irish-tv-tizen/releases).
1. Under File > Import select the release WGT as a Tizen > Tizen Project.
1. Under Tools > Certificate Manager create a Samsung TV profile. The distributor certificate must include your TV’s DUID. Run:

    ```bash
    /path/to/tizen-studio/tools/sdb connect <TV IP address>
    /path/to/tizen-studio/tools/sdb shell 0 getduid
    ABCDEFGH1IJK2 # your DUID
    ```

1. Connect the TV in Device Manager, select it as the target, then right click the project in the sidebar and choose **Run As → Tizen Web Application**.