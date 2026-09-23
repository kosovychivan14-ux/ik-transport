/* webinar-room-pro — Neon Evo. Ефіри: щочетверга 19:00 за Києвом. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Telegram WebApp ---------- */
  try {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg) { tg.ready(); tg.expand(); document.body.classList.add('tg-app'); }
  } catch (e) {}

  /* ---------- вкладки ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function gotoTab(name) {
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      $('tab-' + b.getAttribute('data-tab')).classList.toggle('is-hidden', !on);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  tabs.forEach(function (b) {
    b.addEventListener('click', function () { gotoTab(b.getAttribute('data-tab')); });
  });
  document.querySelector('[data-goto]').addEventListener('click', function (e) {
    e.preventDefault();
    gotoTab(this.getAttribute('data-goto'));
  });

  /* ---------- київський час ---------- */
  function kyivNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  }
  function nextWebinarStart(from) {
    var d = new Date(from);
    d.setHours(19, 0, 0, 0);
    var delta = (4 - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
    return d;
  }
  var LIVE_MS = 2 * 60 * 60 * 1000, ENDED_MS = 30 * 60 * 1000;
  var start = nextWebinarStart(kyivNow());
  (function fixStart() {
    var now = kyivNow(), probe = new Date(start);
    probe.setDate(probe.getDate() - 7);
    if (now.getTime() >= probe.getTime() && now.getTime() < probe.getTime() + LIVE_MS + ENDED_MS) start = probe;
  })();

  /* ---------- стани сцени ---------- */
  var statePrelive = $('state-prelive'), stateLive = $('state-live'), stateEnded = $('state-ended');
  var statusPill = $('status-pill'), statusText = $('status-text');
  var preliveBadge = $('prelive-badge'), preliveBadgeText = $('prelive-badge-text');
  var preliveTitle = $('prelive-title'), preliveNote = $('prelive-note');
  var liveBadgeText = $('live-badge-text');
  var test = null; // {waitUntil, liveUntil}

  var PRELIVE_TITLE = 'До старту<br>залишилось';
  var PRELIVE_NOTE = 'Четвер, 19:00 за Києвом · тримай цю вкладку відкритою,<br>ефір увімкнеться автоматично';

  function setState(name) {
    statePrelive.classList.toggle('is-hidden', name !== 'prelive');
    stateLive.classList.toggle('is-hidden', name !== 'live');
    stateEnded.classList.toggle('is-hidden', name !== 'ended');
  }
  function setPill(mode, text) {
    statusPill.classList.remove('pill--live', 'pill--test');
    if (mode) statusPill.classList.add(mode);
    statusText.textContent = text;
  }

  function renderCountdown(targetMs) {
    var diff = Math.max(0, targetMs - kyivNow().getTime());
    $('cd-d').textContent = pad(Math.floor(diff / 86400000));
    $('cd-h').textContent = pad(Math.floor(diff / 3600000) % 24);
    $('cd-m').textContent = pad(Math.floor(diff / 60000) % 60);
    $('cd-s').textContent = pad(Math.floor(diff / 1000) % 60);
  }

  function tick() {
    var nowMs = kyivNow().getTime();

    // тестовий запуск має пріоритет
    if (test) {
      if (nowMs < test.waitUntil) {
        setState('prelive');
        setPill('pill--test', 'Тестовий запуск');
        preliveBadge.classList.remove('live-badge--off');
        preliveBadge.classList.add('live-badge--test');
        preliveBadgeText.textContent = 'ТЕСТОВИЙ ЗАПУСК';
        preliveTitle.innerHTML = 'Тест: ефір<br>через';
        preliveNote.textContent = 'Перевірка сценарію: 30 секунд очікування → 30 секунд ефіру';
        renderCountdown(test.waitUntil);
      } else if (nowMs < test.liveUntil) {
        setState('live');
        setPill('pill--test', 'Тестовий ефір');
        liveBadgeText.textContent = 'ТЕСТ · LIVE';
        addSysOnce('test', 'Тестовий ефір: перевірка сцени');
        wrpEvent('wrp:test-live-start');
      } else {
        test = null;
        $('test-launch').disabled = false;
        preliveBadge.classList.add('live-badge--off');
        preliveBadge.classList.remove('live-badge--test');
        preliveBadgeText.textContent = 'ЕФІР ЩЕ НЕ РОЗПОЧАВСЯ';
        preliveTitle.innerHTML = PRELIVE_TITLE;
        preliveNote.innerHTML = PRELIVE_NOTE;
        liveBadgeText.textContent = 'LIVE';
        wrpEvent('wrp:test-live-end');
        addSysOnce('test-end', 'Тест завершено — кімната в звичайному режимі');
      }
      tickClock();
      return;
    }

    var s = start.getTime();
    var state = (nowMs >= s && nowMs < s + LIVE_MS) ? 'live'
      : (nowMs >= s + LIVE_MS && nowMs < s + LIVE_MS + ENDED_MS) ? 'ended' : 'prelive';
    // evergreen 24/7: між реальними ефірами сценою керує ротація записаних вебінарів
    var eg = window.EVERGREEN;
    if (eg && eg.takeover && state !== 'live' && eg.tick()) {
      tickClock();
      return;
    }
    setState(state);
    if (state === 'live') {
      setPill('pill--live', 'Прямий ефір');
      addSysOnce('live', 'Іван Косович приєднався до ефіру');
      wrpEvent('wrp:live-start');
    }
    else if (state === 'ended') {
      setPill(null, 'Ефір завершено');
      wrpEvent('wrp:live-end');
    }
    else {
      setPill(null, 'Очікування ефіру');
      var target = s > nowMs ? start : nextWebinarStart(kyivNow());
      if (s <= nowMs) start = target;
      renderCountdown(target.getTime());
    }
    tickClock();
    highlightProgram(kyivNow(), state);
  }

  function tickClock() {
    var n = kyivNow();
    var c = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
    var fc = $('footer-clock');
    if (fc) fc.textContent = 'Київ · ' + c;
  }

  var sysFlags = {};
  function addSysOnce(key, text) {
    if (sysFlags[key]) return;
    sysFlags[key] = true;
    addSys(text);
  }

  /* події для AI-модуля (ai.js): wrp:live-start / wrp:live-end / wrp:chat-sent */
  var wrpFired = {};
  function wrpEvent(name) {
    if (wrpFired[name]) return;
    wrpFired[name] = true;
    try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {}
  }

  /* ---------- програма ---------- */
  var chapters = Array.prototype.slice.call(document.querySelectorAll('#program-list li'));
  function highlightProgram(now, state) {
    if (state !== 'live') {
      chapters.forEach(function (li) { li.classList.remove('is-now', 'is-done'); });
      return;
    }
    var mins = now.getHours() * 60 + now.getMinutes();
    var times = chapters.map(function (li) {
      var p = li.getAttribute('data-start').split(':');
      return (+p[0]) * 60 + (+p[1]);
    });
    chapters.forEach(function (li, i) {
      li.classList.remove('is-now', 'is-done');
      if (mins >= times[i] && (i === times.length - 1 || mins < times[i + 1])) li.classList.add('is-now');
      else if (mins >= times[i]) li.classList.add('is-done');
    });
  }

  /* ---------- глядачі ---------- */
  var viewers = 240 + Math.floor(Math.random() * 140);
  function tickViewers() {
    if (window.WRP_PARTICIPANTS) return; // учасниками керує participants.js + evergreen
    if (window.EVERGREEN && window.EVERGREEN.drivesViewers) return; // лічильник веде evergreen
    viewers = Math.max(120, Math.min(900, viewers + Math.floor(Math.random() * 17) - 8));
    $('viewers').textContent = viewers;
    $('chat-online').textContent = Math.max(50, viewers - Math.floor(Math.random() * 30));
  }
  tickViewers();
  setInterval(tickViewers, 3000);

  /* ---------- чат ---------- */
  var chatBox = $('chat-messages');
  var names = ['Олександр', 'Марія', 'Дмитро', 'Олена', 'Андрій', 'Ірина', 'Тарас', 'Софія', 'Богдан', 'Наталія', 'Юрій', 'Катерина'];
  var texts = [
    'Добрий вечір! Чутно добре?', 'Чекаю початок 🔥', 'Звук є, картинка супер',
    'Нарешті конкретика, а не мотивація', 'А запис ефіру буде?', 'Вже рахую окупність 😄',
    'Який пробіг на добу потрібен для виходу в плюс?', 'Привіт з Києва!',
    'Питання: батарея скільки живе в такому режимі?', 'Дякую, дуже чітко пояснюєте',
    'А для Львова це працює?', 'Чекаю блок про підключення авто',
    'Вперше на вебінарі, поки все зрозуміло 👍', 'Скільки коштує вхід у систему?'
  ];
  function addMsg(name, text, me) {
    var div = document.createElement('div');
    div.className = 'msg' + (me ? ' msg--me' : '');
    var strong = document.createElement('strong');
    strong.className = 'msg__name';
    strong.textContent = me ? 'Ви' : name;
    var span = document.createElement('span');
    span.textContent = text;
    var time = document.createElement('span');
    time.className = 'msg__time';
    var n = kyivNow();
    time.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
    div.appendChild(strong); div.appendChild(span); div.appendChild(time);
    chatBox.appendChild(div);
    while (chatBox.children.length > 40) chatBox.removeChild(chatBox.firstChild);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  function addSys(text) {
    var div = document.createElement('div');
    div.className = 'msg msg--sys';
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  (function seed() {
    var used = {};
    for (var i = 0; i < 6; i++) {
      var ti = Math.floor(Math.random() * texts.length);
      if (used[ti]) continue;
      used[ti] = 1;
      addMsg(names[Math.floor(Math.random() * names.length)], texts[ti], false);
    }
  })();
  setInterval(function () {
    if (document.hidden) return;
    if (window.EVERGREEN && window.EVERGREEN.chatActive) return; // чат веде evergreen-скрипт
    addMsg(names[Math.floor(Math.random() * names.length)], texts[Math.floor(Math.random() * texts.length)], false);
  }, 6000);
  $('chat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('chat-input'), v = input.value.trim();
    if (!v) return;
    addMsg('', v, true);
    try { window.dispatchEvent(new CustomEvent('wrp:chat-sent', { detail: { text: v } })); } catch (err) {}
    input.value = '';
  });

  /* ---------- реакції ---------- */
  var fx = $('fx');
  function floatEmoji(emoji, x, y) {
    var el = document.createElement('span');
    el.className = 'fx__emoji';
    el.textContent = emoji;
    el.style.left = (x - 15 + Math.random() * 30) + 'px';
    el.style.top = (y - 10) + 'px';
    fx.appendChild(el);
    setTimeout(function () { el.remove(); }, 1700);
  }
  var reactBtns = Array.prototype.slice.call(document.querySelectorAll('.react'));
  reactBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var count = btn.querySelector('[data-count]');
      count.textContent = +count.textContent + 1;
      var r = btn.getBoundingClientRect();
      floatEmoji(btn.getAttribute('data-emoji'), r.left + r.width / 2, r.top);
    });
  });
  setInterval(function () {
    if (document.hidden || test) return;
    var nowMs = kyivNow().getTime(), s = start.getTime();
    var inRealLive = (nowMs >= s && nowMs < s + LIVE_MS);
    var inEgLive = window.EVERGREEN && window.EVERGREEN.isLiveNow && window.EVERGREEN.isLiveNow();
    if (!(inRealLive || inEgLive)) return;
    if (Math.random() < 0.5) {
      var btn = reactBtns[Math.floor(Math.random() * reactBtns.length)];
      var count = btn.querySelector('[data-count]');
      count.textContent = +count.textContent + 1 + Math.floor(Math.random() * 3);
      var r = btn.getBoundingClientRect();
      floatEmoji(btn.getAttribute('data-emoji'), r.left + Math.random() * r.width, r.top);
    }
  }, 2500);

  /* ---------- розклад ---------- */
  (function buildSchedule() {
    var list = $('sched-list');
    var now = kyivNow(), d = new Date(now);
    d.setHours(19, 0, 0, 0);
    d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    var fmt = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' });
    for (var i = 0; i < 4; i++) {
      var dt = new Date(d);
      var label = fmt.format(dt);
      label = label.charAt(0).toUpperCase() + label.slice(1);
      var dtTag = dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate());
      var card = document.createElement('div');
      card.className = 'sched-card hud-card' + (i === 0 ? ' sched-card--next' : '');
      card.innerHTML =
        '<span class="corner tl"></span><span class="corner tr"></span>' +
        '<span class="corner bl"></span><span class="corner br"></span>' +
        (i === 0 ? '<span class="sched-card__badge">Найближчий ефір</span>' : '') +
        '<div class="sched-card__date">' + label + '</div>' +
        '<div class="sched-card__time">19:00 за Києвом</div>' +
        '<div class="sched-card__title">Електротранспорт. Від технології до бізнесу.</div>' +
        '<a class="btn btn--lime btn--sm" href="https://t.me/ivankosovych_bot?start=remind_' + dtTag + '" target="_blank" rel="noopener">Нагадати в Telegram</a>';
      list.appendChild(card);
      d = new Date(d);
      d.setDate(d.getDate() + 7);
    }
  })();

  /* ---------- демо-презентація ---------- */
  var slides = [
    { t: 'Знайомство', d: 'Ваш простір для презентацій: сцена ефіру, живий чат і реакції — все в одній кімнаті.' },
    { t: 'Зустрічі за розкладом', d: 'Від очікування до перегляду: таймер, автоматичний старт ефіру і нагадування в Telegram.' },
    { t: 'Перегляд у записі', d: 'У зручний для вас час: записи ефірів і бонусні матеріали завжди під рукою.' }
  ];
  var DEMO_MS = 30000, demoTimer = null, demoStart = 0, demoPaused = 0;
  var modal = $('demo-modal');

  function buildChapters() {
    var box = $('demo-chapters');
    box.innerHTML = '';
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'demo-chapter';
      b.textContent = '0' + (i + 1);
      b.addEventListener('click', function () { demoSeek(i * (DEMO_MS / slides.length)); });
      box.appendChild(b);
    });
  }
  function demoSeek(ms) {
    demoStart = Date.now() - ms;
    demoFrame();
  }
  function demoFrame() {
    var elapsed = Date.now() - demoStart;
    if (elapsed >= DEMO_MS) elapsed = DEMO_MS;
    var idx = Math.min(slides.length - 1, Math.floor(elapsed / (DEMO_MS / slides.length)));
    $('demo-kicker').textContent = '0' + (idx + 1) + ' / 0' + slides.length;
    $('demo-title').textContent = slides[idx].t;
    $('demo-text').textContent = slides[idx].d;
    $('demo-fill').style.width = (elapsed / DEMO_MS * 100) + '%';
    var chs = $('demo-chapters').children;
    for (var i = 0; i < chs.length; i++) chs[i].classList.toggle('is-active', i === idx);
    if (elapsed >= DEMO_MS && demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  }
  function openDemo() {
    buildChapters();
    modal.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    demoStart = Date.now();
    demoFrame();
    if (demoTimer) clearInterval(demoTimer);
    demoTimer = setInterval(demoFrame, 120);
  }
  function closeDemo() {
    modal.classList.add('is-hidden');
    document.body.style.overflow = '';
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  }
  $('open-demo').addEventListener('click', openDemo);
  $('open-demo-2').addEventListener('click', openDemo);
  $('demo-close').addEventListener('click', closeDemo);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeDemo(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDemo(); });
  $('demo-prev').addEventListener('click', function () {
    var idx = Math.min(slides.length - 1, Math.floor((Date.now() - demoStart) / (DEMO_MS / slides.length)));
    demoSeek(Math.max(0, idx - 1) * (DEMO_MS / slides.length));
  });
  $('demo-next').addEventListener('click', function () {
    var idx = Math.min(slides.length - 1, Math.floor((Date.now() - demoStart) / (DEMO_MS / slides.length)));
    demoSeek(Math.min(slides.length - 1, idx + 1) * (DEMO_MS / slides.length));
  });
  $('demo-replay').addEventListener('click', function () {
    demoStart = Date.now();
    if (!demoTimer) demoTimer = setInterval(demoFrame, 120);
    demoFrame();
  });

  /* ---------- тестовий запуск ---------- */
  $('test-launch').addEventListener('click', function () {
    var now = kyivNow().getTime();
    test = { waitUntil: now + 30000, liveUntil: now + 60000 };
    this.disabled = true;
    sysFlags['test'] = false;
    sysFlags['test-end'] = false;
    gotoTab('room');
    tick();
  });

  /* ---------- canvas ефіру ---------- */
  var canvas = $('stream-canvas'), ctx = canvas.getContext('2d');
  var cw = 0, chh = 0, off = 0;
  function sizeCanvas() {
    var r = canvas.getBoundingClientRect();
    cw = canvas.width = Math.max(2, Math.floor(r.width));
    chh = canvas.height = Math.max(2, Math.floor(r.height));
  }
  window.addEventListener('resize', sizeCanvas);
  function drawStream() {
    requestAnimationFrame(drawStream);
    if (stateLive.classList.contains('is-hidden') || document.hidden) return;
    if (!cw) sizeCanvas();
    off += 0.9;
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, cw, chh);
    var horizon = chh * 0.42, i, y;
    ctx.lineWidth = 1;
    for (i = -12; i <= 12; i++) {
      ctx.strokeStyle = 'rgba(215,249,36,0.16)';
      ctx.beginPath();
      ctx.moveTo(cw / 2 + i * cw * 0.035, horizon);
      ctx.lineTo(cw / 2 + i * cw * 0.11, chh);
      ctx.stroke();
    }
    var gap = 46, y0 = horizon + (off % gap);
    for (y = y0; y < chh; y += gap) {
      var p = (y - horizon) / (chh - horizon);
      ctx.strokeStyle = 'rgba(215,249,36,' + (0.05 + p * 0.22) + ')';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }
    var t = Date.now() / 1000, pulse = 0.10 + 0.05 * Math.sin(t * 1.4);
    var g = ctx.createRadialGradient(cw / 2, horizon, 10, cw / 2, horizon, cw * 0.45);
    g.addColorStop(0, 'rgba(215,249,36,' + pulse + ')');
    g.addColorStop(1, 'rgba(215,249,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, chh);
    ctx.fillStyle = 'rgba(10,14,21,0.92)';
    ctx.strokeStyle = 'rgba(215,249,36,0.55)';
    ctx.lineWidth = 2;
    var cx = cw / 2, base = chh * 0.98;
    ctx.beginPath();
    ctx.arc(cx, base - chh * 0.34, chh * 0.13, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, base + chh * 0.10, chh * 0.30, chh * 0.24, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (y = 0; y < chh; y += 4) ctx.fillRect(0, y, cw, 1);
  }

  sizeCanvas();
  tick();
  setInterval(tick, 1000);
  drawStream();
})();
