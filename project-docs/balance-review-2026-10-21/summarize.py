"""Reconcile the saved native witnesses; create compact report tables. Python 3 stdlib only."""
import hashlib,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
names=['mixed','arc-heavy','gun-focused','missile-heavy','arc-heavy-no-chain','mixed-old-missiles','adaptive-gen','adaptive-control','adaptive-gen-capped-b','adaptive-control-capped-b','adaptive-gen-no-bonus']
reports={name:json.loads((HERE/(name+'.json')).read_text())for name in names if(HERE/(name+'.json')).exists()}
summary={'policies':{},'chainByZone':{},'missileByZone':{},'generatorByZone':{},'reconciliation':{},'evidenceHashes':{}}
for name,report in reports.items():
 r=report['results'][0];summary['policies'][name]={key:value for key,value in r.items()if key!='waves'}
 checks=0
 for w in r['waves']:
  useful=w['metrics']['usefulDamage']
  assert abs(sum(w['damageByFamily'].values())-useful)<1e-7,(name,w['wave'],'family sum')
  assert abs(sum(w['damageBySpecies'].values())-useful)<1e-7,(name,w['wave'],'species sum')
  if w['completed']:
   assert abs(useful+sum(e['health']for e in w['escapedHealth'])-w['healthBudget'])<1e-6,(name,w['wave'],'HP conservation')
   checks+=1
 assert r['tokens']==2+r['completedWaves']*2-r['spent'],(name,'wallet')
 for path,expected in report['sourceHashes'].items():
  actual=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
  assert expected==actual,(name,path,'source hash changed')
 summary['reconciliation'][name]={'completeWaveHPChecks':checks,'partialDefeatWaves':len(r['waves'])-checks,'walletExact':True,'sourceHashesVerified':len(report['sourceHashes'])}
 summary['evidenceHashes'][name+'.json']=hashlib.sha256((HERE/(name+'.json')).read_bytes()).hexdigest()
 if name in ['mixed','arc-heavy']:
  summary['chainByZone'][name]={}
  for z in 'abcd':
   w=[x for x in r['waves']if x['wave'][0]==z];p=sum(x['metrics']['primaryArcUseful']for x in w);c=sum(x['metrics']['chainUseful']for x in w)
   summary['chainByZone'][name][z]={'primaryUsefulHP':p,'secondaryUsefulHP':c,'secondaryFractionOfPrimary':c/p if p else 0,'waveSeconds':sum(x['waveTime']for x in w)}
 if name in ['mixed','mixed-old-missiles']:
  summary['missileByZone'][name]={}
  for z in 'abcd':
   w=[x for x in r['waves']if x['wave'][0]==z];launch=sum(x['missileShots']for x in w);contact=sum((x['missileResults']or{}).get('hits',0)for x in w)
   summary['missileByZone'][name][z]={'launches':launch,'contacts':contact,'contactPerLaunch':contact/launch if launch else 0,'usefulMissileHP':sum(x['damageByFamily']['missile-launcher']for x in w),'waveSeconds':sum(x['waveTime']for x in w),'collisions':sum((x['missileResults']or{}).get('collisions',0)for x in w),'missed':sum((x['missileResults']or{}).get('missed',0)for x in w)}
 if name.startswith('adaptive-'):
  summary['generatorByZone'][name]={}
  for z in 'abcd':
   w=[x for x in r['waves']if x['wave'][0]==z]
   if not w:continue
   summary['generatorByZone'][name][z]={'marginalContactUsefulHP':sum(x['metrics']['generatorMarginalUseful']for x in w),'recipientCounts':sorted(set(len(g['recipients'])for x in w for g in x['metrics']['generatorRecipients'])),'waveSeconds':sum(x['waveTime']for x in w),'escapes':sum(x['escaped']for x in w)}
(HERE/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'policies':summary['policies'],'reconciledWaves':sum(x['completeWaveHPChecks']for x in summary['reconciliation'].values())},indent=2))
