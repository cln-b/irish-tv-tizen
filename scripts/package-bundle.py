"""Create a dashboard/Studio-ready download for all apps, without build tools."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import subprocess,sys,hashlib
root=Path(__file__).resolve().parents[1];subprocess.run([sys.executable,str(root/'scripts/check-release.py')],check=True)
out=root/'dist'/('irish-tv-legacy-'+(root/'VERSION').read_text().strip()+'-ready-to-sign.zip')
with ZipFile(out.with_suffix('.tmp'),'w',ZIP_DEFLATED) as z:
 z.writestr('irish-tv-legacy/README.md','# Ready-to-sign Irish TV apps\n\nImport the unsigned WGTs in releases/ into Tizen Studio and sign using your own Samsung TV certificate/DUID. Configure the RTÉ login Worker first using apps/rte-player/README.md. Virgin Media uses its own pairing flow and needs no Worker/Mac playback server. TG4+ includes native VOD and a clearly labelled Worldwide Live feed, with no Mac server. Editable prebuilt files and config.xml are in each app’s tv-app directory.\n\nTG4 Ireland/Cúla4 DRM and Virgin Media live ad transitions/subtitles remain unresolved; see docs/STATUS.md. The full source/maintenance tree is in the separate source ZIP.\n')
 for p in [root/'RELEASING.md',root/'docs/STATUS.md',root/'dist/SHA256SUMS']:
  z.write(p,'irish-tv-legacy/'+('releases/'+p.name if p.parent.name=='dist' else p.relative_to(root).as_posix()))
 for app in ['rte-player','virgin-media-play','tg4']:
  base=root/'apps'/app
  for name in ['README.md','VERSION']:z.write(base/name,'irish-tv-legacy/apps/'+app+'/'+name)
  for folder in ['tv-app','worker']:
   if not (base/folder).exists():continue
   for p in sorted((base/folder).rglob('*')):
    if p.is_file() and not any(x.startswith('.') for x in p.relative_to(base).parts):z.write(p,'irish-tv-legacy/'+p.relative_to(root).as_posix())
 for p in sorted((root/'dist').glob('*-unsigned.wgt')):z.write(p,'irish-tv-legacy/releases/'+p.name)
out.with_suffix('.tmp').replace(out)
print(out)
