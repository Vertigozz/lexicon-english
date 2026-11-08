export async function favoriteKey(word,translation){
  const value=JSON.stringify([word.normalize('NFKC').toLowerCase().trim(),translation.normalize('NFKC').trim()]);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export class Favorites {
  constructor(client,user){this.client=client;this.user=user;this.rows=[];this.loaded=false;this.error='';this.loading=false;this.pending=new Set();}
  async refresh(){
    if(!this.user||this.loading)return;
    this.loading=true;this.error='';
    try{
      const rows=[];
      let page;
      do{
        const {data,error}=await this.client.from('lexicon_favorites').select('entry_key,word,translation,source_title,source_revision,pronunciations,created_at').eq('user_id',this.user.id).order('created_at',{ascending:false}).order('entry_key').range(rows.length,rows.length+499).abortSignal(AbortSignal.timeout(30000));
        if(error)throw error;
        page=data||[];rows.push(...page);
      }while(page.length===500);
      // Favorites are append-only. Retain an addition that completed during this read.
      for(const row of this.rows){
        const remote=rows.find(r=>r.entry_key===row.entry_key);
        if(!remote)rows.push(row);
        else if(remote.pronunciations==null&&row.pronunciations!=null)remote.pronunciations=row.pronunciations;
      }
      this.rows=rows;this.loaded=true;
    }catch(error){console.warn('Favorites load failed',error.code||error.name||'unknown');this.error='Не удалось загрузить избранное. Проверьте подключение и повторите.';}
    finally{this.loading=false;}
  }
  async add(entry){
    if(!this.user)throw new Error('Войдите в аккаунт, чтобы сохранить слово.');
    if(!navigator.onLine)throw new Error('Для сохранения в избранное подключитесь к интернету.');
    const entry_key=await favoriteKey(entry.word,entry.translation);
    const row={...entry,entry_key,user_id:this.user.id};
    const {error}=await this.client.from('lexicon_favorites').upsert(row,{onConflict:'user_id,entry_key',ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(30000));
    if(error)throw new Error('Не удалось сохранить слово. Проверьте подключение и повторите.');
    if(!this.rows.some(r=>r.entry_key===entry_key))this.rows.unshift(row);
    return entry_key;
  }
  async addPronunciations(row,pronunciations){
    if(!this.user)throw new Error('Войдите в аккаунт.');
    const {error}=await this.client.from('lexicon_favorites').update({pronunciations}).eq('user_id',this.user.id).eq('entry_key',row.entry_key).abortSignal(AbortSignal.timeout(30000));
    if(error)throw new Error('Не удалось сохранить произношение. Повторите позже.');
    row.pronunciations=pronunciations;
    const current=this.rows.find(r=>r.entry_key===row.entry_key);
    if(current)current.pronunciations=pronunciations;
  }
}
