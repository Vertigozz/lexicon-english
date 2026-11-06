import {cloudConfig} from './cloud-config.js';
import {mergeStates,packState,unpackState,stateSignature} from './sync-state.js';
import {validateBackup} from './core.js';

export const configured=Boolean(cloudConfig.url&&cloudConfig.publishableKey);
export class CloudSync {
  constructor({catalog,read,write,changed,status,account,recovery}) {
    Object.assign(this,{catalog,read,write,changed,status,account,recovery});
    this.user=null;this.generation=0;this.changeVersion=0;this.dirty=false;this.lastSyncedUser=null;
  }
  async start(){
    if(!configured){this.status('unconfigured');return;}
    const {createClient}=await import('./vendor/supabase.js');
    this.client=createClient(cloudConfig.url,cloudConfig.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'lexicon-cloud-auth-v1'}
    });
    this.client.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{try{await this.setUser(session?.user||null);if(event==='PASSWORD_RECOVERY')this.recovery?.();}catch(e){this.status('error',null,e.message);}},0);});
    const {data,error}=await this.client.auth.getSession();if(error)throw error;
    await this.setUser(data.session?.user||null);
    this.interval=setInterval(()=>{if(!document.hidden)this.sync();},15000);
  }
  async setUser(user){
    if((this.user?.id||null)===(user?.id||null)&&this.started)return this.accountTransition;
    this.started=true;this.generation++;this.user=user;this.dirty=false;this.lastSyncedUser=null;clearTimeout(this.timer);this.timer=null;
    this.accountTransition=(async()=>{await this.account(user);if(user)await this.sync();else this.status('guest');})();
    return this.accountTransition;
  }
  async login(email,password){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;await this.setUser(data.user);}
  async signup(email,password){
    const {data,error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;if(data.session)await this.setUser(data.user);return Boolean(data.session);
  }
  async resendSignup(email){
    const {error}=await this.client.auth.resend({type:'signup',email,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;
  }
  async resetPassword(email){const {error}=await this.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?reset-password=1'});if(error)throw error;}
  async updatePassword(password){const {error}=await this.client.auth.updateUser({password});if(error)throw error;}
  async logout(){await this.sync(true);const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;await this.setUser(null);}
  schedule(){if(!this.user)return;this.dirty=true;this.changeVersion++;this.status('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.sync();},1500);}
  sync(strict=false){
    const user=this.user,generation=this.generation;
    if(!user)return Promise.resolve();
    if(this.flight?.generation===generation)return strict?this.flight.promise.then(()=>this.sync(true)):this.flight.promise;
    clearTimeout(this.timer);this.timer=null;
    const version=this.changeVersion;
    const promise=(async()=>{
      if(generation!==this.generation)return;
      if(!navigator.onLine){this.status('offline');if(strict)throw new Error('Для выхода подключитесь к интернету и синхронизируйте прогресс.');return;}
      if(strict||this.dirty||this.lastSyncedUser!==user.id)this.status('syncing');
      try {
        for(let attempt=0;attempt<6;attempt++){
          const {data:row,error}=await this.client.from('lexicon_progress').select('document,revision,updated_at').eq('user_id',user.id).maybeSingle().abortSignal(AbortSignal.timeout(15000));
          if(error)throw error;if(generation!==this.generation)return;
          let remote=null;
          if(row){remote=unpackState(row.document,this.catalog());const errors=validateBackup({format:'lexicon-backup',version:1,state:remote});if(errors.length)throw new Error('Облачная копия не прошла проверку. Локальные данные сохранены.');}
          const local=await this.read(user.id);
          if(!local)throw new Error('Локальная копия ещё не готова.');
          const merged=mergeStates(local,remote),document=packState(merged,this.catalog());
          let savedAt=row?.updated_at;
          if(!row||stateSignature(row.document)!==stateSignature(document)){
            const {data:commit,error:writeError}=await this.client.rpc('lexicon_save_progress',{expected_revision:row?.revision||0,new_document:document}).abortSignal(AbortSignal.timeout(15000));
            if(writeError)throw writeError;if(generation!==this.generation)return;
            if(!commit?.length)continue;
            savedAt=commit[0].updated_at;
          }
          const needsMerge=stateSignature(local)!==stateSignature(merged);
          const saved=needsMerge?await this.write(merged,user.id):await this.read(user.id);
          if(generation!==this.generation)return;
          if(needsMerge)await this.changed(saved);
          if(stateSignature(packState(saved,this.catalog()))!==stateSignature(document))continue;
          if(version===this.changeVersion)this.dirty=false;
          this.lastSyncedUser=user.id;this.status(this.dirty?'pending':'synced',savedAt);return;
        }
        throw new Error('Другой сеанс активно меняет данные. Повторим синхронизацию автоматически.');
      }catch(error){this.status('error',null,error.message);if(strict)throw error;}
    })();
    this.flight={generation,promise};
    promise.finally(()=>{
      if(this.flight?.promise===promise)this.flight=null;
      if(generation===this.generation&&version!==this.changeVersion&&!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.sync();},1500);
    }).catch(()=>{});
    return promise;
  }
}
