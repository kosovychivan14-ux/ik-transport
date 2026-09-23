/* webinar-room-pro · v1 AI-рекрутинг
 * Модулі: кваліфікаційний гейт, AI-модератор «Помічник Івана»,
 * timed CTA, опитування, скоринг лідів, Telegram follow-up, LiveKit-шар.
 * v1.1 (заплановано): evergreen 24/7, AI-нарізка кліпів, бронювання дзвінка, сертифікати.
 */
(function () {
  'use strict';
  var CFG = window.WEBINAR_CONFIG || {};
  var TG = CFG.TG_BOT || 'https://t.me/ivankosovych_bot';
  var SCORE = CFG.SCORE || {};
  var PITCH_MOMENT = CFG.PITCH_MOMENT || 90;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function kyivNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  }
  function store(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function read(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  /* ============ 1. КВАЛІФІКАЦІЙНИЙ ГЕЙТ ============ */
  var PROFILE_KEY = 'wrp_profile';
  var profile = read(PROFILE_KEY);
  var qualModal = $('qual-modal');

  function showQual() { if (qualModal) qualModal.classList.remove('is-hidden'); }
  function hideQual() { if (qualModal) qualModal.classList.add('is-hidden'); }

  if (!profile) {
    showQual();
    document.body.style.overflow = 'hidden';
    // міні-ап: підставляємо ім'я з Telegram, щоб не вводити вручну
    if (window.TG_USER_NAME) {
      var qn = $('qual-name'); if (qn && !qn.value) qn.value = window.TG_USER_NAME;
      var qs = $('qual-source'); if (qs && !qs.value) qs.value = 'Telegram';
    }
  }
  var qualForm = $('qual-form');
  if (qualForm) qualForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('qual-name').value.trim();
    var source = $('qual-source').value.trim();
    var goal = $('qual-goal').value;
    var timeEl = document.querySelector('input[name="qual-time"]:checked');
    if (!name || !source || !goal || !timeEl) return;
    profile = { name: name, source: source, goal: goal, time: timeEl.value, ts: Date.now() };
    store(PROFILE_KEY, profile);
    hideQual();
    document.body.style.overflow = '';
    addScore('qualification', SCORE.qualification || 20);
    setTimeout(function () {
      addBotMsg('Вітаємо, ' + name + '! 👋 Я — Помічник Івана. Питайте що завгодно про бізнес, команду чи ефір — відповім одразу. Можна просто написати «@аі» + питання.');
    }, 900);
  });

  /* ============ 2. AI-МОДЕРАТОР «ПОМІЧНИК ІВАНА» ============ */
  /* База знань: стисло, дружньо, українською.
     ЗАБОРОНЕНО вигадувати цифри доходу чи гарантії — на питання про заробіток
     відповідаємо загально + пропонуємо дзвінок 1:1. */
  var KB = [
    { k: ['що за бізнес', 'що це за бізнес', 'про що бізнес', 'чим займаєтесь', 'чим займаєтеся', 'суть бізнесу', 'що ви робите'],
      a: 'Це IK Transport: електротранспорт як актив. Автомобіль не просто їздить — він працює 24/7 і приносить дохід власнику, а команда партнерів допомагає все налаштувати.' },
    { k: ['як приєднатися', 'як приєднатись', 'як долучитися', 'як долучитись', 'як вступити', 'як стати партнером', 'стати партнером', 'хочу в команду', 'приєднатися'],
      a: 'Все просто: тисніть кнопку «Приєднатися до команди» — вона відкриє наш Telegram-бот, там кілька кроків і ви в команді. Або напишіть «хочу дзвінок» — домовимось про розмову 1:1.' },
    { k: ['досвід', 'без досвіду', 'новачок', 'чи потрібен досвід', 'потрібен досвід', 'нічого не вмію', 'не розбираюсь'],
      a: 'Досвід не потрібен — навчаємо з нуля. Більшість партнерів починали без жодного бекграунду в авто чи бізнесі, поруч завжди наставник.' },
    { k: ['скільки часу', 'часу треба', 'годин', '5 годин', 'часу потрібно', 'зайнятість'],
      a: 'Достатньо від 5 годин на тиждень — це можна поєднувати з основною роботою. Головне регулярність, а не марафони.' },
    { k: ['що робити', 'що треба робити', 'мої дії', 'обовʼязки', 'обовязки', 'чим займатися', 'щодня'],
      a: 'Щодня — прості кроки за чек-листом: робота з авто та системою, спілкування з командою, навчання. Все показуємо покроково, ви не залишитесь сам на сам.' },
    { k: ['скільки зароблю', 'скільки можна заробити', 'дохід', 'заробіток', 'прибуток', 'скільки платять', 'яка зарплата', 'окупність'],
      a: 'Конкретні цифри залежать від вашої активності, авто та ринку — гарантій доходу ніхто чесний не дасть. Хочете розібрати саме вашу ситуацію? Напишіть «хочу дзвінок» — на розмові 1:1 все порахуємо.' },
    { k: ['коли ефір', 'наступний ефір', 'коли наступний', 'розклад', 'коли початок', 'о котрій'],
      a: 'Ефіри — щочетверга о 19:00 за Києвом. Розклад і кнопка нагадування — у вкладці «Розклад».' },
    { k: ['запис', 'де запис', 'переглянути запис', 'пропустив', 'пропустила'],
      a: 'Запис зʼявляється у вкладці «Записи» та в нашому Telegram-боті одразу після ефіру. Не загубите!' },
    { k: ['бонус', 'подарунок', 'чек-лист', 'чеклист', 'калькулятор'],
      a: 'Бонус учасника ефіру — чек-лист «10 кроків до авто, що заробляє» + калькулятор окупності. Забрати можна кнопкою в блоці «Бонус» або через Telegram-бота.' },
    { k: ['контакт', 'звʼязатися', 'звязатися', 'написати', 'телефон', 'як знайти'],
      a: 'Найшвидше — наш Telegram-бот: там і команда, і матеріали, і запис на дзвінок. Кнопка «Telegram-бот» є вгорі сторінки.' },
    { k: ['команда', 'партнери', 'спільнота', 'хто в команді'],
      a: 'Команда IK Transport — це партнери, які вже запустили свої авто в систему. Новачків ведуть наставники: навчання, чати підтримки, живі розбори.' },
    { k: ['ціна', 'скільки коштує', 'вартість', 'вхід', 'інвестиції', 'вкладення'],
      a: 'Умови залежать від формату участі — їх розбираємо індивідуально. Напишіть «хочу дзвінок», і на розмові 1:1 все детально пояснимо без зобовʼязань.' },
    { k: ['ризик', 'ризики', 'безпечно', 'шахрайство', 'лохотрон', 'піраміда'],
      a: 'Чесне питання! У нас реальний актив — автомобіль, і прозора система роботи. Приходьте на ефір у четвер, ставте незручні питання в прямому ефірі — відповімо на все.' },
    { k: ['іван', 'косович', 'спікер', 'хто веде'],
      a: 'Іван Косович — засновник IK Transport. Сам пройшов шлях від одного авто до системи, що працює 24/7, і тепер масштабує її через команду партнерів.' },
    { k: ['привіт', 'добрий день', 'доброго дня', 'добрий вечір', 'hello', 'hi'],
      a: 'Привіт! 👋 Я — Помічник Івана. Можу розповісти про бізнес, команду, ефіри та бонуси. Що цікавить?' }
  ];
  var DEFAULT_ANSWER = 'Гарне питання! Точну відповідь краще дати персонально — напишіть «хочу дзвінок», і ми домовимось про розмову 1:1. Або спитайте про бізнес, команду, ефіри чи бонус — тут відповім одразу.';

  function botAnswer(text) {
    var t = (text || '').toLowerCase();
    var best = null;
    for (var i = 0; i < KB.length; i++) {
      var keys = KB[i].k;
      for (var j = 0; j < keys.length; j++) {
        if (t.indexOf(keys[j]) >= 0) { best = KB[i].a; break; }
      }
      if (best) break;
    }
    return best || DEFAULT_ANSWER;
  }
  function wantsBot(text) {
    var t = (text || '').toLowerCase();
    if (t.indexOf('@аі') >= 0 || t.indexOf('@ai') >= 0 || t.indexOf('помічник') >= 0) return true;
    if (botAnswer(text) !== DEFAULT_ANSWER) return true;
    return t.indexOf('?') >= 0;
  }

  /* повідомлення бота в живому чаті */
  var chatBox = $('chat-messages');
  function addBotMsg(text) {
    if (!chatBox) return;
    var div = document.createElement('div');
    div.className = 'msg msg--bot';
    var strong = document.createElement('strong');
    strong.className = 'msg__name';
    strong.textContent = '🤖 Помічник Івана';
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

  var botCooldown = 0;
  window.addEventListener('wrp:chat-sent', function (e) {
    var text = e.detail && e.detail.text ? e.detail.text : '';
    addScore('chatMessage', SCORE.chatMessage || 10);
    if (!wantsBot(text)) return;
    var now = Date.now();
    if (now - botCooldown < 2500) return;
    botCooldown = now;
    setTimeout(function () { addBotMsg(botAnswer(text)); }, 900 + Math.random() * 900);
  });

  /* бот на вкладці «Записи» (як Demio — відповідає навіть на записах) */
  var recForm = $('rec-ai-form');
  if (recForm) {
    var recBox = $('rec-ai-messages');
    function recMsg(text, me) {
      var div = document.createElement('div');
      div.className = 'rec-ai__msg' + (me ? ' rec-ai__msg--me' : '');
      div.textContent = text;
      recBox.appendChild(div);
      recBox.scrollTop = recBox.scrollHeight;
    }
    recMsg('Привіт! Я — Помічник Івана 🤖 Питайте про бізнес, команду чи записи — відповім навіть тут.');
    recForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('rec-ai-input'), v = input.value.trim();
      if (!v) return;
      recMsg(v, true);
      input.value = '';
      setTimeout(function () { recMsg(botAnswer(v), false); }, 800);
    });
  }

  /* ============ 3. TIMED CTA ============ */
  var ctaModal = $('cta-modal');
  var ctaShown = false;
  function showCTA() {
    if (!ctaModal || ctaShown) return;
    ctaShown = true;
    ctaModal.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    addBotMsg('🔥 Момент рішення! Якщо відчуваєте, що це ваше — тисніть «Приєднатися до команди». Або оберіть «Хочу дзвінок 1:1», і ми все розберемо особисто.');
  }
  function hideCTA() {
    if (!ctaModal) return;
    ctaModal.classList.add('is-hidden');
    document.body.style.overflow = '';
  }
  var ctaClose = $('cta-close');
  if (ctaClose) ctaClose.addEventListener('click', hideCTA);
  if (ctaModal) ctaModal.addEventListener('click', function (e) { if (e.target === ctaModal) hideCTA(); });

  var ctaJoin = $('cta-join'), ctaCall = $('cta-call');
  if (ctaJoin) {
    ctaJoin.href = TG;
    ctaJoin.addEventListener('click', function () {
      addScore('ctaClick', SCORE.ctaClick || 25);
      setTimeout(hideCTA, 600);
    });
  }
  if (ctaCall) {
    ctaCall.href = TG + '?start=call_1to1';
    ctaCall.addEventListener('click', function () {
      addScore('ctaClick', SCORE.ctaClick || 25);
      setTimeout(hideCTA, 600);
    });
  }

  /* ============ 4. ОПИТУВАННЯ ============ */
  var pollsBox = $('polls');
  var pollsDone = {};
  function renderPoll(poll, isTest) {
    if (!pollsBox || pollsDone[poll.id]) return;
    pollsDone[poll.id] = true;
    var card = document.createElement('div');
    card.className = 'poll hud-card';
    var opts = poll.options.map(function (o, i) {
      return '<button type="button" class="poll__opt" data-i="' + i + '">' +
        '<span class="poll__opt-text">' + o + '</span>' +
        '<span class="poll__bar"><span class="poll__fill" style="width:0%"></span></span>' +
        '<span class="poll__pct mono">0%</span></button>';
    }).join('');
    card.innerHTML =
      '<span class="corner tl"></span><span class="corner tr"></span>' +
      '<span class="corner bl"></span><span class="corner br"></span>' +
      '<div class="poll__kicker mono">ОПИТУВАННЯ · LIVE</div>' +
      '<h3 class="poll__q">' + poll.question + '</h3>' +
      '<div class="poll__opts">' + opts + '</div>';
    pollsBox.appendChild(card);

    var votes = poll.options.map(function () { return 3 + Math.floor(Math.random() * 12); });
    var voted = false;
    var fills = card.querySelectorAll('.poll__fill');
    var pcts = card.querySelectorAll('.poll__pct');
    function paint() {
      var total = votes.reduce(function (a, b) { return a + b; }, 0) || 1;
      votes.forEach(function (v, i) {
        var p = Math.round(v / total * 100);
        fills[i].style.width = p + '%';
        pcts[i].textContent = p + '%';
      });
    }
    paint();
    var simTimer = setInterval(function () {
      if (document.hidden) return;
      votes[Math.floor(Math.random() * votes.length)] += 1 + Math.floor(Math.random() * 4);
      paint();
    }, 2200);
    if (isTest) setTimeout(function () { clearInterval(simTimer); }, 30000);

    var btns = card.querySelectorAll('.poll__opt');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (voted) return;
        voted = true;
        votes[+b.getAttribute('data-i')] += 1;
        paint();
        btns.forEach(function (x) { x.classList.add('is-voted'); });
        b.classList.add('is-mine');
        addScore('pollVote', SCORE.pollVote || 15);
      });
    });
  }

  /* ============ 5. СКОРИНГ ============ */
  var LEADS_KEY = 'wrp_leads';
  var myScore = { total: 0, breakdown: {} };
  function levelOf(total) {
    if (total >= (CFG.LEVEL_HOT || 100)) return '🔥 гарячий';
    if (total >= (CFG.LEVEL_WARM || 40)) return '🟡 теплий';
    return '⚪ холодний';
  }
  function saveLead() {
    if (!profile) return;
    var leads = read(LEADS_KEY) || [];
    var entry = {
      name: profile.name, goal: profile.goal, source: profile.source,
      time: profile.time, total: myScore.total,
      breakdown: Object.assign({}, myScore.breakdown),
      level: levelOf(myScore.total), updated: new Date().toISOString()
    };
    var idx = -1;
    for (var i = 0; i < leads.length; i++) {
      if (leads[i].name === entry.name && leads[i].source === entry.source) { idx = i; break; }
    }
    if (idx >= 0) leads[idx] = entry; else leads.push(entry);
    store(LEADS_KEY, leads);
    renderLeads();
  }
  function addScore(key, pts) {
    if (!pts) return;
    myScore.total += pts;
    myScore.breakdown[key] = (myScore.breakdown[key] || 0) + pts;
    saveLead();
  }

  /* хвилини перегляду LIVE */
  var liveActive = false;
  setInterval(function () {
    if (liveActive && !document.hidden) addScore('watchMinute', SCORE.watchMinute || 5);
  }, 60000);

  /* реакції */
  document.querySelectorAll('.react').forEach(function (btn) {
    btn.addEventListener('click', function () { addScore('reaction', SCORE.reaction || 3); });
  });

  /* ============ панель «Ліди» (режим ведучого ?host=1) ============ */
  var isHost = false;
  try { isHost = new URLSearchParams(window.location.search).get('host') === '1'; } catch (e) {}
  var hostBar = $('host-bar'), leadsPanel = $('leads-panel');
  if (isHost && hostBar) hostBar.classList.remove('is-hidden');

  var BREAKDOWN_LABELS = {
    qualification: 'Кваліфікація', watchMinute: 'Перегляд (хв)',
    chatMessage: 'Чат', reaction: 'Реакції', pollVote: 'Опитування', ctaClick: 'Клік CTA'
  };
  function renderLeads() {
    if (!leadsPanel || leadsPanel.classList.contains('is-hidden')) return;
    var body = $('leads-body');
    var leads = read(LEADS_KEY) || [];
    if (!leads.length) {
      body.innerHTML = '<p class="leads-panel__empty">Поки що немає даних — дочекайтесь перших глядачів.</p>';
      return;
    }
    leads.sort(function (a, b) { return b.total - a.total; });
    body.innerHTML = leads.map(function (l) {
      var parts = Object.keys(l.breakdown || {}).map(function (k) {
        return (BREAKDOWN_LABELS[k] || k) + ': +' + l.breakdown[k];
      }).join(' · ');
      return '<div class="lead-row">' +
        '<div class="lead-row__main"><strong>' + escapeHtml(l.name) + '</strong>' +
        '<span class="lead-row__level">' + l.level + '</span></div>' +
        '<div class="lead-row__meta mono">' + l.total + ' балів · ' + escapeHtml(parts || '—') + '</div>' +
        '<div class="lead-row__sub">Ціль: ' + escapeHtml(l.goal) + ' · Звідки: ' + escapeHtml(l.source) + ' · 5+ год/тиж: ' + (l.time === 'yes' ? 'так' : 'ні') + '</div>' +
        '</div>';
    }).join('');
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var leadsToggle = $('host-leads-toggle');
  if (leadsToggle) leadsToggle.addEventListener('click', function () {
    leadsPanel.classList.toggle('is-hidden');
    renderLeads();
  });
  var hostCtaNow = $('host-cta-now');
  if (hostCtaNow) hostCtaNow.addEventListener('click', function () {
    ctaShown = false;
    showCTA();
  });
  var exportBtn = $('leads-export');
  if (exportBtn) exportBtn.addEventListener('click', function () {
    var leads = read(LEADS_KEY) || [];
    var rows = [['name', 'goal', 'source', 'hours5plus', 'total', 'level', 'breakdown', 'updated']];
    leads.forEach(function (l) {
      rows.push([l.name, l.goal, l.source, l.time, l.total, l.level,
        JSON.stringify(l.breakdown || {}), l.updated]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'webinar-leads.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  /* ============ таймінг LIVE-подій ============ */
  var liveTimers = [];
  function clearLiveTimers() { liveTimers.forEach(clearTimeout); liveTimers = []; }
  function onLiveStart(isTest, isEvergreen) {
    liveActive = true;
    clearLiveTimers();
    // evergreen 24/7: опитування й CTA веде движок evergreen.js за часом відтворення вебінару
    if (isEvergreen) return;
    var polls = CFG.POLLS || [];
    var d1 = isTest ? 8000 : (CFG.POLL_DELAY_1 || 60) * 1000;
    var d2 = isTest ? 15000 : (CFG.POLL_DELAY_2 || 150) * 1000;
    var dp = isTest ? 15000 : PITCH_MOMENT * 1000;
    if (polls[0]) liveTimers.push(setTimeout(function () { renderPoll(polls[0], isTest); }, d1));
    if (polls[1]) liveTimers.push(setTimeout(function () { renderPoll(polls[1], isTest); }, d2));
    liveTimers.push(setTimeout(showCTA, dp));
    initLiveKitStream();
  }
  function onLiveEnd() {
    liveActive = false;
    clearLiveTimers();
    stopLiveKitStream();
    setTimeout(function () {
      addBotMsg('Ефір завершено! 🎬 Запис і бонусні матеріали вже чекають у Telegram-боті — тисніть «Отримати запис у Telegram».');
    }, 1200);
  }
  window.addEventListener('wrp:live-start', function (e) {
    var isEvergreen = !!(e && e.detail && e.detail.evergreen);
    onLiveStart(false, isEvergreen);
  });
  window.addEventListener('wrp:test-live-start', function () { onLiveStart(true, false); });
  window.addEventListener('wrp:live-end', onLiveEnd);
  window.addEventListener('wrp:test-live-end', onLiveEnd);

  /* ============ 6. TELEGRAM FOLLOW-UP ============ */
  var notifyBtn = $('notify-btn');
  function nextEventMs() {
    var now = kyivNow(), d = new Date(now);
    d.setHours(CFG.START_HOUR || 19, 0, 0, 0);
    var delta = ((CFG.WEEKDAY != null ? CFG.WEEKDAY : 4) - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d.getTime();
  }
  function paintNotify() {
    if (!notifyBtn) return;
    var st = read('wrp_notify');
    if (st && st.on) {
      notifyBtn.querySelector('.ghost-btn__text').innerHTML =
        'Нагадування увімкнено ✓<small>Сповістимо про початок ефіру</small>';
    }
  }
  paintNotify();
  if (notifyBtn) notifyBtn.addEventListener('click', function () {
    if (!('Notification' in window)) {
      notifyBtn.querySelector('.ghost-btn__text').innerHTML =
        'Не підтримується<small>Ваш браузер не вміє сповіщення — скористайтесь кнопкою «Нагадати в Telegram»</small>';
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return;
      store('wrp_notify', { on: true });
      paintNotify();
      var wait = nextEventMs() - Date.now();
      if (wait > 0 && wait < 2147483647) {
        setTimeout(function () {
          try {
            new Notification('🔴 Ефір IK Transport розпочинається!', {
              body: 'Приєднуйтесь до прямого ефіру просто зараз.',
              tag: 'wrp-live'
            });
          } catch (e) {}
        }, wait);
      }
    });
  });

  /* ============ 7. LIVEKIT-ШАР ============ */
  var lkRoom = null, lkScriptLoading = false;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function liveKitConfigured() {
    return !!(CFG.LIVEKIT_URL && CFG.TOKEN_ENDPOINT);
  }
  function initLiveKitStream() {
    if (!liveKitConfigured() || lkRoom || lkScriptLoading) return;
    lkScriptLoading = true;
    loadScript('vendor/livekit/livekit-client.umd.js').then(function () {
      var Client = window.LivekitClient;
      if (!Client) { lkScriptLoading = false; return; }
      var identity = 'viewer-' + Math.random().toString(36).slice(2, 10);
      return fetch(CFG.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: identity, room: CFG.ROOM_NAME || 'ik-webinar' })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.token) throw new Error('no token');
          var room = new Client.Room({ adaptiveStream: true, dynacast: true });
          lkRoom = room;
          room.on(Client.RoomEvent.TrackSubscribed, function (track) {
            if (track.kind === Client.Track.Kind.Video) {
              var v = $('livekit-video');
              track.attach(v);
              v.classList.remove('is-hidden');
              var cv = $('stream-canvas');
              if (cv) cv.classList.add('is-hidden');
              var note = $('livekit-note');
              if (note) note.classList.remove('is-hidden');
            }
          });
          return room.connect(CFG.LIVEKIT_URL, j.token);
        })
        .catch(function () {
          /* токен/зʼєднання недоступні — лишаємось на симуляції, демо не ламається */
          lkRoom = null;
        })
        .then(function () { lkScriptLoading = false; });
    }).catch(function () { lkScriptLoading = false; });
  }
  function stopLiveKitStream() {
    if (lkRoom) {
      try { lkRoom.disconnect(); } catch (e) {}
      lkRoom = null;
    }
    var v = $('livekit-video');
    if (v) { v.classList.add('is-hidden'); v.srcObject = null; }
    var cv = $('stream-canvas');
    if (cv) cv.classList.remove('is-hidden');
    var note = $('livekit-note');
    if (note) note.classList.add('is-hidden');
  }

  /* v1.1 hooks: evergreen / кліпи / дзвінки / сертифікати підключатимуться тут */
  window.WRP = window.WRP || {};
  window.WRP.showCTA = showCTA;
  window.WRP.addScore = addScore;
  window.WRP.botAnswer = botAnswer;
  window.WRP.renderPoll = renderPoll;
  window.WRP.resetLiveHooks = function () { ctaShown = false; pollsDone = {}; };
})();
