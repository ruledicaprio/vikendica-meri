import './style.css';
import { initGallery, createLightbox, attachHoverSwap, initHoverPreviews } from './gallery.js';
import { initCalendar } from './calendar.js';
import { t } from './i18n/ui.js';

// Three.js and GSAP are ~600 KB and ~70 KB of the bundle and neither is needed
// for first paint, so both load after it. Everything below runs immediately.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData === true;

/** Run after the page has settled, so nothing here competes with first paint. */
function afterPaint(fn) {
  const run = () => (window.requestIdleCallback || setTimeout)(fn, { timeout: 2000 });
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/* ---------- Hero 3D scene (lazy) ---------- */
const heroMount = document.getElementById('hero-canvas');
const heroPoster = heroMount?.querySelector('.hero-poster');

// Data-saver keeps the poster as the final hero and never downloads the 3D
// chunk at all. Reduced motion still gets the scene: the winter/summer scroll
// transition is content, not decoration, and hero-scene.js already renders it
// on demand with every ambient animation switched off.
if (heroMount && !saveData) {
  afterPaint(async () => {
    const { CabinHeroScene } = await import('./hero-scene.js');
    new CabinHeroScene(heroMount);
    heroPoster?.classList.add('is-hidden');
  });
}

/* ---------- Gallery + lightbox ---------- */
const openLightbox = createLightbox(document.body);
initGallery(document.getElementById('gallery-segments'), openLightbox);

/* ---------- Destinacije media: opens the lightbox, swaps photo on hover ---------- */
document.querySelectorAll('.dest-card__media[data-cat]').forEach((el) => {
  attachHoverSwap(el, el.dataset.cat, openLightbox);
});

/* ---------- Etaže + sadržaji: photo preview on hover ---------- */
initHoverPreviews(document, openLightbox);

/* ---------- Availability calendar ---------- */
const calMount = document.getElementById('cal-mount');
if (calMount) initCalendar(calMount);

/* ---------- Babanovac video: play once when scrolled into view ---------- */
const babanovacVideo = document.getElementById('babanovac-video');
const babanovacPlay = document.getElementById('babanovac-play');
if (babanovacVideo && babanovacPlay) {
  const icon = babanovacPlay.querySelector('.video-feature__icon');

  // The button is always present, so it has to report the real state — the
  // IntersectionObserver below can start playback without anyone pressing it.
  const syncButton = () => {
    const playing = !babanovacVideo.paused && !babanovacVideo.ended;
    babanovacPlay.setAttribute('aria-label', playing ? t.videoPause : t.videoPlay);
    babanovacPlay.classList.toggle('is-playing', playing);
    if (icon) icon.textContent = playing ? '❚❚' : '▶';
  };
  babanovacVideo.addEventListener('play', syncButton);
  babanovacVideo.addEventListener('pause', syncButton);
  babanovacVideo.addEventListener('ended', syncButton);

  // A rejected play() must leave the control usable — iOS refuses autoplay in
  // Low Power Mode, and swallowing that left the visitor stuck on a poster.
  const play = () => babanovacVideo.play().catch(syncButton);

  babanovacPlay.addEventListener('click', () => {
    if (babanovacVideo.paused || babanovacVideo.ended) {
      babanovacVideo.preload = 'auto';
      play();
    } else {
      babanovacVideo.pause();
    }
  });
  syncButton();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;

  // Under reduced motion or data-saver nothing autoplays; the button is the
  // visitor's own way in, and it is already there.
  if (!reduceMotion && !saveData) {
    let started = false;
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started) {
            started = true;
            play();
            videoObserver.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    videoObserver.observe(babanovacVideo);
  }
}

/* ---------- Navbar: transparent → dark after 100px ---------- */
const navbar = document.getElementById('navbar');
const onScrollNav = () => navbar.classList.toggle('is-solid', window.scrollY > 100);
onScrollNav();
window.addEventListener('scroll', onScrollNav, { passive: true });

/* ---------- Mobile menu ---------- */
const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');
// Matches the breakpoint at which .navbar__links becomes the slide-down panel.
const isMobileNav = window.matchMedia('(max-width: 900px)');

// One place that owns the state: the classes, aria-expanded and inert were
// previously set in two places and drifted — closing via a nav link left
// aria-expanded="true" forever.
function setMenu(open) {
  navLinks.classList.toggle('is-open', open);
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  // A closed panel is off-screen but still focusable; inert takes it out of the
  // tab order and the accessibility tree. Only on mobile — on desktop the same
  // element is the visible nav.
  navLinks.toggleAttribute('inert', isMobileNav.matches && !open);
}

burger.addEventListener('click', () => setMenu(!navLinks.classList.contains('is-open')));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
    setMenu(false);
    burger.focus();
  }
});
// Crossing the breakpoint must clear inert, or the desktop nav goes unreachable.
isMobileNav.addEventListener('change', () => setMenu(false));
setMenu(false);

/* ---------- Smooth in-page scrolling ---------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ---------- Reveal on scroll (lazy) ----------
   GSAP loads after first paint. Until it does, .reveal elements are simply
   visible and un-animated — the tween sets autoAlpha from JS, so there is no
   hidden-content flash if the chunk is slow or never arrives.
   autoAlpha also means visibility:hidden while pending, and Chrome will not
   start a lazy image fetch inside a hidden element, so skipping the animation
   under reduced motion is what keeps those photos loading at all. */
if (!reducedMotion) {
  afterPaint(async () => {
    const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.fromTo(
        el,
        { y: 40, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        }
      );
    });
    ScrollTrigger.refresh();
  });
}

/* ---------- Reservation form ----------
   Add a free Web3Forms access key to send in-page; otherwise opens the mail client. */
const WEB3FORMS_KEY = 'bc60fbf4-87e2-4fa8-bde9-b5636e7bca26';
const CONTACT_EMAIL = 'villa-meri@gmail.com';
const form = document.getElementById('reserve-form');
const status = document.getElementById('form-status');

function mailtoFallback(d) {
  const L = t.mailLabels;
  const body = [
    `${L.name}: ${d.name || ''}`,
    `${L.email}: ${d.email || ''}`,
    `${L.phone}: ${d.phone || ''}`,
    `${L.checkin}: ${d.checkin || ''}`,
    `${L.checkout}: ${d.checkout || ''}`,
    `${L.guests}: ${d.guests || ''}`,
    '',
    d.message || '',
  ].join('\n');
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    t.mailSubject
  )}&body=${encodeURIComponent(body)}`;
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    // Nothing stops a guest entering a checkout before their check-in, and the
    // error is easier to fix here than in a reply email two days later.
    if (data.checkin && data.checkout && data.checkout <= data.checkin) {
      status.textContent = t.formDates;
      status.className = 'form-status is-err';
      document.getElementById('f-to').focus();
      return;
    }
    if (!WEB3FORMS_KEY) {
      status.textContent = t.formMailto;
      status.className = 'form-status is-info';
      mailtoFallback(data);
      return;
    }
    if (!data['h-captcha-response']) {
      status.textContent = t.formCaptcha;
      status.className = 'form-status is-err';
      return;
    }
    status.textContent = t.formSending;
    status.className = 'form-status is-info';

    // Two independent paths, on purpose. The API records the enquiry so it shows
    // up in the manager panel; Web3Forms is what actually emails the owner today.
    // Until the Worker sends its own mail, dropping either one would lose
    // something — so both are attempted and one success is enough.
    const toApi = fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.ok);

    const toEmail = fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: t.mailSubject, ...data }),
    })
      .then((r) => r.json())
      .then((j) => j.success === true);

    const [api, email] = await Promise.all([
      toApi.catch(() => false),
      toEmail.catch(() => false),
    ]);

    if (api || email) {
      status.textContent = t.formOk;
      status.className = 'form-status is-ok';
      form.reset();
    } else {
      status.textContent = t.formErr;
      status.className = 'form-status is-err';
    }
    if (window.hcaptcha) window.hcaptcha.reset();
  });
}

