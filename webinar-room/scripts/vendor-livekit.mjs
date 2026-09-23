import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const destination=new URL('../dist/vendor/livekit/',import.meta.url);
await mkdir(destination,{recursive:true});
await copyFile(new URL('../node_modules/livekit-client/dist/livekit-client.umd.js',import.meta.url),new URL('livekit-client.umd.js',destination));
await copyFile(new URL('../node_modules/livekit-client/LICENSE',import.meta.url),new URL('LICENSE',destination));
await writeFile(new URL('NOTICE.txt',destination),'LiveKit JS Client SDK 2.22.3\nhttps://github.com/livekit/client-sdk-js\nApache-2.0; see LICENSE.\n');
