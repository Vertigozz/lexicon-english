import {mergeStates} from './sync-state.js';

// A DOM field can still show the previous task while an async save completes.
// Preserve typing only when that field belongs to the task being restored.
export function mergeSavedState(current,saved,draft){
  const state=mergeStates(current,saved),session=state.session;
  if(draft?.enabled&&session&&!session.feedback&&
    draft.sessionId===session.id&&draft.index===session.index&&draft.phase===session.phase&&
    ['recall','gaps','enru'].includes(session.phase))session.input=draft.value;
  return state;
}
