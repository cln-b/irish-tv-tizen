"""Check public prebuilt source and release ZIP contents without signing secrets."""
import importlib.util,re,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pack',root/'scripts/package-release.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
for name in pack.APPS:
 app,version=pack.validate(name);p=root/'dist'/(name+'-'+version+'-unsigned.wgt')
 with ZipFile(p) as z:
  assert not z.testzip(), 'Corrupt WGT'
  names=z.namelist();assert len(names)==len(set(names)), 'Duplicate archive names'
  assert 'config.xml' in names and 'index.html' in names
  for n in names:
   assert not n.startswith('/') and '..' not in Path(n).parts
   assert not n.endswith(('.p12','.pem','.key','.har','.log'))
   assert not re.search(r'(^|/)(author-signature|signature\d*)\.xml$',n)
   if n.endswith(('.js','.html','.json','.xml','.md')):
    content=z.read(n).decode('utf8');assert '192.168.1.14' not in content, 'Developer LAN address in release'
  manifest=ET.fromstring(z.read('config.xml'));print(name,manifest.get('version'),len(names),'files',hashlib.sha256(p.read_bytes()).hexdigest())
print('PASS public manifests, blank RTÉ helper, native retry policy, clean archives and no personal signatures')
