export function practiceAnswers(task,word){
  if(task.type==='gaps')return word.clozeItems.find(item=>item.id===task.exerciseId).acceptedAnswers;
  return task.type==='enru'?word.translations:[word.word,...(word.acceptedAnswers||[])];
}

export function rememberPracticeDraft(session){
  const task=session.tasks[session.index];
  if(!task||session.phase==='study'||session.feedback)return;
  if(session.input)(session.cardDrafts??={})[task.attemptId]=session.input;
  else if(session.cardDrafts)delete session.cardDrafts[task.attemptId];
}

export function selectPracticeTask(session,index,words){
  const task=session.tasks[index],answer=session.answers.find(item=>item.id===task.attemptId);
  session.index=index;
  session.phase=task.type;
  session.input=answer?.answer??session.cardDrafts?.[task.attemptId]??'';
  const word=answer&&words.find(item=>item.id===task.wordId);
  session.feedback=word?{correct:answer.correct,typo:answer.typo,accepted:practiceAnswers(task,word)}:null;
}

export function nextUnansweredTask(session){
  const answered=new Set(session.answers.map(answer=>answer.id));
  const pending=session.tasks.flatMap((task,index)=>answered.has(task.attemptId)?[]:[index]);
  const samePhase=pending.filter(index=>session.tasks[index].type===session.phase);
  return samePhase.find(index=>index>session.index)??samePhase[0]??pending[0]??-1;
}
