import {derive,makeEvent,appendEvent} from './core.js';
import {nextUnansweredTask,selectPracticeTask} from './study-navigation.js?v=40';

export function setWordKnown(state,wordId,known=true){
  const word=state.decks.find(d=>d.deck.id===state.activeDeckId)?.words.find(w=>w.id===wordId);
  if(!word)throw new Error('Слово не найдено.');
  if(derive(state).known.has(wordId)===known)return false;
  appendEvent(state,makeEvent(state,'word_known',{wordId,module:word.module,known}));
  reconcileKnownSession(state);
  return true;
}

export function reconcileKnownSession(state){
  const a=state?.session;
  if(!a||a.phase==='result'||!Array.isArray(a.tasks)||!Array.isArray(a.wordIds))return state;
  // Original positions remain the identity of attempts after tasks are removed.
  a.tasks.forEach((t,i)=>{t.attemptId ||= `${a.id}:attempt:${i}`;});
  // The final assessment still checks the whole course, including declared knowledge.
  if(a.kind==='final'||!state.events.some(e=>e.deckId===a.deckId&&e.type==='word_known'))return state;
  const known=derive(state,a.deckId).known;
  if(!a.wordIds.some(id=>known.has(id)))return state;
  const oldWords=a.wordIds,oldTasks=a.tasks,oldIndex=a.index,oldStudyIndex=a.studyIndex||0,current=oldTasks[oldIndex];
  a.wordIds=oldWords.filter(id=>!known.has(id));
  a.tasks=oldTasks.filter(t=>!known.has(t.wordId));
  const ids=new Set(a.tasks.map(t=>t.attemptId));
  a.answers=a.answers.filter(e=>ids.has(e.id));
  for(const id of Object.keys(a.cardDrafts||{}))if(!ids.has(id))delete a.cardDrafts[id];
  if(!a.wordIds.length||!a.tasks.length){state.session=null;return state;}
  if(a.phase==='study'){
    const currentWord=oldWords[oldStudyIndex];
    if(a.wordIds.includes(currentWord))a.studyIndex=a.wordIds.indexOf(currentWord);
    else {
      const next=oldWords.slice(oldStudyIndex+1).find(id=>!known.has(id));
      if(next)a.studyIndex=a.wordIds.indexOf(next);
      else {a.studyIndex=a.wordIds.length-1;a.index=0;a.phase=a.tasks[0].type;a.input='';a.feedback=null;}
    }
  }else {
    const retained=a.tasks.findIndex(t=>t.attemptId===current?.attemptId);
    if(retained>=0)a.index=retained;
    else {
      a.index=oldTasks.slice(0,oldIndex).filter(task=>ids.has(task.attemptId)).length-1;
      const next=nextUnansweredTask(a);
      const words=state.decks.find(deck=>deck.deck.id===a.deckId).words;
      selectPracticeTask(a,next<0?a.tasks.length-1:next,words);
      if(next<0)a.exhausted=true;
    }
  }
  return state;
}

export function sessionScores(session){
  const counts={},scores={};
  const byId=new Map(session.tasks.map((t,i)=>[t.attemptId||`${session.id}:attempt:${i}`,t]));
  for(const type of ['recall','gaps',...(session.kind==='final'?['enru']:[])]){
    counts[type]=session.tasks.filter(t=>t.type===type).length;
    scores[type]=session.answers.filter(e=>byId.has(e.id)&&e.exerciseType===type&&e.correct).length;
  }
  const missed=[...new Set(session.answers.filter(e=>byId.has(e.id)&&!e.correct).map(e=>e.wordId))];
  const success=session.kind==='difficult'?missed.length===0:Object.keys(counts).every(type=>counts[type]>0&&scores[type]>=Math.ceil(counts[type]*.8));
  return {counts,scores,missed,success};
}
