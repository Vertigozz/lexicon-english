const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function statusText(status,user){
  if(status.localError)return 'Не удалось сохранить на устройстве';
  if(status.saving)return 'Сохраняем на устройстве…';
  if(!user)return 'Сохранено в этом браузере · без синхронизации';
  return ({syncing:'Синхронизация…',pending:'Сохранено на устройстве · ждёт синхронизации',offline:'Сохранено на устройстве · отправим при подключении',error:'Сохранено на устройстве · ошибка синхронизации',synced:'Сохранено в облаке'})[status.mode]||'Подключаем облачное сохранение…';
}
export function cloudTimeText(label,value){
  return value?label+': '+new Date(value).toLocaleString('ru'):'';
}
export function accountPanel({configured,user,status,guestAvailable}){
  let body;
  if(!configured)body='<p>Облачное сохранение ещё не подключено владельцем приложения. Пока результаты сохраняются в этом браузере. Можно скачать резервную копию ниже.</p>';
  else if(!user)body='<p>Войдите, чтобы синхронизировать прогресс и продолжать занятия на других устройствах.</p><p><a class="btn primary" href="#auth">Войти или зарегистрироваться</a></p>';
  else body=`<p class="account-email">${esc(user.email)}</p><p data-cloud-detail>${esc(statusText(status,user))}</p><p class="tiny" data-cloud-checked>${esc(cloudTimeText('Последняя ручная синхронизация',status.checkedAt))}</p><p class="tiny" data-cloud-time>${esc(cloudTimeText('Облачная копия обновлена',status.at))}</p><p class="notice error" data-cloud-error ${status.mode==='error'?'':'hidden'}>${esc(status.error||'')}</p><div class="button-row"><button class="btn primary" data-action="cloud-sync">Синхронизировать сейчас</button><button class="btn subtle" data-action="cloud-password">Сменить пароль</button><button class="btn subtle" data-action="cloud-logout">Выйти</button></div>${guestAvailable?'<div class="notice"><div><strong>Есть локальные результаты без аккаунта</strong><p>Объедините их с вашим облачным прогрессом. Резервная локальная копия останется в этом браузере.</p><button class="btn subtle" data-action="cloud-import-guest">Перенести локальный прогресс</button></div></div>':''}<p class="tiny">Без интернета ответы сохраняются на устройстве. При восстановлении соединения они отправятся в облако. Перед закрытием сайта дождитесь статуса «Сохранено в облаке».</p>`;
  return `<section class="neo settings-panel cloud-panel"><h2>Аккаунт и облачное сохранение</h2>${body}<p class="auth-message" id="auth-message" role="status"></p></section>`;
}
