"""Export this portable multi-app repository without Git/private/build data."""
from pathlib import Path
import re
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1];out=root/'dist/irish-tv-legacy-source.zip';out.parent.mkdir(exist_ok=True)
excluded={'.git','dist','build','node_modules','.local','.wrangler','__pycache__','.settings','.metadata','.tv-app-previous','.tv-app-next'}
with ZipFile(out.with_suffix('.tmp'),'w',ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  rel=p.relative_to(root)
  if not p.is_file() or any(part in excluded for part in rel.parts) or p.name=='.DS_Store' or rel==Path('AGENTS.md'):continue
  if re.fullmatch(r'(?:author-signature|signature\d*)\.xml',p.name):continue
  if p.suffix.lower() in ['.wgt','.zip','.har','.p12','.pem','.key','.log','.pyc'] or p.name.startswith('.env') or p.name=='.dev.vars':continue
  z.write(p,'irish-tv-legacy/'+rel.as_posix())
out.with_suffix('.tmp').replace(out);print(out)
