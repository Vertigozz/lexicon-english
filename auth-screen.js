const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);

const views = {
  login: ['Войти в Lexicon', 'Используйте почту и пароль своего аккаунта.', 'Войти'],
  signup: ['Создать аккаунт', 'Сохраняйте прогресс и продолжайте занятия на других устройствах.', 'Создать аккаунт'],
  reset: ['Восстановить пароль', 'Укажите почту аккаунта. На неё придёт ссылка для смены пароля.', 'Отправить ссылку'],
  confirm: ['Подтвердите почту', 'Перейдите по ссылке из письма, чтобы активировать аккаунт. Если письма нет, проверьте папку «Спам».'],
  sent: ['Проверьте почту', 'Если аккаунт существует, на указанную почту придёт ссылка для смены пароля.'],
  recovery: ['Новый пароль', 'Придумайте новый пароль для входа в Lexicon.', 'Сохранить пароль']
};

const errors = {
  invalid_credentials: 'Проверьте почту и пароль.',
  email_not_confirmed: 'Подтвердите адрес по ссылке из письма.',
  email_exists: 'Такой аккаунт уже есть. Войдите или восстановите пароль.',
  user_already_exists: 'Такой аккаунт уже есть. Войдите или восстановите пароль.',
  over_email_send_rate_limit: 'Слишком много запросов на отправку письма. Попробуйте позже.',
  over_request_rate_limit: 'Слишком много запросов. Попробуйте позже.',
  weak_password: 'Выберите более надёжный пароль.',
  same_password: 'Новый пароль должен отличаться от прежнего.',
  signup_disabled: 'Регистрация временно недоступна.',
  session_not_found: 'Ссылка устарела. Запросите новую.',
  otp_expired: 'Ссылка устарела. Запросите новую.'
};

export class AuthScreen {
  constructor({client, emailsEnabled, refresh, continueAsGuest, toggleTheme, passwordUpdated}) {
    Object.assign(this, {client, emailsEnabled, refresh, continueAsGuest, toggleTheme, passwordUpdated});
    this.view = 'login';
    this.email = '';
    this.message = '';
  }

  open(view, message = '') {
    this.view = view;
    this.message = message;
    this.root = null;
    this.refresh();
    document.querySelector('#auth-title')?.focus({preventScroll:true});
  }

  mount(app, dark, {ready, recovery}) {
    const view = recovery ? 'recovery' : this.view;
    if (this.root?.parentElement === app && this.root.dataset.view === view &&
        this.root.dataset.ready === String(ready)) {
      this.paintTheme(dark);
      return;
    }
    const [title, copy, action] = views[view];
    const tabs = this.emailsEnabled && (view === 'login' || view === 'signup');
    const hasPassword = ['login', 'signup', 'recovery'].includes(view);
    const newPassword = view === 'signup' || view === 'recovery';
    const status = this.message || (!ready ? 'Подключаем авторизацию…' : '');
    app.innerHTML = `<div class="auth-screen" data-view="${view}" data-ready="${ready}">
      <header class="auth-top">
        <div class="auth-brand"><img src="./icon.svg" alt="" width="38" height="38"><span>lexicon<span class="auth-dot">.</span></span></div>
        <button type="button" class="auth-theme" data-auth="theme"></button>
      </header>
      <main class="auth-layout" id="content" tabindex="-1">
        <aside class="auth-intro">
          <h2>Английский<br>в вашем ритме</h2>
          <p>Учите слова, повторяйте их в контексте и продолжайте занятия с любого устройства.</p>
          <div class="auth-sample" aria-hidden="true"><strong lang="en">curiosity</strong><span lang="en">/ˌkjʊəriˈɒsəti/</span><span>любопытство</span></div>
        </aside>
        <section class="auth-card" aria-labelledby="auth-title">
          ${tabs ? `<nav class="auth-switch" aria-label="Вход или регистрация">
            <button type="button" data-auth="login" aria-pressed="${view === 'login'}">Вход</button>
            <button type="button" data-auth="signup" aria-pressed="${view === 'signup'}">Регистрация</button>
          </nav>` : ''}
          <h1 id="auth-title" tabindex="-1">${title}</h1>
          <p class="auth-copy">${copy}</p>
          ${action ? `<form id="auth-screen-form">
            ${view !== 'recovery' ? `<div class="auth-field">
              <label for="auth-email">Электронная почта</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" autocapitalize="none" required maxlength="254" value="${esc(this.email)}" placeholder="name@example.com">
            </div>` : ''}
            ${hasPassword ? `<div class="auth-field">
              <label for="auth-password">${view === 'recovery' ? 'Новый пароль' : 'Пароль'}</label>
              <div class="auth-password">
                <input id="auth-password" name="password" type="password" autocomplete="${newPassword ? 'new-password' : 'current-password'}" required ${newPassword ? 'minlength="8" aria-describedby="auth-password-note"' : ''}>
                <button type="button" data-auth="reveal" aria-controls="auth-password" aria-pressed="false">Показать</button>
              </div>
              ${newPassword ? '<span class="auth-footnote" id="auth-password-note">Минимум 8 символов</span>' : ''}
            </div>` : ''}
            ${view === 'login' && this.emailsEnabled ? '<button type="button" class="auth-link auth-forgot" data-auth="reset">Забыли пароль?</button>' : ''}
            <button type="submit" class="auth-primary" ${ready ? '' : 'disabled'}>${action}</button>
          </form>` : ''}
          ${view === 'confirm' ? `<button type="button" class="auth-primary" data-auth="resend" ${ready ? '' : 'disabled'}>Отправить письмо повторно</button>` : ''}
          ${!tabs && view !== 'recovery' ? '<button type="button" class="auth-secondary" data-auth="login">Вернуться ко входу</button>' : ''}
          ${view === 'recovery' ? '<button type="button" class="auth-secondary" data-auth="leave-recovery">Выйти</button>' : ''}
          <p class="auth-status" role="status" ${status ? '' : 'hidden'}>${esc(status)}</p>
          ${view === 'login' || view === 'signup' ? '<div class="auth-guest"><button type="button" class="auth-link" data-auth="guest">Продолжить без аккаунта</button><p>Прогресс сохранится в этом браузере.</p></div>' : ''}
        </section>
      </main>
    </div>`;
    this.root = app.firstElementChild;
    this.paintTheme(dark);
    this.root.addEventListener('click', event => this.click(event));
    this.root.querySelector('form')?.addEventListener('submit', event => {
      event.preventDefault();
      this.request(view);
    });
  }

  paintTheme(dark) {
    const button = this.root.querySelector('[data-auth="theme"]');
    button.setAttribute('aria-pressed', String(dark));
    button.textContent = dark ? 'Светлая тема' : 'Тёмная тема';
  }

  click(event) {
    const button = event.target.closest('[data-auth]');
    if (!button || this.busy) return;
    const action = button.dataset.auth;
    if (action === 'theme') return this.toggleTheme();
    if (action === 'guest') return this.continueAsGuest();
    if (action === 'resend' || action === 'leave-recovery') return this.request(action);
    if (action === 'reveal') {
      const input = this.root.querySelector('#auth-password');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.textContent = visible ? 'Скрыть' : 'Показать';
      return;
    }
    if (action === this.view) return;
    this.email = this.root.querySelector('#auth-email')?.value.trim() ?? this.email;
    this.open(action);
  }

  notify(message) {
    this.message = message;
    const status = this.root?.querySelector('.auth-status');
    if (!status) return;
    status.hidden = !message;
    status.textContent = message;
  }

  async request(view) {
    if (this.busy) return;
    const client = this.client();
    if (!client) return this.notify('Не удалось подключиться к авторизации. Проверьте соединение и обновите страницу.');
    this.email = this.root.querySelector('#auth-email')?.value.trim() ?? this.email;
    const password = this.root.querySelector('#auth-password');
    const controls = [...this.root.querySelectorAll('button, input')].filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    this.busy = true;
    this.notify(view === 'resend' || view === 'signup' || view === 'reset' ? 'Запрашиваем письмо…' : 'Подождите…');
    let next;
    let message = '';
    try {
      if (view === 'login') {
        await client.login(this.email, password.value);
        this.email = '';
      } else if (view === 'signup') {
        if (!await client.signup(this.email, password.value)) next = 'confirm';
        else this.email = '';
      } else if (view === 'reset') {
        await client.resetPassword(this.email);
        next = 'sent';
      } else if (view === 'resend') {
        await client.resendSignup(this.email);
        message = 'Если адрес ещё не подтверждён, на него придёт новое письмо.';
      } else if (view === 'recovery') {
        await client.updatePassword(password.value);
        this.passwordUpdated();
      } else if (view === 'leave-recovery') {
        await client.logout();
      }
    } catch (error) {
      message = errors[error?.code] || ({
        'Invalid login credentials': errors.invalid_credentials,
        'Email not confirmed': errors.email_not_confirmed
      })[error?.message] || (['login', 'recovery', 'leave-recovery'].includes(view)
        ? 'Не удалось выполнить запрос. Проверьте соединение и повторите попытку.'
        : 'Не удалось отправить письмо. Проверьте адрес и повторите попытку.');
    } finally {
      if (password) password.value = '';
      this.busy = false;
      controls.forEach(control => { control.disabled = false; });
    }
    if (next) this.open(next);
    else this.notify(message);
  }
}
