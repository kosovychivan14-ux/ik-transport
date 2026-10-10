(() => {
  'use strict';
  document.getElementById('year').textContent = String(new Date().getFullYear());
  // Reveal only off-screen sections; the opening content never waits on animation.
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px 35px 0px' });
    document.querySelectorAll('.showcase-heading, .mobility-card, .host-story, .section-heading, .step-grid article, .lessons article, .fit, .faq-list, .closing').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('motion-ready');
        reveal.observe(element);
      }
    });
  }
  // Load Meta asynchronously so tracking does not block rendering.
  const META_PIXEL_ID = '962742956142305';
  if (/^\d{5,30}$/.test(META_PIXEL_ID)) {
    const fbq = window.fbq = window.fbq || function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = fbq.queue || [];
    const script = document.createElement('script');
    script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
    fbq('init', META_PIXEL_ID); fbq('track', 'PageView'); fbq('track', 'ViewContent');
  }

  // --- Ремонт переходу лендінг -> бот (варіант fix-v2) ---
  const WA_URL = 'https://wa.me/14372614873?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82!%20%D0%AF%20%D0%B7%20%D1%80%D0%B5%D0%BA%D0%BB%D0%B0%D0%BC%D0%B8%20%D0%BF%D1%80%D0%BE%20%D0%B4%D0%BE%D1%85%D1%96%D0%B4%20%D0%BD%D0%B0%20%D0%BE%D1%80%D0%B5%D0%BD%D0%B4%D1%96%20%D1%82%D1%80%D0%B0%D0%BD%D1%81%D0%BF%D0%BE%D1%80%D1%82%D1%83.%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%B2%D1%96%D0%B4%D0%B5%D0%BE-%D1%80%D0%BE%D0%B7%D0%B1%D1%96%D1%80%20%D1%96%20%D0%B3%D0%B0%D0%B9%D0%B4%20%C2%AB%D0%97%20%24100%20%D0%B4%D0%BE%20%241000%C2%BB%20%D1%83%20%D0%BF%D0%BE%D0%B4%D0%B0%D1%80%D1%83%D0%BD%D0%BE%D0%BA.';
  // WHATSAPP-ТЕСТ: 14372614873 — ПЛЕЙСХОЛДЕР номера, замінити на підтверджений Vanya перед деплоєм.
  function launchUrl() { return WA_URL; }

  // 1) Вбудований браузер Instagram/Facebook: показати підказку «відкрий у браузері».
  const ua = navigator.userAgent || '';
  const inAppBrowser = /FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua);
  const hint = document.getElementById('webviewHint');
  if (inAppBrowser && hint) {
    hint.hidden = false;
    const close = document.getElementById('webviewHintClose');
    if (close) close.addEventListener('click', () => { hint.hidden = true; });
  }

  // 2) Запасний шлях: блоки допомоги з кнопкою копіювання посилання на бот.
  const helpBlocks = document.querySelectorAll('[data-tg-help]');
  function revealHelp() { helpBlocks.forEach(block => { block.hidden = false; }); }
  document.querySelectorAll('[data-tg-alt]').forEach(btn => {
    btn.addEventListener('click', revealHelp);
  });
  document.querySelectorAll('[data-copy-bot]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = launchUrl();
      let ok = false;
      try {
        await navigator.clipboard.writeText(url);
        ok = true;
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
      }
      const done = btn.parentElement ? btn.parentElement.querySelector('[data-copy-done]') : null;
      if (done && ok) {
        done.hidden = false;
        setTimeout(() => { done.hidden = true; }, 3000);
      }
    });
  });

  // 3) Кнопки WhatsApp: Lead-подія для паритету вимірювання + звичайний перехід за wa.me.
  //    Deep-link не перехоплюємо: wa.me сам відкриває застосунок або веб-версію.
  document.querySelectorAll('[data-whatsapp]').forEach(link => {
    link.addEventListener('click', () => {
      const detail = window.IKAttribution && typeof window.IKAttribution.eventDetail === 'function'
        ? window.IKAttribution.eventDetail(location.search)
        : { destination: 'WhatsApp' };
      detail.destination = 'WhatsApp';
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'WhatsAppButtonClick', detail);
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
      window.dispatchEvent(new CustomEvent('WhatsAppButtonClick', { detail }));
      revealHelp();
    });
  });
})();
