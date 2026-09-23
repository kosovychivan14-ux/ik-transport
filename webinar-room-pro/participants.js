/* webinar-room-pro / participants.js
 * Симуляція учасників ефіру: імена + країни з прапорами, події приєднання,
 * інтерактивна панель списку учасників (клік по лічильнику глядачів).
 * Кількість на лічильнику ЗАВЖДИ дорівнює довжині списку.
 */
(function () {
  'use strict';

  /* ---------- пул імен ---------- */
  var FIRST_M = ['Олександр','Петро','Дмитро','Андрій','Сергій','Тарас','Богдан','Максим','Владислав','Олег','Ігор','Юрій','Василь','Михайло','Роман','Назар','Остап','Захар','Тимофій','Артем','Денис','Євген','Павло','Степан','Микола','Віктор','Руслан','Святослав','Ярослав','Григорій'];
  var FIRST_F = ['Вікторія','Олена','Ірина','Марія','Наталія','Софія','Анна','Катерина','Ольга','Тетяна','Юлія','Дарина','Христина','Соломія','Оксана','Людмила','Зоряна','Марта','Василина','Олеся','Яна','Діана','Вероніка','Мілана','Єва','Аліна','Богдана','Роксолана','Тамара','Галина'];
  // [чоловіча форма, жіноча форма]
  var LAST = [
    ['Коваленко','Коваленко'],['Шевченко','Шевченко'],['Бондаренко','Бондаренко'],
    ['Ткаченко','Ткаченко'],['Савченко','Савченко'],['Петренко','Петренко'],
    ['Іваненко','Іваненко'],['Литвиненко','Литвиненко'],['Захарченко','Захарченко'],
    ['Кузьменко','Кузьменко'],['Тимошенко','Тимошенко'],['Степаненко','Степаненко'],
    ['Гриценко','Гриценко'],['Лисенко','Лисенко'],['Сидоренко','Сидоренко'],
    ['Бабківський','Бабківська'],['Дубровський','Дубровська'],['Мельник','Мельник'],
    ['Ковальчук','Ковальчук'],['Поліщук','Поліщук'],['Кравчук','Кравчук'],
    ['Олійник','Олійник'],['Гончар','Гончар'],['Мороз','Мороз'],
    ['Романюк','Романюк'],['Данилюк','Данилюк'],['Мартинюк','Мартинюк'],
    ['Костюк','Костюк'],['Павлюк','Павлюк'],['Шевчук','Шевчук'],
    ['Бондар','Бондар'],['Климчук','Климчук']
  ];
  // [прапор, країна, вага]
  var COUNTRIES = [
    ['🇺🇦','Україна',14],['🇵🇱','Польща',3],['🇩🇪','Німеччина',3],
    ['🇬🇧','Велика Британія',2],['🇺🇸','США',2],['🇨🇦','Канада',2],
    ['🇨🇿','Чехія',2],['🇪🇸','Іспанія',1],['🇮🇹','Італія',1],
    ['🇫🇷','Франція',1],['🇳🇱','Нідерланди',1],['🇮🇪','Ірландія',1]
  ];
  var countryBag = [];
  COUNTRIES.forEach(function (c) { for (var i = 0; i < c[2]; i++) countryBag.push([c[0], c[1]]); });

  var used = {};
  var list = [];
  var joinCb = null;

  function rnd(n) { return Math.floor(Math.random() * n); }

  function makeParticipant() {
    for (var tries = 0; tries < 60; tries++) {
      var f = Math.random() < 0.52;
      var name = (f ? FIRST_F[rnd(FIRST_F.length)] : FIRST_M[rnd(FIRST_M.length)]) + ' ' +
                 (f ? LAST[rnd(LAST.length)][1] : LAST[rnd(LAST.length)][0]);
      if (used[name]) continue;
      used[name] = true;
      var c = countryBag[rnd(countryBag.length)];
      return { name: name, f: f, flag: c[0], country: c[1], joinedAt: Date.now() };
    }
    return null; // пул вичерпано
  }

  function fmtAgo(ts) {
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'щойно';
    if (m < 60) return m + ' хв тому';
    var h = Math.round(m / 60);
    return h + ' год тому';
  }

  /* ---------- панель ---------- */
  var drawer, scrim, listEl, countEl, searchEl;

  function buildDrawer() {
    if (drawer) return;
    scrim = document.getElementById('p-scrim');
    drawer = document.getElementById('p-drawer');
    if (!drawer) return;
    listEl = document.getElementById('p-list');
    countEl = document.getElementById('p-count');
    searchEl = document.getElementById('p-search');
    var close = document.getElementById('p-close');
    if (close) close.addEventListener('click', api.close);
    if (scrim) scrim.addEventListener('click', api.close);
    if (searchEl) searchEl.addEventListener('input', render);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) api.close();
    });
    var w1 = document.getElementById('eg-watchers');
    if (w1) { w1.style.cursor = 'pointer'; w1.addEventListener('click', api.open); }
    var w2 = document.getElementById('viewers');
    if (w2) { w2.style.cursor = 'pointer'; w2.title = 'Показати учасників'; w2.addEventListener('click', api.open); }
  }

  function rowHtml(p) {
    return '<div class="p-row"><span class="p-row__flag">' + p.flag + '</span>' +
      '<span class="p-row__main"><strong>' + escapeHtml(p.name) + '</strong>' +
      '<span>' + escapeHtml(p.country) + ' · ' + fmtAgo(p.joinedAt) + '</span></span>' +
      '<span class="p-row__dot" title="Онлайн"></span></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    if (!listEl) return;
    var q = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : '';
    var items = list.slice().sort(function (a, b) { return b.joinedAt - a.joinedAt; });
    if (q) {
      items = items.filter(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1 || p.country.toLowerCase().indexOf(q) !== -1;
      });
    }
    if (countEl) countEl.textContent = list.length;
    listEl.innerHTML = items.length
      ? items.map(rowHtml).join('')
      : '<div class="p-empty">Нікого не знайдено</div>';
  }

  /* ---------- публічний API ---------- */
  var api = {
    reset: function (n) {
      used = {}; list = [];
      var now = Date.now();
      for (var i = 0; i < n; i++) {
        var p = makeParticipant();
        if (!p) break;
        p.joinedAt = now - rnd(40) * 60000 - rnd(60000); // розкид «приєднань» у минулому
        list.push(p);
      }
      render();
    },
    joinOne: function () {
      var p = makeParticipant();
      if (!p) return null;
      p.joinedAt = Date.now();
      list.push(p);
      render();
      if (joinCb) { try { joinCb(p); } catch (e) {} }
      return p;
    },
    count: function () { return list.length; },
    all: function () { return list.slice(); },
    onJoin: function (cb) { joinCb = cb; },
    open: function () {
      buildDrawer();
      if (!drawer) return;
      render();
      drawer.classList.add('is-open');
      if (scrim) scrim.classList.remove('is-hidden');
      if (searchEl) { searchEl.value = ''; setTimeout(function () { try { searchEl.focus(); } catch (e) {} }, 300); }
    },
    close: function () {
      if (!drawer) return;
      drawer.classList.remove('is-open');
      if (scrim) scrim.classList.add('is-hidden');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildDrawer);
  } else {
    buildDrawer();
  }

  window.WRP_PARTICIPANTS = api;
})();
