import {validatePackage,makeEvent,appendEvent,mergePackage} from './core.js';

export const CATALOG_ID='english-b1b2-1000';
export const CATALOG_URL='./data/english-b1b2-1000.json';

export function installCatalog(current,pkg){
  const report=validatePackage(pkg);
  if(report.errors.length||pkg.deck.id!==CATALOG_ID||pkg.words.length!==1000||report.warnings.length)throw new Error('Встроенный словарь не прошёл проверку.');
  if(!current)return {state:{version:1,activeDeckId:CATALOG_ID,decks:[structuredClone(pkg)],events:[],settings:{timeZone:'Europe/Moscow',reminder:'19:00',theme:'light',sound:true},session:null},changed:true,installed:true};
  const previous=current.decks.find(d=>d.deck.id===CATALOG_ID);
  if(previous?.deck.catalogRevision===pkg.deck.catalogRevision)return {state:current,changed:false,installed:false};
  // A different curriculum must never inherit scores just because module numbers match.
  const state=structuredClone(current);
  const existingIndex=state.decks.findIndex(d=>d.deck.id===CATALOG_ID);
  if(existingIndex<0)state.decks.push(structuredClone(pkg));
  else {
    // Fill missing records without replacing edits imported by the user.
    const retained=state.decks[existingIndex],ids=new Set(retained.words.map(w=>w.id));
    const additions={...pkg,deck:{...pkg.deck,...retained.deck,catalogRevision:pkg.deck.catalogRevision},words:pkg.words.filter(w=>!ids.has(w.id))};
    state.decks[existingIndex]=additions.words.length?mergePackage(retained,additions):retained;
    state.decks[existingIndex].deck.catalogRevision=pkg.deck.catalogRevision;
  }
  const legacy=state.decks.find(d=>d.deck.id==='english-b1b2');
  if(legacy){legacy.deck.title='English B1–B2 · стартовая колода (архив)';legacy.deck.archived=true;}
  if(state.activeDeckId==='english-b1b2'){
    if(state.session&&state.session.phase!=='result')state.settings.pendingCatalogActivation=CATALOG_ID;
    else {state.activeDeckId=CATALOG_ID;state.session=null;}
  }
  appendEvent(state,{...makeEvent(state,'deck_imported',{deckId:CATALOG_ID,wordCount:1000,source:'bundled',catalogRevision:pkg.deck.catalogRevision}),id:`catalog:${pkg.deck.catalogRevision}`});
  return {state,changed:true,installed:true};
}

export function finishPendingCatalogActivation(state){
  const id=state.settings.pendingCatalogActivation;
  if(id&&state.decks.some(d=>d.deck.id===id)){state.activeDeckId=id;delete state.settings.pendingCatalogActivation;}
}
