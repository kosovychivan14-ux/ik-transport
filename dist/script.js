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
  // Кнопки Telegram — ПРЯМІ посилання в href, без прокладок (фікс 2026-10-07,
  // рішення Vanya): раніше клік перехоплювався — preventDefault, спроба
  // tg://resolve і фолбек через 1.2 с на https; на частині пристроїв це
  // губило/гальмувало перехід. Тепер обробник лише фіксує подію кліку
  // (піксель Lead / TelegramButtonClick) і НЕ втручається в перехід:
  // браузер іде за href одразу. href у HTML уже прямий:
  // https://t.me/Ivankosovychwebinarbot?start=ads_video
  document.querySelectorAll('[data-telegram]').forEach(link => {
    link.addEventListener('click', () => {
      const detail = window.IKAttribution && typeof window.IKAttribution.eventDetail === 'function'
        ? window.IKAttribution.eventDetail(location.search)
        : { destination: 'Ivankosovychwebinarbot' };
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'TelegramButtonClick', detail);
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
      window.dispatchEvent(new CustomEvent('TelegramButtonClick', { detail }));
    });
  });
})();
