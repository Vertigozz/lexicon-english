import {mergeStates,stateSignature} from './sync-state.js';
const KEY='lexicon-state-v1';let db,queue=Promise.resolve();
const stateKey=scope=>scope==='guest'?'state':`state:${scope}`;
const fallbackKey=scope=>scope==='guest'?KEY:`${KEY}:${scope}`;
export async function openStorage(){
  try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lexicon',1);r.onupgradeneeded=()=>r.result.createObjectStore('app');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Database blocked'));});return true;}catch{return false;}
}
export async function readState(scope='guest'){
  await queue.catch(()=>{});
  if(db){const value=await new Promise((resolve,reject)=>{const r=db.transaction('app').objectStore('app').get(stateKey(scope));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(value)return value;}
  return JSON.parse(localStorage.getItem(fallbackKey(scope))||'null');
}
export function writeState(state,scope='guest'){
  const snapshot=structuredClone(state);
  queue=queue.catch(()=>{}).then(async()=>{
    let merged,changed=false;
    if(db)await new Promise((resolve,reject)=>{
      const t=db.transaction('app','readwrite'),store=t.objectStore('app'),r=store.get(stateKey(scope));
      r.onsuccess=()=>{try{merged=mergeStates(r.result,snapshot);changed=stateSignature(r.result)!==stateSignature(merged);if(changed)store.put(merged,stateKey(scope));}catch(error){t.abort();reject(error);}};
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Запись отменена.'));
    });
    else {
      const commit=()=>{const previous=JSON.parse(localStorage.getItem(fallbackKey(scope))||'null');merged=mergeStates(previous,snapshot);changed=stateSignature(previous)!==stateSignature(merged);if(changed)localStorage.setItem(fallbackKey(scope),JSON.stringify(merged));};
      if(navigator.locks)await navigator.locks.request(`lexicon:${scope}`,commit);else commit();
    }
    if(changed)try{localStorage.setItem('lexicon-storage-changed',JSON.stringify({scope,at:Date.now(),id:crypto.randomUUID()}));}catch{}
    return merged;
  });return queue;
}
