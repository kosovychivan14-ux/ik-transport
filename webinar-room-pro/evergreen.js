/* webinar-room-pro · evergreen 24/7 (v1.1)
 *
 * Ротація записаних вебінарів: кожен відвідувач автоматично бачить «прямий ефір» —
 * вебінар, який він ще не дивився (історія — localStorage `wrp_seen`).
 * Ілюзія live: бейдж LIVE, «почався N хв тому», лічильник глядачів, скриптований
 * чат із Q&A (питання глядача за 30–60 с до відповіді ведучого в записі).
 * CTA й опитування привʼязані до ЧАСУ ВІДТВОРЕННЯ вебінару (не до заходу глядача).
 * Працює поверх v1: скоринг, AI-модератор, timed CTA, опитування, Telegram follow-up.
 *
 * Як додати новий вебінар: videos/README.md (3 кроки).
 */
(function () {
  'use strict';

  var CFG = window.WEBINAR_CONFIG || {};
  var EVERGREEN_ON = CFG.EVERGREEN !== false;

  var api = {
    takeover: false,      // app.js: віддати керування станом сцени evergreen
    chatActive: false,     // app.js: не спамити випадковими повідомленнями чату
    drivesViewers: false,  // app.js: глядачів рахує evergreen
    webinar: null,
    tick: tick,
    isLiveNow: function () { return !!(api.takeover && !endedState && api.webinar); },
    _test: null           // заповнюється нижче (для node-тестів)
  };
  window.EVERGREEN = api;

  if (!EVERGREEN_ON) return;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function readLS(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function readSS(k) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function writeSS(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var SEEN_KEY = 'wrp_seen';          // localStorage: {id: timestamp}
  var SESSION_KEY = 'wrp_eg_session';  // sessionStorage: {webinarId, t0, offsetSec, startedAgoMin}

  /* Спрощена копія playlist.json на випадок, якщо сторінку відкрито через file://
   * (fetch тоді недоступний). Повна версія з чат-скриптами — у playlist.json. */
  var DEFAULT_PLAYLIST = [
    {
      id: 'w-2026-09-18',
      title: 'Електротранспорт 24/7: як змусити авто працювати на тебе',
      dateLabel: '18 вересня 2026',
      file: null,
      durationSec: 3600,
      audienceBase: 240,
      chatScript: []
    },
    {
      id: 'w-2026-09-11',
      title: 'Математика прибутку: скільки реально приносить авто на добу',
      dateLabel: '11 вересня 2026',
      file: 'videos/demo-1.webm',
      durationSec: 2700,
      audienceBase: 180,
      chatScript: []
    }
  ];

  /* ============ 1. вибір вебінару (ротація) ============ */
  function pickWebinar(list) {
    if (!list || !list.length) return null;
    // оновлення сторінки не міняє вебінар — вибір зафіксовано на сесію
    var sess = readSS(SESSION_KEY);
    if (sess && sess.webinarId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === sess.webinarId) return { webinar: list[i], session: sess, fresh: false };
      }
    }
    var seen = readLS(SEEN_KEY) || {};
    var unseen = list.filter(function (w) { return !seen[w.id]; });
    var chosen;
    if (unseen.length) {
      chosen = unseen[Math.floor(Math.random() * unseen.length)];
    } else {
      // всі переглянуті — беремо той, що бачили найдавніше
      chosen = list.slice().sort(function (a, b) { return (seen[a.id] || 0) - (seen[b.id] || 0); })[0];
    }
    seen[chosen.id] = Date.now();
    writeLS(SEEN_KEY, seen);
    var minS = (CFG.EVERGREEN_SESSION_MIN || 3) * 60;
    var maxS = (CFG.EVERGREEN_SESSION_MAX || 12) * 60;
    var dur = chosen.durationSec || 3600;
    var offsetSec = Math.min(
      minS + Math.floor(Math.random() * Math.max(1, maxS - minS)),
      Math.max(60, dur - 120)
    );
    var session = {
      webinarId: chosen.id,
      t0: Date.now(),
      offsetSec: offsetSec,
      startedAgoMin: Math.max(1, Math.round(offsetSec / 60))
    };
    writeSS(SESSION_KEY, session);
    return { webinar: chosen, session: session, fresh: true };
  }

  /* ============ 2. розгортання chatScript ============ */
  function expandScript(script) {
    var out = [];
    (script || []).forEach(function (e) {
      if (e && e.qa) {
        out.push({ t: e.qAt || 0, name: e.name || 'Глядач', text: e.q || '' });
        out.push({ t: e.aAt || 0, host: true, text: e.a || '' });
      } else if (e) {
        out.push({ t: e.t || 0, name: e.name, host: !!e.host, text: e.text || '' });
      }
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  /* Універсальний сценарій (~20 повідомлень), якщо у вебінара немає свого */
  var GENERIC_SCRIPT = expandScript([
    { t: 20, name: 'Олександр', text: 'Добрий вечір! Чутно добре?' },
    { t: 55, name: 'Марія', text: 'Звук є, картинка супер 👍' },
    { t: 110, name: 'Дмитро', text: 'Вперше на вебінарі, поки все зрозуміло' },
    { t: 180, host: true, text: 'Вітаю всіх! Пишіть у чат, звідки ви дивитесь 👇' },
    { t: 250, name: 'Олена', text: 'Київ на звʼязку 🔥' },
    { t: 320, name: 'Тарас', text: 'А запис ефіру буде?' },
    { t: 380, host: true, text: 'Так, запис буде — після ефіру у вкладці «Записи» і в Telegram-боті' },
    { qa: true, qAt: 520, aAt: 600, name: 'Ірина',
      q: 'Скільки часу треба приділяти?',
      a: 'Достатньо від 5 годин на тиждень — реально поєднувати з основною роботою. Головне регулярність, а не марафони.' },
    { t: 700, name: 'Богдан', text: 'Нарешті конкретика, а не мотивація' },
    { t: 820, name: 'Софія', text: 'Вже рахую окупність 😄' },
    { t: 940, host: true, text: 'Друзі, питання можна ставити прямо в чат — найцікавіші розберу в кінці' },
    { qa: true, qAt: 1100, aAt: 1180, name: 'Юрій',
      q: 'Чи потрібен досвід, якщо я новачок?',
      a: 'Ні, навчаємо з нуля — поруч завжди наставник. Більшість партнерів починали без досвіду.' },
    { t: 1300, name: 'Наталія', text: 'Дякую, дуже чітко пояснюєте 👏' },
    { t: 1450, name: 'Андрій', text: '🔥🔥🔥' },
    { qa: true, qAt: 1600, aAt: 1680, name: 'Катерина',
      q: 'Як приєднатися до команди?',
      a: 'Все просто: кнопка «Приєднатися до команди» відкриє наш Telegram-бот — там кілька кроків. Або напишіть «хочу дзвінок».' },
    { t: 1850, name: 'Олександр', text: 'Чекаю блок питань-відповідей' },
    { t: 2000, host: true, text: 'Переходимо до ваших питань — пишіть, не соромтесь!' },
    { t: 2200, name: 'Марія', text: 'Це саме те, що я шукала 🙌' }
  ]);

  /* Фоновий «шум» чату, коли скрипт вичерпано, а вебінар ще триває */
  var AMBIENT = [
    'Звук супер 👍', 'Дуже чітко пояснюєте', '🔥🔥🔥', 'Привіт усім!',
    'А запис буде?', 'Дякую за ефір!', 'Цікаво, слухаю далі', 'Погоджуюсь на всі 100'
  ];
  var AMBIENT_NAMES = ['Олександр', 'Марія', 'Дмитро', 'Олена', 'Андрій', 'Ірина', 'Тарас', 'Софія', 'Богдан', 'Наталія'];

  /* ============ стан сесії ============ */
  var playlist = [];
  var webinar = null;
  var session = null;
  var chatScript = [];
  var chatIdx = 0;
  var pollFired = {};
  var pitchFired = false;
  var endedState = false;
  var ambientAt = 0;
  var viewers = 0;
  var videoEl = null, canvasEl = null;
  var chatBox = null;

  function playbackPos() {
    if (!session) return 0;
    return session.offsetSec + (Date.now() - session.t0) / 1000;
  }

  /* ============ чат ============ */
  function ensureChat() { if (!chatBox) chatBox = $('chat-messages'); return chatBox; }
  function addChatMsg(name, text, cls) {
    var box = ensureChat();
    if (!box) return;
    var div = document.createElement('div');
    div.className = 'msg' + (cls ? ' ' + cls : '');
    var strong = document.createElement('strong');
    strong.className = 'msg__name';
    strong.textContent = name;
    var span = document.createElement('span');
    span.textContent = text;
    var time = document.createElement('span');
    time.className = 'msg__time';
    var n = new Date();
    time.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
    div.appendChild(strong);
    div.appendChild(span);
    div.appendChild(time);
    box.appendChild(div);
    while (box.children.length > 40) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
  function addHostMsg(text) { addChatMsg('Іван · ведучий', text, 'msg--host'); }
  function emitChat(m) {
    if (!m) return;
    if (m.host) addHostMsg(m.text);
    else addChatMsg(m.name || 'Глядач', m.text);
  }

  /* ============ сцена ============ */
  function egSetState(name) {
    var pre = $('state-prelive'), live = $('state-live'), end = $('state-ended');
    if (pre) pre.classList.toggle('is-hidden', name !== 'prelive');
    if (live) live.classList.toggle('is-hidden', name !== 'live');
    if (end) end.classList.toggle('is-hidden', name !== 'ended');
  }
  function setPillLive() {
    var pill = $('status-pill'), txt = $('status-text');
    if (!pill || !txt) return;
    pill.classList.remove('pill--test');
    pill.classList.add('pill--live');
    txt.textContent = 'Прямий ефір';
  }

  /* ============ відео / симуляція ============ */
  function setupVideo() {
    if (!videoEl) videoEl = $('evergreen-video');
    if (!canvasEl) canvasEl = $('stream-canvas');
    stopVideo();
    if (!webinar || !webinar.file || !videoEl) return; // немає файлу → canvas-симуляція
    var shown = false;
    videoEl.onloadedmetadata = function () {
      try {
        var d = videoEl.duration;
        if (d && isFinite(d)) videoEl.currentTime = Math.min(session.offsetSec, Math.max(0, d - 10));
      } catch (e) {}
    };
    videoEl.oncanplay = function () {
      if (shown) return;
      shown = true;
      videoEl.classList.remove('is-hidden');
      if (canvasEl) canvasEl.classList.add('is-hidden');
      try {
        var p = videoEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            // автоплей зі звуком заблоковано — вмикаємо без звуку + кнопка
            videoEl.muted = true;
            try { var p2 = videoEl.play(); if (p2 && p2.catch) p2.catch(function () {}); } catch (e2) {}
            showSoundBtn();
          });
        }
      } catch (e) {}
      if (videoEl.muted) showSoundBtn();
    };
    // файл відсутній або битий — тихо лишаємось на canvas-симуляції, сторінка не ламається
    videoEl.onerror = function () { stopVideo(); };
    videoEl.onended = function () { endSession(); };
    try { videoEl.src = webinar.file; videoEl.load(); } catch (e) { stopVideo(); }
  }
  function stopVideo() {
    if (!videoEl) return;
    try { videoEl.pause(); } catch (e) {}
    try { videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {}
    videoEl.classList.add('is-hidden');
    if (canvasEl) canvasEl.classList.remove('is-hidden');
    var sb = $('eg-sound');
    if (sb) sb.classList.add('is-hidden');
  }
  function showSoundBtn() {
    var sb = $('eg-sound');
    if (sb && videoEl && !videoEl.classList.contains('is-hidden')) sb.classList.remove('is-hidden');
  }

  /* ============ глядачі: тепер це реальний список учасників ============ */
  function startViewers() {
    var P = window.WRP_PARTICIPANTS;
    if (P) {
      P.reset(120 + Math.floor(Math.random() * 51)); // 120–170 на старті
      P.onJoin(onParticipantJoin);
      viewers = P.count();
    } else {
      viewers = (webinar.audienceBase || 200) + Math.floor(Math.random() * 41) - 20;
    }
    paintViewers();
  }
  // кількість на лічильнику завжди = довжині списку учасників
  function onParticipantJoin(p) {
    var P = window.WRP_PARTICIPANTS;
    viewers = P ? P.count() : viewers;
    paintViewers();
    var verb = p.f ? 'приєдналась' : 'приєднався';
    addChatMsg('', p.flag + ' ' + p.name + ' · ' + p.country + ' ' + verb, 'msg--sys');
  }
  function paintViewers() {
    var v = Math.max(60, viewers);
    var el1 = $('viewers'); if (el1) el1.textContent = v;
    var el2 = $('chat-online'); if (el2) el2.textContent = Math.max(40, v - Math.floor(Math.random() * 25));
    var el3 = $('eg-watchers-n'); if (el3) el3.textContent = v;
    var el4 = $('eg-sched-viewers'); if (el4) el4.textContent = v;
  }
  // нові учасники приєднуються протягом ефіру — кожен з'являється в чаті й у списку
  (function joinLoop() {
    setTimeout(function () {
      var P = window.WRP_PARTICIPANTS;
      if (api.takeover && !endedState && P) {
        var n = Math.random() < 0.22 ? 2 : 1;
        for (var i = 0; i < n; i++) P.joinOne();
      }
      joinLoop();
    }, 9000 + Math.random() * 16000);
  })();

  /* ============ сесія ============ */
  function beginSession(pick) {
    webinar = pick.webinar;
    session = pick.session;
    api.webinar = webinar;
    chatScript = (webinar.chatScript && webinar.chatScript.length)
      ? expandScript(webinar.chatScript)
      : GENERIC_SCRIPT.slice();
    chatIdx = 0;
    pollFired = {};
    pitchFired = false;
    endedState = false;
    ambientAt = Date.now() + 30000;
    var pos = playbackPos();

    var pollsBox = $('polls');
    var box = ensureChat();
    if (pick.fresh) {
      if (pollsBox) pollsBox.innerHTML = '';
      if (box) box.innerHTML = '';
      try { if (window.WRP && window.WRP.resetLiveHooks) window.WRP.resetLiveHooks(); } catch (e) {}
    } else {
      // перезавантаження посеред сесії: події, що вже минули за часом вебінару, не повторюємо
      var pAt0 = webinar.pollAt || CFG.EVERGREEN_POLL_AT || [480, 1140];
      pAt0.forEach(function (t, i) { if (t <= pos) pollFired[i] = true; });
      var pch0 = webinar.pitchAt != null ? webinar.pitchAt : (CFG.EVERGREEN_PITCH_AT || 1500);
      if (pch0 <= pos) pitchFired = true;
      // показати «історію» чату, ніби глядач щойно зайшов у розпал ефіру
      while (chatIdx < chatScript.length && chatScript[chatIdx].t <= pos) {
        emitChat(chatScript[chatIdx]);
        chatIdx++;
      }
    }

    var topic = $('stage-topic');
    if (topic) topic.textContent = webinar.title || 'Прямий ефір';
    var started = $('eg-started');
    if (started) started.textContent = 'почався ' + session.startedAgoMin + ' хв тому';

    api.takeover = true;
    api.chatActive = true;
    api.drivesViewers = true;

    setupVideo();
    startViewers();
    egSetState('live');
    setPillLive();
    try { window.dispatchEvent(new CustomEvent('wrp:live-start', { detail: { evergreen: true } })); } catch (e) {}

    renderScheduleCard();
    paintHostInfo();
  }

  function endSession() {
    if (endedState) return;
    endedState = true;
    stopVideo();
    try { window.dispatchEvent(new CustomEvent('wrp:live-end')); } catch (e) {}
    egSetState('ended');
    var pill = $('status-pill'), txt = $('status-text');
    if (pill && txt) { pill.classList.remove('pill--live'); txt.textContent = 'Ефір завершено'; }
    // 24/7: через 45 секунд — наступний вебінар як новий «прямий ефір»
    setTimeout(function () {
      var pick = pickWebinar(playlist);
      if (pick) beginSession(pick);
    }, 45000);
  }

  /* Викликається з app.js щосекунди замість звичайного таймера, коли evergreen активний.
   * Повертає true, якщо сцену оброблено (app.js пропускає свою логіку). */
  function tick() {
    if (!api.takeover) return false;
    if (endedState) return true;
    if (!webinar || !session) return false;
    var pos = playbackPos();
    var dur = webinar.durationSec || 3600;
    if (pos >= dur) { endSession(); return true; }

    // скрипт чату, синхронізований з часом відтворення
    while (chatIdx < chatScript.length && chatScript[chatIdx].t <= pos) {
      emitChat(chatScript[chatIdx]);
      chatIdx++;
    }
    var now = Date.now();
    if (chatIdx >= chatScript.length && now >= ambientAt) {
      addChatMsg(
        AMBIENT_NAMES[Math.floor(Math.random() * AMBIENT_NAMES.length)],
        AMBIENT[Math.floor(Math.random() * AMBIENT.length)]
      );
      ambientAt = now + 25000 + Math.random() * 20000;
    }

    // опитування й CTA — за часом ВЕБІНАРУ (video.currentTime / sim-годинник)
    try {
      var polls = CFG.POLLS || [];
      var pAt = webinar.pollAt || CFG.EVERGREEN_POLL_AT || [480, 1140];
      for (var i = 0; i < pAt.length && i < polls.length; i++) {
        if (!pollFired[i] && pos >= pAt[i]) {
          pollFired[i] = true;
          if (window.WRP && window.WRP.renderPoll) window.WRP.renderPoll(polls[i], false);
        }
      }
      var pitchAt = webinar.pitchAt != null ? webinar.pitchAt : (CFG.EVERGREEN_PITCH_AT || 1500);
      if (!pitchFired && pos >= pitchAt) {
        pitchFired = true;
        if (window.WRP && window.WRP.showCTA) window.WRP.showCTA();
      }
    } catch (e) {}

    return true;
  }

  /* ============ вкладка «Записи» ============ */
  function fmtDur(s) {
    s = Math.max(0, Math.round(s || 0));
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    if (h > 0) return h + ' год ' + m + ' хв';
    return m + ' хв';
  }
  function renderRecordings() {
    var grid = $('rec-playlist');
    if (!grid) return;
    grid.innerHTML = '';
    playlist.forEach(function (w) {
      var card = document.createElement('div');
      card.className = 'rec-card hud-card';
      card.innerHTML =
        '<span class="corner tl"></span><span class="corner tr"></span>' +
        '<span class="corner bl"></span><span class="corner br"></span>' +
        '<button class="rec-card__play" type="button" aria-label="Дивитися запис">▶</button>' +
        '<div class="rec-card__info"><h3></h3><p class="mono"></p></div>';
      card.querySelector('h3').textContent = w.title || 'Вебінар';
      card.querySelector('p').textContent = (w.dateLabel || '') + ' · ' + fmtDur(w.durationSec);
      card.querySelector('.rec-card__play').addEventListener('click', function () { openRecModal(w); });
      grid.appendChild(card);
    });
  }
  function openRecModal(w) {
    var modal = $('rec-modal');
    if (!modal) return;
    $('rec-modal-title').textContent = w.title || 'Вебінар';
    $('rec-modal-date').textContent = (w.dateLabel || '') + ' · ' + fmtDur(w.durationSec);
    var vid = $('rec-modal-video'), fb = $('rec-modal-fallback');
    if (w.file && vid) {
      fb.classList.add('is-hidden');
      vid.classList.remove('is-hidden');
      vid.src = w.file;
    } else {
      if (vid) { try { vid.pause(); } catch (e) {} vid.classList.add('is-hidden'); vid.removeAttribute('src'); }
      fb.classList.remove('is-hidden');
    }
    modal.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeRecModal() {
    var modal = $('rec-modal');
    if (!modal) return;
    var vid = $('rec-modal-video');
    if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute('src'); }
    modal.classList.add('is-hidden');
    document.body.style.overflow = '';
  }

  /* ============ вкладка «Розклад»: картка «зараз у прямому ефірі» ============ */
  function renderScheduleCard() {
    var list = $('sched-list');
    if (!list) return;
    var existing = $('eg-live-card');
    if (existing) {
      var t = existing.querySelector('.sched-card__date');
      if (t && webinar) t.textContent = webinar.title || 'Прямий ефір';
      return;
    }
    var card = document.createElement('div');
    card.className = 'sched-card sched-card--live hud-card';
    card.id = 'eg-live-card';
    card.innerHTML =
      '<span class="corner tl"></span><span class="corner tr"></span>' +
      '<span class="corner bl"></span><span class="corner br"></span>' +
      '<span class="sched-card__badge sched-card__badge--live">🔴 Зараз у прямому ефірі</span>' +
      '<div class="sched-card__date"></div>' +
      '<div class="sched-card__time">👁 <span id="eg-sched-viewers">0</span> зараз дивляться</div>' +
      '<button class="btn btn--lime btn--sm" type="button">Дивитися</button>';
    card.querySelector('.sched-card__date').textContent = webinar ? (webinar.title || 'Прямий ефір') : 'Прямий ефір';
    card.querySelector('.btn').addEventListener('click', function () {
      var tab = document.querySelector('[data-tab="room"]');
      if (tab) tab.click();
    });
    list.insertBefore(card, list.firstChild);
  }

  /* ============ режим ведучого (?host=1) ============ */
  function isHost() {
    try { return new URLSearchParams(window.location.search).get('host') === '1'; } catch (e) { return false; }
  }
  function paintHostInfo() {
    if (!isHost()) return;
    var info = $('host-eg-info');
    if (info && webinar) {
      info.textContent = 'EVERGREEN · ' + (webinar.title || '') + ' · ' + fmtDur(webinar.durationSec);
    }
  }
  function bindHost() {
    if (!isHost()) return;
    var repick = $('host-eg-repick');
    if (repick) repick.addEventListener('click', function () {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      window.location.reload();
    });
    var reset = $('host-eg-reset');
    if (reset) reset.addEventListener('click', function () {
      try { localStorage.removeItem(SEEN_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      window.location.reload();
    });
  }

  /* ============ init ============ */
  function init(list) {
    playlist = (list && list.length) ? list : [];
    if (!playlist.length) return;

    var soundBtn = $('eg-sound');
    if (soundBtn) soundBtn.addEventListener('click', function () {
      if (!videoEl) return;
      videoEl.muted = false;
      try { var p = videoEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      soundBtn.classList.add('is-hidden');
    });
    var rc = $('rec-close');
    if (rc) rc.addEventListener('click', closeRecModal);
    var rm = $('rec-modal');
    if (rm) rm.addEventListener('click', function (e) { if (e.target === rm) closeRecModal(); });
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRecModal(); });
    }
    bindHost();
    renderRecordings();

    var pick = pickWebinar(playlist);
    if (pick) beginSession(pick);
  }

  api._test = { pick: pickWebinar, expand: expandScript, SEEN_KEY: SEEN_KEY, SESSION_KEY: SESSION_KEY };

  var plPromise = (typeof fetch === 'function')
    ? fetch('playlist.json').then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).catch(function () { return DEFAULT_PLAYLIST; })
    : Promise.resolve(DEFAULT_PLAYLIST);
  plPromise.then(init);
})();
