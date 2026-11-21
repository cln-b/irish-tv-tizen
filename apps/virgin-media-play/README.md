# Virgin Media Play for older Samsung TVs

Patched Virgin Media Play for Tizen 2.4, using SimpleStream's whitelabel UI and Samsung AVPlay, tested on a Samsung UE40K5500.

## Install

You’ll need [Tizen Studio](https://download.tizen.org/sdk/Installer/tizen-sdk_10.0/) with `TV Extensions-XX.X` and `Samsung Certificate Extension` from Package Manager, and developer mode enabled on the TV.

1. Download the unsigned WGT from [releases](https://www.github.com/cln-b/irish-tv-tizen/releases).
1. Under File > Import select the release WGT as a Tizen > Tizen Project.
1. Under Tools > Certificate Manager create a Samsung TV profile. The distributor certificate must include your TV’s DUID.
: run
    ```bash
    /path/to/tizen-studio/tools/sdb connect <TV IP address>
    /path/to/tizen-studio/tools/sdb shell 0 getduid
    ABCDEFGH1IJK2 # your DUID
    ```
1. Connect the TV in Device Manager, select it as the target, then right click the project in the sidebar and choose **Run As → Tizen Web Application**.

## Playback status

On-demand playback features a manual resolution selector, and attempts to play the highest quality stream before falling back to lower resolutions. (Two features the official app doesn't have!)

**Live streaming is experimental.** Channels can stall during broadcast/ad transitions and return `PLAYER_ERROR_NOT_SUPPORTED_FILE`. The live subclass's fresh-stream retries were disabled because they selected additional pre-roll pods after a failure. A same-URL automatic-reopen experiment also replayed content and has been removed. This is not a reliable-live release. Resolution selector is read-only; manual choices currently apply to on-demand.

**Subtitles working**. A caption segment must contain a real cue before the options panel offers a language. Text and image AVPlay callbacks are logged and rendered, verified cues are drawn by the app, and On/Off is remembered. “No subtitles detected” means no verified cue yet, not proof that a programme has none.

The broadcaster UI snapshot is SimpleStream app **1.172.0**, core **1.16.0**. APIs and DRM services can change independently. See [maintenance](maintenance/README.md) and the [shared status notes](../../slop/STATUS.md).
