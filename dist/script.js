(() => {
  'use strict';
  const duration = 8 * 60 * 1000;
  const deadline = Date.now() + duration;
  const minutes = document.getElementById('minutes');
  const seconds = document.getElementById('seconds');
  const timer = document.querySelector('[role="timer"]');
  let interval;
  function renderCountdown() {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const minuteValue = Math.floor(remaining / 60);
    const secondValue = remaining % 60;
    minutes.textContent = String(minuteValue).padStart(2, '0');
    seconds.textContent = String(secondValue).padStart(2, '0');
    timer.setAttribute('aria-label', `Зворотний відлік: ${minuteValue} хвилин ${secondValue} секунд`);
    if (remaining === 0 && interval) clearInterval(interval);
  }
  renderCountdown();
  interval = setInterval(renderCountdown, 1000);
  document.addEventListener('visibilitychange', renderCountdown);
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
  document.querySelectorAll('[data-telegram]').forEach(link => {
    const params = new URLSearchParams(location.search);
    const parts = ['web'];
    for (const key of ['utm_source', 'utm_campaign', 'utm_content']) {
      const value = params.get(key);
      if (value) parts.push(value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16));
    }
    link.href = `https://t.me/ivankosovych_bot?start=${parts.filter(Boolean).join('_').slice(0, 64)}`;
    link.addEventListener('click', () => {
      const detail = { destination: 'ivankosovych_bot' };
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
        const value = params.get(key);
        if (value) detail[key] = value.slice(0, 200);
      }
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'TelegramButtonClick', detail);
      window.dispatchEvent(new CustomEvent('TelegramButtonClick', { detail }));
    });
  });
})();
