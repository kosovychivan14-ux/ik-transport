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
  const landingTimestamp = Date.now();
  function updateTelegramHref(link) {
    if (!window.IKAttribution || typeof window.IKAttribution.buildLaunchUrl !== 'function') return;
    try {
      const href = window.IKAttribution.buildLaunchUrl({
        search: location.search,
        cookieString: document.cookie,
        landingTimestamp
      });
      if (typeof href === 'string' && href) link.href = href;
    } catch (_) {
      // Keep the static Telegram URL when attribution storage is unavailable.
    }
  }
  document.querySelectorAll('[data-telegram]').forEach(link => {
    updateTelegramHref(link);
    link.addEventListener('click', (e) => {
      updateTelegramHref(link);
      const detail = window.IKAttribution && typeof window.IKAttribution.eventDetail === 'function'
        ? window.IKAttribution.eventDetail(location.search)
        : { destination: 'Ivankosovychwebinarbot' };
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'TelegramButtonClick', detail);
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
      window.dispatchEvent(new CustomEvent('TelegramButtonClick', { detail }));
      // Прямий вхід у бота: спочатку пробуємо відкрити застосунок Telegram напряму
      // (мінус сторінка-прокладка t.me з кнопкою «Send Message»). Мітка start зберігається.
      const fallbackUrl = link.href;
      let startParam = 'ads_video';
      try { startParam = new URL(fallbackUrl).searchParams.get('start') || startParam; } catch (_) {}
      const directUrl = 'tg://resolve?domain=Ivankosovychwebinarbot&start=' + encodeURIComponent(startParam);
      e.preventDefault();
      window.location.href = directUrl;
      // Фолбек: якщо за 1.2 c застосунок не перехопив (Telegram не встановлено) —
      // повертаємось до звичайного редіректу, щоб кнопка не була «мертвою».
      setTimeout(() => { if (!document.hidden) window.location.href = fallbackUrl; }, 1200);
    });
  });
})();
