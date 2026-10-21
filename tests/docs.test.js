import {test,expect} from 'bun:test';
import {renderDocument} from '../server/docs.js';

test('native Markdown view retains hierarchy, unique contents links, tables and source navigation',async()=>{
 const html=await renderDocument('# design doc\n\nA living **reference**.\n\n## Game & rules\n\n### Arsenal\n\n## Game & rules\n\n| Item | Strength |\n| --- | --- |\n| Gun | 10 |\n\n```js\nconst count = 3;\n```');
 expect(html).toContain('<title>design doc</title>');expect(html).toContain('<h1 id="design-doc">design doc</h1>');
 expect(html).toContain('href="#game-rules"');expect(html).toContain('href="#game-rules-1"');expect(html).toContain('class="depth-3"');
 expect(html).toContain('Game &amp; rules</a>');expect(html).toContain('<strong>reference</strong>');expect(html).toContain('<table>');expect(html).toContain('aria-label="Document table"');expect(html).toContain('const count = 3;');
 expect(html).toContain('href="/game/"');expect(html).toContain('href="/"');expect(html).toContain('href="/docs/design-doc.md?raw=1"');
});

test('relative documentation, images, root contributor notes and existing code/review URLs resolve correctly',async()=>{
 const html=await renderDocument('# design doc\n\n![Concept](concepts/power.png)\n\n[Combat](combat.md#damage) [Code](../shared/defence.js) [Agents](../AGENTS.md) [Readme](../README.md) [Review](/tools/turret-review.html) [External](https://example.com/study)');
 for(const url of ['/docs/concepts/power.png','/docs/combat.md#damage','/shared/defence.js','/AGENTS.md','/README.md','/tools/turret-review.html','https://example.com/study'])expect(html).toContain('="'+url+'"');
 expect(html).toContain('loading="lazy"');
 const nested=await renderDocument('# Concept\n\n![Art](art.png) [Notes](../combat.md)', '/docs/concepts/concept.md');expect(nested).toContain('src="/docs/concepts/art.png"');expect(nested).toContain('href="/docs/combat.md"');
 const instructions=await renderDocument('# Instructions\n\n[Design](docs/design-doc.md)', '/AGENTS.md');expect(instructions).toContain('href="/docs/design-doc.md"');
});

test('raw HTML and unsafe Markdown links/images cannot add executable markup or unconfined media',async()=>{
 const html=await renderDocument('# design doc\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[Bad](javascript:alert(3)) [Encoded](jav&#x61;script:alert(4)) [Data](data:text/html,hello) [File](file:///etc/passwd) [Root](../package.json)\n\n![Remote](https://example.com/a.png) ![Traversal](../assets/a.png) ![Data](data:image/svg+xml,hello)\n\n```html\n<iframe src="x"></iframe>\n```');
 expect(html).not.toContain('<script');expect(html).not.toContain('<iframe');expect(html).not.toContain('<img src=x');expect(html).not.toContain('href="javascript:');expect(html).not.toContain('href="data:');expect(html).not.toContain('href="file:');expect(html).not.toContain('href="/package.json"');
 expect(html).not.toContain('src="https:');expect(html).not.toContain('src="data:');expect(html).not.toContain('src="/assets/');expect(html).toContain('&lt;script&gt;');expect(html).toContain('&lt;iframe');
});

test('strict model and level source links use the read-only API without exposing arbitrary assets',async()=>{
 const html=await renderDocument('# design doc\n\n[Model](../assets/models/power-generator.json) [Level](../assets/levels/moss-01.json) [Nested model](../../assets/models/turret-study.json)\n\n[Bad id](../assets/models/bad_id.json) [Wrong kind](../assets/private/secret.json) [Wrong type](../assets/models/dog.js) [Directory](../assets/models/) [Nested file](../assets/models/private/dog.json)\n\n![Model image](../assets/models/dog.json)');
 expect(html).toContain('href="/api/models/power-generator"');expect(html).toContain('href="/api/levels/moss-01"');expect(html).toContain('href="/api/models/turret-study"');
 expect(html).not.toContain('href="/assets/');expect(html).not.toContain('href="/api/models/bad_id"');expect(html).not.toContain('src="/api/');
 for(const text of ['Bad id','Wrong kind','Wrong type','Directory','Nested file'])expect(html).toContain('<a>'+text+'</a>');
});

test('document chrome escapes hostile heading text and supplies readable responsive/print CSS',async()=>{
 const html=await renderDocument('# <img src=x onerror=alert(1)>\n\n## <script>bad</script>');expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;img');
 const css=await Bun.file(new URL('../tools/design-doc.css',import.meta.url)).text();expect(css).toContain('@media(max-width:720px)');expect(css).toContain('@media print');expect(css).toContain(':focus-visible');expect(css).toContain('overflow-x:auto');
});
