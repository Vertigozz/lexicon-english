// A convergent learning log plus versioned registers for mutable fields.
// A reset starts a new epoch, so an old offline device cannot resurrect progress.
const clone = value => structuredClone(value);
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
  return value;
}
// PostgreSQL jsonb reorders object keys. Equality must compare values, not wire order.
export const stateSignature=value=>JSON.stringify(canonical(value));
const equal = (a,b) => stateSignature(a) === stateSignature(b);
const zero = '0000000000000000:legacy';
const latest = (a=zero,b=zero) => a>b?a:b;
const meta = s => s?.sync || {};
const keys = (...objects) => [...new Set(objects.flatMap(o=>Object.keys(o||{})))];
const stampFor = (s,group,key) => meta(s)[group]?.[key] || zero;

export function stampState(state, previous, device, now=Date.now()) {
  const old=meta(previous), retained=meta(state);
  const clock=Math.max(now,old.clock||0,retained.clock||0)+1;
  const stamp=`${String(clock).padStart(16,'0')}:${device}`;
  const m=state.sync={...clone(old),...clone(retained),clock};
  for(const group of ['settings','decks','deletedDecks','epochs']){
    m[group]={};for(const key of keys(old[group],retained[group]))m[group][key]=latest(old[group]?.[key],retained[group]?.[key]);
  }
  for(const key of keys(state.settings,previous?.settings)) {
    if(!previous||!equal(state.settings[key],previous.settings[key]))m.settings[key]=stamp;
  }
  const before=new Map(previous?.decks.map(d=>[d.deck.id,d])||[]);
  const after=new Map(state.decks.map(d=>[d.deck.id,d]));
  for(const [id,d] of after)if(!equal(d,before.get(id)))m.decks[id]=stamp;
  for(const id of before.keys())if(!after.has(id)){m.deletedDecks[id]=stamp;m.epochs[id]=stamp;}
  const eventIds=new Set(state.events.map(e=>e.id));
  const reset=new Set((previous?.events||[]).filter(e=>!eventIds.has(e.id)).map(e=>e.deckId));
  for(const id of reset)m.epochs[id]=stamp;
  for(const event of state.events) {
    if(reset.has(event.deckId)||event.syncEpoch===undefined)event.syncEpoch=m.epochs[event.deckId]||zero;
  }
  if(!previous||state.activeDeckId!==previous.activeDeckId)m.active=stamp;
  if(state.session)state.session.syncEpoch=m.epochs[state.session.deckId]||zero;
  if(!previous||!equal(state.session,previous.session))m.session=stamp;
  return state;
}

export function mergeStates(left,right) {
  if(!left)return clone(right);if(!right)return clone(left);
  const a=left,b=right,m={clock:Math.max(meta(a).clock||0,meta(b).clock||0)};
  for(const group of ['settings','decks','deletedDecks','epochs']) {
    m[group]={};for(const key of keys(meta(a)[group],meta(b)[group]))m[group][key]=latest(stampFor(a,group,key),stampFor(b,group,key));
  }
  m.active=latest(meta(a).active,meta(b).active);m.session=latest(meta(a).session,meta(b).session);
  const choose=(x,y,sx,sy)=>sx>sy?x:sy>sx?y:stateSignature(x??null)>stateSignature(y??null)?x:y;
  const settings={};
  for(const key of keys(a.settings,b.settings))settings[key]=clone(choose(a.settings[key],b.settings[key],stampFor(a,'settings',key),stampFor(b,'settings',key)));
  const ad=new Map(a.decks.map(d=>[d.deck.id,d])),bd=new Map(b.decks.map(d=>[d.deck.id,d]));
  const decks=[...new Set([...ad.keys(),...bd.keys()])].sort().flatMap(id=>{
    const d=choose(ad.get(id),bd.get(id),stampFor(a,'decks',id),stampFor(b,'decks',id));
    return d&&(!m.deletedDecks[id]||m.deletedDecks[id]<(m.decks[id]||zero))?[clone(d)]:[];
  });
  const ids=new Set(decks.map(d=>d.deck.id)),byId=new Map();
  for(const e of [...a.events,...b.events]) {
    if(!ids.has(e.deckId)||(e.syncEpoch||zero)!==(m.epochs[e.deckId]||zero))continue;
    const old=byId.get(e.id);byId.set(e.id,old?choose(old,e,zero,zero):e);
  }
  const events=[...byId.values()].sort((x,y)=>x.at.localeCompare(y.at)||x.id.localeCompare(y.id)).map(clone);
  let session=clone(choose(a.session,b.session,meta(a).session||zero,meta(b).session||zero));
  if(session&&(!ids.has(session.deckId)||(session.syncEpoch||zero)!==(m.epochs[session.deckId]||zero)||(session.phase!=='result'&&events.some(e=>e.type==='session_completed'&&e.sessionId===session.id))))session=null;
  let activeDeckId=choose(a.activeDeckId,b.activeDeckId,meta(a).active||zero,meta(b).active||zero);
  if(!ids.has(activeDeckId))activeDeckId=decks[0]?.deck.id;
  return {...clone(a),version:1,decks,events,settings,session,activeDeckId,sync:m};
}

// The built-in 1000-word course is fetched locally instead of uploaded on every answer.
export function packState(state,catalog) {
  const packed=clone(state);
  packed.decks=packed.decks.map(d=>equal(d,catalog)?{bundled:d.deck.id,revision:d.deck.catalogRevision}:d);
  return {format:'lexicon-cloud',version:1,state:packed};
}
export function unpackState(document,catalog) {
  if(document?.format!=='lexicon-cloud'||document.version!==1||!Array.isArray(document.state?.decks))throw new Error('Неизвестный формат облачного сохранения.');
  const state=clone(document.state);
  state.decks=state.decks.map(d=>{
    if(!d.bundled)return d;
    if(d.bundled!==catalog?.deck.id||d.revision!==catalog.deck.catalogRevision)throw new Error('Обновите приложение: версия учебного курса отличается.');
    return clone(catalog);
  });
  return state;
}
