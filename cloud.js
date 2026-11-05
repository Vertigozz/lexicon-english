import {cloudConfig} from './cloud-config.js';
import {mergeStates,packState,unpackState,stateSignature} from './sync-state.js';
import {validateBackup} from './core.js';

export const configured=Boolean(cloudConfig.url&&cloudConfig.publishableKey);
export class CloudSync {
  constructor({catalog,read,write,changed,status,account,recovery}) {
    Object.assign(this,{catalog,read,write,changed,status,account,recovery});
    this.user=null;this.chain=Promise.resolve();this.generation=0;
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
    this.started=true;this.generation++;this.user=user;clearTimeout(this.timer);
    this.accountTransition=(async()=>{await this.account(user);if(user)await this.sync();else this.status('guest');})();
    return this.accountTransition;
  }
  async login(email,password){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;await this.setUser(data.user);}
  async signup(email,password){
    const {data,error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;if(data.session)await this.setUser(data.user);return Boolean(data.session);
  }
  async resetPassword(email){const {error}=await this.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?reset-password=1'});if(error)throw error;}
  async updatePassword(password){const {error}=await this.client.auth.updateUser({password});if(error)throw error;}
  async logout(){await this.sync(true);const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;await this.setUser(null);}
  schedule(){if(!this.user)return;this.status('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),900);}
  sync(strict=false){
    clearTimeout(this.timer);
    const user=this.user,generation=this.generation;
    if(!user)return Promise.resolve();
    this.chain=this.chain.catch(()=>{}).then(async()=>{
      if(generation!==this.generation)return;
      if(!navigator.onLine){this.status('offline');if(strict)throw new Error('Для выхода подключитесь к интернету и синхронизируйте прогресс.');return;}
      this.status('syncing');
      try {
        for(let attempt=0;attempt<6;attempt++){
          const {data:row,error}=await this.client.from('lexicon_progress').select('document,revision,updated_at').eq('user_id',user.id).maybeSingle().abortSignal(AbortSignal.timeout(15000));
          if(error)throw error;if(generation!==this.generation)return;
          let remote=null;
          if(row){remote=unpackState(row.document,this.catalog());const errors=validateBackup({format:'lexicon-backup',version:1,state:remote});if(errors.length)throw new Error('Облачная копия не прошла проверку. Локальные данные сохранены.');}
          const local=await this.read(user.id);
          if(!local)throw new Error('Локальная копия ещё не готова.');
          const merged=mergeStates(local,remote),document=packState(merged,this.catalog());
          if(row&&stateSignature(row.document)===stateSignature(document)){
            const saved=await this.write(merged,user.id);if(generation!==this.generation)return;
            await this.changed(saved);this.status('synced',row.updated_at);return;
          }
          const {data:commit,error:writeError}=await this.client.rpc('lexicon_save_progress',{expected_revision:row?.revision||0,new_document:document}).abortSignal(AbortSignal.timeout(15000));
          if(writeError)throw writeError;if(generation!==this.generation)return;
          if(!commit?.length)continue;
          const saved=await this.write(merged,user.id);await this.changed(saved);
          if(stateSignature(packState(saved,this.catalog()))!==stateSignature(document))continue;
          this.status('synced',commit[0].updated_at);return;
        }
        throw new Error('Другой сеанс активно меняет данные. Повторим синхронизацию автоматически.');
      }catch(error){this.status('error',null,error.message);if(strict)throw error;}
    });return this.chain;
  }
}
