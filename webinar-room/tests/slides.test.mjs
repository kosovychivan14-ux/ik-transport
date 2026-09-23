import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSlideFiles,normalizeWebsite} from '../dist/slide-deck.js';
const file=(name,size=1024)=>({name,size});
test('slides accept one PDF or naturally ordered raster images only',()=>{
  assert.equal(validateSlideFiles([file('deck.PDF')]).type,'pdf');
  assert.deepEqual(validateSlideFiles([file('slide10.png'),file('slide2.jpg'),file('slide1.webp')]).files.map(f=>f.name),['slide1.webp','slide2.jpg','slide10.png']);
  for(const files of [[file('deck.pdf'),file('one.png')],[file('slides.pptx')],[file('unsafe.svg')],[file('empty.pdf',0)],[file('big.pdf',81*1024*1024)]])assert.throws(()=>validateSlideFiles(files));
});
test('website links allow navigation URLs but reject scripts, file URLs and credentials',()=>{
  assert.equal(normalizeWebsite(' example.com/path?q=1 '),'https://example.com/path?q=1');
  assert.equal(normalizeWebsite('https://example.com/a#b'),'https://example.com/a#b');
  for(const url of ['','javascript:alert(1)','data:text/html,x','file:///private','https://user:pass@example.com','https://'])assert.throws(()=>normalizeWebsite(url));
});
