import {upload} from '@vercel/blob/client';
import {setupStudioRecorder} from '../dist/studio-recorder.js';
import {createRecordingBackup} from '../dist/recording-backup.js';

window.createStudioRecorder=options=>setupStudioRecorder({...options,
  backup:createRecordingBackup(),
  uploadFile:({file,pathname,onProgress})=>upload(pathname,file,{access:'public',handleUploadUrl:'/api/recordings/upload',multipart:true,onUploadProgress:event=>onProgress?.(event.percentage)}),
  setVisibility:async({id,visible})=>{const response=await fetch('/api/recordings/visibility',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({id,visible})});if(!response.ok)throw new Error('Не вдалося змінити видимість запису.');return response.json();}
});
