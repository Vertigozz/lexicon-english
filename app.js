import {lookupWord,sourceURL,WIKI_LICENSE} from './wiktionary.js?v=13';
import {Favorites} from './favorites.js';
import {SharedDecks,installSharedDecks} from './shared-decks.js';
import {normalize,uid,localDate,addDays,checkAnswer,shuffle,makeEvent,appendEvent,derive,reviewQueue,nextModule,selectContext,validatePackage,mergePackage,validateBackup,learningTotals} from './core.js';
import {openStorage,readState,writeState} from './storage.js';
import {starter} from './data/seed.js';
import {stampState,mergeStates} from './sync-state.js';
import {mergeSavedState} from './session-draft.js';
import {setWordKnown,reconcileKnownSession,sessionScores} from './known.js';
import {CloudSync,configured} from './cloud.js';
import {accountPanel,statusText,registrationForm} from './account-panel.js?v=8';
import {CATALOG_ID,CATALOG_URL,installCatalog,finishPendingCatalogActivation} from './catalog.js';
import {copy,contextSources,courseSourcesHTML} from './credits.js';
import {cloudConfig} from './cloud-config.js';
import {speakingConfig} from './speaking-config.js';
let speakingView, unmountSpeaking, speakingAccount;
let bundledCatalog,cloud,accountUser=null,scope='guest',lastSaved=null,guestAvailable=false;
const cloudStatus={mode:'guest',at:null,error:'',saving:false,localError:false};
let deviceId;try{deviceId=localStorage.getItem('lexicon-device-id')||crypto.randomUUID();localStorage.setItem('lexicon-device-id',deviceId);}catch{deviceId=crypto.randomUUID();}

const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shapes={grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',chart:'<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',settings:'<path d="m10 3-1 3-3 1-3 3 2 3-1 4 4 1 2 3 4-1 3 1 1-4 3-2-1-4 1-3-4-1-2-3-4 1Z"/><circle cx="12" cy="12" r="3"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',check:'<path d="m5 12 4 4L19 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',repeat:'<path d="M20 7H6l3-3M4 17h14l-3 3M20 7v5M4 17v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',sound:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',bell:'<path d="M5 16V9a7 7 0 0 1 14 0v7l2 2H3l2-2Zm4 5h6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',flag:'<path d="M5 22V3c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',leaf:'<path d="M20 3C7 1 2 8 5 15c5 9 17 2 15-12ZM4 21 16 9"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',flame:'<path d="M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 1-5 3-7 0 4 2 4 2 4 2-3 3-6 2-10Z"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||shapes.book}</svg>`;
const day=n=>`Day ${String(n).padStart(3,'0')}`;
const btn=(label,action,cls='',extra='')=>`<button class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const badge=(text,type='')=>`<span class="badge ${type}">${text}</span>`;
let sharedDecks,catalogError='',catalogRefreshing=false;
let favorites=new Favorites(null,null);
const dictionary={query:'',searched:'',status:'idle',results:[],error:''};
let dictionaryRequest;
const dictionaryRoutes=['vocabulary','dictionary','favorites'];
function dictionaryNavigation(){
  return `<nav class="dictionary-navigation" aria-label="Разделы словаря">${[['vocabulary','Слова колоды'],['dictionary','Найти перевод'],['favorites','Избранное']].map(([path,title])=>`<a href="#${path}"${route===path?' aria-current="page"':''}>${title}</a>`).join('')}</nav>`;
}
function sourceCredit(entry){
  return `<p class="dictionary-source">Источник <a href="${esc(sourceURL(entry))}" target="_blank" rel="noopener noreferrer">Викисловарь · ${esc(entry.source_title)}</a> · <a href="${WIKI_LICENSE}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p>`;
}
function pronunciationHTML(entry){
  const variants=Array.isArray(entry.pronunciations)?entry.pronunciations.filter(v=>v&&typeof v.ipa==='string'&&v.ipa.length<=120).slice(0,4):[];
  return `<div class="dictionary-pronunciation">
    ${variants.length?variants.map(v=>`<p class="dictionary-ipa" lang="en">[${esc(v.ipa)}]</p>`).join(''):`<p class="tiny">${entry.pronunciations===null||entry.pronunciations===undefined?'Транскрипция ещё не загружена.':'В статье нет транскрипции.'}</p>`}
    ${btn(icon('sound')+' Озвучить','dictionary-speak','text-btn',`data-word="${esc(entry.word)}" aria-label="Озвучить ${esc(entry.word)}"`)}
  </div>`;
}
function pronounceWord(word,language='en-GB'){
  if(!state.settings.sound)return toast('Включите произношение в настройках.');
  if(!('speechSynthesis' in window))return toast('Этот браузер не поддерживает озвучку.');
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(word);
  utterance.lang=language;utterance.rate=.85;
  utterance.onerror=()=>toast('Английский голос недоступен. Проверьте настройки устройства.');
  speechSynthesis.speak(utterance);
}
function resultIdentity(entry){return JSON.stringify([entry.word.toLowerCase(),entry.translation]);}
function dictionaryResults(){
  if(dictionary.status==='loading')return '<p role="status">Ищем в Викисловаре…</p>';
  if(dictionary.status==='error')return `<p role="status">${esc(dictionary.error)}</p>`;
  if(dictionary.status==='empty')return '<p role="status">В английском разделе Викисловаря не найдено подходящих русских значений. Попробуйте начальную форму слова или другое написание.</p>';
  if(dictionary.status==='idle')return '<p>Введите английское слово или выражение, чтобы найти русские значения.</p>';
  return `<p role="status">Найдено значений: ${dictionary.results.length}. Выберите нужное.</p>
    ${dictionary.results.map((entry,index)=>{
      const saved=favorites.rows.some(row=>resultIdentity(row)===resultIdentity(entry)),saving=favorites.pending.has(resultIdentity(entry));
      return `<article class="dictionary-entry" data-result="${index}"><h2 lang="en" tabindex="-1">${esc(entry.word)}</h2>${pronunciationHTML(entry)}<p>${esc(entry.translation)}</p>
        ${sourceCredit(entry)}
        ${accountUser?btn(saved?'В избранном':saving?'Сохраняем…':'В избранное','favorite-add','subtle',`data-index="${index}" ${saved||saving?'disabled':''} aria-label="${saved?'В избранном':'В избранное'} — значение ${index+1}"`):'<a href="#settings">Войдите, чтобы сохранить это значение</a>'}
      </article>`;
    }).join('')}`;
}
function externalDictionaryPage(){
  return `${heading('Найти перевод','Английские слова и выражения из Викисловаря.')}${dictionaryNavigation()}
    <section class="neo dictionary-panel"><form id="dictionary-search-form">
      <label class="field-label" for="dictionary-query">Английское слово</label>
      <div class="dictionary-search"><input id="dictionary-query" class="neo-input" type="search" lang="en" maxlength="80" required autocomplete="off" spellcheck="false" value="${esc(dictionary.query)}" placeholder="Например, bank"><button class="btn primary" type="submit">Найти перевод</button></div>
      <p class="tiny">Текст запроса отправляется в Викисловарь. Каждое значение можно сохранить отдельно.</p>
    </form><div id="dictionary-results" aria-busy="${dictionary.status==='loading'}">${dictionaryResults()}</div></section>`;
}
function favoritesPage(){
  return `${heading('Избранное','Личная коллекция слов и выбранных переводов.')}${dictionaryNavigation()}
    <section class="neo dictionary-panel"><p class="favorites-note">Эта коллекция хранится отдельно от учебных колод. Сохранённые слова доступны в вашем аккаунте на других устройствах.</p>
    ${!accountUser?'<p><a class="btn primary" href="#settings">Войти в аккаунт</a></p>':
      `<div class="favorites-toolbar"><span>${favorites.loaded?'Сохранено значений: '+favorites.rows.length:'Личное избранное'}</span>${btn(favorites.loading?'Загружаем…':'Обновить','favorites-refresh','subtle',favorites.loading?'disabled':'')}</div>
      ${favorites.error?`<p role="status">${esc(favorites.error)}</p>`:''}
      ${favorites.rows.map(entry=>`<article class="dictionary-entry"><h2 lang="en">${esc(entry.word)}</h2>${pronunciationHTML(entry)}<p>${esc(entry.translation)}</p>${sourceCredit(entry)}
      ${entry.pronunciations===null||entry.pronunciations===undefined?btn(favorites.pending.has(entry.entry_key)?'Загружаем…':'Загрузить транскрипцию','favorite-pronunciation','subtle',`data-key="${esc(entry.entry_key)}" ${favorites.pending.has(entry.entry_key)?'disabled':''}`):''}</article>`).join('')}
      ${favorites.loaded&&!favorites.rows.length?'<div class="empty-state"><h2>Здесь будут сохранённые слова</h2><p>Найдите перевод и добавьте нужное значение.</p><a class="btn primary" href="#dictionary">Найти перевод</a></div>':''}
      ${!favorites.loaded&&!favorites.error?'<p role="status">Загружаем избранное…</p>':''}`}
    </section>`;
}
function paintDictionaryResults(){
  const panel=$('#dictionary-results');
  if(panel){
    const focused=document.activeElement?.closest('.dictionary-entry')?.dataset.result;
    panel.innerHTML=dictionaryResults();panel.setAttribute('aria-busy',String(dictionary.status==='loading'));
    if(focused!==undefined)panel.querySelector(`[data-result="${focused}"] h2`)?.focus();
  }
}
async function searchDictionary(){
  dictionaryRequest?.abort();
  const controller=new AbortController();dictionaryRequest=controller;
  dictionary.query=$('#dictionary-query').value;
  dictionary.searched=dictionary.query;
  dictionary.status='loading';dictionary.results=[];dictionary.error='';
  paintDictionaryResults();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const entries=await lookupWord(dictionary.query,{signal:controller.signal});
    if(dictionaryRequest!==controller)return;
    dictionary.results=entries;dictionary.status=entries.length?'found':'empty';
  }catch(error){
    if(dictionaryRequest!==controller)return;
    dictionary.error=controller.signal.aborted?'Викисловарь долго не отвечает. Повторите поиск.':error instanceof TypeError?'Не удалось подключиться к Викисловарю. Проверьте интернет и повторите поиск.':error.message;
    dictionary.status='error';
  }finally{
    clearTimeout(timer);
    if(dictionaryRequest===controller)paintDictionaryResults();
  }
}
async function refreshFavorites(){
  const target=favorites,pending=target.refresh();
  if(route==='favorites')render();
  await pending;
  if(target!==favorites)return;
  if(route==='favorites')render();
  else paintDictionaryResults();
}
const authHash=new URLSearchParams(location.hash.slice(1)),authQuery=new URLSearchParams(location.search);
const emailLinkError=authHash.has('error_code')||authQuery.has('error_code');
const emailConfirmed=authHash.get('type')==='signup'&&authHash.has('access_token');
let state,route=emailConfirmed||emailLinkError?'settings':location.hash.slice(1)||'dashboard',storageError='',filters={search:'',module:'',status:'all'},pendingImport=null,saveTimer,toastTimer;
const deck=()=>state.decks.find(d=>d.deck.id===state.activeDeckId);
const today=()=>localDate(state.settings.timeZone);
let progressCache;
const progress=()=>{if(!progressCache||progressCache.events!==state.events||progressCache.length!==state.events.length||progressCache.deckId!==state.activeDeckId)progressCache={events:state.events,length:state.events.length,deckId:state.activeDeckId,value:derive(state)};return progressCache.value;};
const finalAvailable=()=>deck().words.length>=1000&&new Set(deck().words.map(w=>w.module)).size>=100&&deck().words.every(w=>progress().known.has(w.id)||progress().wordProgress[w.id]?.stage===5)&&!Object.keys(progress().difficult).length;
const courseComplete=()=>finalAvailable()&&progress().sessions.some(e=>e.kind==='final'&&e.success);
const fmt=(d,long=false)=>d?new Intl.DateTimeFormat('ru',{day:'numeric',month:long?'long':'short',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`)):'—';
const wordsOf=n=>deck().words.filter(w=>w.module===n).sort((a,b)=>a.position-b.position);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
function paintCloudStatus(){
  const label=statusText(cloudStatus,accountUser);if($('#save-state'))$('#save-state').textContent=label;
  if($('#result-save-state'))$('#result-save-state').textContent=label;
  document.querySelectorAll('[data-cloud-detail]').forEach(el=>el.textContent=label);
  document.querySelectorAll('[data-cloud-time]').forEach(el=>el.textContent=cloudStatus.at?'Последняя синхронизация: '+new Date(cloudStatus.at).toLocaleString('ru'):'');
  document.querySelectorAll('[data-cloud-error]').forEach(el=>{el.hidden=cloudStatus.mode!=='error';el.textContent=cloudStatus.error;});
}
function applySaved(saved){
  const input=$('#answer');
  const draft=input?{sessionId:input.dataset.sessionId,index:Number(input.dataset.taskIndex),phase:input.dataset.phase,taskId:input.dataset.taskId,value:input.value,enabled:!input.disabled}:null;
  state=mergeSavedState(state,saved,draft);
}
async function save(schedule=true){
  clearTimeout(saveTimer);saveTimer=null;
  const targetScope=scope;cloudStatus.saving=true;paintCloudStatus();
  stampState(state,lastSaved,deviceId);lastSaved=structuredClone(state);
  try{const saved=await writeState(state,targetScope);if(scope!==targetScope)return true;applySaved(saved);cloudStatus.localError=false;storageError='';if(schedule)cloud?.schedule();return true;}
  catch{cloudStatus.localError=true;storageError='Не удалось сохранить данные. Экспортируйте резервную копию и освободите место в браузере.';toast(storageError);return false;}
  finally{cloudStatus.saving=false;paintCloudStatus();}
}
let recoveryShown=false;
function showPasswordReset(){if($('#new-password-form'))return;recoveryShown=true;showModal('Новый пароль','<form id="new-password-form"><label class="field-label" for="new-password">Новый пароль · минимум 8 символов</label><input id="new-password" class="neo-input full" type="password" autocomplete="new-password" minlength="8" required><button class="btn primary" type="submit">Сохранить пароль</button><p id="auth-message" role="status"></p></form>');}
async function startCloud(){
  cloud=new CloudSync({catalog:()=>bundledCatalog,read:readState,write:writeState,recovery:showPasswordReset,
    status:(mode,at,error)=>{Object.assign(cloudStatus,{mode,at:at||cloudStatus.at,error:error||''});paintCloudStatus();},
    changed:async saved=>{if(scope!==cloud.user?.id)return;const before=JSON.stringify(state.session);applySaved(saved);lastSaved=structuredClone(saved);if(route!=='study'||before!==JSON.stringify(state.session))render();},
    account:async user=>{
      const nextScope=user?.id||'guest';
      if (speakingView && speakingAccount !== user?.id) clearSpeaking();
      if(nextScope!==scope){
        if(!await save(false))throw new Error('Сначала сохраните локальные результаты в резервную копию.');
        const next=await readState(nextScope);
        scope=nextScope;state=next||{version:1,activeDeckId:(bundledCatalog||starter).deck.id,decks:[structuredClone(bundledCatalog||starter)],events:[],settings:{timeZone:'Europe/Moscow',reminder:'19:00',theme:'light',sound:true},session:null};
        lastSaved=state.sync?structuredClone(state):null;
        await save(false);if(route==='study'){route='dashboard';location.hash='dashboard';}
        try{localStorage.removeItem('lexicon-draft');}catch{}
      }
      accountUser=user;
      if(favorites.user?.id!==user?.id||favorites.client!==cloud.client){
        favorites=new Favorites(cloud.client,user);
        if(user)refreshFavorites();
      }
      if(cloud?.client){sharedDecks=new SharedDecks(cloud.client);await refreshDecks(false);}cloudStatus.at=null;cloudStatus.error='';
      const guest=await readState('guest');guestAvailable=Boolean(guest?.events.some(e=>['attempt','session_completed'].includes(e.type))||guest?.session);
      closeModal();render();
    }
  });
  try{await cloud.start();}catch(error){cloudStatus.mode='error';cloudStatus.error='Не удалось подключить аккаунт. Локальные результаты сохранены. '+error.message;paintCloudStatus();}
  if(emailConfirmed||emailLinkError){
    history.replaceState(null,'',location.pathname+'#settings');route='settings';render();
    if(emailLinkError)authMessage('Ссылка недействительна или устарела. Если вы уже подтвердили почту, войдите; иначе запросите новое письмо.');
    else authMessage(accountUser?'Почта подтверждена. Прогресс привязан к вашему аккаунту.':'Войдите с почтой и паролем, которые указали при регистрации.');
  }
  if(new URLSearchParams(location.search).has('reset-password')&&accountUser){
    showPasswordReset();
  }
}
async function refreshDecks(redraw=true){
 if(!sharedDecks||catalogRefreshing)return;
 catalogRefreshing=true;
 const status=$('#catalog-status');
 if(redraw&&status){status.hidden=false;status.textContent='Обновляем каталог…';}
 const owner=accountUser?.id,before=JSON.stringify([state.decks,sharedDecks.admin,catalogError]);
 try{await sharedDecks.refresh(accountUser);if(owner!==accountUser?.id)return;installSharedDecks(state,sharedDecks.rows);progressCache=null;await save(false);catalogError='';}
 catch(e){catalogError='Каталог недоступен. Сохранённые колоды доступны офлайн. '+e.message;}
 finally{
   catalogRefreshing=false;
   if(redraw&&before!==JSON.stringify([state.decks,sharedDecks.admin,catalogError]))render();
   if(redraw&&owner===accountUser?.id){
     const message=$('#catalog-status');
     if(message){message.hidden=false;message.textContent=catalogError||'Каталог обновлён.';}
   }
 }
}
const formatCount=value=>new Intl.NumberFormat('ru-RU').format(value);
function deckLabel(d){
  const count=formatCount(d.words.length);
  const title=d.deck.title.replace(/\s*·\s*[\d\s]+\s+слов$/u,'');
  return `${title} · ${count} слов`;
}
function deckOptions(){
  return state.decks.map(d=>`<option value="${esc(d.deck.id)}" ${d.deck.id===state.activeDeckId?'selected':''}>${esc(deckLabel(d))}</option>`).join('');
}
function deckBar(){
  const active=state.session&&state.session.phase!=='result';
  if(route==='study')return `<p class="study-deck">${esc(deckLabel(deck()))}</p>`;
  return `<section class="deck-picker" aria-label="Активная колода">
    <label for="catalog-deck-select">Колода</label>
    <div class="deck-control">
      <select id="catalog-deck-select" class="neo-select" ${active?'disabled':''}>${deckOptions()}</select>
      <span class="active-deck-name" aria-hidden="true">${esc(deckLabel(deck()))}</span>
    </div>
    ${accountUser?`<details class="catalog-actions"><summary>Каталог</summary><div class="catalog-panel">
      ${btn('Обновить каталог','refresh-decks','subtle small')}${sharedDecks?.admin?btn('Переименовать','rename-deck','subtle small'):''}
    </div></details>`:'<a class="catalog-login" href="#settings">Войти в общий каталог</a>'}
    ${active?'<small>Чтобы сменить колоду, завершите текущую тренировку.</small>':''}
    <small id="catalog-status" role="status" ${catalogError?'':'hidden'}>${esc(catalogError)}</small>
  </section>`;
}
function authMessage(message){const el=$('#auth-message');if(el)el.textContent=message;else toast(message);}
async function cloudAction(action,button){
  if(!configured||!cloud?.client){toast('Облачное сохранение ещё не подключено.');return;}
  if(action==='cloud-password'){showPasswordReset();return;}
  if(button)button.disabled=true;
  try{
    if(action==='cloud-login'){
      const form=$('#cloud-auth-form');if(!form?.reportValidity())return;
      const email=$('#account-email').value.trim(),password=$('#account-password').value;
      authMessage('Подключаем аккаунт…');
      await cloud.login(email,password);toast('Аккаунт подключён. Прогресс синхронизируется.');
    }
    if(action==='cloud-forgot'&&cloudConfig.emailsConfigured){
      const input=$('#account-email');if(!input.reportValidity()||!input.value.trim())return;
      await cloud.resetPassword(input.value.trim());authMessage('Ссылка для смены пароля отправлена на почту.');
    }
    if(action==='cloud-sync'){if(await save(false))await cloud.sync(true);}
    if(action==='cloud-logout'){if(await save(false)){await cloud.logout();toast('Вы вышли. Облачный прогресс сохранён в аккаунте.');}}
    if(action==='cloud-import-guest'){
      const guest=await readState('guest');if(!guest||!accountUser)return;
      state=mergeStates(state,guest);if(!await save())return;
      await cloud.sync(true);guestAvailable=false;render();toast('Локальный и облачный прогресс объединены.');
    }
  }catch(error){
    const messages={'Invalid login credentials':'Проверьте почту и пароль.','Email not confirmed':'Подтвердите адрес по ссылке из письма.','User already registered':'Такой аккаунт уже есть. Нажмите «Войти».','Email rate limit exceeded':'Слишком много писем. Попробуйте позже.'};
    authMessage(messages[error.message]||'Не удалось подключиться. '+error.message);
  }finally{if(button?.isConnected)button.disabled=false;}
}
async function sendRegistration(form,resend=false){
  if(!cloudConfig.emailsConfigured||!cloud?.client||accountUser||!form||form.dataset.sending)return;
  const email=form.querySelector('#registration-email'),password=form.querySelector('#registration-password'),message=form.querySelector('#registration-message');
  if(!(resend?email.reportValidity():form.reportValidity()))return;
  const buttons=[...form.querySelectorAll('button')];form.dataset.sending='true';buttons.forEach(button=>button.disabled=true);
  message.textContent='Запрашиваем письмо…';
  try{
    if(resend)await cloud.resendSignup(email.value.trim());
    else if(await cloud.signup(email.value.trim(),password.value))return;
    password.value='';
    form.querySelector('.registration-resend').open=true;
    message.textContent='Проверьте почту и папку «Спам». Если адрес ещё не подтверждён, вы получите ссылку. После подтверждения войдите с вашим паролем.';
  }catch(error){
    const messages={over_email_send_rate_limit:'Слишком много запросов на отправку. Попробуйте позже.',over_request_rate_limit:'Слишком много запросов. Попробуйте позже.',weak_password:'Выберите более надёжный пароль.',signup_disabled:'Регистрация временно недоступна.',email_address_not_authorized:'Письмо не отправлено. Регистрация по почте временно недоступна.'};
    message.textContent=messages[error.code]||'Не удалось отправить письмо. Проверьте адрес и попробуйте позже.';
  }finally{delete form.dataset.sending;buttons.forEach(button=>button.disabled=false);}
}
function log(type,data){appendEvent(state,makeEvent(state,type,data));}
function navigate(next){route=next;location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});}
function stats(){const p=progress(),ms=Object.values(p.modules),q=reviewQueue(state),learned=ms.filter(m=>m.covered).length;return {p,ms,q,learned,...learningTotals(state,p),mastered:ms.filter(m=>m.stage===5).length,hard:Object.values(p.difficult),due:q.filter(m=>m.nextDate===today()).length,overdue:q.filter(m=>m.nextDate<today()).length};}
function sidebar(){const nav=[['dashboard','grid','Обзор'],['today','calendar','Сегодня'],['vocabulary','book','Словарь'],['roadmap','map','Карта'],['statistics','chart','Статистика']];const q=reviewQueue(state).length;
  if (speakingConfig.enabled) nav.push(['speaking','sound','Разговорная практика']);
  return `<aside class="sidebar"><a href="#dashboard" class="brand" aria-label="Lexicon, главная"><span class="brand-mark">${icon('book')}</span>lexicon<span class="brand-dot">.</span></a><div class="sidebar-label">ВАШЕ УЧЕБНОЕ ПРОСТРАНСТВО</div><nav aria-label="Главная навигация">${nav.map(([r,i,t])=>`<a href="#${r}" class="nav-item ${r==='speaking'?'speaking-nav':''} ${(route===r||r==='vocabulary'&&dictionaryRoutes.includes(route))?'active':''}" ${(route===r||r==='vocabulary'&&dictionaryRoutes.includes(route))?'aria-current="page"':''}>${icon(i)}<span>${t}</span>${r==='today'&&q?`<span class="nav-count">${q}</span>`:''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="quiet-note"><div class="quiet-icon">${icon('leaf')}</div><strong>В своём ритме</strong><p>Не гонитесь за количеством.<br>Дайте словам остаться с вами.</p><span class="tiny">НЕМНОГО КАЖДЫЙ ДЕНЬ</span></div><a href="#settings" class="nav-item ${route==='settings'?'active':''}">${icon('settings')}<span>Настройки</span></a><button class="nav-item help-btn" data-action="help">${icon('help')}<span>Как это работает</span></button><div class="local-status"><span></span> ${accountUser?'Прогресс привязан к аккаунту':'Без аккаунта · только этот браузер'}</div></div></aside>`;
}
function shell(body){const titles={dashboard:'Обзор',today:'Сегодня',vocabulary:'Словарь',dictionary:'Найти перевод',favorites:'Избранное',roadmap:'Карта',statistics:'Статистика',settings:'Настройки',study:'Тренировка',speaking:'Разговорная практика'};
  return `${sidebar()}<div class="workspace"><header class="topbar"><div class="breadcrumb"><span class="breadcrumb-prefix">Моё пространство</span> ${icon('chevron')} <span>${titles[route]||'Обзор'}</span></div><div class="top-actions"><span class="local-pill">${icon('lock')} Личное пространство</span><button class="icon-btn" data-action="theme" aria-label="${state.settings.theme==='dark'?'Светлая':'Тёмная'} тема">${icon(state.settings.theme==='dark'?'sun':'moon')}</button><button class="icon-btn" data-action="notifications" aria-label="Очередь повторений">${icon('bell')}${reviewQueue(state).length?'<i class="notification-dot"></i>':''}</button><a href="#settings" class="profile-link" aria-label="Настройки профиля">${icon('settings')}<span>Настройки</span></a></div></header><main id="content" tabindex="-1">${storageError?`<div class="notice error">${icon('info')}${esc(storageError)} ${btn('Скачать копию','backup','small')}</div>`:''}${!navigator.onLine?'<div class="notice">Вы офлайн. Слова и прогресс доступны на этом устройстве.</div>':''}${body}</main><footer><span>Lexicon · Пространство для роста</span><span>${icon('check')} <span id="save-state">${esc(statusText(cloudStatus,accountUser))}</span></span></footer></div>`;
}
function heading(title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">${esc(new Intl.DateTimeFormat('ru',{weekday:'long',day:'numeric',month:'long',timeZone:state.settings.timeZone}).format(new Date()))}</div><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>${action}</div>`;}
function progressRing(value,label,sub){return `<div class="progress-ring" role="progressbar" aria-label="${esc(sub)}" aria-valuenow="${Math.round(value)}" aria-valuetext="${esc(label)}" style="--progress:${Math.max(0,Math.min(100,value))*3.6}deg"><div class="ring-center" aria-hidden="true"><strong>${label}</strong><span>${sub}</span></div></div>`;}
function calendar(){const date=today(),d=new Date(`${date}T12:00:00Z`),year=d.getUTCFullYear(),month=d.getUTCMonth(),first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7,days=new Date(Date.UTC(year,month+1,0)).getUTCDate(),sessions=progress().sessions,active=new Set(sessions.map(e=>e.date));
  return `<section class="neo calendar"><div class="panel-title"><h2>Календарь активности</h2>${icon('calendar')}</div><div class="calendar-month">${esc(new Intl.DateTimeFormat('ru',{month:'long',year:'numeric',timeZone:'UTC'}).format(d))}</div><div class="calendar-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span class="weekday">${x}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:days},(_,i)=>{const v=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;return `<span class="calendar-day ${v===date?'is-today':''} ${active.has(v)?'has-activity':''}" title="${v}${active.has(v)?' · занятие':''}" ${v===date?'aria-current="date"':''}>${i+1}</span>`;}).join('')}</div><div class="calendar-legend"><span class="legend-dot"></span> Занятие <span class="legend-dot current"></span> Сегодня</div></section>`;
}
function miniModule(n){const m=progress().modules[n],loaded=wordsOf(n).length===10,status=m?.knownOnly?'Уже известно':m?.stage===5?'Завершён':m?.stage>=0?`R${m.stage+1} · ${fmt(m.nextDate)}`:m?.viewed?'В процессе':loaded?(nextModule(state)===n?'Следующий модуль':'Доступен предпросмотр'):'Ожидает слов';return `<button class="module-mini ${m?.stage>=0||m?.knownOnly?'done':''} ${nextModule(state)===n?'next':''}" data-action="module" data-module="${n}"><span>${String(n).padStart(2,'0')}</span>${m?.stage>=0||m?.knownOnly?icon('check'):nextModule(state)===n?icon('book'):icon('lock')}<small>${status}</small></button>`;}
function dashboard(){const s=stats(),n=nextModule(state),ratio=deck().words.length?s.learnedWords/deck().words.length*100:0,ready=s.q.length>0,hardDue=s.hard.filter(x=>x.date<=today()).length,next=s.q[0];
  const pending=state.session&&state.session.phase!=='result',reviewCount=s.q.length+hardDue;
  const primary=pending?['Продолжить тренировку','resume','Продолжим с сохранённого места.']:
    reviewCount?['Начать повторение','reviews',`Задач на сегодня: ${formatCount(reviewCount)}.`]:
    n?['Начать тренировку','new',`${day(n)} · новых слов: ${wordsOf(n).filter(w=>!s.p.known.has(w.id)&&s.p.wordProgress[w.id].stage<0).length}.`]:null;
  return `${heading('Английский в вашем ритме','',sharedDecks?.admin?btn(`${icon('upload')} Загрузить колоду`,'import','subtle'):'')}
  <div class="dashboard-layout"><div class="dashboard-main"><section class="neo hero">
    <div class="hero-copy"><h2>${pending?'Продолжите занятие':reviewCount?'Время повторить':n?'Следующее занятие':'Все новые слова изучены'}</h2>
      <p>${primary?.[2]||'Даты следующих повторений есть в плане.'}</p>
      <div class="hero-actions">${primary?btn(primary[0]+' '+icon('arrow'),primary[1],'primary'):'<a class="btn primary" href="#today">Открыть план</a>'}</div>
    </div>
    ${progressRing(ratio,`${formatCount(s.learnedWords)} из ${formatCount(deck().words.length)}`,'Изучено слов')}
  </section>
  ${speakingConfig.enabled?'<section class="neo speaking-entry"><div><h2>Разговорная практика</h2><p>Короткий голосовой звонок с AI-тьютором.</p></div><a class="btn subtle" href="#speaking">Открыть</a></section>':''}
  <div class="stat-grid"><div class="neo stat"><span class="stat-icon blue">${icon('book')}</span><div><span>Изучено слов</span><strong>${s.learnedWords}<small>из ${deck().words.length} · уже знаю: ${s.knownWords}</small></strong></div></div><div class="neo stat"><span class="stat-icon violet">${icon('repeat')}</span><div><span>Повторить сегодня</span><strong>${s.due}<small>${s.overdue?'ещё '+s.overdue+' просрочено':'по вашему плану'}</small></strong></div></div><div class="neo stat"><span class="stat-icon green">${icon('check')}</span><div><span>Модулей пройдено</span><strong>${s.learned}<small>из ${new Set(deck().words.map(w=>w.module)).size} загруженных</small></strong></div></div></div>
  <div class="section-title"><h2>Ваш следующий шаг</h2><a href="#today">Весь план ${icon('arrow')}</a></div><div class="next-grid"><section class="neo task-card"><div class="task-top"><span class="tile-icon lavender">${icon('repeat')}</span>${badge(ready?(s.overdue?'Есть просроченные':'Время вспомнить'):'Всё по плану',ready?'warning':'success')}</div><h3>Повторить и закрепить</h3><p>${ready?`${day(next.module)} · R${next.stage+1}<br>${next.count} слов, новые контексты.`:'Пока нет обязательных повторений.<br>После изучения они появятся здесь.'}</p><div class="task-footer"><span>${icon('clock')} ${ready?'~ 10 минут':'Интервалы 1 → 2 → 4 → 7 → 16'}</span>${ready||hardDue?'<a href="#today">К очереди</a>':''}</div></section><section class="neo task-card"><div class="task-top"><span class="tile-icon peach">${icon('spark')}</span>${badge(n?day(n):'Все слова изучены','muted')}</div><h3>${n?'Слова для изучения':'Продолжайте повторять'}</h3><p>${n?`${wordsOf(n).filter(w=>!s.p.known.has(w.id)&&s.p.wordProgress[w.id].stage<0).slice(0,3).map(w=>esc(w.word)).join(' · ')}…<br>${ready?'Сначала закрепим предыдущие слова.':'Небольшой шаг к большому словарю.'}`:'Первичное изучение завершено.<br>Теперь слова проходят цикл SRS.'}</p><div class="task-footer"><span>${icon('book')} ${n?'Новый модуль':'Долговременная память'}</span>${n&&!ready&&!hardDue&&!pending?'<a href="#today">Открыть план</a>':''}</div></section></div>
  <section class="neo roadmap-preview"><div class="panel-title"><div><h2>Путь к ${deck().words.length} словам</h2><p>Один модуль. Десять слов. Ещё немного уверенности.</p></div><a class="text-link" href="#roadmap">Вся карта ${icon('arrow')}</a></div><div class="mini-modules">${Array.from({length:10},(_,i)=>miniModule(i+1)).join('')}</div><div class="roadmap-caption"><span><i class="dot blue-dot"></i> Следующий модуль</span><span><i class="dot"></i> Впереди</span><span class="caption-right">${s.learned} / 100 модулей</span></div></section>
  <div class="starter-note">${icon('info')} ${copy.courseNote(deck())} ${btn(deck().deck.id===CATALOG_ID?copy.about:copy.format,deck().deck.id===CATALOG_ID?'sources':'schema','text-btn')}</div></div>
  <aside class="dashboard-aside">${calendar()}<section class="neo upcoming"><div class="panel-title"><h2>Ближайшие повторения</h2>${icon('clock')}</div>${reviewQueue(state,'9999-12-31').slice(0,3).map(m=>`<button class="upcoming-row" data-action="module" data-module="${m.module}"><span class="date-tile"><strong>${fmt(m.nextDate).split(' ')[0]}</strong><small>${fmt(m.nextDate).split(' ').slice(1).join(' ')}</small></span><span><strong>${day(m.module)}</strong><small>Повторение R${m.stage+1} · ${m.count} слов</small></span>${icon('chevron')}</button>`).join('')||`<div class="empty-mini"><span class="empty-icon">${icon('calendar')}</span><p>Здесь появится ваш<br>личный график повторений</p></div>`}<div class="panel-foot">План подстраивается под вас</div></section><section class="neo difficult-panel"><div class="panel-title"><h2>Сложные слова</h2>${badge(s.hard.length)}</div>${s.hard.length?s.hard.slice(0,3).map(h=>{const w=deck().words.find(w=>w.id===h.wordId);return `<button class="hard-row" data-action="word" data-id="${esc(h.wordId)}"><strong>${esc(w?.word||h.wordId)}</strong><span>${esc(w?.translations[0])}</span></button>`;}).join(''):`<div class="gentle-empty">${icon('leaf')}<p>Пока всё получается.<br>Ошибки — тоже часть пути.</p></div>`}${s.hard.length?btn(`Повторить ${hardDue?'('+hardDue+')':''} ${icon('arrow')}`,'difficult','subtle full'):''}</section></aside></div>`;
}
function todayPage(){const s=stats(),hard=s.hard.filter(h=>h.date<=today()),n=nextModule(state);return `${heading('План на сегодня','Сначала закрепляем знакомое, затем открываем новое.',s.q.length||hard.length?btn(icon('repeat')+' Только повторения','reviews','subtle'):'')}<div class="today-summary"><div class="neo summary-number"><strong>${s.overdue}</strong><span>просрочено</span></div><div class="neo summary-number"><strong>${s.due}</strong><span>повторить сегодня</span></div><div class="neo summary-number"><strong>${hard.length}</strong><span>сложных слов</span></div></div><section class="neo queue-panel"><div class="panel-title"><h2>Ваша очередь</h2>${badge(s.q.length+hard.length+' задач')}</div>${s.q.map(m=>`<div class="queue-row"><span class="tile-icon lavender">${icon('repeat')}</span><div class="queue-copy"><h3>${day(m.module)} <span>Повторение R${m.stage+1}</span></h3><p>${m.count} слов · Active Recall + Fill in the Gaps</p></div><div class="queue-date">${badge(m.nextDate<today()?'Просрочено':'Сегодня',m.nextDate<today()?'danger':'warning')}<small>${fmt(m.nextDate,true)}</small></div>${btn('Повторить '+icon('arrow'),'review','primary small',`data-module="${m.module}" data-stage="${m.stage}"`)}</div>`).join('')}${hard.length?`<div class="queue-row"><span class="tile-icon peach">${icon('flag')}</span><div class="queue-copy"><h3>Точечная практика</h3><p>${hard.length} сложных слов · дополнительная проверка</p></div>${btn('Закрепить','difficult','small')}</div>`:''}${!s.q.length&&!hard.length?`<div class="empty-state">${icon('check')}<h3>Все обязательные повторения выполнены</h3><p>Можно познакомиться с новыми словами или отдохнуть.</p></div>`:''}${n?`<div class="queue-row new-row"><span class="tile-icon blue">${icon('book')}</span><div class="queue-copy"><h3>${day(n)} <span>Новые слова</span></h3><p>${s.q.length||hard.length?'Откроется после обязательных повторений':(wordsOf(n).filter(w=>!s.p.known.has(w.id)&&s.p.wordProgress[w.id].stage<0).length+' слов · в своём темпе')}</p></div>${s.q.length||hard.length?'':btn('Начать '+icon('arrow'),'new','primary')}</div>`:''}</section><div class="notice">${icon('info')} Пропуск не обнуляет прогресс. Следующий срок будет рассчитан от дня, когда вы действительно завершите повторение.</div>`;}
function vocabularyPage(){return `${heading('Ваш словарь','Слова, к которым всегда можно вернуться.',sharedDecks?.admin?btn(icon('upload')+' Загрузить колоду','import','subtle'):'')}${dictionaryNavigation()}<section class="neo vocabulary-panel"><div class="vocabulary-toolbar"><label class="search-field">${icon('search')}<input id="word-search" type="search" placeholder="Найти слово или перевод…" value="${esc(filters.search)}" aria-label="Поиск слов"></label>${btn('Очистить поиск','clear-search','text-btn')}<select id="module-filter" class="neo-select" aria-label="Фильтр по модулю"><option value="">Все модули</option>${[...new Set(deck().words.map(w=>w.module))].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${String(n)===filters.module?'selected':''}>${day(n)}</option>`).join('')}</select><select id="status-filter" class="neo-select" aria-label="Статус изучения">${[['all','Все слова'],['new','Не изучены'],['learned','Изучены'],['known','Уже знаю'],['hard','С ошибками']].map(([v,t])=>`<option value="${v}" ${v===filters.status?'selected':''}>${t}</option>`).join('')}</select></div><div class="table-head"><span>СЛОВО</span><span>ПЕРЕВОД</span><span>МОДУЛЬ</span><span>СТАТУС</span></div><div id="word-list">${wordList()}</div></section>`;}
function wordList(){const p=progress(),term=normalize(filters.search),errorIds=new Set(state.events.filter(e=>e.deckId===state.activeDeckId&&e.type==='attempt'&&!e.correct).map(e=>e.wordId));
  const words=deck().words.filter(w=>(!term||normalize(w.word+' '+w.translations.join(' ')).includes(term))&&(!filters.module||String(w.module)===filters.module)&&(filters.status==='all'||filters.status==='new'&&!p.known.has(w.id)&&p.wordProgress[w.id].stage<0||filters.status==='learned'&&(p.known.has(w.id)||p.wordProgress[w.id].stage>=0)||filters.status==='known'&&p.known.has(w.id)||filters.status==='hard'&&!p.known.has(w.id)&&errorIds.has(w.id)));
  return `<div class="list-count">Найдено ${words.length} из ${deck().words.length} слов${words.length>150?' · показаны первые 150, уточните поиск':''}</div>${words.slice(0,150).map(w=>`<button class="word-row" data-action="word" data-id="${esc(w.id)}"><span><strong>${esc(w.word)}</strong><small>${esc(w.ipa)}</small></span><span>${esc(w.translations.join('; '))}</span><span class="word-module">${day(w.module)}</span><span>${badge(p.known.has(w.id)?'Уже знаю':p.difficult[w.id]?'Требует внимания':p.wordProgress[w.id].stage===5?'Цикл завершён':p.wordProgress[w.id].stage>=0?'На повторении':'Новое',p.known.has(w.id)||p.wordProgress[w.id].stage>=0?'success':p.difficult[w.id]?'warning':'muted')}</span></button>`).join('')||'<div class="empty-state"><h3>Таких слов пока нет</h3><p>Попробуйте другой запрос или измените фильтры.</p><button class="btn subtle" data-action="reset-filters">Сбросить фильтры</button></div>'}`;
}
function roadmapPage(){const s=stats(),count=Math.max(1,...deck().words.map(w=>w.module));return `${heading('Маленькие шаги. Большой путь.','Номер модуля — ваш шаг, а не дата в календаре.',badge(s.learned+' / '+count+' модулей','muted'))}<section class="neo roadmap-explainer"><span class="tile-icon lavender">${icon('map')}</span><div><h2>Знание остаётся с повторением</h2><p>Изучение → R1 (+1 день) → R2 (+2) → R3 (+4) → R4 (+7) → R5 (+16)</p></div></section><div class="roadmap-groups">${Array.from({length:Math.ceil(count/10)},(_,g)=>`<section><div class="section-title"><h2>Глава ${String(g+1).padStart(2,'0')}</h2><span>Модули ${g*10+1}–${Math.min(g*10+10,count)}</span></div><div class="roadmap-grid">${Array.from({length:Math.min(10,count-g*10)},(_,i)=>{const n=g*10+i+1,m=s.p.modules[n],words=wordsOf(n),next=nextModule(state)===n;return `<button class="neo module-card ${next?'current':''}" data-action="module" data-module="${n}"><div><strong>${day(n)}</strong>${icon(m?.knownOnly||m?.stage===5?'check':m?.stage>=0?'repeat':next?'book':'lock')}</div><span>${m?.knownOnly?'Все слова уже известны':m?.stage===5?'Цикл завершён':m?.stage>=0?(m.nextDate<today()?'Просрочено · ':m.nextDate===today()?'Сегодня · ':'Запланировано · ')+'R'+(m.stage+1):m?.viewed?'Материал просмотрен':words.length===10?(next?'Следующий модуль':'Доступен предпросмотр'):'Ожидает импорта'}</span><div class="module-dots" aria-label="${m?.stage>=0?'Пройдено этапов: '+(m.stage+1):'Не начат'}">${Array.from({length:6},(_,j)=>`<i class="${j<=(m?.stage??-1)?'filled':''}"></i>`).join('')}</div><small>${m?.knownOnly?'Без упражнений и SRS':m?.nextDate?'Следующее: '+fmt(m.nextDate):words.length+' / 10 слов'}</small></button>`;}).join('')}</div></section>`).join('')}</div><section class="neo final-card"><div>${icon('flag')}<h2>Итоговая проверка</h2><p>100 EN → RU · 50 RU → EN · 20 контекстов. Станет доступна после R5 или отметки «Уже знаю» для каждого слова и закрытия сложных слов. Проверяет весь курс.</p></div>${btn(icon(finalAvailable()?'flag':'lock')+' '+(courseComplete()?'Пройти итоговый тест ещё раз':'Проверить знания'),'final',finalAvailable()?'primary':'subtle')}</section>`;}
function accuracyMetric(label,type,attempts){
  const answers=attempts.filter(e=>e.exerciseType===type),total=answers.length;
  const correct=answers.filter(e=>e.correct).length;
  const percent=total?Math.round(correct/total*100):null;
  return `<div class="neo metric"><span>${label}</span>
    <strong${total?'':' class="metric-empty"'}>${total?percent+'%':'Нет попыток'}</strong>
    <small>${total?`${formatCount(correct)} из ${formatCount(total)} верных ответов`:'Появится после первого ответа'}</small>
  </div>`;
}
function learningChart(sessions){
  const current=today(),dates=Array.from({length:14},(_,i)=>addDays(current,i-13));
  const totals=new Map(dates.map(date=>[date,0]));
  for(const session of sessions){
    if(session.kind==='initial'&&session.success&&totals.has(session.date)){
      totals.set(session.date,totals.get(session.date)+(session.count??session.wordIds.length));
    }
  }
  const counts=[...totals.values()],sum=counts.reduce((a,b)=>a+b,0),max=Math.max(1,...counts);
  return `<section class="neo chart-panel" aria-labelledby="chart-title">
    <h2 id="chart-title">Первичное изучение за 14 дней</h2>
    <p class="chart-period">${fmt(dates[0],true)} — ${fmt(current,true)}</p>
    <p class="chart-summary">${sum?`Слов в успешно пройденных первых тестах: <strong>${formatCount(sum)}</strong>.`:'За этот период нет успешно пройденных первых тестов.'}</p>
    ${sum?`<div class="learning-chart" aria-hidden="true">${dates.map((date,i)=>`<div class="learning-bar">
      <div class="learning-track"><span style="--bar-height:${counts[i]/max*100}%"></span></div>
      <span>${i%2===0||i===dates.length-1?Number(date.slice(8)):''}</span>
    </div>`).join('')}</div>`:''}
    <details class="chart-details"><summary>Значения по дням</summary>
      <table><caption class="sr-only">Первичное изучение за 14 дней</caption><thead><tr><th scope="col">Дата</th><th scope="col">Слов</th></tr></thead>
        <tbody>${dates.map((date,i)=>`<tr><th scope="row"><time datetime="${date}">${fmt(date,true)}</time></th><td>${formatCount(counts[i])}</td></tr>`).join('')}</tbody>
      </table>
    </details>
  </section>`;
}
function statisticsPage(){
  const s=stats(),attempts=state.events.filter(e=>e.deckId===state.activeDeckId&&e.type==='attempt');
  const last=s.p.sessions.at(-1),errors={};
  for(const a of attempts.filter(e=>!e.correct))errors[a.wordId]=(errors[a.wordId]||0)+1;
  return `${heading('Статистика','Результаты по активной колоде. Точность учитывает все ответы.',btn(icon('download')+' Скачать отчёт','markdown','subtle'))}
  <div class="stats-four">
    <div class="neo metric"><span>Изучено слов</span><strong>${formatCount(s.learnedWords)} <em>из ${formatCount(deck().words.length)}</em></strong><small>В том числе «Уже знаю»: ${formatCount(s.knownWords)}</small></div>
    ${accuracyMetric('Вспомнить слово','recall',attempts)}
    ${accuracyMetric('Заполнить пропуск','gaps',attempts)}
    <div class="neo metric"><span>Полный цикл R1–R5</span><strong>${formatCount(s.mastered)}</strong><small>модулей прошли все интервальные повторения</small></div>
  </div>
  <div class="stats-layout">${learningChart(s.p.sessions)}<section class="neo stage-panel"><h2>Этапы модулей</h2>
    ${Array.from({length:6},(_,i)=>{const n=s.ms.filter(m=>m.stage===i).length;return `<div class="stage-row"><span>${i?'R'+i:'Изучены'}</span><div class="inset track" aria-hidden="true"><i style="width:${n/Math.max(1,s.learned)*100}%"></i></div><strong>${formatCount(n)}</strong></div>`;}).join('')}
  </section></div><div class="stats-layout"><section class="neo"><div class="panel-title"><h2>История занятий</h2>${badge(s.p.sessions.length)}</div>${s.p.sessions.length?`<div class="session-list">${[...s.p.sessions].reverse().slice(0,15).map(e=>`<div class="session-row"><span>${icon(e.success?'check':'repeat')}</span><div><strong>${e.kind==='difficult'?'Сложные слова':e.kind==='final'?'Итоговая проверка':day(e.module)+' · '+(e.stage?'R'+e.stage:'Изучение')}</strong><small>${fmt(e.date,true)} · ${e.scores.recall}/${e.count||10} и ${e.scores.gaps}/${e.count||10}</small></div>${badge(e.success?'Пройдено':'Повторная попытка',e.success?'success':'warning')}</div>`).join('')}</div>`:'<div class="empty-state compact"><p>Ваша история начнётся с первого занятия.</p></div>'}</section><section class="neo"><h2>Слова, которым нужно внимание</h2>${Object.entries(errors).filter(([id])=>!s.p.known.has(id)).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n])=>`<button class="hard-row" data-action="word" data-id="${esc(id)}"><strong>${esc(deck().words.find(w=>w.id===id)?.word||id)}</strong><span>${n} ошибок</span></button>`).join('')||'<div class="gentle-empty">'+icon('leaf')+'<p>Ошибок пока нет.<br>Здесь будет ваша личная зона роста.</p></div>'}</section></div><div class="notice">${icon('info')} Успешных плановых повторений: ${s.p.sessions.filter(e=>e.kind==='review'&&e.success).length}. Просроченных: ${s.overdue}. Первичный тест показывает результат занятия. Долговременное запоминание закрепляется полным циклом повторений.${last?' Последнее занятие: '+fmt(last.date,true)+'.':''}</div>`;
}
function settingsPage(){return `${heading('Всё по-вашему','Ваш темп, ваши данные, ваше пространство.')}<div class="settings-grid">${accountPanel({configured,user:accountUser,status:cloudStatus,guestAvailable})}<section class="neo settings-panel"><h2>${icon('book')} Учебные материалы</h2><label class="field-label" for="deck-select">Активная колода</label><select id="deck-select" class="neo-select full">${deckOptions()}</select><p>Все колоды доступны пользователям. Загрузка и переименование — у администратора. Прогресс каждой колоды сохраняется отдельно.</p><div class="button-row">${sharedDecks?.admin?btn(icon('upload')+' Загрузить JSON-колоду','import','primary'):''}${btn('Скачать пример','sample','subtle')}</div>${btn('Схема и инструкция','schema','text-btn')} ${btn(copy.downloadCourse,'download-course','text-btn')} ${btn(copy.sources,'sources','text-btn')}</section><section class="neo settings-panel"><h2>${icon('calendar')} Ритм занятий</h2><label class="field-label" for="timezone">Часовой пояс</label><select id="timezone" class="neo-select full">${[...new Set([state.settings.timeZone,'Europe/Moscow','Europe/Kaliningrad','Europe/Samara','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Vladivostok','Europe/Berlin','Europe/London','America/New_York','Asia/Tbilisi','Asia/Almaty','UTC'])].map(t=>`<option ${t===state.settings.timeZone?'selected':''}>${t}</option>`).join('')}</select><label class="field-label" for="reminder">Удобное время занятий</label><input type="time" class="neo-input" id="reminder" value="${esc(state.settings.reminder)}"><p>Время — ваш личный ориентир. MVP напоминает о повторениях внутри приложения; push при закрытом браузере не отправляется.</p></section><section class="neo settings-panel"><h2>${icon('sun')} Комфорт</h2><div class="setting-row"><div><strong>Тёмная тема</strong><small>Мягкие поверхности в вечерних оттенках</small></div><button class="switch ${state.settings.theme==='dark'?'on':''}" role="switch" aria-checked="${state.settings.theme==='dark'}" aria-label="Тёмная тема" data-action="theme"><span></span></button></div><div class="setting-row"><div><strong>Произношение</strong><small>Английский голос вашего устройства</small></div><button class="switch ${state.settings.sound?'on':''}" role="switch" aria-checked="${state.settings.sound}" aria-label="Произношение" data-action="sound"><span></span></button></div><p>${'speechSynthesis' in window?'Для озвучки используется синтез речи браузера. Доступность офлайн зависит от установленных голосов.':'В этом браузере озвучка недоступна.'}</p></section><section class="neo settings-panel"><h2>${icon('download')} Резервная копия</h2><p>Сохраните колоды, журнал ответов, очередь SRS и настройки в одном файле. Файл также позволяет перенести прежние результаты с другого адреса сайта.</p><div class="button-row">${btn(icon('download')+' Скачать копию','backup','primary')}${btn(icon('upload')+' Восстановить','restore','subtle')}</div><p class="tiny">Восстановление и импорт словаря — разные операции. Перед заменой данных будет предварительный отчёт.</p>${btn('Отчёт в Markdown','markdown','text-btn')}</section><section class="neo settings-panel danger-zone"><h2>Управление прогрессом</h2><p>Начать заново можно в любой момент. Сброс затрагивает только активную колоду; слова остаются.</p><div class="button-row">${btn('Обнулить прогресс','reset','subtle danger-text')}</div></section></div>`;}
let modalOpener;
function showModal(title,body,wide=false){
  const root=$('#modal-root');
  if(!root.firstElementChild)modalOpener=document.activeElement;
  $('#app').inert=true;
  $('.skip-link').inert=true;
  root.innerHTML=`<div class="modal-backdrop"><section class="modal neo ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Закрыть">${icon('close')}</button></div>${body}</section></div>`;root.querySelector('button, input, select, a')?.focus();
}
function closeModal(){
  const root=$('#modal-root');
  if(!root.firstElementChild)return;
  root.innerHTML='';
  $('#app').inert=false;
  $('.skip-link').inert=false;
  const target=modalOpener?.isConnected?modalOpener:
    document.getElementById(modalOpener?.id||'')||$('#content');
  modalOpener=null;
  target?.focus();
}
function showWord(id){const w=deck().words.find(w=>w.id===id);if(!w)return;const isKnown=progress().known.has(id);const mistakes=state.events.filter(e=>e.deckId===state.activeDeckId&&e.type==='attempt'&&e.wordId===id&&!e.correct);showModal(`${day(w.module)} · Словарь`,`<div class="word-detail"><div class="word-head"><h3 lang="en">${esc(w.word)}</h3>${btn(icon('sound'),'speak','icon-btn',`data-id="${esc(w.id)}" aria-label="Произнести ${esc(w.word)}"`)}</div><div class="ipa">${esc(w.ipa)}</div><p class="word-translation">${esc(w.translations.join('; '))}</p><div class="word-examples">${w.examples.map(e=>`<div><p lang="en">${esc(e.en)}</p>${e.ru?`<span>${esc(e.ru)}</span>`:''}</div>`).join('')}</div>${w.collocations?.length?`<h4>Полезные сочетания</h4><div class="tags">${w.collocations.map(c=>badge(esc(c),'muted')).join('')}</div>`:''}${contextSources(w)}<div class="known-word-action">${badge(isKnown?'Уже знаю · без SRS':'Можно исключить из SRS',isKnown?'success':'muted')}${btn(isKnown?'Вернуть в обучение':'Уже знаю',isKnown?'relearn-word':'known-word',isKnown?'subtle':'primary',`data-id="${esc(w.id)}"`)}<small>${isKnown?'Вернётся в первичное изучение, остальные слова сохранят свой этап.':'Засчитывается в изученное, без упражнений и интервальных повторений.'}</small></div><h4>История ошибок</h4>${mistakes.length?mistakes.slice(-5).reverse().map(e=>`<div class="mistake-item"><span>${fmt(e.date)} · ${e.exerciseType==='recall'?'Active Recall':'Fill in the Gaps'}</span><s>${esc(e.answer||'Без ответа')}</s></div>`).join(''):'<p class="muted">Ошибок пока нет.</p>'}</div>`);}
function showModule(n){const m=progress().modules[n],words=wordsOf(n),q=reviewQueue(state),hard=Object.values(progress().difficult).some(h=>h.date<=today()),next=nextModule(state);showModal(day(n),`<div class="module-detail"><div class="tags">${badge(m?.knownOnly?'Все слова уже известны':m?.stage===5?'Цикл SRS завершён':m?.stage>=0?'Следующий этап R'+(m.stage+1):m?.viewed?'Материал просмотрен':'Не начат',m?.stage>=0?'success':'muted')}${badge(words.length+' слов · уже знаю: '+(m?.knownCount||0),'muted')}</div><div class="module-word-list">${words.map(w=>`<button data-action="word" data-id="${esc(w.id)}"><strong>${esc(w.word)}</strong><span>${esc(w.translations[0])}</span></button>`).join('')||'<p>Слова для этого модуля ещё не загружены. Добавьте JSON-пакет с соответствующим номером модуля.</p>'}</div>${words.length===10&&!m?.knownOnly&&m?.stage!==5&&!q.some(x=>x.module===n)&&(n!==next||q.length||hard)?`<p class="muted">${n!==next?'Этот модуль можно просмотреть. Начните со следующего модуля в плане.':'Сначала завершите обязательные повторения.'}</p>`:''}<dl class="module-meta"><div><dt>Первичное изучение D₀</dt><dd>${fmt(m?.d0,true)}</dd></div><div><dt>Последний первичный тест</dt><dd>${m?.initialScores?m.initialScores.recall+'/'+m.initialCount+' · '+m.initialScores.gaps+'/'+m.initialCount:'—'}</dd></div><div><dt>Последний этап SRS</dt><dd>${m?.stage>0?'R'+m.stage:'—'}</dd></div><div><dt>Следующее повторение</dt><dd>${fmt(m?.nextDate,true)}</dd></div></dl><h4>История попыток</h4>${m?.attempts.length?m.attempts.map(e=>`<div class="attempt-row"><span>${fmt(e.date)} · ${e.stage?'R'+e.stage:'Изучение'}</span><span>${e.scores.recall}/${e.count||10} · ${e.scores.gaps}/${e.count||10}</span>${badge(e.success?'Пройдено':'Повторить',e.success?'success':'warning')}</div>`).join(''):'<p class="muted">Тестирование ещё не проводилось.</p>'}<div class="button-row">${words.length!==10?btn(icon('upload')+' Импорт слов','import','primary'):m?.stage>=0?(q.some(x=>x.module===n)?btn('Повторить '+icon('arrow'),'review','primary',`data-module="${n}"`):btn('Посмотреть слова','preview','subtle',`data-module="${n}"`)):btn((n===next&&!q.length&&!hard?'Изучать':'Посмотреть слова')+' '+icon('arrow'),'preview','primary',`data-module="${n}"`)}</div></div>`,true);}
function showImport(){if(!sharedDecks?.admin)return toast('Загружать колоды может только администратор. Войдите в свой аккаунт.');pendingImport=null;showModal('Добавить новые слова',`<p class="modal-intro">Расширяйте словарь в своём ритме. Уже знакомые слова обновятся по ID — ваши результаты останутся с вами.</p><label class="dropzone" for="import-file"><span class="tile-icon lavender">${icon('upload')}</span><strong>Выберите JSON-файл</strong><span>До 30 МБ · до 10 000 слов</span><input id="import-file" type="file" accept=".json,application/json"></label><div id="import-report"></div><div class="import-help">${btn('Скачать пример пакета','sample','text-btn')}${btn('Посмотреть формат','schema','text-btn')}</div>`,true);}
function showSchema(){showModal('Формат учебного пакета',`<p>Формат: UTF-8 JSON, <code>schemaVersion: 1</code>. Каждое слово имеет постоянный ID, модуль и позицию 1–10, IPA, переводы, два примера и банк контекстов.</p><pre class="code-sample">${esc(JSON.stringify({schemaVersion:1,deck:{id:'my-english',title:'Мой английский',sourceLanguage:'ru',targetLanguage:'en',version:1},words:[{id:'word-001',module:1,position:1,word:'maintain',ipa:'/meɪnˈteɪn/',translations:['поддерживать'],examples:[{en:'We maintain high standards.'},{en:'I maintain a regular routine.'}],clozeItems:[{id:'word-001-c01',en:'We {{gap}} a high level of service.',ru:'Мы поддерживаем высокий уровень обслуживания.',acceptedAnswers:['maintain']}]}]},null,2))}</pre><p>Для целого цикла нужны минимум 6 разных контекстов. В модуле должно быть ровно 10 слов. Неполные модули сохраняются как черновики; нехватка контекстов отмечается отдельно.</p><p>Приложение проверяет структуру, ID и пропуски. Смысловую точность переводов и однозначность предложений проверяйте при подготовке материалов.</p><div class="button-row">${btn('Скачать полный пример (20 слов)','sample','primary')}${btn('Скачать JSON Schema','download-schema','subtle')}</div>`,true);}
async function readJSON(file){if(!file)throw new Error('Выберите файл.');if(file.size>30*1024*1024)throw new Error('Размер файла превышает 30 МБ.');try{return JSON.parse(await file.text());}catch{throw new Error('Не удалось прочитать JSON. Проверьте скобки, запятые и кодировку UTF-8.');}}
async function previewImport(file){try{if(!sharedDecks?.admin)throw new Error('Требуются права администратора.');const pkg=await readJSON(file),report=validatePackage(pkg);if(report.errors.length){$('#import-report').innerHTML=`<div class="notice error"><div><strong>Нужно исправить файл</strong><ul>${report.errors.slice(0,20).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div></div>`;return;}
  const existing=state.decks.find(d=>d.deck.id===pkg.deck.id);const merged=mergePackage(existing,pkg);const oldIds=new Set(existing?.words.map(w=>w.id)||[]);const updated=pkg.words.filter(w=>oldIds.has(w.id)).length;const p=derive(state,pkg.deck.id);const changed=pkg.words.filter(w=>{const old=existing?.words.find(x=>x.id===w.id);return old&&p.modules[old.module]?.stage>=0&&JSON.stringify(old)!==JSON.stringify(w);});
  if(state.session?.deckId===pkg.deck.id&&state.session.phase!=='result')throw new Error('В этой колоде есть незавершённая тренировка. Завершите её перед обновлением материалов.');
  pendingImport={pkg,merged};$('#import-report').innerHTML=`<div class="import-report"><h3>${esc(pkg.deck.title)}</h3><div class="import-numbers"><span><strong>${pkg.words.length-updated}</strong>новых слов</span><span><strong>${updated}</strong>обновлений</span><span><strong>${new Set(merged.words.map(w=>w.module)).size}</strong>модулей</span></div>${changed.length?`<div class="notice warning">Изменятся ${changed.length} уже изученных слов. История и SRS сохранятся, но их прежние результаты относятся к старым текстам.</div>`:''}${report.warnings.length?`<details open><summary>Обратите внимание (${report.warnings.length})</summary><ul>${report.warnings.slice(0,15).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:'<p class="success-text">Структура проверена. Все модули и контексты готовы.</p>'}${btn('Подтвердить импорт '+icon('check'),'confirm-import','primary full')}</div>`;
}catch(e){$('#import-report').innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}
async function confirmImport(){if(!pendingImport)return;if(!sharedDecks?.admin)throw new Error('Требуются права администратора.');const {pkg}=pendingImport;await sharedDecks.publish(pkg);installSharedDecks(state,sharedDecks.rows);progressCache=null;await save();pendingImport=null;closeModal();navigate('vocabulary');toast('Колода опубликована для всех пользователей. Выберите её в списке колод.');}
function download(value,name,type='application/json'){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
function backup(){download({format:'lexicon-backup',version:1,exportedAt:new Date().toISOString(),state},`lexicon-backup-${today()}.json`);toast('Резервная копия подготовлена.');}
function restoreModal(){pendingImport=null;showModal('Восстановить резервную копию',`<p>Выберите полный файл резервной копии Lexicon. Сначала проверим его содержимое, затем попросим подтвердить замену.</p><label class="dropzone" for="restore-file">${icon('upload')}<strong>Выбрать резервную копию</strong><span>JSON · до 30 МБ</span><input id="restore-file" type="file" accept=".json,application/json"></label><div id="restore-report"></div>`);}
async function previewRestore(file){try{const value=await readJSON(file),errors=validateBackup(value);if(errors.length)throw new Error(errors.join('\n'));pendingImport={backup:value};$('#restore-report').innerHTML=`<div class="import-report"><h3>Копия от ${esc(new Date(value.exportedAt||Date.now()).toLocaleString('ru'))}</h3><p>${value.state.decks.length} колод · ${value.state.decks.reduce((a,d)=>a+d.words.length,0)} слов · ${value.state.events.length} событий</p><div class="notice warning">Текущие данные будут заменены целиком. Скачайте их копию перед восстановлением.</div>${btn('1. Скачать текущие данные','backup-before-restore','subtle full')}${btn('2. Заменить данные и восстановить','confirm-restore','primary full','disabled id="restore-confirm"')}</div>`;}catch(e){$('#restore-report').innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}
function markdown(){const p=progress();const rows=Object.values(p.modules).sort((a,b)=>a.module-b.module);download(`# Lexicon — ${deck().deck.title}\n\nДата отчёта: ${today()} (${state.settings.timeZone})\n\nЗагружено слов: ${deck().words.length}\nИзучено слов: ${learningTotals(state,p).learnedWords}\nУже знаю без SRS: ${learningTotals(state,p).knownWords}\nПолный цикл R5: ${rows.filter(m=>m.stage===5).length} модулей\nТрудных слов: ${Object.keys(p.difficult).length}\n\n| Модуль | D₀ | Этап | Следующее повторение | Первичный тест |\n|---|---|---|---|---|\n${rows.map(m=>`| ${day(m.module)} | ${m.d0||'—'} | ${m.knownOnly?'Уже знаю':m.stage<0?'Не изучен':m.stage?'R'+m.stage:'Изучен'} | ${m.nextDate||'—'} | ${m.initialScores?m.initialScores.recall+'/'+m.initialCount+'; '+m.initialScores.gaps+'/'+m.initialCount:'—'} |`).join('\n')}\n\n## Учебные сессии\n${p.sessions.map(e=>`- ${e.date}: ${e.kind==='difficult'?'Сложные слова':e.kind==='final'?'Итоговый тест':day(e.module)}, ${e.success?'успешно':'повторить'}, Recall ${e.scores.recall}/${e.count||10}, Gaps ${e.scores.gaps}/${e.count||10}`).join('\n')}\n\nПервичное изучение не является доказательством долговременного запоминания.\n`,`lexicon-report-${today()}.md`,'text/markdown;charset=utf-8');}

function hasPendingSession(){if(state.session&&state.session.phase!=='result'){closeModal();showModal('У вас есть незавершённое занятие','<p>Все ответы сохранены. Продолжите его перед началом новой тренировки.</p>'+btn('Продолжить занятие '+icon('arrow'),'resume','primary full'));return true;}return false;}
function requiredHard(){return Object.values(progress().difficult).filter(h=>h.date<=today());}
async function train(onlyReviews=false){if(hasPendingSession())return;const q=reviewQueue(state);if(q.length)return startSession(q[0].module,'review');if(requiredHard().length)return startSession(null,'difficult');if(onlyReviews){navigate('today');toast('Обязательных повторений на сегодня нет.');return;}return startNew();}
async function startNew(){if(hasPendingSession())return;if(reviewQueue(state).length||requiredHard().length){navigate('today');toast('Сначала завершите обязательные повторения.');return;}const n=nextModule(state);if(!n){navigate('roadmap');toast('Все загруженные модули изучены. Добавьте новый пакет слов.');return;}await startSession(n,'initial');}
async function previewStudy(n){closeModal();const words=wordsOf(n);if(words.length!==10)return showImport();const body=`<div class="preview-word-grid">${words.map(w=>`<button data-action="word" data-id="${esc(w.id)}"><strong>${esc(w.word)}</strong><span>${esc(w.translations[0])}</span></button>`).join('')}</div>${nextModule(state)===n?btn('Перейти к изучению '+icon('arrow'),'new','primary full'):''}`;log('module_viewed',{module:n});await save();showModal(day(n)+' · 10 слов',body,true);}
async function startSession(n,kind,previousStage){if(hasPendingSession())return;closeModal();const p=progress();let words,stage=0;
  if(kind==='difficult'){const ids=requiredHard().map(h=>h.wordId);words=shuffle(deck().words.filter(w=>ids.includes(w.id)&&!p.known.has(w.id)));}
  else {
    const all=wordsOf(n);if(all.length!==10){toast('Сначала загрузите полный модуль из 10 слов.');return showImport();}
    if(kind==='review'){
      const group=reviewQueue(state).find(m=>m.module===n&&(previousStage===undefined||m.stage===previousStage));if(!group){toast('Срок этого повторения ещё не наступил.');return;}
      words=all.filter(w=>group.wordIds.includes(w.id));stage=group.stage+1;
    }else {
      if(reviewQueue(state).length||requiredHard().length){navigate('today');toast('Сначала завершите обязательные повторения.');return;}
      words=all.filter(w=>!p.known.has(w.id)&&p.wordProgress[w.id].stage<0);
    }
  }
  if(!words.length){navigate('dashboard');toast('Все слова уже известны. Повторения не назначены.');return;}
  const tasks=[...shuffle(words).map(w=>({type:'recall',wordId:w.id})),...shuffle(words).map(w=>{const c=selectContext(w,p.used);return {type:'gaps',wordId:w.id,exerciseId:c.id,reused:p.used.has(c.id)};})];
  state.session={id:uid(),deckId:state.activeDeckId,module:n,kind,stage,startedAt:new Date().toISOString(),wordIds:words.map(w=>w.id),tasks,phase:kind==='initial'?'study':tasks[0].type,index:0,studyIndex:0,answers:[],input:'',feedback:null};
  log('session_started',{sessionId:state.session.id,module:n,kind,stage});if(kind==='initial')log('module_viewed',{module:n});await save();navigate('study');
}
function phaseLabel(type){return {recall:'Active Recall',gaps:'Fill in the Gaps',enru:'English → Русский'}[type]||'Знакомство со словами';}
function exerciseProgress(current,total,label){
  return `<div class="exercise-progress"><div class="track inset" aria-hidden="true"><i style="width:${total?current/total*100:0}%"></i></div><span>${label} ${current} из ${total}</span></div>`;
}
function studyPage(){const a=state.session;if(!a)return `${heading('Время для английского','Небольшой шаг к свободному владению языком.')}<div class="empty-state neo"><h2>Начнём с десяти слов?</h2><p>Сначала познакомимся, затем проверим, что запомнилось.</p>${btn('Начать тренировку '+icon('arrow'),'train','primary')}</div>`;
  if(a.phase==='result')return resultPage(a);
  if(a.exhausted)return `${heading('Все оставшиеся задания выполнены','Посмотрите результат занятия.')}<div class="empty-state neo">${btn('Посмотреть результат','complete-session','primary')}</div>`;
  const words=a.wordIds.map(id=>deck().words.find(w=>w.id===id));
  if(a.phase==='study'){const w=words[a.studyIndex];return `<div class="study-top"><button class="text-btn" data-action="pause">${icon('chevron','back-icon')} Сохранить и выйти</button><span>${day(a.module)} · Знакомство со словами</span>${badge('Шаг 1 из 3','muted')}</div><div class="study-container">${exerciseProgress(a.studyIndex+1,words.length,'Слово')}<section class="neo word-study"><div class="word-label">СЛОВО ${String(a.studyIndex+1).padStart(2,'0')}</div><div class="word-head"><h1 lang="en">${esc(w.word)}</h1>${btn(icon('sound'),'speak','icon-btn',`data-id="${esc(w.id)}" aria-label="Произнести слово"`)}</div><div class="ipa">${esc(w.ipa)}</div><p class="word-translation">${esc(w.translations.join('; '))}</p><div class="known-word-action">${btn(icon('check')+' Уже знаю','known-word','subtle',`data-id="${esc(w.id)}"`)}<small>Исключить из упражнений и повторений</small></div><div class="divider"></div><div class="word-examples">${w.examples.map(e=>`<div><p lang="en">${esc(e.en)}</p>${e.ru?`<span>${esc(e.ru)}</span>`:''}</div>`).join('')}</div>${w.collocations?.length?`<div class="tags">${w.collocations.map(x=>badge(esc(x),'muted')).join('')}</div>`:''}</section><div class="study-controls">${btn('Назад','previous-word','subtle',a.studyIndex===0?'disabled':'') }<span>Не спешите. Прочитайте примеры вслух.</span>${btn(a.studyIndex===words.length-1?'К проверке '+icon('arrow'):'Следующее слово '+icon('arrow'),'next-word','primary')}</div></div>`;}
  const t=a.tasks[a.index],w=deck().words.find(w=>w.id===t.wordId),c=t.type==='gaps'?w.clozeItems.find(c=>c.id===t.exerciseId):null,phaseTasks=a.tasks.filter(x=>x.type===t.type),ix=a.tasks.slice(0,a.index).filter(x=>x.type===t.type).length;
  if(c&&!state.events.some(e=>e.type==='context_shown'&&e.sessionId===a.id&&e.exerciseId===c.id)){log('context_shown',{sessionId:a.id,exerciseId:c.id,wordId:w.id});save();}
  return `<div class="study-top"><button class="text-btn" data-action="pause">${icon('chevron','back-icon')} Сохранить и выйти</button><span>${a.kind==='difficult'?'Сложные слова':a.kind==='final'?'Итоговая проверка':day(a.module)} · ${phaseLabel(t.type)}</span>${badge(a.kind==='initial'?(t.type==='recall'?'Шаг 2 из 3':'Шаг 3 из 3'):a.kind==='review'?'Повторение R'+a.stage:'Дополнительная практика','muted')}</div><div class="study-container">${exerciseProgress(ix+1,phaseTasks.length,'Вопрос')}<section class="neo exercise-card ${a.kind==='review'||a.kind==='difficult'?'with-speech':''}">${a.kind==='review'||a.kind==='difficult'?btn(icon('sound'),'speak','icon-btn exercise-speak',`type="button" data-id="${esc(w.id)}" aria-label="Озвучить слово" title="Озвучить слово"`):''}<div class="exercise-kicker">${t.type==='gaps'?'ВОССТАНОВИТЕ СЛОВО В КОНТЕКСТЕ':t.type==='enru'?'ВСПОМНИТЕ РУССКОЕ ЗНАЧЕНИЕ':'ВСПОМНИТЕ АНГЛИЙСКОЕ СЛОВО'}</div>${t.reused?'<div class="context-notice">Новые контексты закончились: это предложение уже встречалось. Добавьте упражнения через импорт.</div>':''}<h1 class="exercise-question ${t.type==='gaps'?'cloze-question':''}" lang="${t.type==='recall'?'ru':'en'}">${c?esc(c.en).replace('{{gap}}','<span class="gap">_____</span>'):esc(t.type==='enru'?w.word:w.recallPrompt||w.translations.join('; '))}</h1>${c?`<p class="exercise-translation">${esc(c.ru)}</p>`:'<p class="exercise-translation">'+(t.type==='enru'?'Введите одно из русских значений':'Без подсказок. Только вы и ваша память.')+'</p>'}<form id="answer-form" aria-label="Ответ на вопрос ${ix+1}"><label for="answer" class="sr-only">${t.type==='enru'?'Русский перевод':'Английское слово'}</label><input id="answer" data-session-id="${esc(a.id)}" data-task-index="${a.index}" data-task-id="${esc(t.attemptId)}" data-phase="${esc(a.phase)}" class="neo-input answer-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${t.type==='enru'?'ru':'en'}" placeholder="${t.type==='enru'?'Введите перевод…':'Введите английское слово…'}" value="${esc(a.input)}" ${a.feedback?'disabled':''} aria-describedby="answer-help"><div id="answer-help" class="input-hint">${a.feedback?'':t.type==='gaps'?'Введите только пропущенное слово':'Регистр и пробелы по краям не учитываются'}</div>${a.feedback?feedbackHTML(a,w,c):btn('Проверить '+icon('arrow'),'check','primary full','type="submit"')}</form>${a.kind!=='final'&&!a.feedback?`<div class="known-word-action">${btn('Уже знаю это слово','known-word','text-btn',`data-id="${esc(w.id)}" type="button"`)}</div>`:''}</section><div class="exercise-foot">${icon('lock')} Ответ сохраняется автоматически <span>Enter — ${a.feedback?(a.index===a.tasks.length-1?'посмотреть результат':'продолжить'):'проверить'}</span></div></div>`;
}
function feedbackHTML(a,w,c){const f=a.feedback;return `<div class="answer-feedback ${f.correct?'correct':'incorrect'}" role="status"><div>${icon(f.correct?'check':'info')}<strong>${f.correct?'Верно!':f.typo?'Похоже на опечатку':'Пока не получилось'}</strong></div>${!f.correct?`<p>${f.typo?'Опечатка не засчитывается. ':''}Правильный ответ: <strong lang="en">${esc(f.accepted.join(' / '))}</strong></p>`:''}${c?`<p lang="en">${esc(c.en.replace('{{gap}}',c.acceptedAnswers[0]))}</p><span>${esc(c.ru)}</span>`:`<p>${esc(w.word)} — ${esc(w.translations.join('; '))}</p>`}</div>${btn(a.index===a.tasks.length-1?'Посмотреть результат '+icon('arrow'):'Продолжить '+icon('arrow'),'next-question','primary full','type="button"')}`;}
async function checkCurrent(){const a=state.session;if(!a||a.feedback||a.phase==='result'||a.phase==='study')return;const answer=$('#answer')?.value??a.input;if(!normalize(answer)){toast('Введите ответ или «—», если пока не помните слово.');$('#answer')?.focus();return;}const t=a.tasks[a.index],w=deck().words.find(w=>w.id===t.wordId),c=t.type==='gaps'?w.clozeItems.find(c=>c.id===t.exerciseId):null,accepted=c?c.acceptedAnswers:t.type==='enru'?w.translations:[w.word,...(w.acceptedAnswers||[])];const result=checkAnswer(answer,accepted);const attempt={id:t.attemptId||`${a.id}:attempt:${a.index}`,type:'attempt',at:new Date().toISOString(),date:today(),deckId:state.activeDeckId,sessionId:a.id,wordId:w.id,exerciseId:c?.id||`${w.id}:${t.type}`,exerciseType:t.type,answer,...result};appendEvent(state,attempt);a.answers.push(attempt);a.input=answer;a.feedback={...result,accepted};await save();render();$('[data-action="next-question"]')?.focus();}
async function nextQuestion(){const a=state.session;if(!a?.feedback)return;if(a.index>=a.tasks.length-1){await completeSession();return;}a.index++;a.phase=a.tasks[a.index].type;a.feedback=null;a.input='';try{localStorage.removeItem('lexicon-draft');}catch{}await save();render();$('#answer')?.focus();}
async function completeSession(){const a=state.session;if(!a||a.phase==='result')return;
  const result=sessionScores(a),{scores,counts,success,missed}=result;
  appendEvent(state,{...makeEvent(state,'session_completed'),id:`${a.id}:completed`,sessionId:a.id,module:a.module,stage:a.stage,kind:a.kind,scores,counts,success,missed,wordIds:[...a.wordIds],count:a.wordIds.length});
  a.result=result;a.phase='result';a.feedback=null;delete a.exhausted;
  try{localStorage.removeItem('lexicon-draft');}catch{}await save();render();window.scrollTo({top:0,behavior:'instant'});
}
function resultPage(a){const r=a.result,p=progress(),m=p.modules[a.module],nextReview=reviewQueue(state,'9999-12-31').find(g=>g.module===a.module),count=a.wordIds.length,counts=r.counts||{recall:a.kind==='final'?50:count,gaps:a.kind==='final'?20:count,enru:100},missed=r.missed.filter(id=>!p.known.has(id));return `<div class="result-container"><div class="result-heading"><span class="result-medallion ${r.success?'':'retry'}">${icon(r.success?'check':'repeat')}</span><div class="eyebrow">${a.kind==='difficult'?'Дополнительная практика':a.kind==='final'?'Итоговая проверка':day(a.module)}</div><h1>${r.success?'Ещё один шаг вперёд.':'Закрепим ещё немного.'}</h1><p>${r.success?(cloudStatus.localError?'Не удалось сохранить результат. Скачайте резервную копию в настройках.':'Проверка завершена. Здесь показаны ваши результаты.'):`Для успеха нужно минимум ${Math.ceil(counts.recall*.8)} из ${counts.recall} в Active Recall и ${Math.ceil(counts.gaps*.8)} из ${counts.gaps} в Fill in the Gaps.`}</p><p id="result-save-state" role="status">${esc(statusText(cloudStatus,accountUser))}</p></div><div class="result-scores">${a.kind==='final'?`<section class="neo"><span>English → Русский</span><strong>${r.scores.enru}<em> / 100</em></strong></section>`:''}<section class="neo"><span>Active Recall</span><strong>${r.scores.recall}<em> / ${counts.recall}</em></strong>${badge(r.scores.recall>=Math.ceil(counts.recall*.8)?'Порог достигнут':'Нужна практика',r.scores.recall>=Math.ceil(counts.recall*.8)?'success':'warning')}</section><section class="neo"><span>Fill in the Gaps</span><strong>${r.scores.gaps}<em> / ${counts.gaps}</em></strong>${badge(r.scores.gaps>=Math.ceil(counts.gaps*.8)?'Порог достигнут':'Нужна практика',r.scores.gaps>=Math.ceil(counts.gaps*.8)?'success':'warning')}</section></div>${a.kind==='initial'||a.kind==='review'?`<div class="notice ${r.success?'success':''}">${icon('calendar')} ${r.success?(nextReview?`Следующее повторение: ${fmt(nextReview.nextDate,true)} · R${nextReview.stage+1}.`:'Поздравляем! Для этого модуля завершён весь цикл R1–R5.'):(a.kind==='review'?`Этап SRS сохранён. Повторная проверка — ${fmt(m.nextDate,true)}.`:'Модуль ещё не изучен. Повторите материалы и попробуйте снова.')}</div>`:''}${missed.length?`<section class="neo result-errors"><h2>Слова для закрепления: ${missed.length}</h2><p>Дополнительная проверка назначена на ${fmt(addDays(today(),1),true)}.</p>${a.answers.filter(x=>!x.correct&&!p.known.has(x.wordId)).map(e=>{const w=deck().words.find(w=>w.id===e.wordId),c=w.clozeItems.find(c=>c.id===e.exerciseId);return `<div class="error-review"><div><strong>${esc(w.word)}</strong>${badge(e.typo?'Опечатка':phaseLabel(e.exerciseType),'muted')}</div><p><s>${esc(e.answer)}</s> ${icon('arrow')} <strong>${esc(c?.acceptedAnswers[0]||w.word)}</strong></p><p lang="en">${esc(c?c.en.replace('{{gap}}',c.acceptedAnswers[0]):w.examples[0].en)}</p><span>${esc(c?.ru||w.examples[0].ru||w.translations.join('; '))}</span></div>`;}).join('')}</section>`:'<p class="perfect-note">'+icon('spark')+' Ни одного слова в списке сложных. Отличная работа.</p>'}<div class="button-row centered">${btn('Вернуться к обзору','finish','subtle')}${btn(r.success?'К плану на сегодня '+icon('arrow'):'Попробовать ещё раз '+icon('repeat'),'after-result','primary')}</div><p class="tiny center">Один успешный тест — начало. Долговременная память формируется повторениями.</p></div>`;}

async function startFinal(){const p=progress(),numbers=[...new Set(deck().words.map(w=>w.module))];if(deck().words.length<1000||numbers.length<100||deck().words.some(w=>!p.known.has(w.id)&&p.wordProgress[w.id]?.stage!==5)||Object.keys(p.difficult).length){toast('Итоговая проверка откроется после загрузки 1000 слов, R5 или отметки «Уже знаю» для каждого слова и закрытия сложных слов.');return;}if(hasPendingSession())return;const tasks=[...shuffle(deck().words).slice(0,100).map(w=>({type:'enru',wordId:w.id})),...shuffle(deck().words).slice(0,50).map(w=>({type:'recall',wordId:w.id})),...shuffle(deck().words).slice(0,20).map(w=>{const c=selectContext(w,p.used);return {type:'gaps',wordId:w.id,exerciseId:c.id,reused:p.used.has(c.id)};})];state.session={id:uid(),deckId:state.activeDeckId,module:null,kind:'final',stage:5,startedAt:new Date().toISOString(),wordIds:[...new Set(tasks.map(t=>t.wordId))],tasks,phase:'enru',index:0,answers:[],input:'',feedback:null};log('session_started',{sessionId:state.session.id,kind:'final'});await save();navigate('study');}
function speakingPage(){
  const title=heading('Разговорная практика','');
  if(!speakingConfig.enabled)return title+'<p>Раздел пока недоступен.</p>';
  if(!accountUser)return title+'<p><a class="btn primary" href="#settings">Войти в Lexicon</a></p>';
  return title+'<div id="speaking-root"><p role="status">Загружаем голосовой раздел…</p></div>';
}
function clearSpeaking(){
  const closing=unmountSpeaking?.();
  unmountSpeaking=undefined;
  speakingView=undefined;
  speakingAccount=undefined;
  return closing;
}
function mountSpeakingPage(){
  const root=$('#speaking-root');
  if(!root)return;
  speakingView=root;
  speakingAccount=accountUser.id;
  import('./speaking.js?v=3').then(({mountSpeaking})=>{
    if(speakingView!==root||route!=='speaking')return;
    unmountSpeaking=mountSpeaking(root,{
      endpoint:speakingConfig.endpoint||new URL('/functions/v1/tutor',cloudConfig.url).href,
      publishableKey:cloudConfig.publishableKey,
      getAccessToken:async()=>{
        const {data}=await cloud.client.auth.getSession();
        return data.session?.user.id===speakingAccount?data.session.access_token:null;
      },
    });
  }).catch(()=>{if(speakingView===root)root.textContent='Не удалось загрузить голосовой раздел. Обнови страницу.';});
}
function render(){
  document.documentElement.dataset.theme=state.settings.theme;
  const app=$('#app');
  if(route==='speaking'&&speakingView&&speakingAccount===accountUser?.id){
    const themeButton=app.querySelector('[data-action="theme"]');
    const dark=state.settings.theme==='dark';
    themeButton?.setAttribute('aria-label',dark?'Светлая тема':'Тёмная тема');
    if(themeButton)themeButton.innerHTML=icon(dark?'sun':'moon');
    paintCloudStatus();
    return;
  }
  if(speakingView)clearSpeaking();
  app.dataset.route=route;
  const pages={dashboard,today:todayPage,vocabulary:vocabularyPage,dictionary:externalDictionaryPage,favorites:favoritesPage,roadmap:roadmapPage,statistics:statisticsPage,settings:settingsPage,study:studyPage,speaking:speakingPage};
  app.innerHTML=shell((['dictionary','favorites','speaking'].includes(route)?'':deckBar())+(pages[route]||dashboard)());
  if(route==='speaking')mountSpeakingPage();
  if(route==='study'&&state.session?.phase!=='study'&&!state.session?.feedback)requestAnimationFrame(()=>$('#answer')?.focus());
}
async function actions(action,el){
  if(action==='close')return closeModal();
  if(action==='dictionary-speak')return pronounceWord(el.dataset.word);
  if(action==='favorite-pronunciation'){
    const target=favorites,row=target.rows.find(r=>r.entry_key===el.dataset.key);
    if(!row||!accountUser||target.pending.has(row.entry_key))return;
    target.pending.add(row.entry_key);render();
    try{
      const entries=await lookupWord(row.word,{revision:row.source_revision,signal:AbortSignal.timeout(20000)});
      const original=entries.find(e=>e.translation===row.translation);
      if(!original)throw new Error('Не удалось найти сохранённое значение в исходной статье.');
      await target.addPronunciations(row,original.pronunciations);
      if(target===favorites)toast(original.pronunciations.length?'Произношение сохранено.':'В исходной статье нет транскрипции. Доступна кнопка «Озвучить».');
    }finally{
      target.pending.delete(row.entry_key);
      if(target===favorites&&route==='favorites'){
        render();
        $('#content')?.focus({preventScroll:true});
      }
    }
    return;
  }
  if(action==='favorites-refresh')return refreshFavorites();
  if(action==='favorite-add'){
    const entry=dictionary.results[Number(el.dataset.index)];
    if(!entry||!accountUser)return;
    const target=favorites,identity=resultIdentity(entry);
    if(target.pending.has(identity))return;
    target.pending.add(identity);paintDictionaryResults();
    try{
      await target.add(entry);
      if(target===favorites)toast('Слово и выбранное значение сохранены в избранном.');
    }finally{
      target.pending.delete(identity);
      paintDictionaryResults();
    }
    return;
  }
  if(action==='clear-search'||action==='reset-filters'){
    filters.search='';
    if(action==='reset-filters'){
      filters.module='';filters.status='all';
      $('#module-filter').value='';$('#status-filter').value='all';
    }
    $('#word-search').value='';
    $('#word-list').innerHTML=wordList();
    $('#word-search').focus();
    return;
  }
  if(action==='open-registration'&&cloudConfig.emailsConfigured&&!accountUser)return showModal('Регистрация',registrationForm($('#account-email')?.value));
  if(action==='resend-registration')return sendRegistration(el.closest('form'),true);
  if(action==='refresh-decks')return refreshDecks();
  if(action==='rename-deck'){if(!sharedDecks?.admin)throw new Error('Требуются права администратора.');return showModal('Переименовать колоду',`<label for="deck-title">Название для всех пользователей</label><input id="deck-title" class="neo-input full" maxlength="200" value="${esc(deck().deck.title)}">${btn('Сохранить название','save-deck-title','primary full')}`);}
  if(action==='save-deck-title'){const title=$('#deck-title').value.trim();const pkg=structuredClone(sharedDecks?.rows.find(r=>r.id===state.activeDeckId)?.package||deck());pkg.deck.title=title;await sharedDecks.publish(pkg);installSharedDecks(state,sharedDecks.rows);await save();closeModal();render();return toast('Название колоды обновлено для всех пользователей.');}

  if(action==='complete-session')return completeSession();
  if(action==='known-word'||action==='relearn-word'){
    const known=action==='known-word';setWordKnown(state,el.dataset.id,known);try{localStorage.removeItem('lexicon-draft');}catch{}
    if(!await save())return;closeModal();if(route==='study'&&!state.session)navigate('dashboard');else render();
    return toast(known?'Слово уже знакомо. Оно исключено из урока и SRS.':'Слово возвращено в первичное изучение.');
  }
  if(action.startsWith('cloud-'))return cloudAction(action,el);
  if(action==='theme'){state.settings.theme=state.settings.theme==='dark'?'light':'dark';await save();return render();}
  if(action==='notifications'){closeModal();return navigate('today');}
  if(action==='train')return train();
  if(action==='reviews')return train(true);
  if(action==='new')return startNew();
  if(action==='review')return startSession(Number(el.dataset.module),'review',el.dataset.stage===undefined?undefined:Number(el.dataset.stage));
  if(action==='difficult'){if(hasPendingSession())return;return startSession(null,'difficult');}
  if(action==='word')return showWord(el.dataset.id);
  if(action==='module')return showModule(Number(el.dataset.module));
  if(action==='preview')return previewStudy(Number(el.dataset.module));
  if(action==='import')return showImport();
  if(action==='schema')return showSchema();
  if(action==='sample')return download(starter,'lexicon-starter-20-words.json');
  if(action==='download-course'){if(!bundledCatalog){const r=await fetch(CATALOG_URL);if(!r.ok)throw new Error('Course unavailable');bundledCatalog=await r.json();}return download(bundledCatalog,'lexicon-b1-b2-1000-full-srs.json');}
  if(action==='sources')return showModal(copy.courseTitle,courseSourcesHTML(),true);
  if(action==='download-sources'){const r=await fetch('./data/sources.md');if(!r.ok)throw new Error('Source file unavailable');return download(await r.text(),'lexicon-course-sources.md','text/markdown;charset=utf-8');}
  if(action==='download-schema'){const res=await fetch('./data/import.schema.json');return download(await res.json(),'lexicon-import.schema.json');}
  if(action==='confirm-import')return confirmImport();
  if(action==='backup')return backup();
  if(action==='restore')return restoreModal();
  if(action==='backup-before-restore'){backup();$('#restore-confirm').disabled=false;return;}
  if(action==='confirm-restore'){if(!pendingImport?.backup)return;const previous=state;state=structuredClone(pendingImport.backup.state);delete state.sync;if(!await save()){state=previous;return;}try{localStorage.removeItem('lexicon-draft');}catch{}closeModal();navigate('dashboard');return toast('Резервная копия восстановлена.');}
  if(action==='markdown')return markdown();
  if(action==='resume'){closeModal();if(state.session)state.activeDeckId=state.session.deckId;await save();return navigate('study');}
  if(action==='pause'){await save();navigate('dashboard');return;}
  if(action==='next-word'){const a=state.session;if(!a||a.phase!=='study')return;if(a.studyIndex<a.wordIds.length-1)a.studyIndex++;else{a.phase='recall';a.index=0;}await save();return render();}
  if(action==='previous-word'){if(state.session?.studyIndex>0)state.session.studyIndex--;await save();return render();}
  if(action==='check')return checkCurrent();
  if(action==='next-question')return nextQuestion();
  if(action==='finish'){state.session=null;finishPendingCatalogActivation(state);await save();navigate('dashboard');return;}
  if(action==='after-result'){const a=state.session,success=a.result.success;state.session=null;finishPendingCatalogActivation(state);await save();if(a.deckId!==state.activeDeckId){navigate('dashboard');toast(copy.ready);return;}if(success)return navigate('today');if(a.kind==='final')return startFinal();if(a.kind==='review'||a.kind==='difficult'){navigate('today');toast('Следующая попытка назначена на завтра.');return;}return startSession(a.module,a.kind);}
  if(action==='final')return startFinal();
  if(action==='sound'){state.settings.sound=!state.settings.sound;await save();return render();}
  if(action==='speak'){const w=deck().words.find(w=>w.id===el.dataset.id);if(w)pronounceWord(w.word,deck().deck.pronunciation||'en-GB');return;}
  if(action==='reset'||action==='delete-deck'){if(action==='delete-deck'&&state.decks.length===1)return toast('Сначала добавьте другую колоду. Единственную колоду можно только обнулить.');showModal(action==='reset'?'Начать с чистого листа?':'Удалить эту колоду?',`<p>${action==='reset'?'Все результаты, ответы и расписание повторений активной колоды будут удалены. Слова останутся.':'Колода и вся её история будут удалены с этого устройства.'}</p><p>Сначала сохраните резервную копию. Затем станет доступно подтверждение.</p>${btn('Скачать резервную копию','backup-before-reset','subtle full')}${btn(action==='reset'?'Обнулить прогресс':'Удалить колоду','confirm-reset','danger full',`data-mode="${action}" disabled id="reset-confirm"`)}`);return;}
  if(action==='backup-before-reset'){backup();$('#reset-confirm').disabled=false;return;}
  if(action==='confirm-reset'){state.events=state.events.filter(e=>e.deckId!==state.activeDeckId);if(state.session?.deckId===state.activeDeckId)state.session=null;if(el.dataset.mode==='delete-deck'){state.decks=state.decks.filter(d=>d.deck.id!==state.activeDeckId);state.activeDeckId=state.decks[0].deck.id;}try{localStorage.removeItem('lexicon-draft');}catch{}await save();closeModal();navigate('dashboard');return toast('Готово. Можно начать заново.');}
  if(action==='help')return showModal('Десять слов. Пять повторений.',`<div class="help-steps"><div><span>01</span><section><h3>Познакомьтесь</h3><p>10 слов, транскрипции, переводы и живые примеры.</p></section></div><div><span>02</span><section><h3>Вспомните сами</h3><p>Переведите с русского на английский и заполните пропуски. Нужны 80% отдельно в каждом упражнении. «Уже знаю» исключает слово из урока и SRS; новые слова взамен не добавляются.</p></section></div><div><span>03</span><section><h3>Возвращайтесь к знакомому</h3><p>Повторяйте через 1, 2, 4, 7 и 16 дней после предыдущего успешного этапа. Пропуски сдвигают план, а не обнуляют его.</p></section></div></div><div class="notice">Без аккаунта прогресс хранится в этом браузере. Войдите в настройках, чтобы продолжать занятия на других устройствах. Резервную копию можно скачать в любое время.</div>`);
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled){e.preventDefault();actions(el.dataset.action,el).catch(err=>{console.error(err);toast('Не удалось выполнить действие. '+err.message);});}if(e.target.classList.contains('modal-backdrop'))closeModal();});
document.addEventListener('submit',e=>{if(e.target.id==='dictionary-search-form'){e.preventDefault();searchDictionary();return;}if(e.target.id==='registration-form'){e.preventDefault();sendRegistration(e.target);return;}if(e.target.id==='new-password-form'){e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;cloud.updatePassword($('#new-password').value).then(()=>{history.replaceState(null,'',location.pathname+'#settings');closeModal();toast('Пароль обновлён.');}).catch(err=>authMessage(err.message)).finally(()=>button.disabled=false);return;}if(e.target.id==='cloud-auth-form'){e.preventDefault();cloudAction('cloud-login',e.target.querySelector('button')).catch(err=>authMessage(err.message));return;}if(e.target.id==='answer-form'){e.preventDefault();if(state.session?.feedback)nextQuestion();else checkCurrent();}});
document.addEventListener('input',e=>{if(e.target.id==='dictionary-query')dictionary.query=e.target.value;if(e.target.id==='answer'){const a=state.session;if(!a)return;a.input=e.target.value;try{localStorage.setItem('lexicon-draft',JSON.stringify({sessionId:a.id,index:a.index,taskId:a.tasks[a.index]?.attemptId,phase:a.phase,input:a.input}));}catch{}clearTimeout(saveTimer);saveTimer=setTimeout(save,250);}if(e.target.id==='word-search'){filters.search=e.target.value;$('#word-list').innerHTML=wordList();}});
document.addEventListener('change',async e=>{const el=e.target;try{if(el.id==='import-file')await previewImport(el.files[0]);if(el.id==='restore-file')await previewRestore(el.files[0]);if(el.id==='module-filter'){filters.module=el.value;$('#word-list').innerHTML=wordList();}if(el.id==='status-filter'){filters.status=el.value;$('#word-list').innerHTML=wordList();}if(el.id==='timezone'){state.settings.timeZone=el.value;await save();render();toast('Часовой пояс обновлён.');}if(el.id==='reminder'){state.settings.reminder=el.value;await save();toast('Время занятий сохранено.');}if((el.id==='deck-select'||el.id==='catalog-deck-select')){if(state.session&&state.session.phase!=='result'){render();toast('Сначала завершите текущую тренировку.');return;}state.session=null;state.activeDeckId=el.value;filters={search:'',module:'',status:'all'};await save();render();}}catch(err){toast(err.message);}});
document.addEventListener('keydown',e=>{const modal=$('[role="dialog"]');if(modal){if(e.key==='Escape')closeModal();if(e.key==='Tab'){const els=[...modal.querySelectorAll('button:not(:disabled),a[href],input,select,summary,[tabindex="0"]')].filter(x=>x.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}if(e.key==='Enter'&&route==='study'&&state.session?.feedback&&e.target.tagName!=='BUTTON'){e.preventDefault();nextQuestion();}});
$('.skip-link').addEventListener('click',e=>{
  const main=$('#content');
  if(!main)return;
  e.preventDefault();
  main.focus();
  main.scrollIntoView({block:'start'});
});
window.addEventListener('hashchange',()=>{
  const next=location.hash.slice(1)||'dashboard';
  if(next===route)return;
  closeModal();
  route=next;
  render();
  window.scrollTo({top:0,behavior:'instant'});
  if(route!=='study')$('#content')?.focus({preventScroll:true});
  if(route==='favorites'&&accountUser)refreshFavorites();
});
window.addEventListener('online',()=>{render();cloud?.sync();});window.addEventListener('offline',()=>{if(accountUser)cloudStatus.mode='offline';render();});
async function refreshLocal(){if(!state)return;const activeScope=scope;const saved=await readState(activeScope);if(saved&&activeScope===scope){const before=JSON.stringify(state.session);applySaved(saved);if(route!=='study'||before!==JSON.stringify(state.session))render();}cloud?.sync();}
window.addEventListener('storage',e=>{if(e.key==='lexicon-storage-changed'){try{if(JSON.parse(e.newValue)?.scope===scope)refreshLocal().catch(console.warn);}catch{}}});
document.addEventListener('visibilitychange',()=>{if(!state)return;if(document.hidden){if(saveTimer)save();}else refreshLocal().catch(console.warn);});
async function init(){const idb=await openStorage();try{state=await readState();}catch{storageError='Не удалось открыть сохранённые данные. Перезагрузите страницу; данные не перезаписаны.';$('#app').innerHTML=`<div class="boot">Не удалось открыть базу данных<span>Перезагрузите страницу. Существующие данные не перезаписаны.</span></div>`;return;}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(CATALOG_URL,{signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);bundledCatalog=await response.json();const installed=installCatalog(state,bundledCatalog);state=installed.state;if(installed.changed)await save();}
  catch(error){console.warn('Course unavailable:',error.message);storageError=copy.loadingError;}
  finally{clearTimeout(timeout);}
  if(!state){state={version:1,activeDeckId:starter.deck.id,decks:[structuredClone(starter)],events:[],settings:{timeZone:'Europe/Moscow',reminder:'19:00',theme:'light',sound:true},session:null};await save();}
  if(!idb)storageError='IndexedDB недоступна. Используется резервное хранилище браузера; регулярно скачивайте копию.';
  reconcileKnownSession(state);
  try{const draft=JSON.parse(localStorage.getItem('lexicon-draft')),a=state.session;if(a&&draft?.sessionId===a.id&&draft.index===a.index&&draft.taskId===a.tasks[a.index]?.attemptId&&draft.phase===a.phase&&!a.feedback)a.input=draft.input;}catch{}
  if(!state.sync)await save(false);
  render();await startCloud();setInterval(()=>{if(!document.hidden&&accountUser)refreshDecks();},60000);if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init().catch(err=>{console.error(err);$('#app').innerHTML='<div class="boot">Не удалось запустить приложение<span>Попробуйте перезагрузить страницу. Ваши данные не удалены.</span></div>';});
