/* Вебінарна кімната v2 — Neon Evo. Вебінар: щочетверга 19:00 за Києвом. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Kyiv time ---------- */
  function kyivNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  }

  function nextWebinarStart(from) {
    var d = new Date(from);
    d.setHours(19, 0, 0, 0);
    var delta = (4 - d.getDay() + 7) % 7; // Thursday = 4
    d.setDate(d.getDate() + delta);
    if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
    return d;
  }

  var LIVE_MS = 2 * 60 * 60 * 1000;
  var ENDED_MS = 30 * 60 * 1000;

  var start = nextWebinarStart(kyivNow());
  // Якщо ми всередині вікна ефіру, start має бути "сьогоднішнім" четвергом:
  (function fixStart() {
    var now = kyivNow();
    var probe = new Date(start); probe.setDate(probe.getDate() - 7);
    if (now.getTime() >= probe.getTime() && now.getTime() < probe.getTime() + LIVE_MS + ENDED_MS) {
      start = probe;
    }
  })();

  var statePrelive = $('state-prelive'), stateLive = $('state-live'), stateEnded = $('state-ended');
  var statusPill = $('status-pill'), statusText = $('status-text');

  function setState(name) {
    statePrelive.classList.toggle('is-hidden', name !== 'prelive');
    stateLive.classList.toggle('is-hidden', name !== 'live');
    stateEnded.classList.toggle('is-hidden', name !== 'ended');
    statusPill.classList.toggle('pill--live', name === 'live');
    if (name === 'live') { statusText.textContent = 'Прямий ефір'; }
    else if (name === 'ended') { statusText.textContent = 'Ефір завершено'; }
    else { statusText.textContent = 'Очікування ефіру'; }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var now = kyivNow();
    var t = now.getTime(), s = start.getTime();
    var state = (t >= s && t < s + LIVE_MS) ? 'live'
      : (t >= s + LIVE_MS && t < s + LIVE_MS + ENDED_MS) ? 'ended' : 'prelive';
    setState(state);

    if (state === 'prelive') {
      var target = s > t ? start : nextWebinarStart(now);
      if (s <= t) start = target;
      var diff = Math.max(0, target.getTime() - t);
      $('cd-d').textContent = pad(Math.floor(diff / 86400000));
      $('cd-h').textContent = pad(Math.floor(diff / 3600000) % 24);
      $('cd-m').textContent = pad(Math.floor(diff / 60000) % 60);
      $('cd-s').textContent = pad(Math.floor(diff / 1000) % 60);
    }

    var clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    $('clock').textContent = clock;
    $('footer-clock').textContent = 'Київ · ' + clock;

    highlightProgram(now, state);
  }

  /* ---------- program ---------- */
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

  /* ---------- viewers ---------- */
  var viewers = 240 + Math.floor(Math.random() * 140);
  function tickViewers() {
    viewers = Math.max(120, Math.min(900, viewers + Math.floor(Math.random() * 17) - 8));
    $('viewers').textContent = viewers;
    $('chat-online').textContent = Math.max(50, viewers - Math.floor(Math.random() * 30));
  }
  tickViewers();
  setInterval(tickViewers, 3000);

  /* ---------- chat ---------- */
  var chatBox = $('chat-messages');
  var names = ['Олександр', 'Марія', 'Дмитро', 'Олена', 'Андрій', 'Ірина', 'Тарас', 'Софія', 'Богдан', 'Наталія', 'Юрій', 'Катерина'];
  var texts = [
    'Добрий вечір! Чутно добре?',
    'Чекаю початок 🔥',
    'Звук є, картинка супер',
    'Нарешті конкретика, а не мотивація',
    'А запис ефіру буде?',
    'Вже рахую окупність 😄',
    'Який пробіг на добу потрібен для виходу в плюс?',
    'Привіт з Києва!',
    'Питання: батарея скільки живе в такому режимі?',
    'Дякую, дуже чітко пояснюєте',
    'А для Львова це працює?',
    'Чекаю блок про підключення авто',
    'Вперше на вебінарі, поки все зрозуміло 👍',
    'Скільки коштує вхід у систему?'
  ];

  function kyivTimeShort() {
    var n = kyivNow();
    return pad(n.getHours()) + ':' + pad(n.getMinutes());
  }

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
    time.textContent = kyivTimeShort();
    div.appendChild(strong);
    div.appendChild(span);
    div.appendChild(time);
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

  // стартові повідомлення
  var seedIdx = {};
  for (var i = 0; i < 6; i++) {
    var ni = Math.floor(Math.random() * names.length);
    var ti = Math.floor(Math.random() * texts.length);
    if (seedIdx[ti]) continue;
    seedIdx[ti] = 1;
    addMsg(names[ni], texts[ti], false);
  }

  setInterval(function () {
    if (document.hidden) return;
    addMsg(names[Math.floor(Math.random() * names.length)], texts[Math.floor(Math.random() * texts.length)], false);
  }, 6000);

  $('chat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('chat-input');
    var v = input.value.trim();
    if (!v) return;
    addMsg('', v, true);
    input.value = '';
  });

  /* ---------- reactions ---------- */
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

  document.querySelectorAll('.react').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var count = btn.querySelector('[data-count]');
      count.textContent = +count.textContent + 1;
      var r = btn.getBoundingClientRect();
      floatEmoji(btn.getAttribute('data-emoji'), r.left + r.width / 2, r.top);
    });
  });

  // живі реакції під час ефіру
  setInterval(function () {
    if (document.hidden) return;
    var now = kyivNow().getTime(), s = start.getTime();
    if (!(now >= s && now < s + LIVE_MS)) return;
    if (Math.random() < 0.5) {
      var btns = document.querySelectorAll('.react');
      var btn = btns[Math.floor(Math.random() * btns.length)];
      var count = btn.querySelector('[data-count]');
      count.textContent = +count.textContent + 1 + Math.floor(Math.random() * 3);
      var r = btn.getBoundingClientRect();
      floatEmoji(btn.getAttribute('data-emoji'), r.left + Math.random() * r.width, r.top);
    }
  }, 2500);

  /* ---------- live canvas (simulated stream backdrop) ---------- */
  var canvas = $('stream-canvas');
  var ctx = canvas.getContext('2d');
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

    // перспективна сітка
    var horizon = chh * 0.42;
    ctx.strokeStyle = 'rgba(215,249,36,0.16)';
    ctx.lineWidth = 1;
    for (var i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(cw / 2 + i * cw * 0.035, horizon);
      ctx.lineTo(cw / 2 + i * cw * 0.11, chh);
      ctx.stroke();
    }
    var gap = 46, y0 = horizon + (off % gap);
    for (var y = y0; y < chh; y += gap) {
      var p = (y - horizon) / (chh - horizon);
      ctx.strokeStyle = 'rgba(215,249,36,' + (0.05 + p * 0.22) + ')';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }

    // пульсуюче світіння
    var t = Date.now() / 1000;
    var pulse = 0.10 + 0.05 * Math.sin(t * 1.4);
    var g = ctx.createRadialGradient(cw / 2, horizon, 10, cw / 2, horizon, cw * 0.45);
    g.addColorStop(0, 'rgba(215,249,36,' + pulse + ')');
    g.addColorStop(1, 'rgba(215,249,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, chh);

    // силует спікера (абстрактна "голова-плечі")
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

    // сканлайни
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (var sy = 0; sy < chh; sy += 4) ctx.fillRect(0, sy, cw, 1);
  }

  // системне повідомлення при старті ефіру
  var announced = false;
  setInterval(function () {
    var now = kyivNow().getTime(), s = start.getTime();
    if (!announced && now >= s && now < s + LIVE_MS) {
      announced = true;
      addSys('Іван Косович приєднався до ефіру');
    }
    if (now >= s + LIVE_MS + ENDED_MS) announced = false;
  }, 5000);

  sizeCanvas();
  tick();
  setInterval(tick, 1000);
  drawStream();
})();
