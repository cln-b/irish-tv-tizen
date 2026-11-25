# Virgin Media Play for older Samsung TVs

Patched Virgin Media Play for Tizen 2.4, using SimpleStream's whitelabel UI, tested on a Samsung UE40K5500.

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

## Playback status

- **Live and on demand working** via Shaka/MSE by default.
  - AVPlay remains as fallback, and is not capable of playing live channels correctly. 
  - Two hidden local-storage diagnostics can restore AVPlay for DASH: `vm-live-mse=off` and `vm-vod-mse=off`. 

- **Audio description and subtitles working**. It may take up to 10 seconds for the selection to apply.

## Additional features

- **Mark as watched** lets you remove unwanted episodes, from the Continue Watching rail.

- The player overlay features a manual **resolution selector** menu, which also lists current video statistics.

## Release state

The broadcaster UI snapshot is SimpleStream app **1.172.0**, core **1.16.0**. APIs and DRM services can change independently. See [maintenance](maintenance/README.md) and the [shared status notes](../../slop/STATUS.md).
