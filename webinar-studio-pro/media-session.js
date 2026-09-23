const KINDS = ['camera', 'microphone', 'screen'];
export function mediaErrorMessage(error, kind) {
  const source = {camera:'камери', microphone:'мікрофона', screen:'екрана'}[kind] || 'пристрою';
  switch(error?.name) {
    case 'NotAllowedError': return `Доступ до ${source} не надано або вибір скасовано. Спробуйте знову й підтвердьте запит браузера.`;
    case 'NotFoundError': return `Не знайдено ${source}. Підключіть пристрій та спробуйте ще раз.`;
    case 'NotReadableError': return `Не вдалося відкрити джерело. Закрийте інші програми, що використовують його, та спробуйте ще раз.`;
    case 'OverconstrainedError': return 'Обраний пристрій недоступний. Оберіть інший або варіант за замовчуванням.';
    case 'InvalidStateError': return 'Поверніться до активної вкладки студії та натисніть кнопку ще раз.';
    case 'UnsupportedError': return kind === 'screen' ? 'Цей браузер не підтримує показ екрана. Для слайдів відкрийте студію у Chrome або Edge на комп’ютері.' : 'Цей браузер не надає доступу до пристрою. Відкрийте студію окремо у Chrome, Edge або Safari.';
    case 'InsecureContextError': return 'Камера й мікрофон працюють за захищеним HTTPS-посиланням. Відкрийте опубліковану студію.';
    default: return 'Не вдалося увімкнути джерело. Перевірте дозволи браузера та підключення пристрою.';
  }
}
export class MediaSession {
  constructor({mediaDevices, secureContext = true, onChange = () => {}} = {}) {
    this.devices=mediaDevices; this.secureContext=secureContext; this.onChange=onChange;
    this.streams={camera:null,microphone:null,screen:null};
    this.pending={camera:false,microphone:false,screen:false};
    this.versions={camera:0,microphone:0,screen:0};
  }
  assertKind(kind){if(!KINDS.includes(kind))throw new TypeError('Unknown media source');}
  supported(kind){this.assertKind(kind);return this.secureContext&&typeof this.devices?.[kind==='screen'?'getDisplayMedia':'getUserMedia']==='function';}
  active(kind){this.assertKind(kind);return !!this.streams[kind]?.getTracks().some(track=>track.readyState==='live');}
  notify(){this.onChange(this);}
  stop(kind){
    this.assertKind(kind);this.versions[kind]++;this.pending[kind]=false;
    const stream=this.streams[kind];this.streams[kind]=null;
    stream?.getTracks().forEach(track=>track.stop());this.notify();
  }
  stopAll(){for(const kind of KINDS)this.stop(kind);}
  async start(kind, deviceId=''){
    this.assertKind(kind);
    if(!this.secureContext)throw Object.assign(new Error('HTTPS required'),{name:'InsecureContextError'});
    if(!this.supported(kind))throw Object.assign(new Error('Unsupported capture'),{name:'UnsupportedError'});
    this.stop(kind);
    const version=this.versions[kind];this.pending[kind]=true;this.notify();
    let incoming;
    try {
      if(kind==='screen')incoming=await this.devices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:false});
      else if(kind==='camera')incoming=await this.devices.getUserMedia({video:{...(deviceId?{deviceId:{exact:deviceId}}:{}),width:{ideal:1280},height:{ideal:720}},audio:false});
      else incoming=await this.devices.getUserMedia({video:false,audio:{...(deviceId?{deviceId:{exact:deviceId}}:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(version!==this.versions[kind]){incoming.getTracks().forEach(track=>track.stop());return null;}
      const expected=kind==='microphone'?'audio':'video';
      const track=incoming.getTracks().find(track=>track.kind===expected&&track.readyState==='live');
      if(!track){incoming.getTracks().forEach(track=>track.stop());throw Object.assign(new Error('Missing requested media track'),{name:'NotFoundError'});}
      this.streams[kind]=incoming;
      track.addEventListener('ended',()=>{if(this.streams[kind]===incoming)this.stop(kind);},{once:true});
      return incoming;
    } catch(error){
      if(version!==this.versions[kind])return null;
      throw error;
    } finally {
      if(version===this.versions[kind]){this.pending[kind]=false;this.notify();}
    }
  }
  async listDevices(){return this.devices?.enumerateDevices?await this.devices.enumerateDevices():[];}
}
