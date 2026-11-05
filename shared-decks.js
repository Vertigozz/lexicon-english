import {validatePackage,mergePackage} from './core.js';
export function installSharedDecks(state,rows){
 for(const row of rows){const errors=validatePackage(row.package).errors;if(errors.length)throw new Error('Колода в каталоге повреждена: '+errors[0]);}
 for(const row of rows){
  const pkg=row.package;
  const i=state.decks.findIndex(d=>d.deck.id===pkg.deck.id);
  if(i<0)state.decks.push(structuredClone(pkg));
  else state.decks[i]=mergePackage(state.decks[i],pkg);
 }
 return state;
}
export class SharedDecks {
 constructor(client){this.client=client;this.rows=[];this.admin=false;}
 async refresh(user){
  this.admin=false;if(!user){this.rows=[];return;}
  const [role,catalog]=await Promise.all([
   this.client.from('lexicon_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
   this.client.from('lexicon_decks').select('*').order('id')
  ]);
  if(role.error||catalog.error)throw role.error||catalog.error;
  this.admin=Boolean(role.data);this.rows=catalog.data;
 }
 async publish(pkg){
  if(!this.admin)throw new Error('Загрузка и переименование доступны только администратору.');
  const errors=validatePackage(pkg).errors;if(errors.length)throw new Error(errors[0]);
  if(!pkg.deck.title.trim()||pkg.deck.title.length>200)throw new Error('Название должно содержать от 1 до 200 символов.');
  const old=this.rows.find(r=>r.id===pkg.deck.id);
  const merged=mergePackage(old?.package,pkg);
  const {data,error}=await this.client.rpc('lexicon_publish_deck',{new_package:merged,expected_revision:old?.revision||0});
  if(error)throw error;if(!data?.length)throw new Error('Колоду изменили в другом окне. Обновите каталог и повторите.');
  this.rows=this.rows.filter(r=>r.id!==pkg.deck.id).concat(data);return data[0];
 }
}
