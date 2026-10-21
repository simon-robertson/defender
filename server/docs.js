import {realpath,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

export const PUBLIC_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const headers={'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':PUBLIC_CSP};
const imageTypes=new Map([['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.gif','image/gif'],['.svg','image/svg+xml']]);
const textTypes=new Map([['.md','text/plain; charset=utf-8'],['.txt','text/plain; charset=utf-8'],['.json','application/json; charset=utf-8']]);
const markdownOptions={noHtmlBlocks:true,noHtmlSpans:true,headings:{ids:true}};
const rootDocuments=new Set(['/AGENTS.md','/README.md']);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const origin='http://defender.local';

// Resolve in URL space, then allow only the already public local areas. Images
// stay inside docs: remote/data URLs cannot introduce tracked or active media.
function safeURL(value,documentPath,image=false){
 if(!value||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 let url;try{url=new URL(value,origin+documentPath);}catch{return null;}
 if(url.origin!==origin)return !image&&['https:','http:','mailto:'].includes(url.protocol)?url.href:null;
 let path;try{path=decodeURIComponent(url.pathname);}catch{return null;}
 if(path.includes('\\')||path.split('/').some(part=>part.startsWith('.')))return null;
 const asset=!image&&path.match(/^\/assets\/(models|levels)\/([a-z][a-z0-9-]{0,63})\.json$/);
 if(asset)return `/api/${asset[1]}/${asset[2]}`+url.search+url.hash;
 const extension=extname(path).toLowerCase();
 if(image){if(!path.startsWith('/docs/')||!imageTypes.has(extension))return null;}
 else if(path.startsWith('/docs/')){if(path!=='/docs/design-doc'&&!imageTypes.has(extension)&&!textTypes.has(extension))return null;}
 else if(path!=='/'&&!rootDocuments.has(path)&&!/^\/(tools|shared|engine|game)\//.test(path)&&path!=='/game')return null;
 return url.pathname+url.search+url.hash;
}

export async function renderDocument(markdown,documentPath='/docs/design-doc.md',modified=null){
 const sections=[];let title=null;
 Bun.markdown.render(markdown,{heading:(text,{level,id})=>{if(level===1&&title===null)title=text;if(level===2||level===3)sections.push({text,level,id});return '';}},markdownOptions);
 title??='design doc';
 const html=Bun.markdown.html(markdown,markdownOptions);
 const body=await new HTMLRewriter()
  .on('a',{element(element){const href=safeURL(element.getAttribute('href'),documentPath);if(href)element.setAttribute('href',href);else element.removeAttribute('href');}})
  .on('img',{element(element){const src=safeURL(element.getAttribute('src'),documentPath,true);if(!src){element.replace(element.getAttribute('alt')??'');return;}element.setAttribute('src',src);element.setAttribute('loading','lazy');element.setAttribute('decoding','async');}})
  .on('table',{element(element){element.before('<div class="table-scroll" tabindex="0" role="region" aria-label="Document table">',{html:true});element.after('</div>',{html:true});}})
  .transform(new Response(html)).text();
 const toc=sections.map(section=>`<li class="depth-${section.level}"><a href="#${escape(section.id)}">${escape(section.text)}</a></li>`).join('');
 const source=documentPath+'?raw=1',updated=modified?new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'Europe/London'}).format(modified):null;
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escape(title)}</title><link rel="stylesheet" href="/tools/design-doc.css"></head>
<body><a class="skip-link" href="#document">Skip to document</a>
<header class="doc-header"><a class="brand" href="/docs/design-doc"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>DEFENDER<small>DESIGN &amp; DEVELOPMENT</small></span></a><nav aria-label="Project"><a href="/game/">Game preview <span aria-hidden="true">↗</span></a><a href="/">Workshop <span aria-hidden="true">↗</span></a><a href="${escape(source)}">Markdown source</a></nav></header>
<div class="doc-layout"><aside class="doc-sidebar"><a class="doc-home" href="/docs/design-doc">Living design reference</a><details open><summary>On this page</summary><nav aria-label="Contents"><ol>${toc}</ol></nav></details><div class="sidebar-note">${updated?`Updated ${escape(updated)}<br>`:''}Read from the repository.<br>Reload to see saved changes.</div></aside>
<main id="document" class="doc-content" tabindex="-1"><div class="eyebrow">DEFENDER / PROJECT REFERENCE</div><article>${body}</article><footer class="doc-footer"><a href="${escape(source)}">View Markdown source</a><a href="#document">Back to top ↑</a></footer></main></div></body></html>`;
}

export async function serveDocs(request,pathname,docsRoot,repositoryRoot){
 const rootDocument=rootDocuments.has(pathname);
 if(!pathname.startsWith('/docs/')&&!rootDocument)return null;
 const url=new URL(request.url);
 if(pathname==='/docs/design-doc/'||(pathname==='/docs/design-doc.md'&&url.searchParams.get('raw')!=='1'))return new Response(null,{status:308,headers:{...headers,Location:'/docs/design-doc'+url.search}});
 const relative=rootDocument?pathname.slice(1):pathname==='/docs/design-doc'?'design-doc.md':pathname.slice('/docs/'.length),extension=extname(relative).toLowerCase();
 if(/[\u0000-\u001f\u007f\\]/.test(relative)||relative.split('/').some(part=>!part||part.startsWith('.'))||!imageTypes.has(extension)&&!textTypes.has(extension))return new Response('Not found',{status:404,headers});
 try{
  const directory=await realpath(rootDocument?repositoryRoot:docsRoot),path=await realpath(resolve(directory,relative));
  if(!path.startsWith(directory+'/'))return new Response('Not found',{status:404,headers});
  const info=await stat(path);if(!info.isFile())return new Response('Not found',{status:404,headers});
  const file=Bun.file(path);let content,type;
  if(extension==='.md'&&url.searchParams.get('raw')!=='1'){content=await renderDocument(await file.text(),rootDocument?pathname:'/docs/'+relative,info.mtime);type='text/html; charset=utf-8';}
  else{content=file;type=imageTypes.get(extension)??textTypes.get(extension);}
  // SVG is useful for the authored maps, but opening one as a document must not
  // execute embedded scripts or fetch arbitrary resources.
  const csp=extension==='.svg'?"default-src 'none'; style-src 'unsafe-inline'; sandbox":PUBLIC_CSP;
  return new Response(request.method==='HEAD'?null:content,{headers:{...headers,'Content-Type':type,'Content-Security-Policy':csp}});
 }catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return new Response('Not found',{status:404,headers});throw error;}
}
