"""Promote an explicitly selected maintenance build into its prebuilt app."""
import argparse,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser(description=__doc__);p.add_argument('app',choices=['rte-player','virgin-media-play']);args=p.parse_args();app=root/'apps'/args.app
source=app/'maintenance/build'/('vestel' if args.app=='rte-player' else 'tv')
if not (source/'config.xml').is_file():raise SystemExit('Build this app first')
# Build is copied to a fresh sibling before replacement, preserving a local backup.
target=app/'tv-app';temp=app/'.tv-app-next';backup=app/'.tv-app-previous'
if temp.exists():shutil.rmtree(temp)
shutil.copytree(source,temp,ignore=shutil.ignore_patterns('.DS_Store','.*','author-signature.xml','signature*.xml'))
if backup.exists():shutil.rmtree(backup)
target.rename(backup);temp.rename(target);print('Updated',target,'; previous files retained locally in',backup)
