/* IK webinar landing v2 (Neon Evo) — interactions */
(function(){
"use strict";
document.documentElement.classList.add('js');

/* ============ Налаштування вебінару ============
   Зміни ці два рядки — і дата/час оновляться скрізь
   (hero, фінальний блок, мобільна панель, підписи).
   День тижня: 0=неділя, 1=понеділок … 6=субота. Час — за Києвом. */
const WEBINAR_WEEKDAY = 4; // четвер
const WEBINAR_HOUR = 19;
const WEBINAR_MIN = 0;
/* ============================================== */

const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const pad = n => String(n).padStart(2, '0');

/* ---------- дата наступного вебінару (Europe/Kyiv) ---------- */
function kyivOffsetMinutes(date){
  try{
    const parts = new Intl.DateTimeFormat('en', {timeZone:'Europe/Kyiv', timeZoneName:'shortOffset', hour:'2-digit'}).formatToParts(date);
    const tz = (parts.find(p => p.type === 'timeZoneName') || {}).value || 'GMT+0';
    const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if(!m) return 180;
    return (m[1] === '-' ? -1 : 1) * (parseInt(m[2],10) * 60 + parseInt(m[3] || '0', 10));
  }catch(e){ return 180; }
}
function nextWebinarDate(){
  const now = Date.now();
  const off = kyivOffsetMinutes(new Date(now));
  const kyiv = new Date(now + off * 60000); // «стінний» час Києва як UTC-поля
  const target = new Date(Date.UTC(kyiv.getUTCFullYear(), kyiv.getUTCMonth(), kyiv.getUTCDate(), WEBINAR_HOUR, WEBINAR_MIN, 0));
  let delta = (WEBINAR_WEEKDAY - kyiv.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + delta);
  let real = target.getTime() - off * 60000;
  if(real <= now + 60000){ // уже минув сьогодні — переносимо на тиждень
    real += 7 * 86400000;
  }
  return new Date(real);
}
const webinarAt = nextWebinarDate();

/* ---------- підписи з датою ---------- */
try{
  const dFmt = new Intl.DateTimeFormat('uk-UA', {timeZone:'Europe/Kyiv', day:'numeric', month:'long', weekday:'long'});
  const label = dFmt.format(webinarAt) + ' · ' + pad(WEBINAR_HOUR) + ':' + pad(WEBINAR_MIN);
  ['webinarDateLabel','stickyDate'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = label; });
}catch(e){}

/* ---------- таймер зворотного відліку ---------- */
const cd = {
  d: [$('#cdD'), $('#cdD2')], h: [$('#cdH'), $('#cdH2')],
  m: [$('#cdM'), $('#cdM2')], s: [$('#cdS'), $('#cdS2')],
  nav: $('#navTimerText')
};
function tick(){
  let diff = Math.max(0, webinarAt.getTime() - Date.now());
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);    diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  cd.d.forEach(el => el && (el.textContent = pad(d)));
  cd.h.forEach(el => el && (el.textContent = pad(h)));
  cd.m.forEach(el => el && (el.textContent = pad(m)));
  cd.s.forEach(el => el && (el.textContent = pad(s)));
  if(cd.nav) cd.nav.textContent = (d > 0 ? d + 'д ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
}
tick();
setInterval(tick, 1000);

/* ---------- навігація ---------- */
const nav = $('#nav'), burger = $('#burger');
if(burger) burger.addEventListener('click', () => nav.classList.toggle('nav--open'));
$$('.nav__links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('nav--open')));

const progress = $('#scrollProgress');
const stickyCta = $('#stickyCta');
const heroEl = $('.hero');
const finalEl = $('#register');
function onScroll(){
  const y = window.scrollY;
  nav.classList.toggle('nav--scrolled', y > 40);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if(progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  const pastHero = heroEl ? y > heroEl.offsetHeight * 0.75 : y > 700;
  let finalVisible = false;
  if(finalEl){
    const r = finalEl.getBoundingClientRect();
    finalVisible = r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
  }
  if(stickyCta) stickyCta.classList.toggle('sticky-cta--show', pastHero && !finalVisible);
}
window.addEventListener('scroll', onScroll, {passive:true});
onScroll();

/* ---------- reveal-анімації ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add('reveal--in'); io.unobserve(e.target); }
  });
}, {threshold: 0.12, rootMargin: '0px 0px -6% 0px'});
$$('.reveal').forEach(el => io.observe(el));

/* ---------- анімовані лічильники ---------- */
const cio = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, end = parseInt(el.dataset.count || '0', 10), suf = el.dataset.suffix || '';
    const t0 = performance.now(), dur = 1400;
    (function frame(t){
      const p = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * ease) + suf;
      if(p < 1) requestAnimationFrame(frame);
    })(t0);
  });
}, {threshold: 0.6});
$$('[data-count]').forEach(el => cio.observe(el));

/* ---------- паралакс HUD-фото за мишею ---------- */
/* ---------- паралакс фото за мишею ---------- */
$$('.hero__visual, .speaker__photo').forEach(zone => {
  const img = $('.hud--photo > img', zone);
  if(!img || window.matchMedia('(hover: none)').matches) return;
  img.style.transition = 'transform .35s ease-out';
  img.style.transform = 'scale(1.08)';
  zone.addEventListener('mousemove', e => {
    const r = zone.getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) - 0.5) * 14;
    const y = (((e.clientY - r.top) / r.height) - 0.5) * 10;
    img.style.transform = 'scale(1.08) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  });
  zone.addEventListener('mouseleave', () => { img.style.transform = 'scale(1.08)'; });
});

/* ---------- плавний скрол для hero-стрілки ---------- */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = $(a.getAttribute('href'));
    if(t){ e.preventDefault(); t.scrollIntoView({behavior:'smooth'}); }
  });
});
})();
