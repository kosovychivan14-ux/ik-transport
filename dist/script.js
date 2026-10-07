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
  // Кнопки Telegram: клік одразу відкриває застосунок Telegram на екрані бота
  // через tg://resolve. Статичний https-href лишається для копіювання посилання
  // та випадку без JavaScript. Якщо застосунок не перехопив перехід і сторінка
  // через 1.5 с досі видима й у фокусі, відкриваємо https-посилання як фолбек.
  document.querySelectorAll('[data-telegram]').forEach(link => {
    link.addEventListener('click', event => {
      const detail = window.IKAttribution && typeof window.IKAttribution.eventDetail === 'function'
        ? window.IKAttribution.eventDetail(location.search)
        : { destination: 'Ivankosovychwebinarbot' };
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'TelegramButtonClick', detail);
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
      window.dispatchEvent(new CustomEvent('TelegramButtonClick', { detail }));

      let startParam = 'ads_video';
      try {
        startParam = new URL(link.href).searchParams.get('start') || startParam;
      } catch (_) {
        // Залишаємо ads_video, якщо поточний href не вдалося розібрати.
      }

      const encodedStart = encodeURIComponent(startParam);
      const directUrl = 'tg://resolve?domain=Ivankosovychwebinarbot&start=' + encodedStart;
      const fallbackUrl = 'https://t.me/Ivankosovychwebinarbot?start=' + encodedStart;

      event.preventDefault();
      window.location.href = directUrl;
      window.setTimeout(() => {
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          window.location.href = fallbackUrl;
        }
      }, 1500);
    });
  });
})();
