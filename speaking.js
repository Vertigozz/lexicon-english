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
  START_FAILED: 'Не удалось запустить комнату. Попробуй позже.',
  SERVICE_UNAVAILABLE: 'Сервис звонков временно недоступен.',
};
const decoder = new TextDecoder();
const pauseKey = 'lexicon-speaking-pause-ms';
const pauseOptions = new Map([['', 'По смыслу фразы'], ['1000', '1 секунда'], ['1500', '1,5 секунды'],
  ['2000', '2 секунды'], ['2500', '2,5 секунды'], ['3000', '3 секунды'], ['4000', '4 секунды']]);

export function mountSpeaking(root, { endpoint, publishableKey, getAccessToken }) {
  root.innerHTML = `
    <section class="neo speaking-panel" aria-label="Голосовой урок">
      <div class="speaking-media" hidden>
        <video aria-label="Видео аватара Obvious Thrush" playsinline muted autoplay></video>
        <audio autoplay></audio>
      </div>
      <div class="speaking-copy">
        <p class="speaking-intro">Поговори по-английски с AI-тьютором. Тестовый звонок длится до пяти минут.</p>
        <p class="speaking-privacy">Голос обрабатывают LiveKit и OpenAI. Simli озвучивает аватар. Lexicon не сохраняет запись или расшифровку.</p>
        <p class="speaking-status" role="status" aria-live="polite"></p>
        <p class="speaking-caption" lang="en" aria-live="polite" hidden></p>
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
        <p class="speaking-mode-current" hidden></p>
        <div class="speaking-controls">
          <button class="btn primary speaking-start">Начать звонок</button>
          <button class="btn primary speaking-unlock" hidden>Включить звук</button>
          <button class="btn primary speaking-done" hidden>Готово</button>
          <button class="btn subtle speaking-mic" hidden>Выключить микрофон</button>
          <button class="btn subtle speaking-end" hidden>Завершить</button>
        </div>
      </div>
    </section>`;
  const find = selector => root.querySelector(selector);
  const media = find('.speaking-media');
  const video = find('video');
  const audio = find('audio');
  const status = find('.speaking-status');
  const caption = find('.speaking-caption');
  const start = find('.speaking-start');
  const unlock = find('.speaking-unlock');
  const done = find('.speaking-done');
  const mic = find('.speaking-mic');
  const end = find('.speaking-end');
  const modePicker = find('.speaking-mode');
  const modeHint = find('#speaking-mode-hint');
  const modeCurrent = find('.speaking-mode-current');
  const pauseSettings = find('.speaking-pause');
  const pauseSelect = find('#speaking-pause');
  try {
    const savedPause = localStorage.getItem(pauseKey);
    if (pauseOptions.has(savedPause)) pauseSelect.value = savedPause;
  } catch {}
  const selectedMode = () => find('input[name="speaking-mode"]:checked').value;
  let current;
  let closing;
  let disposed = false;

  async function api(method, accessToken, { mode, pauseMs, sessionId } = {}) {
    const url = new URL(endpoint);
    if (sessionId) url.searchParams.set('sessionId', sessionId);
    if (mode) url.searchParams.set('mode', mode);
    if (pauseMs != null) url.searchParams.set('pauseMs', String(pauseMs));
    const response = await fetch(url, {
      method, headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey },
      cache: 'no-store', keepalive: method === 'DELETE', signal: AbortSignal.timeout(24_000),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errors[data.code] || errors.SERVICE_UNAVAILABLE);
    return data;
  }

  function render(message) {
    if (disposed) return;
    start.hidden = Boolean(current);
    start.disabled = Boolean(closing);
    end.hidden = !current;
    unlock.hidden = !current?.workerReady || current.unlocked && !current.audioBlocked;
    modePicker.hidden = Boolean(current);
    modePicker.disabled = Boolean(closing);
    modeCurrent.hidden = !current;
    modeCurrent.textContent = current?.mode === 'auto' ? 'Смена реплик · Авто' : 'Смена реплик · Вручную';
    if (current?.pauseMs != null) modeCurrent.textContent += ` · ${pauseOptions.get(String(current.pauseMs))}`;
    done.hidden = current?.mode !== 'manual' || current?.phase !== 'listening';
    mic.hidden = !current?.unlocked || !['speaking', 'listening', 'thinking'].includes(current.phase);
    done.disabled = Boolean(current?.sending || current?.paused || current?.audioBlocked);
    mic.disabled = current?.phase !== 'listening';
    mic.textContent = current?.paused ? 'Включить микрофон' : 'Выключить микрофон';
    if (message !== undefined) status.textContent = message;
    else if (current?.workerReady && (!current.unlocked || current.audioBlocked)) {
      status.textContent = 'Нажми «Включить звук», чтобы услышать тьютора.';
    } else if (current?.phase === 'listening' && current.mode === 'auto') {
      status.textContent = current.pauseMs === null ? 'Твой ход. Тьютор ответит, когда ты закончишь.'
        : 'Твой ход. Пауза передаст слово тьютору.';
    } else status.textContent = phases[current?.phase] || '';
  }

  function setPhase(call, state) {
    if (current !== call || !Number.isSafeInteger(state.seq) || state.seq < call.seq) return;
    call.seq = state.seq;
    if (state.phase === 'error') {
      void stop('Аватар не успел подключиться. Попробуй начать звонок снова.');
      return;
    }
    if (state.phase === 'ended') {
      void stop('Время тестового звонка закончилось.');
      return;
    }
    if (!Object.hasOwn(phases, state.phase)) return;
    call.phase = state.phase;
    call.turn = state.turn;
    if (state.phase !== 'starting') clearTimeout(call.startupTimer);
    updateMicrophone(call);
    render();
  }

  function updateMicrophone(call) {
    if (!call.track || current !== call) return;
    call.track.mediaStreamTrack.enabled = call.phase === 'listening' && call.unlocked && !call.paused && !call.audioBlocked;
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
    call.track?.stop();
    call.videoTrack?.detach(video);
    call.audioTrack?.detach(audio);
    video.srcObject = null;
    audio.srcObject = null;
    media.hidden = true;
    caption.hidden = true;
    caption.textContent = '';
    closing = Promise.allSettled([call.room.disconnect(), release(call)]);
    render(message);
    await closing;
    closing = undefined;
    render(message);
  }

  async function begin() {
    if (current || closing || disposed) return;
    if (!navigator.onLine || !navigator.mediaDevices?.getUserMedia) {
      render('Для звонка нужны интернет и доступ к микрофону по HTTPS.');
      return;
    }
    const room = new Room({ adaptiveStream: true, disconnectOnPageLeave: true });
    const mode = selectedMode();
    const pauseMs = mode === 'auto' && pauseSelect.value ? Number(pauseSelect.value) : null;
    const call = { room, mode, pauseMs, phase: 'starting', seq: -1, turn: 0, paused: false, sending: false };
    current = call;
    render();
    try {
      // Unlock playback and request permission from the explicit Start gesture.
      const audioUnlocked = room.startAudio().then(() => true, () => false);
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      if (current !== call) { track.stop(); return; }
      call.track = track;
      track.mediaStreamTrack.addEventListener('ended', () => {
        if (current === call) void stop('Доступ к микрофону потерян. Проверь настройки и начни звонок снова.');
      });
      updateMicrophone(call);
      call.audioUnlocked = await audioUnlocked;
      if (current !== call) return;
      call.accessToken = await getAccessToken();
      if (current !== call) return;
      if (!call.accessToken) { await stop(errors.AUTH_REQUIRED); return; }
      call.connection = await api('POST', call.accessToken, { mode, pauseMs });
      if (current !== call) { await release(call); return; }
      if ((call.connection.mode ?? 'manual') !== call.mode) {
        await stop('Автоматический режим пока недоступен. Выбери «Вручную» и попробуй снова.');
        return;
      }
      if ((call.connection.pauseMs ?? null) !== pauseMs) {
        await stop('Настройка паузы пока недоступна. Выбери «По смыслу фразы» и попробуй снова.');
        return;
      }
      const { serverUrl, participantToken, workerIdentity, avatarIdentity, endsAt } = call.connection;
      call.timer = setTimeout(() => void stop('Время тестового звонка закончилось.'), Math.max(0, Date.parse(endsAt) - Date.now()));

      const subscribe = (publication, participant) => {
        if (participant.identity === avatarIdentity) publication.setSubscribed(true);
      };
      room.on(RoomEvent.TrackPublished, subscribe);
      room.on(RoomEvent.TrackSubscribed, (remote, publication, participant) => {
        if (current !== call || participant.identity !== avatarIdentity) return;
        if (remote.kind === Track.Kind.Video) {
          call.videoTrack?.detach(video);
          call.videoTrack = remote;
          remote.attach(video);
          video.muted = true;
          media.hidden = false;
        } else if (remote.kind === Track.Kind.Audio) {
          call.audioTrack?.detach(audio);
          call.audioTrack = remote;
          remote.attach(audio);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, remote => {
        if (current !== call) return;
        if (remote === call.videoTrack) { remote.detach(video); media.hidden = true; }
        if (remote === call.audioTrack) remote.detach(audio);
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
        if (topic === 'lexicon.caption' && typeof data.text === 'string') {
          caption.textContent = data.text;
          caption.hidden = false;
        }
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (current !== call) return;
        call.phase = 'reconnecting';
        call.paused = true;
        updateMicrophone(call);
        render();
      });
      room.on(RoomEvent.Reconnected, () => {
        if (current !== call) return;
        room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
        if (call.workerReady) rpc(call, 'lexicon.status').then(state => setPhase(call, state)).catch(() => void stop('Связь не восстановилась.'));
      });
      room.on(RoomEvent.Disconnected, () => {
        if (current === call) void stop('Соединение завершено. Можно начать новый звонок.');
      });
      room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
      await room.connect(serverUrl, participantToken, { autoSubscribe: false, maxRetries: 0, websocketTimeout: 10_000 });
      if (current !== call) { await room.disconnect(); return; }
      room.localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: workerIdentity, allowAll: true }]);
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) subscribe(publication, participant);
      }
      await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
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
          setPhase(call, state);
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }
      if (current !== call) return;
      if (call.seq === -1) { await stop('Тьютор не подключился. Попробуй начать звонок снова.'); return; }
      call.workerReady = true;
      if (call.audioUnlocked && room.canPlaybackAudio) await ready(call);
      else render();
    } catch (error) {
      if (current !== call) return;
      const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
      await stop(denied ? 'Разреши микрофон в настройках браузера и попробуй снова.' :
        error.name === 'NotFoundError' ? 'Микрофон не найден.' :
        errors.AUTH_REQUIRED === error.message || Object.values(errors).includes(error.message) ? error.message :
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
        call.startupTimer = setTimeout(() => void stop('Тьютор не успел ответить. Попробуй начать звонок снова.'), 32_000);
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
