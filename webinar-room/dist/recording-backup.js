const DB_NAME='ik-webinar-recordings';
const STORE='pending';

function requestResult(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('IndexedDB request failed'));});}
function transactionDone(transaction){return new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB transaction failed'));transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB transaction aborted'));});}

export function createRecordingBackup(indexedDB=globalThis.indexedDB){
  let database=null,queue=Promise.resolve();
  async function open(){if(database)return database;if(!indexedDB)throw new Error('Локальне резервне сховище недоступне.');const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};database=await requestResult(request);return database;}
  async function write(id,change){const db=await open(),transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE),current=await requestResult(store.get(id));if(!current)throw new Error('Recording backup is missing');await requestResult(store.put(change(current)));await transactionDone(transaction);}
  const enqueue=task=>(queue=queue.then(task,task));
  return {
    async begin({id,startedAt,mime}){await enqueue(async()=>{const db=await open(),transaction=db.transaction(STORE,'readwrite');transaction.objectStore(STORE).put({id,startedAt,mime,chunks:[],duration:0,updatedAt:Date.now()});await transactionDone(transaction);});},
    append(id,chunk,duration){return enqueue(()=>write(id,current=>({...current,chunks:[...current.chunks,chunk],duration:Math.max(current.duration||0,duration||0),updatedAt:Date.now()})));},
    finalize(id,{duration,mime}){return enqueue(()=>write(id,current=>({...current,duration,mime:mime||current.mime,updatedAt:Date.now()})));},
    async remove(id){await enqueue(async()=>{const db=await open(),transaction=db.transaction(STORE,'readwrite');transaction.objectStore(STORE).delete(id);await transactionDone(transaction);});},
    async list(){await queue;const db=await open(),transaction=db.transaction(STORE,'readonly'),records=await requestResult(transaction.objectStore(STORE).getAll());await transactionDone(transaction);return records.filter(record=>record.chunks?.length);},
    async flush(){await queue;}
  };
}
