# Virgin Media Play for older Samsung TVs

Release **1.0**, for Tizen 2.4. The app uses SimpleStream's television UI and Samsung AVPlay. The complete prebuilt project is in `tv-app`, including `config.xml` and its icon.

## Install

1. Download the unsigned Virgin Media WGT from the shared repository's release assets.
2. In Tizen Studio, import it using the packaged Tizen web application option.
3. Create/select your Samsung TV certificate profile. Its distributor certificate must include your TV's DUID.
4. Choose **Build Signed Package**, connect the TV in Device Manager, then **Run As → Tizen Web Application**.
5. Follow Virgin Media Play's pairing instructions on screen using your own account.

A Mac playback server, private proxy configuration and RTÉ's login Worker are not required. This release contains no LAN diagnostic receiver or automatic player-reopen experiment. App ID: `VmPlay2016.Player`.

## Playback status

On-demand playback was confirmed with smooth picture/sound. Local continue/resume and native 252p/1080p manual quality switching were verified. Player options scale to a 1080p viewport. Live **Auto** now requests the highest initial rendition while allowing adaptation; the new live startup policy has not yet been confirmed on the TV.

**Live streaming is experimental.** Channels can stall during broadcast/ad transitions and return `PLAYER_ERROR_NOT_SUPPORTED_FILE`. The live subclass's fresh-stream retries were disabled because they selected additional pre-roll pods after a failure. A same-URL automatic-reopen experiment also replayed content and has been removed. This is not a reliable-live release.

**Subtitles remain unresolved**. The options panel's “No subtitles detected” message is not proof that the programme has no captions. The native callback path does not yet handle every caption type. The live picture-quality value is read-only; manual choices currently apply to on-demand.

The broadcaster UI snapshot is SimpleStream app **1.172.0**, core **1.16.0**. APIs and DRM services can change independently. See [maintenance](maintenance/README.md) and the [shared status notes](../../docs/STATUS.md).
