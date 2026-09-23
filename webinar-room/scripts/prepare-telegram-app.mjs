import {mkdir,cp,copyFile,readFile,writeFile,unlink} from 'node:fs/promises';
const project=new URL('../',import.meta.url),out=new URL('telegram-app/',project);
const files=['viewer.html','viewer.css','viewer.js','viewer-fullscreen.js','recordings.js','analytics-client.js','premiere.js','room-clock.js','style.css','live.css','live-viewer.js','live-connection.js','live-config.js','audience-activity.js','presenter-access.html','presenter-access.js','ivan-cutout.webp','autonomous-car.webp','vendor/livekit/livekit-client.umd.js'];
const css=await readFile(new URL('dist/style.css',project),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+\.woff2)['"]?\)/g))files.push(match[1].replace(/^\//,''));
for(const path of new Set(files)){const target=new URL('views/'+path,out);await mkdir(new URL('.',target),{recursive:true});await copyFile(new URL('dist/'+path,project),target);}
await cp(new URL('dist/assets/flags',project),new URL('views/assets/flags',out),{recursive:true});
for(const path of ['telegram-auth.mjs','telegram-session.mjs','presenter-session.mjs','live-service.mjs','analytics-store.mjs','premiere-store.mjs']){await mkdir(new URL('server/',out),{recursive:true});await copyFile(new URL('server/'+path,project),new URL('server/'+path,out));}
await copyFile(new URL('dist/viewer.html',project),new URL('views/index.html',out));
await copyFile(new URL('dist/viewer.html',project),new URL('views/live.html',out));
// Remove only the two legacy generated demo scripts, never source files.
for(const file of ['app.js','timeline.js'])await unlink(new URL('views/'+file,out)).catch(error=>{if(error.code!=='ENOENT')throw error;});
await writeFile(new URL('views/live-config.js',out),"export const LIVE_API_ORIGIN='';\n");
console.log('Prepared private Telegram viewer and server; studio assets are separately protected by presenter authentication.');

const studioFiles=['studio.html','style.css','studio.js','studio.css','studio-preview-fullscreen.js','studio-recorder.js','studio-recording-client.js','studio-recordings.js','recording-backup.js','analytics.html','analytics.css','analytics-dashboard.js','analytics-presenter.js','premiere-admin.js','studio.webmanifest','studio-pwa.js','studio-share.js','studio-service-worker.js','ik-studio-icon.svg','materials.js','materials.css','slide-deck.js','media-session.js','camera-position.js','camera-effects.css','background-blur.js','blur-worker.js','studio-live.js','program-stream.js','vendor/pdfjs','vendor/mediapipe','assets/presentations'];
for(const path of studioFiles){const target=new URL('studio/'+path,out);await mkdir(new URL('.',target),{recursive:true});await cp(new URL('dist/'+path,project),target,{recursive:true});}
