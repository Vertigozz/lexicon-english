export const INTERVALS = [1, 2, 4, 7, 16];
export const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en');
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function localDate(timeZone = 'Europe/Moscow', date = new Date()) {
  const p = new Intl.DateTimeFormat('en', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(t => p.find(x=>x.type===t).value).join('-');
}
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
export function isDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value; }
export function editDistance(a,b) {
  let row = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]!==b[j-1])); row=next;} return row[b.length];
}
export function checkAnswer(answer, accepted) {
  const a=normalize(answer), targets=accepted.map(normalize);
  const correct=targets.includes(a);
  return {correct, typo:!correct && a.length>2 && targets.some(t=>t.length>2 && editDistance(a,t)===1)};
}
export function shuffle(items) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
export function makeEvent(state,type,data={}) {
  return {id:uid(),type,at:new Date().toISOString(),date:localDate(state.settings.timeZone),deckId:state.activeDeckId,...data};
}
export function appendEvent(state,event) { if(!state.events.some(x=>x.id===event.id)) state.events.push(event); }
export function derive(state,deckId=state.activeDeckId) {
  const modules={}, difficult={}, used=new Set(), sessions=[];
  const get=n=>modules[n] ||= {module:n,stage:-1,d0:null,nextDate:null,lastSuccessDate:null,viewed:false,attempts:[],initialScores:null};
  for(const e of state.events){
    if(e.deckId!==deckId)continue;
    if(e.type==='module_viewed')get(e.module).viewed=true;
    if(e.type==='context_shown')used.add(e.exerciseId);
    if(e.type==='legacy_import'){
      Object.assign(get(1),{stage:0,d0:'2026-11-04',nextDate:'2026-11-05',lastSuccessDate:'2026-11-04',initialScores:{recall:10,gaps:10},legacy:true});get(2).viewed=true;
    }
    if(e.type==='session_completed'){
      sessions.push(e);
      if(e.kind==='difficult'){
        for(const id of e.wordIds){if(e.missed.includes(id))difficult[id]={wordId:id,date:addDays(e.date,1)};else delete difficult[id];} continue;
      }
      if(e.kind==='final')continue;
      const m=get(e.module);m.attempts.push(e);m.viewed=true;
      if(e.success){
        if(e.stage!==m.stage+1 || (m.lastSuccessDate===e.date && e.stage>0))continue;
        m.stage=e.stage;m.lastSuccessDate=e.date;
        if(e.stage===0){m.d0=e.date;m.initialScores=e.scores;}
        m.nextDate=e.stage<5?addDays(e.date,INTERVALS[e.stage]):null;
      } else if(m.stage>=0){m.nextDate=addDays(e.date,1);}
      for(const id of e.missed)difficult[id]={wordId:id,date:addDays(e.date,1)};
    }
  }
  return {modules,difficult,used,sessions};
}
export function reviewQueue(state,date=localDate(state.settings.timeZone),deckId=state.activeDeckId) {
  return Object.values(derive(state,deckId).modules).filter(m=>m.stage>=0&&m.stage<5&&m.nextDate<=date&&m.lastSuccessDate!==date).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)||a.module-b.module);
}
export function nextModule(state,deckId=state.activeDeckId) {
  const deck=state.decks.find(d=>d.deck.id===deckId),p=derive(state,deckId);
  const numbers=[...new Set(deck.words.map(w=>w.module))].sort((a,b)=>a-b);
  return numbers.find(n=>(p.modules[n]?.stage??-1)<0&&deck.words.filter(w=>w.module===n).length===10)??null;
}
export function selectContext(word,used) { return word.clozeItems.find(c=>!used.has(c.id)) || word.clozeItems[0]; }
export function resolveOutcome(progress,stage,scores,date) {
  const success=scores.recall>=8&&scores.gaps>=8;
  if(progress?.lastSuccessDate===date && stage>0)throw new Error('Этот модуль уже успешно повторён сегодня.');
  if(stage!==(progress?.stage??-1)+1)throw new Error('Этап уже изменился. Обновите очередь.');
  return {success,nextDate:success?(stage<5?addDays(date,INTERVALS[stage]):null):(stage>0?addDays(date,1):null)};
}
export function validatePackage(pkg) {
  const errors=[],warnings=[];const err=(path,message)=>errors.push(`${path}: ${message}`);
  const str=x=>typeof x==='string'&&x.trim().length>0&&x.length<=10000;
  if(!pkg||typeof pkg!=='object')return {errors:['Корень файла: ожидается JSON-объект.'],warnings};
  if(pkg.schemaVersion!==1)err('schemaVersion','поддерживается только версия 1');
  if(!pkg.deck||!['id','title','sourceLanguage','targetLanguage'].every(k=>str(pkg.deck[k])))err('deck','нужны id, title, sourceLanguage и targetLanguage');
  if(pkg.deck?.sourceLanguage!=='ru'||pkg.deck?.targetLanguage!=='en')err('deck','поддерживается направление ru → en');
  if(!Number.isInteger(pkg.deck?.version)||pkg.deck.version<1)err('deck.version','ожидается положительное целое число');
  if(!Array.isArray(pkg.words)||pkg.words.length===0||pkg.words.length>10000)return {errors:[...errors,'words: нужно от 1 до 10 000 слов.'],warnings};
  const ids=new Set(),positions=new Set(),contexts=new Set(),counts={};
  pkg.words.forEach((w,i)=>{
    const p=`words[${i}]`;
    if(!w||typeof w!=='object'){err(p,'ожидается объект');return;}
    for(const k of ['id','word','ipa'])if(!str(w[k]))err(`${p}.${k}`,'обязательная строка');
    if(ids.has(w.id))err(`${p}.id`,'ID слова повторяется');ids.add(w.id);
    if(!Number.isInteger(w.module)||w.module<1||w.module>1000)err(`${p}.module`,'номер от 1 до 1000');
    if(!Number.isInteger(w.position)||w.position<1||w.position>10)err(`${p}.position`,'позиция от 1 до 10');
    const pos=`${w.module}:${w.position}`;if(positions.has(pos))err(p,'позиция в модуле уже занята');positions.add(pos);counts[w.module]=(counts[w.module]||0)+1;
    if(!Array.isArray(w.translations)||!w.translations.length||!w.translations.every(str))err(`${p}.translations`,'нужен непустой массив переводов');
    if(w.acceptedAnswers!==undefined&&(!Array.isArray(w.acceptedAnswers)||!w.acceptedAnswers.length||!w.acceptedAnswers.every(str)))err(`${p}.acceptedAnswers`,'нужен массив непустых вариантов');
    if(w.recallPrompt!==undefined&&!str(w.recallPrompt))err(`${p}.recallPrompt`,'ожидается непустая строка');
    if(w.collocations!==undefined&&(!Array.isArray(w.collocations)||!w.collocations.every(str)))err(`${p}.collocations`,'ожидается массив строк');
    if(!Array.isArray(w.examples)||w.examples.length<2||!w.examples.every(x=>x&&str(x.en)&&(x.ru===undefined||str(x.ru))))err(`${p}.examples`,'нужны минимум два английских примера');
    if(!Array.isArray(w.clozeItems)||!w.clozeItems.length||w.clozeItems.length>100){err(`${p}.clozeItems`,'нужно от 1 до 100 контекстов');return;}
    if(w.clozeItems.length<6)warnings.push(`${w.word}: ${w.clozeItems.length}/6 контекстов — недостаточно для полного SRS.`);
    const texts=new Set();w.clozeItems.forEach((c,j)=>{
      const cp=`${p}.clozeItems[${j}]`;
      if(!c||!str(c.id)){err(cp,'нет ID упражнения');return;}
      if(contexts.has(c.id))err(`${cp}.id`,'ID упражнения повторяется');contexts.add(c.id);
      if(!str(c.en)||(c.en.match(/\{\{gap\}\}/g)||[]).length!==1)err(`${cp}.en`,'должен содержать ровно один {{gap}}');
      if(str(c.en)){if(texts.has(normalize(c.en)))err(`${cp}.en`,'контекст повторяется у этого слова');texts.add(normalize(c.en));}
      if(!str(c.ru))err(`${cp}.ru`,'нужен полный русский перевод');
      if(!Array.isArray(c.acceptedAnswers)||!c.acceptedAnswers.length||!c.acceptedAnswers.every(str))err(`${cp}.acceptedAnswers`,'нужны допустимые ответы');
      else if(!c.acceptedAnswers.some(a=>[w.word,...(Array.isArray(w.acceptedAnswers)?w.acceptedAnswers:[])].map(normalize).includes(normalize(a))))err(`${cp}.acceptedAnswers`,'ответ должен совпадать со словом или явно заданной словоформой в word.acceptedAnswers');
    });
  });
  for(const [m,n] of Object.entries(counts))if(n!==10)warnings.push(`Day ${String(m).padStart(3,'0')}: ${n}/10 слов — черновой модуль, тренировка недоступна.`);
  return {errors,warnings};
}
export function mergePackage(existing,pkg) {
  const map=new Map((existing?.words||[]).map(w=>[w.id,w]));for(const w of pkg.words)map.set(w.id,w);
  const merged={schemaVersion:1,deck:{...existing?.deck,...pkg.deck},words:[...map.values()].sort((a,b)=>a.module-b.module||a.position-b.position)};
  const report=validatePackage(merged);if(report.errors.length)throw new Error(report.errors.join('\n'));return merged;
}
export function validateBackup(value) {
  const errors=[];
  if(value?.format!=='lexicon-backup'||value?.version!==1||value?.state?.version!==1)return ['Это не резервная копия Lexicon версии 1.'];
  const s=value.state;
  if(!Array.isArray(s.decks)||!s.decks.length||s.decks.length>100)return ['Некорректный список колод.'];
  const deckIds=new Set();
  for(const deck of s.decks){errors.push(...validatePackage(deck).errors);if(deckIds.has(deck.deck?.id))errors.push('Повторяется ID колоды.');deckIds.add(deck.deck?.id);}
  if(!deckIds.has(s.activeDeckId))errors.push('Активная колода не найдена.');
  if(!s.settings||typeof s.settings.timeZone!=='string')errors.push('Нет настроек часового пояса.');
  else try{localDate(s.settings.timeZone);}catch{errors.push('Неизвестный часовой пояс.');}
  if(!Array.isArray(s.events)||s.events.length>500000)errors.push('Некорректный журнал событий.');
  else {
    const ids=new Set();const types=['module_viewed','context_shown','session_started','attempt','session_completed','deck_imported','legacy_import'];
    for(const e of s.events){
      if(!e||typeof e.id!=='string'||ids.has(e.id)||!types.includes(e.type)||!deckIds.has(e.deckId)||!isDate(e.date)||typeof e.at!=='string'||isNaN(Date.parse(e.at))){errors.push('Некорректное или повторное событие журнала.');break;} ids.add(e.id);
      if(e.type==='session_completed'&&(!Array.isArray(e.missed)||!Array.isArray(e.wordIds)||!['initial','review','difficult','final'].includes(e.kind)||typeof e.success!=='boolean'||!e.scores||!Number.isFinite(e.scores.recall)||!Number.isFinite(e.scores.gaps)||(e.kind!=='difficult'&&e.kind!=='final'&&(!Number.isInteger(e.module)||!Number.isInteger(e.stage)||e.stage<0||e.stage>5)))){errors.push('Повреждён результат учебной сессии.');break;}
      if((e.type==='module_viewed'&&!Number.isInteger(e.module))||(e.type==='context_shown'&&typeof e.exerciseId!=='string')||(e.type==='attempt'&&(typeof e.wordId!=='string'||typeof e.correct!=='boolean'||typeof e.answer!=='string'))){errors.push('Повреждено учебное событие.');break;}
    }
  }
  if(s.session!==null&&s.session!==undefined){const a=s.session;
    if(!a||!deckIds.has(a.deckId)||!Array.isArray(a.wordIds)||!Array.isArray(a.tasks)||!Array.isArray(a.answers)||!['initial','review','difficult','final'].includes(a.kind)||!['study','recall','gaps','enru','result'].includes(a.phase)||!Number.isInteger(a.index))errors.push('Повреждена незавершённая сессия.');
    else {const deck=s.decks.find(d=>d.deck.id===a.deckId);if(!a.wordIds.length||!a.tasks.length||a.index<0||a.index>=a.tasks.length||a.wordIds.some(id=>!deck.words.some(w=>w.id===id))||a.tasks.some(t=>!t||!deck.words.some(w=>w.id===t.wordId)||!['recall','gaps','enru'].includes(t.type)||(t.type==='gaps'&&!deck.words.find(w=>w.id===t.wordId)?.clozeItems.some(c=>c.id===t.exerciseId))))errors.push('В незавершённой сессии не найдены слова или задания.');
      if(a.phase==='study'&&(!Number.isInteger(a.studyIndex)||a.studyIndex<0||a.studyIndex>=a.wordIds.length))errors.push('Повреждена позиция изучения.');
      if(a.phase==='result'&&(!a.result||!a.result.scores||!Array.isArray(a.result.missed)||typeof a.result.success!=='boolean'))errors.push('Повреждён итог занятия.');
      if(a.answers.some(x=>!x||typeof x.correct!=='boolean'||typeof x.answer!=='string'))errors.push('Повреждены ответы сессии.');
    }
  }
  return [...new Set(errors)].slice(0,30);
}
