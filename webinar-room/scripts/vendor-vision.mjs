import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../node_modules/@mediapipe/tasks-vision/',import.meta.url),target=new URL('../dist/vendor/mediapipe/',import.meta.url);
await mkdir(new URL('wasm/',target),{recursive:true});
await cp(new URL('vision_bundle.js',source),new URL('vision_bundle.js',target));
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])await cp(new URL(`wasm/${name}`,source),new URL(`wasm/${name}`,target));
const {version}=JSON.parse(await readFile(new URL('package.json',source),'utf8'));
await writeFile(new URL('NOTICE.txt',target),`MediaPipe Tasks Vision ${version}; Google LLC; Apache-2.0. See LICENSE.\nhttps://github.com/google-ai-edge/mediapipe\nSelfie segmenter downloaded from https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite\nVendored SHA-256: 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b\nModel card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf\n`);
console.log(`Bundled MediaPipe ${version}`);
