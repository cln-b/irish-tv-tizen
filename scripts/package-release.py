"""Package reviewed prebuilt apps as unsigned public WGT assets."""
import argparse,hashlib,json,re
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
APPS=('rte-player','virgin-media-play','tg4')
def validate(name):
 app=ROOT/'apps'/name;version=(app/'VERSION').read_text().strip();manifest=ET.parse(app/'tv-app/config.xml').getroot()
 expected=version+'.0' if version.count('.')==1 else version
 if manifest.get('version')!=expected:raise ValueError(name+': VERSION/config.xml mismatch')
 for tag in ['content','icon']:
  element=manifest.find('{http://www.w3.org/ns/widgets}'+tag)
  if element is None or not (app/'tv-app'/element.get('src','')).is_file():raise ValueError(name+': missing '+tag)
 if name=='rte-player':
  if (app/'tv-app/login-helper-config.js').read_text().strip()!='window.__rteLoginHelper={"url":"","key":""};':raise ValueError('RTÉ helper settings must be blank in public releases')
  worker=(ROOT/'worker/index.mjs').read_text()
  for token in ("'/rte'", "'/tg4'", 'https://www.rte.ie', 'https://sso.tg4.ie', 'https://user.tg4.ie', 'SECRET_KEY', 'TG4_SECRET_KEY', 'X-RTE-Helper-Key', 'X-TG4-Helper-Key'):
   if token not in worker:raise ValueError('Shared login Worker routes, endpoints or helper keys are missing')
  if 'workers.dev' in worker:raise ValueError('Login Worker must not contain a deployed host')
 if name=='virgin-media-play':
  html=(app/'tv-app/whitelabel/app/release/1.172.0/default-webkit-default.html').read_text()
  if 'window.vmTimingProxy=null' not in html or 'window.vmDiagnosticsEnabled=false' not in html:raise ValueError('Virgin Media public build must have proxy/diagnostics disabled')
  native=(app/'tv-app/avplay.js').read_text()
  if 'restartLive' in native or 'watchLive' in native:raise ValueError('Failed automatic live-reopen experiment must not be released')
  if not re.search(r'MAX_RECOVERY_ATTEMPTS=window\.vmAvPlay.*?\?0:3',(app/'tv-app/whitelabel/app/release/1.172.0/static/script/appui/components/player/live.js').read_text()):raise ValueError('Native live fresh-retry protection is missing')
 if name=='tg4':
  if manifest.find('{http://www.w3.org/ns/widgets}name').text!='TG4+':raise ValueError('TG4 display name must be TG4+')
  app_js=(app/'tv-app/app.js').read_text()
  html=(app/'tv-app/index.html').read_text()
  worldwide_js=(app/'tv-app/worldwide.js').read_text()
  if '/epg/current' not in app_js:raise ValueError('TG4 default SmartTV EPG request is missing')
  if 'tg4Worldwide.epg' not in app_js or 'tg4Worldwide.homeRails' not in app_js:raise ValueError('TG4 Worldwide-only Live/Home rail is missing')
  if '_tg4Visible' in app_js:raise ValueError('RailsContainer render patch must not be released; Home rail is lazy')
  if '6384196213112' not in worldwide_js:raise ValueError('TG4 Worldwide identity is missing')
  if 'result.streams = mapped.streams' not in worldwide_js:raise ValueError('TG4 clear Live mapping is missing')
  if 'delete channel.liveToken' not in worldwide_js or 'matches(item, worldwideId, 3600)' not in worldwide_js:raise ValueError('TG4 +1 timeshift or Ireland token isolation is missing')
  if "rail.type === 'LIVE'" not in worldwide_js:raise ValueError('TG4 Home LIVE rail must replace the API Ireland LIVE rail')
  if (app/'tv-app/login-helper-config.js').read_text().strip()!='window.__tg4LoginHelper={"url":"","key":""};':raise ValueError('TG4 public login helper URL and key must be blank')
  if 'X-TG4-Helper-Key' not in (app/'tv-app/login-proxy.js').read_text():raise ValueError('TG4 helper key header injection is missing')
  worker=(ROOT/'worker/index.mjs').read_text()
  for token in ('TG4_SECRET_KEY','X-TG4-Helper-Key'):
   if token not in worker:raise ValueError('TG4 Worker helper key support is missing')
  if 'src="login-helper-config.js"' not in html:raise ValueError('TG4 generated app must load the helper config')
  player=next((app/'tv-app/js').glob('627-*.js'),None)
  if player is None or 'key:n.playbackPaused?"play":"pause"' not in player.read_text():raise ValueError('TG4 play/pause WebKit SVG icon replacement is missing')
  native=(app/'tv-app/native-backend.js').read_text()
  if "setStreamingProperty('ADAPTIVE_INFO','STARTBITRATE=HIGHEST')" not in native:raise ValueError('TG4 AVPlay highest-rendition startup is missing')
  if "'/dvr?u='" not in native or 'offsetRequested' not in native:raise ValueError('TG4 clear +1 normalized DVR seek is missing')
  worker=(ROOT/'worker/index.mjs').read_text()
  if "'/dvr'" not in worker or 'playlist-dash-dvr.mpd' not in worker:raise ValueError('TG4 normalized DVR Worker route is missing')
  for p in (app/'tv-app').rglob('*'):
   if p.is_file() and any(x in p.name for x in ['probe','native-test','legacy-eme']):raise ValueError('TG4 diagnostic experiment in public app: '+p.name)
 return app,version

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--app',choices=(*APPS,'all'),default='all');parser.add_argument('--output',type=Path,default=ROOT/'dist');args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 for name in APPS if args.app=='all' else [args.app]:
  app,version=validate(name);output=args.output/(name+'-'+version+'-unsigned.wgt')
  with ZipFile(output.with_suffix('.tmp'),'w',ZIP_DEFLATED) as z:
   for p in sorted((app/'tv-app').rglob('*')):
    if not p.is_file() or any(part.startswith('.') for part in p.relative_to(app/'tv-app').parts):continue
    if p.name=='author-signature.xml' or re.fullmatch(r'signature\d*\.xml',p.name):continue
    if p.suffix.lower() in ['.p12','.pem','.key','.har','.log']:raise ValueError('Private file in TV app: '+p.name)
    z.write(p,p.relative_to(app/'tv-app').as_posix())
   z.write(app/'README.md','CONFIGURE.md')
  output.with_suffix('.tmp').replace(output);print(output)
 sums=[]
 for p in sorted(args.output.glob('*-unsigned.wgt')):sums.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
 (args.output/'SHA256SUMS').write_text('\n'.join(sums)+'\n')
if __name__=='__main__':main()
