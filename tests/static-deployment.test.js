import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {preflight,productionSource} from '../scripts/deployment/build.js';
const digest=s=>createHash('sha256').update(s).digest('hex');
const manifest=files=>({owner:'defender-static-deployer',version:1,files});
async function fixture(run){const root=await mkdtemp(path.join(tmpdir(),'defender-deployment-'));try{await mkdir(root+'/docs/site',{recursive:true});return await run(root);}finally{await rm(root,{recursive:true,force:true});}}
test('preflight protects existing documentation before first deployment',()=>fixture(async root=>{
 await writeFile(root+'/docs/index.html','existing documentation');
 await expect(preflight(new Map([['docs/index.html',{}]]),null,root)).rejects.toThrow('unowned or edited');
 expect(await readFile(root+'/docs/index.html','utf8')).toBe('existing documentation');
}));
test('refresh accepts unchanged owned files but preserves intervening edits including stale files',()=>fixture(async root=>{
 await writeFile(root+'/docs/site/old.js','generated');
 const previous=manifest([{path:'docs/site/old.js',sha256:digest('generated')}]);
 expect((await preflight(new Map(),previous,root)).size).toBe(1);
 await writeFile(root+'/docs/site/old.js','user edit');
 await expect(preflight(new Map(),previous,root)).rejects.toThrow('unowned or edited');
 expect(await readFile(root+'/docs/site/old.js','utf8')).toBe('user edit');
}));
test('manifest cannot claim arbitrary documentation or traverse out of the generated directory',()=>fixture(async root=>{
 for(const file of ['docs/design-doc.md','docs/site/../../AGENTS.md'])await expect(preflight(new Map(),manifest([{path:file,sha256:'x'}]),root)).rejects.toThrow('Unsafe owned path');
 await expect(preflight(new Map(),{...manifest([]),owner:'unknown'},root)).rejects.toThrow('Unknown deployment');
}));
test('output symlinks are refused before reading or overwriting their targets',()=>fixture(async root=>{
 await writeFile(root+'/sentinel','preserve');await symlink(root+'/sentinel',root+'/docs/index.html');
 await expect(preflight(new Map([['docs/index.html',{}]]),null,root)).rejects.toThrow('Symlink');expect(await readFile(root+'/sentinel','utf8')).toBe('preserve');
}));
test('source changes that invalidate stripping boundaries fail closed',async()=>{
 const source=await Bun.file(new URL('../play/app.js',import.meta.url)).text();
 expect(()=>productionSource('play/app.js',source.replace(',gpuTiming:true',',gpuTiming:false'))).toThrow('Packaging boundary changed');
});
