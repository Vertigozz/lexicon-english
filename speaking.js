import { createLocalAudioTrack, Room, RoomEvent, Track } from './vendor/livekit.js';

const phases = {
  starting: 'Подключаем тьютора…',
  speaking: 'Говорит тьютор',
  listening: 'Твой ход. Нажми «Готово», когда закончишь.',
  thinking: 'Тьютор готовит ответ…',
  reconnecting: 'Восстанавливаем связь…',
};
const errors = {
  AUTH_REQUIRED: 'Войди в аккаунт Lexicon и попробуй снова.',
  NOT_ELIGIBLE: 'Для этого аккаунта тест пока не открыт.',
  PILOT_DISABLED: 'Голосовой тест пока не включён.',
  PILOT_BUSY: 'Другой тестовый звонок ещё открыт. Попробуй чуть позже.',
  USER_QUOTA: 'Достигнут лимит запусков. Попробуй позже.',
  INVALID_MODE: 'Обнови страницу и выбери режим звонка снова.',
  INVALID_PAUSE: 'Обнови страницу и выбери длительность паузы снова.',
  INVALID_PREFERENCES: 'Обнови страницу и выбери настройки тьютора снова.',
  START_FAILED: 'Не удалось запустить комнату. Попробуй позже.',
  SERVICE_UNAVAILABLE: 'Сервис звонков временно недоступен.',
};
const decoder = new TextDecoder();
const pauseKey = 'lexicon-speaking-pause-ms';
const tutorSettingsKey = 'lexicon-speaking-tutor-settings';
const tutorFields = {
  voiceModel: { label: 'Модель', defaultValue: 'mini', choices: [['mini', 'GPT Realtime 2.1 Mini'], ['live', 'GPT‑Live‑1']] },
  mediaMode: { label: 'Формат звонка', defaultValue: 'avatar', choices: [['avatar', 'С аватаром'], ['voice', 'Только голос']] },
  opening: { label: 'Кто начинает разговор', defaultValue: 'tutor', choices: [['tutor', 'Тьютор'], ['learner', 'Я']] },
  replyLength: { label: 'Длина ответов', defaultValue: 'brief', choices: [['brief', 'Около 15 слов'], ['standard', 'Около 30 слов']] },
  feedback: { label: 'Исправление ошибок', defaultValue: 'on_request', choices: [['correct_errors', 'Исправлять ошибки'], ['on_request', 'По просьбе'], ['off', 'Выключено']] },
  voiceSpeed: { label: 'Скорость речи', defaultValue: '1', choices: [['0.75', 'Медленно · 0,75×'], ['0.9', 'Чуть медленнее · 0,9×'], ['1', 'Обычная · 1×'], ['1.15', 'Быстрее · 1,15×']] },
};
const pauseOptions = new Map([['', 'По смыслу фразы'], ['1000', '1 секунда'], ['1500', '1,5 секунды'],
  ['2000', '2 секунды'], ['2500', '2,5 секунды'], ['3000', '3 секунды'], ['4000', '4 секунды']]);
const callIcon = (shape, toggle = false) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  ${shape}${toggle ? '<path class="speaking-icon-slash" d="M3 3l18 18"/>' : ''}</svg>`;
const videoIcon = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>';
const micIcon = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-3 0h6"/>';
const hangUpIcon = '<path d="M3 12a13 13 0 0 1 18 0v4l-5 1-1.5-3a9 9 0 0 0-5 0L8 17l-5-1Z"/>';

export function mountSpeaking(root, { endpoint, publishableKey, getAccessToken }) {
  root.innerHTML = `
    <section class="neo speaking-panel" aria-label="Голосовой урок">
      <div class="speaking-call" hidden>
        <div class="speaking-stage">
          <div class="speaking-video-placeholder">
            <i class="speaking-avatar-symbol">${callIcon(videoIcon)}</i>
            <i class="speaking-voice-symbol">${callIcon(micIcon)}</i>
            <span>Подключаем видео…</span>
          </div>
          <video aria-label="Видео аватара Obvious Thrush" playsinline muted autoplay hidden></video>
        </div>
        <div class="speaking-controls speaking-call-controls" role="group" aria-label="Управление звонком">
          <button type="button" class="btn subtle speaking-icon-button speaking-toggle-video">${callIcon(videoIcon, true)}</button>
          <button type="button" class="btn subtle speaking-icon-button speaking-mic">${callIcon(micIcon, true)}</button>
          <button type="button" class="btn speaking-icon-button speaking-end" aria-label="Завершить звонок" title="Завершить звонок">${callIcon(hangUpIcon)}</button>
        </div>
        <div class="speaking-call-info">
          <p class="speaking-countdown" role="timer" hidden></p>
        </div>
        <div class="speaking-controls speaking-turn-controls">
          <button type="button" class="btn primary speaking-unlock" hidden>Включить звук</button>
          <button type="button" class="btn primary speaking-done" hidden>Готово</button>
        </div>
      </div>
      <div class="speaking-chat" hidden>
        <div class="speaking-chat-scroll" role="log" aria-label="Диалог" tabindex="0">
          <p class="speaking-chat-empty">Здесь появятся реплики разговора</p>
          <ol class="speaking-messages"></ol>
        </div>
      </div>
      <audio autoplay></audio>
      <div class="speaking-copy">
        <p class="speaking-intro">Поговори по-английски с AI-тьютором. После подключения тьютора у тебя до 30 минут.</p>
        <p class="speaking-privacy">Голос обрабатывают LiveKit и OpenAI. Для звонка с аватаром используется Simli. Lexicon не сохраняет запись или расшифровку.</p>
        <p class="speaking-status" role="status" aria-live="polite"></p>
        <fieldset class="speaking-mode" aria-describedby="speaking-mode-hint">
          <legend>Смена реплик</legend>
          <label><input type="radio" name="speaking-mode" value="auto"> Авто</label>
          <label><input type="radio" name="speaking-mode" value="manual" checked> Вручную</label>
          <p id="speaking-mode-hint">Нажми «Готово», чтобы передать ход тьютору.</p>
          <div class="speaking-pause" hidden>
            <label for="speaking-pause">Пауза перед ответом</label>
            <select id="speaking-pause" aria-describedby="speaking-pause-hint">
              ${[...pauseOptions].map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
            <p id="speaking-pause-hint">Если выбрать время, тьютор начнёт готовить ответ после указанной паузы в речи.</p>
          </div>
        </fieldset>
        <fieldset class="speaking-tutor-settings">
          <legend>Настройки тьютора</legend>
          ${Object.entries(tutorFields).map(([key, field]) => `
            <div class="speaking-option">
              <label for="speaking-${key}">${field.label}</label>
              <select id="speaking-${key}" name="${key}">
                ${field.choices.map(([value, label]) => `<option value="${value}"${value === field.defaultValue ? ' selected' : ''}>${label}</option>`).join('')}
              </select>
            </div>`).join('')}
        </fieldset>
        <p class="speaking-live-note" hidden>GPT‑Live‑1 сам определяет смену реплик и темп речи. Голосовая сессия OpenAI стоит $0,05 за минуту.</p>
        <div class="speaking-controls">
          <button type="button" class="btn primary speaking-start">Начать звонок</button>
        </div>
      </div>
    </section>`;
  const find = selector => root.querySelector(selector);
  const panel = find('.speaking-panel');
  const setup = find('.speaking-copy');
  const callPanel = find('.speaking-call');
  const callInfo = find('.speaking-call-info');
  const chat = find('.speaking-chat');
  const chatScroll = find('.speaking-chat-scroll');
  const chatEmpty = find('.speaking-chat-empty');
  const messages = find('.speaking-messages');
  const video = find('video');
  const videoPlaceholder = find('.speaking-video-placeholder span');
  const audio = find('audio');
  const status = find('.speaking-status');
  const countdown = find('.speaking-countdown');
  const start = find('.speaking-start');
  const unlock = find('.speaking-unlock');
  const done = find('.speaking-done');
  const mic = find('.speaking-mic');
  const toggleVideo = find('.speaking-toggle-video');
  const end = find('.speaking-end');
  const modePicker = find('.speaking-mode');
  const modeHint = find('#speaking-mode-hint');
  const pauseSettings = find('.speaking-pause');
  const pauseSelect = find('#speaking-pause');
  const tutorSettings = find('.speaking-tutor-settings');
  const tutorSelects = [...tutorSettings.querySelectorAll('select')];
  const modelSelect = find('#speaking-voiceModel');
  const speedSelect = find('#speaking-voiceSpeed');
  const liveNote = find('.speaking-live-note');
  const isLive = () => modelSelect.value === 'live';
  const getPreferences = () => ({ ...Object.fromEntries(tutorSelects.map(select => [select.name, select.value])),
    ...(isLive() ? { voiceSpeed: '1' } : {}) });
  try {
    const savedPause = localStorage.getItem(pauseKey);
    if (pauseOptions.has(savedPause)) pauseSelect.value = savedPause;
  } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(tutorSettingsKey));
    for (const select of tutorSelects) {
      const value = saved?.[select.name];
      if (select !== modelSelect && tutorFields[select.name].choices.some(([choice]) => choice === value)) select.value = value;
    }
  } catch {}
  const selectedMode = () => find('input[name="speaking-mode"]:checked').value;
  let current;
  let closing;
  let disposed = false;

  async function api(method, accessToken, { mode, pauseMs, preferences, sessionId } = {}) {
    const url = new URL(endpoint);
    if (sessionId) url.searchParams.set('sessionId', sessionId);
    if (mode) url.searchParams.set('mode', mode);
    if (pauseMs != null) url.searchParams.set('pauseMs', String(pauseMs));
    for (const [key, value] of Object.entries(preferences ?? {})) url.searchParams.set(key, value);
    const response = await fetch(url, {
      method, headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey },
      cache: 'no-store', keepalive: method === 'DELETE', signal: AbortSignal.timeout(24_000),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const retryAt = Date.parse(data.retryAt);
      const message = data.code === 'USER_QUOTA' && Number.isFinite(retryAt)
        ? `Достигнут лимит запусков. Следующий звонок доступен с ${new Intl.DateTimeFormat('ru-RU', {
          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        }).format(retryAt)}.`
        : errors[data.code] || errors.SERVICE_UNAVAILABLE;
      throw new Error(message, { cause: 'tutor-api' });
    }
    return data;
  }

  function render(message) {
    if (disposed) return;
    const inCall = Boolean(current);
    const voiceOnly = current?.preferences.mediaMode === 'voice';
    callPanel.classList.toggle('speaking-voice-only', voiceOnly);
    if (callPanel.hidden === inCall) {
      panel.classList.toggle('speaking-panel-active', inCall);
      callPanel.hidden = chat.hidden = !inCall;
      setup.hidden = inCall;
      if (inCall) {
        callInfo.prepend(status);
        end.focus();
      } else {
        setup.querySelector('.speaking-privacy').after(status);
        if (!closing) start.focus();
      }
    }
    start.disabled = Boolean(closing);
    unlock.hidden = !current?.workerReady || current.unlocked && !current.audioBlocked;
    modePicker.hidden = isLive();
    modePicker.disabled = Boolean(closing);
    tutorSettings.disabled = Boolean(closing);
    speedSelect.closest('.speaking-option').hidden = isLive();
    liveNote.hidden = !isLive();
    done.hidden = current?.mode !== 'manual' || current?.phase !== 'listening';
    done.disabled = Boolean(current?.sending || current?.paused || current?.audioBlocked);
    mic.disabled = !current?.unlocked || current.phase !== 'listening';
    toggleVideo.disabled = !current?.videoPublication;
    toggleVideo.hidden = voiceOnly;
    const micOff = mic.disabled || Boolean(current?.paused || current?.audioBlocked);
    setCallButton(mic, micOff, current?.paused ? 'Включить микрофон'
      : mic.disabled ? 'Микрофон выключен до твоего хода' : 'Выключить микрофон');
    setCallButton(toggleVideo, Boolean(current?.videoOff), current?.videoOff ? 'Включить видео'
      : toggleVideo.disabled ? 'Видео подключается' : 'Выключить видео');
    videoPlaceholder.textContent = voiceOnly ? 'Только голос' : current?.videoOff ? 'Видео выключено' : 'Подключаем видео…';
    if (message !== undefined) status.textContent = message;
    else if (current?.workerReady && (!current.unlocked || current.audioBlocked)) {
      status.textContent = 'Нажми «Включить звук», чтобы услышать тьютора.';
    } else if (current?.phase === 'listening' && current.mode === 'auto') {
      status.textContent = current.pauseMs === null ? 'Твой ход. Тьютор ответит, когда ты закончишь.'
        : 'Твой ход. Пауза передаст слово тьютору.';
    } else status.textContent = phases[current?.phase] || '';
  }

  function setCallButton(button, off, label) {
    button.classList.toggle('speaking-icon-off', off);
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function appendMessage({ speaker, text }) {
    if (!['learner', 'tutor'].includes(speaker) || typeof text !== 'string' || !text.trim()) return;
    const follow = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight <= 24;
    const bubble = document.createElement('li');
    bubble.className = `speaking-message speaking-message-${speaker}`;
    const name = document.createElement('span');
    name.className = 'speaking-message-author';
    name.textContent = speaker === 'learner' ? 'Ты' : 'Тьютор';
    const phrase = document.createElement('p');
    phrase.lang = 'en';
    phrase.textContent = text.trim();
    bubble.append(name, phrase);
    chatEmpty.hidden = true;
    messages.append(bubble);
    if (follow) chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function setPhase(call, state) {
    if (current !== call || !Number.isSafeInteger(state.seq) || state.seq < call.seq) return;
    call.seq = state.seq;
    if (state.phase === 'error') {
      void stop('Тьютор не успел подключиться. Попробуй начать звонок снова.');
      return;
    }
    if (state.phase === 'ended') {
      void stop('Время тестового звонка закончилось.');
      return;
    }
    if (!Object.hasOwn(phases, state.phase)) return;
    if (call.connection.connectBy && state.endsAt && state.endsAt !== call.endsAt) {
      const remaining = Date.parse(state.endsAt) - Date.parse(state.serverNow);
      if (Number.isFinite(remaining)) {
        call.endsAt = state.endsAt;
        clearTimeout(call.timer);
        clearTimeout(call.startupTimer);
        startCountdown(call, remaining);
      }
    }
    call.phase = state.phase;
    call.turn = state.turn;
    if (state.phase !== 'starting') clearTimeout(call.startupTimer);
    updateMicrophone(call);
    render();
  }

  function startCountdown(call, remaining) {
    const expires = performance.now() + remaining;
    function tick() {
      if (current !== call) return;
      const seconds = Math.max(0, Math.ceil((expires - performance.now()) / 1000));
      if (!seconds) {
        void stop('Время тестового звонка закончилось.');
        return;
      }
      countdown.hidden = false;
      countdown.textContent = `Осталось ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      call.timer = setTimeout(tick, 250);
    }
    call.timer = setTimeout(tick, 0);
  }

  function updateMicrophone(call) {
    if (!call.track || current !== call) return;
    call.track.mediaStreamTrack.enabled = call.phase === 'listening' && call.unlocked && !call.paused && !call.audioBlocked;
  }

  function matchesPreferences(call, settings) {
    return Object.entries(call.preferences).every(([key, value]) => (settings[key] ?? tutorFields[key].defaultValue) === value);
  }

  function rpc(call, method, payload = '') {
    return call.room.localParticipant.performRpc({
      destinationIdentity: call.connection.workerIdentity, method, payload, responseTimeout: 4_000,
    }).then(value => JSON.parse(value));
  }

  async function release(call) {
    if (call.released || !call.connection) return;
    call.released = true;
    await api('DELETE', call.accessToken, { sessionId: call.connection.sessionId }).catch(() => {});
  }

  async function stop(message = 'Звонок завершён.') {
    const call = current;
    if (!call) return;
    current = undefined;
    clearTimeout(call.timer);
    clearTimeout(call.startupTimer);
    clearInterval(call.mediaSampler);
    if (call.videoFrame !== undefined) video.cancelVideoFrameCallback(call.videoFrame);
    call.track?.stop();
    call.videoTrack?.detach(video);
    call.audioTrack?.detach(audio);
    video.srcObject = null;
    audio.srcObject = null;
    video.hidden = true;
    countdown.hidden = true;
    countdown.textContent = '';
    messages.replaceChildren();
    chatEmpty.hidden = false;
    closing = Promise.allSettled([call.room.disconnect(), release(call)]);
    render(message);
    await closing;
    closing = undefined;
    render(message);
    if (!disposed && (document.activeElement === document.body || callPanel.contains(document.activeElement))) start.focus();
  }

  async function sampleMedia(call) {
    if (current !== call || call.sampling || document.hidden) return;
    call.sampling = true;
    try {
      const report = { ...call.firstMedia };
      for (const [kind, track] of [['video', call.videoTrack], ['audio', call.audioTrack]]) {
        const stats = await track?.getRTCStatsReport?.();
        stats?.forEach(row => {
          if (row.type !== 'inbound-rtp' || (row.kind ?? row.mediaType) !== kind) return;
          const before = call.lastMediaStats.get(kind);
          call.lastMediaStats.set(kind, row);
          if (!before || row.id !== before.id || row.ssrc !== before.ssrc) return;
          const lost = (row.packetsLost ?? 0) - (before.packetsLost ?? 0);
          if (lost > 0) report[`${kind}_lost`] = lost;
          if (kind === 'video') {
            const freezes = (row.freezeCount ?? 0) - (before.freezeCount ?? 0);
            const freezeMs = Math.round(((row.totalFreezesDuration ?? 0) - (before.totalFreezesDuration ?? 0)) * 1000);
            if (freezes > 0) report.video_freezes = freezes;
            if (freezeMs > 0) report.video_freeze_ms = freezeMs;
          } else {
            const transport = stats.get(row.transportId);
            const pair = stats.get(transport?.selectedCandidatePairId);
            const candidate = stats.get(pair?.localCandidateId);
            if (candidate?.candidateType) report.connection_relay = Number(candidate.candidateType === 'relay');
            for (const [source, target] of [['packetsReceived', 'audio_received'], ['packetsDiscarded', 'audio_discarded'],
              ['concealedSamples', 'audio_concealed']]) {
              if (Number.isFinite(row[source]) && Number.isFinite(before[source])) {
                report[target] = Math.max(0, row[source] - before[source]);
              }
            }
            report.video_subscribed = Number(Boolean(call.videoTrack));
            const samples = (row.jitterBufferEmittedCount ?? 0) - (before.jitterBufferEmittedCount ?? 0);
            const bufferMs = Math.round(((row.jitterBufferDelay ?? 0) - (before.jitterBufferDelay ?? 0)) * 1000 / samples);
            const jitterMs = Math.round((row.jitter ?? 0) * 1000);
            if (samples > 0 && bufferMs >= 150) report.audio_jitter_buffer_ms = bufferMs;
            if (jitterMs >= 40) report.audio_jitter_ms = jitterMs;
          }
        });
      }
      if (current === call && Object.keys(report).length) {
        await call.room.localParticipant.performRpc({ destinationIdentity: call.connection.workerIdentity,
          method: 'lexicon.media', payload: JSON.stringify(report), responseTimeout: 2000 });
        for (const key of Object.keys(report)) delete call.firstMedia[key];
      }
    } catch {} finally {
      call.sampling = false;
    }
  }

  async function begin() {
    if (current || closing || disposed) return;
    if (!navigator.onLine || !navigator.mediaDevices?.getUserMedia) {
      render('Для звонка нужны интернет и доступ к микрофону по HTTPS.');
      return;
    }
    const room = new Room({ adaptiveStream: true, disconnectOnPageLeave: true });
    const mode = isLive() ? 'auto' : selectedMode();
    const pauseMs = !isLive() && mode === 'auto' && pauseSelect.value ? Number(pauseSelect.value) : null;
    const preferences = getPreferences();
    const call = { room, mode, pauseMs, preferences, phase: 'starting', seq: -1, turn: 0, paused: false, sending: false,
      startedAt: performance.now(), firstMedia: {}, lastMediaStats: new Map() };
    current = call;
    render();
    try {
      // Unlock playback and request permission from the explicit Start gesture.
      const audioUnlocked = room.startAudio().then(() => true, () => false);
      const auth = getAccessToken().catch(() => null);
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      if (current !== call) { track.stop(); return; }
      call.track = track;
      track.mediaStreamTrack.addEventListener('ended', () => {
        if (current === call) void stop('Доступ к микрофону потерян. Проверь настройки и начни звонок снова.');
      });
      updateMicrophone(call);
      call.accessToken = await auth;
      if (current !== call) return;
      if (!call.accessToken) { await stop(errors.AUTH_REQUIRED); return; }
      call.connection = await api('POST', call.accessToken, { mode, pauseMs, preferences });
      if (current !== call) { await release(call); return; }
      if ((call.connection.mode ?? 'manual') !== call.mode) {
        await stop('Автоматический режим пока недоступен. Выбери «Вручную» и попробуй снова.');
        return;
      }
      if ((call.connection.pauseMs ?? null) !== pauseMs) {
        await stop('Настройка паузы пока недоступна. Выбери «По смыслу фразы» и попробуй снова.');
        return;
      }
      if (!matchesPreferences(call, call.connection)) {
        await stop('Сервер не применил настройки тьютора. Обнови страницу и попробуй снова.');
        return;
      }
      const { serverUrl, participantToken, workerIdentity, avatarIdentity, endsAt, connectBy, serverNow } = call.connection;
      const voiceOnly = preferences.mediaMode === 'voice';
      const audioIdentity = voiceOnly ? workerIdentity : avatarIdentity;
      if (connectBy) {
        call.timer = setTimeout(() => void stop('Тьютор не успел подключиться. Попробуй начать звонок снова.'),
          Math.max(0, Date.parse(connectBy) - Date.parse(serverNow)));
      } else {
        call.timer = setTimeout(() => void stop('Время тестового звонка закончилось.'), Math.max(0, Date.parse(endsAt) - Date.now()));
      }

      const subscribe = (publication, participant) => {
        if (current !== call) return;
        if (publication.kind === Track.Kind.Video && !voiceOnly && participant.identity === avatarIdentity) {
          call.videoPublication = publication;
          publication.setSubscribed(!call.videoOff);
          render();
        } else if (publication.kind === Track.Kind.Audio && participant.identity === audioIdentity) {
          publication.setSubscribed(true);
        }
      };
      room.on(RoomEvent.TrackPublished, subscribe);
      room.on(RoomEvent.TrackSubscribed, (remote, publication, participant) => {
        if (current !== call) return;
        if (remote.kind === Track.Kind.Video && !voiceOnly && participant.identity === avatarIdentity) {
          if (call.videoOff || publication !== call.videoPublication) return;
          call.videoTrack?.detach(video);
          call.videoTrack = remote;
          remote.attach(video);
          video.muted = true;
          video.hidden = false;
          if (!call.firstVideoSeen && video.requestVideoFrameCallback) {
            if (call.videoFrame !== undefined) video.cancelVideoFrameCallback(call.videoFrame);
            call.videoFrame = video.requestVideoFrameCallback(() => {
              call.videoFrame = undefined;
              if (current !== call) return;
              call.firstVideoSeen = true;
              call.firstMedia.first_video_ms = Math.round(performance.now() - call.startedAt);
            });
          }
        } else if (remote.kind === Track.Kind.Audio && participant.identity === audioIdentity) {
          call.audioTrack?.detach(audio);
          call.audioTrack = remote;
          remote.attach(audio);
        }
      });
      room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        if (current !== call || participant.identity !== avatarIdentity || publication !== call.videoPublication) return;
        call.videoPublication = undefined;
        render();
      });
      room.on(RoomEvent.TrackUnsubscribed, remote => {
        if (current !== call) return;
        if (remote === call.videoTrack) {
          remote.detach(video);
          video.hidden = true;
          call.videoTrack = undefined;
          call.lastMediaStats.delete('video');
          if (call.videoFrame !== undefined) {
            video.cancelVideoFrameCallback(call.videoFrame);
            call.videoFrame = undefined;
          }
        }
        if (remote === call.audioTrack) {
          remote.detach(audio);
          call.audioTrack = undefined;
          call.lastMediaStats.delete('audio');
        }
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (current !== call) return;
        call.audioBlocked = !room.canPlaybackAudio;
        updateMicrophone(call);
        render();
      });
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (current !== call || participant?.identity !== workerIdentity) return;
        let data;
        try { data = JSON.parse(decoder.decode(payload)); } catch { return; }
        if (topic === 'lexicon.state') setPhase(call, data);
        if (topic === 'lexicon.caption' && data) appendMessage(data);
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (current !== call) return;
        call.phase = 'reconnecting';
        updateMicrophone(call);
        render();
      });
      room.on(RoomEvent.Reconnected, () => {
        if (current !== call) return;
        room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
        if (call.workerReady) rpc(call, 'lexicon.status').then(state => setPhase(call, state)).catch(() => void stop('Связь не восстановилась.'));
      });
      room.on(RoomEvent.Disconnected, () => {
        if (current === call && call.roomConnected) void stop('Соединение завершено. Можно начать новый звонок.');
      });
      room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
      const connectOptions = { autoSubscribe: false, maxRetries: 1, websocketTimeout: 8_000 };
      if (voiceOnly) {
        await room.connect(serverUrl, participantToken, connectOptions);
      } else {
        try {
          await room.connect(serverUrl, participantToken, {
            ...connectOptions, maxRetries: 0, peerConnectionTimeout: 8_000,
            rtcConfig: { iceTransportPolicy: 'relay' },
          });
        } catch (error) {
          if (current !== call || error.status === 401 || error.status === 403) throw error;
          // Reuse the same room and token when the relay is unavailable.
          await room.connect(serverUrl, participantToken, {
            ...connectOptions, rtcConfig: { iceTransportPolicy: 'all' },
          });
        }
      }
      if (current !== call) { await room.disconnect(); return; }
      call.roomConnected = true;
      room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) subscribe(publication, participant);
      }
      const published = room.localParticipant.publishTrack(track, { source: Track.Source.Microphone }).then(() => true, () => false);
      const waitUntil = Date.now() + 12_000;
      while (current === call && Date.now() < waitUntil) {
        try {
          const state = await rpc(call, 'lexicon.status');
          if ((state.mode ?? 'manual') !== call.mode) {
            await stop('Автоматический режим пока недоступен. Выбери «Вручную» и попробуй снова.');
            return;
          }
          if ((state.pauseMs ?? null) !== pauseMs) {
            await stop('Настройка паузы пока недоступна. Выбери «По смыслу фразы» и попробуй снова.');
            return;
          }
          if (!matchesPreferences(call, state)) {
            await stop('Тьютор не применил настройки. Попробуй начать звонок снова.');
            return;
          }
          setPhase(call, state);
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }
      if (current !== call) return;
      if (call.seq === -1) { await stop('Тьютор не подключился. Попробуй начать звонок снова.'); return; }
      const micReady = await published;
      if (current !== call) return;
      if (!micReady) { await stop('Микрофон не подключился. Попробуй начать звонок снова.'); return; }
      call.audioUnlocked = await audioUnlocked;
      if (current !== call) return;
      call.workerReady = true;
      call.mediaSampler = setInterval(() => void sampleMedia(call), 10_000);
      if (call.audioUnlocked && room.canPlaybackAudio) await ready(call);
      else render();
    } catch (error) {
      if (current !== call) return;
      const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
      await stop(denied ? 'Разреши микрофон в настройках браузера и попробуй снова.' :
        error.name === 'NotFoundError' ? 'Микрофон не найден.' :
        error.cause === 'tutor-api' ? error.message :
        'Не удалось подключить звонок. Проверь интернет и попробуй снова.');
    }
  }

  async function ready(call) {
    if (current !== call || call.readyPending) return;
    call.readyPending = true;
    try {
      await call.room.startAudio();
      if (current !== call) return;
      if (!call.unlocked) {
        const state = await rpc(call, 'lexicon.ready');
        if (current !== call) return;
        if (!call.endsAt) call.startupTimer = setTimeout(() => void stop('Тьютор не успел ответить. Попробуй начать звонок снова.'), 32_000);
        setPhase(call, state);
      }
      call.unlocked = true;
      call.audioBlocked = false;
      updateMicrophone(call);
      render();
    } catch {
      if (current === call) render('Не удалось включить звук. Нажми «Включить звук» ещё раз.');
    } finally {
      call.readyPending = false;
    }
  }

  start.addEventListener('click', () => void begin());
  audio.addEventListener('playing', () => {
    if (!current || current.firstAudioSeen) return;
    current.firstAudioSeen = true;
    current.firstMedia.first_audio_ms = Math.round(performance.now() - current.startedAt);
  });
  tutorSettings.addEventListener('change', () => {
    const saved = Object.fromEntries(tutorSelects.filter(select => select !== modelSelect)
      .map(select => [select.name, select.value]));
    try { localStorage.setItem(tutorSettingsKey, JSON.stringify(saved)); } catch {}
    render();
  });
  modePicker.addEventListener('change', event => {
    if (event.target === pauseSelect) {
      try { localStorage.setItem(pauseKey, pauseSelect.value); } catch {}
      return;
    }
    pauseSettings.hidden = selectedMode() !== 'auto';
    modeHint.hidden = !pauseSettings.hidden;
  });
  unlock.addEventListener('click', () => { if (current) void ready(current); });
  end.addEventListener('click', () => void stop());
  toggleVideo.addEventListener('click', () => {
    const call = current;
    if (!call?.videoPublication) return;
    call.videoOff = !call.videoOff;
    call.videoPublication.setSubscribed(!call.videoOff);
    video.hidden = call.videoOff || !call.videoTrack;
    render();
  });
  mic.addEventListener('click', () => {
    if (current?.phase !== 'listening') return;
    current.paused = !current.paused;
    updateMicrophone(current);
    render();
  });
  done.addEventListener('click', async () => {
    const call = current;
    if (!call || call.mode !== 'manual' || call.phase !== 'listening' || call.sending || call.paused || call.audioBlocked) return;
    call.sending = true;
    render();
    try {
      setPhase(call, await rpc(call, 'lexicon.commit', String(call.turn)));
    } catch {
      try { setPhase(call, await rpc(call, 'lexicon.status')); }
      catch { if (current === call) render('Ответ не подтверждён. Проверь соединение и повтори.'); }
    } finally {
      call.sending = false;
      render(status.textContent);
    }
  });
  const onLeave = () => void stop();
  window.addEventListener('pagehide', onLeave);
  return () => {
    disposed = true;
    window.removeEventListener('pagehide', onLeave);
    return stop();
  };
}
