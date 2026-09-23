// IK landing v2 — interactions
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // Sticky nav state
  var nav = document.getElementById('nav');
  function onScroll() {
    nav.classList.toggle('nav--scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var burger = document.getElementById('burger');
  burger.addEventListener('click', function () {
    nav.classList.toggle('nav--open');
  });
  nav.querySelectorAll('.nav__links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('nav--open'); });
  });

  // Scroll reveal
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('reveal--in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el, i) {
    el.style.transitionDelay = Math.min(i % 4, 3) * 70 + 'ms';
    io.observe(el);
  });

  // FAQ: only one open at a time
  var items = document.querySelectorAll('.faq__item');
  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        items.forEach(function (other) {
          if (other !== item && other.open) other.open = false;
        });
      }
    });
  });
})();
