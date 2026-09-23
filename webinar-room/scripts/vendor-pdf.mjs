import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
const source=new URL('../node_modules/pdfjs-dist/',import.meta.url);
const target=new URL('../dist/vendor/pdfjs/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await cp(new URL(`build/${name}`,source),new URL(name,target));
for(const name of ['cmaps','standard_fonts','wasm','iccs','LICENSE'])await cp(new URL(name,source),new URL(name,target),{recursive:true});
const {version}=JSON.parse(await readFile(new URL('package.json',source),'utf8'));
await writeFile(new URL('version.txt',target),`Mozilla PDF.js ${version}\nhttps://github.com/mozilla/pdf.js\nApache-2.0; see LICENSE\n`);
console.log(`Bundled PDF.js ${version}`);
