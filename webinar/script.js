/* ============================================================
   Вебінар «Інструменти доходу різного рівня ризику»
   script.js — прогресивне покращення, жодної критичної логіки.

   Принципи:
   - повна читабельність без JS (reveal-стани вмикаються лише
     через клас `js` на <html>, який додає цей скрипт);
   - анімації тільки transform/opacity;
   - повага до prefers-reduced-motion;
   - жодних зовнішніх залежностей (GSAP не потрібен і не
     використовується — скрипт працює автономно).
   ============================================================ */
(function () {
  'use strict';

  var doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.documentElement) { return; }

  var root = doc.documentElement;
  root.classList.add('js');

  var reduced = false;
  try {
    reduced = typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* matchMedia недоступний — вважаємо рух дозволеним */ }

  /* ---------- scroll-reveal через IntersectionObserver ---------- */
  function revealAll() {
    var items = doc.querySelectorAll('.reveal');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.add('in');
    }
  }

  function initReveal() {
    var items = doc.querySelectorAll('.reveal');
    if (!items.length) { return; }

    // Зменшений рух: показати все одразу, без анімацій.
    if (reduced) { revealAll(); return; }

    var IO = typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : null;
    if (!IO) { revealAll(); return; }

    var observer = new IO(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    for (var j = 0; j < items.length; j++) {
      observer.observe(items[j]);
    }
  }

  /* ---------- м'який паралакс світіння за hero (transform/opacity) ---------- */
  function initHeroGlow() {
    if (reduced) { return; }
    var glow = doc.querySelector('.photo-stage .glow');
    if (!glow) { return; }

    var raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : function (cb) { return setTimeout(cb, 16); };

    var targetY = 0;
    var currentY = 0;

    function onScroll() {
      var y = typeof window !== 'undefined' && typeof window.scrollY === 'number'
        ? window.scrollY
        : 0;
      // Ледь помітний зсув світіння проти скролу, обмежений 60px.
      targetY = Math.max(-60, Math.min(60, y * -0.08));
    }

    function tick() {
      currentY += (targetY - currentY) * 0.08;
      if (Math.abs(targetY - currentY) > 0.1) {
        glow.style.transform = 'translate3d(0,' + currentY.toFixed(1) + 'px,0)';
      }
      raf(tick);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    raf(tick);
  }

  /* ---------- м'яка пульсація головного CTA (тільки transform/opacity) ---------- */
  function initCtaPulse() {
    if (reduced) { return; }
    var cta = doc.querySelector('.hero-cta .btn-big');
    if (!cta) { return; }

    var hovering = false;
    cta.addEventListener('mouseenter', function () { hovering = true; });
    cta.addEventListener('mouseleave', function () { hovering = false; });

    var start = Date.now();
    var raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : function (cb) { return setTimeout(cb, 50); };

    (function pulse() {
      if (!hovering) {
        var t = (Date.now() - start) / 1000;
        var s = 1 + Math.sin(t * 1.6) * 0.022;
        cta.style.transform = 'scale(' + s.toFixed(4) + ')';
      } else if (cta.style.transform) {
        cta.style.transform = '';
      }
      raf(pulse);
    })();
  }

  /* ---------- старт ---------- */
  function ready(fn) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initReveal();
    initHeroGlow();
    initCtaPulse();
  });
})();
