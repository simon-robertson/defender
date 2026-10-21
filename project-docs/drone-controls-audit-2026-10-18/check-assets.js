// Read-only preservation check for this control-only correction.
import {createHash} from 'node:crypto';
import {readdir} from 'node:fs/promises';

const root=new URL('../../',import.meta.url);
const before=await Bun.file(new URL('./before-assets.json',import.meta.url)).json();
const actual=[];
for(const folder of ['assets/models/','assets/levels/'])
 for(const name of await readdir(new URL(folder,root)))
  if(name.endsWith('.json'))actual.push(folder+name);
const changed=[],added=actual.filter(name=>!(name in before));
for(const [name,hash] of Object.entries(before)){
 const file=Bun.file(new URL(name,root));
 if(!await file.exists()){changed.push(name+' (missing)');continue;}
 const current=createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex');
 if(current!==hash)changed.push(name);
}
const backup='backups/pre-path-carving-2026-10-18T17-00-34-263Z';
const sums=(await Bun.file(new URL(backup+'/SHA256SUMS',root)).text()).trim().split('\n');
const backupErrors=[];
for(const line of sums){
 const [,expected,name]=line.match(/^(\w+)\s+\*?(.+)$/);
 const bytes=await Bun.file(new URL(backup+'/'+name,root)).arrayBuffer();
 if(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')!==expected)backupErrors.push(name);
}
const archive=await Bun.file(new URL(backup+'.tar.gz',root)).arrayBuffer();
const archiveExpected=(await Bun.file(new URL(backup+'.tar.gz.sha256',root)).text()).split(/\s+/)[0];
const archiveUnchanged=createHash('sha256').update(new Uint8Array(archive)).digest('hex')===archiveExpected;
const passed=!changed.length&&!added.length&&!backupErrors.length&&archiveUnchanged;
const report={checked:Object.keys(before).length,changed,added,backupChecksums:sums.length,backupErrors,archiveUnchanged,passed};
console.log(JSON.stringify(report,null,2));
await Bun.write(new URL('./preservation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(!passed)process.exitCode=1;
