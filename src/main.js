import './style.css';
import { initGallery, createLightbox, attachHoverSwap, initHoverPreviews } from './gallery.js';
import { initCalendar } from './calendar.js';
import { initMiniCal } from './mini-cal.js';
import { initAframeFloors } from './aframe-floors.js';
import { t, lang } from './i18n/ui.js';
import { teleport } from './teleport.js';

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
if (calMount) {
  // The hero's mini calendar reads and drives this calendar, so it needs the
  // handle rather than a copy of the availability data.
  const cal = initCalendar(calMount);
  initMiniCal(document.getElementById('hero-cal'), cal);
}

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

/* ---------- Floors: A-frame cross-section (aframe-floors.js) ----------
   Scroll-driven, so motion-sensitive visitors keep the static diagram. */
if (!reducedMotion) initAframeFloors(document.querySelector('[data-aframe]'), navbar);

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
    // The calendar is far down the page: jump there under a veil rather than
    // ride a long smooth scroll (see teleport.js).
    if (id === '#dostupnost') teleport(target);
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ---------- "Vlašić kroz godinu" tab cards ---------- */
for (const box of document.querySelectorAll('[data-tabs]')) {
  const tabs = [...box.querySelectorAll('[role="tab"]')];
  const select = (tab, focus = false) => {
    for (const t2 of tabs) {
      const on = t2 === tab;
      t2.setAttribute('aria-selected', String(on));
      t2.tabIndex = on ? 0 : -1;
      document.getElementById(t2.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    // Arrow keys move between tabs, as the tab pattern expects.
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
  box.classList.add('is-tabs');
  select(tabs[0]);
}

/* ---------- Reveal on scroll (lazy) ----------
   .js .reveal is visibility:hidden until GSAP animates it in, so the content
   under it — including the gallery grid the build now writes into the HTML —
   depends on this chunk arriving. If it does not, drop the .js class and let
   everything show, un-animated: a slow CDN must not cost the page its photos.
   The images themselves are fine either way — a lazy fetch inside a hidden
   element still starts — but the markup around them would sit invisible. */
if (!reducedMotion) {
  afterPaint(async () => {
    let gsap, ScrollTrigger;
    try {
      [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
    } catch {
      document.documentElement.classList.remove('js');
      return;
    }
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
   Posts to /api/requests, which records the enquiry and emails the owner. The
   Web3Forms call used to happen here too; it moved into the Worker so that it
   sits behind the Turnstile check instead of beside it. */
const CONTACT_EMAIL = 'villa-meri@gmail.com';
const form = document.getElementById('reserve-form');
const status = document.getElementById('form-status');

function mailtoFallback(d) {
  const L = t.mailLabels;
  const body = [
    `${L.name}: ${d.name || ''}`,
    `${L.email}: ${d.email || ''}`,
    `${L.phone}: ${d.phone || ''}`,
    `${L.checkin}: ${d.checkin ? t.fieldDate(d.checkin) : ''}`,
    `${L.checkout}: ${d.checkout ? t.fieldDate(d.checkout) : ''}`,
    `${L.guests}: ${d.guests || ''}`,
    '',
    d.message || '',
  ].join('\n');
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    t.mailSubject
  )}&body=${encodeURIComponent(body)}`;
}

// Bosnian page: arrival/departure read 06.11.2026. whatever language the
// browser itself is in (an English Windows prints 11/06/2026). The native date
// input stays underneath for its picker and its ISO value; only its own text
// is hidden behind the formatted copy.
if (form && lang === 'bs') {
  const syncs = [];
  for (const input of form.querySelectorAll('input[type="date"]')) {
    const wrap = document.createElement('span');
    wrap.className = 'date-bs';
    const text = document.createElement('span');
    text.className = 'date-bs__text';
    text.setAttribute('aria-hidden', 'true');
    input.replaceWith(wrap);
    wrap.append(input, text);
    const sync = () => {
      text.textContent = input.value ? t.fieldDate(input.value) : t.fieldDatePlaceholder;
      text.classList.toggle('is-empty', !input.value);
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    // With a mouse, a click anywhere on the field opens the picker, not only
    // the small icon; the hidden text is not something to click into.
    input.addEventListener('click', () => {
      if (matchMedia('(pointer: coarse)').matches) return;
      try {
        input.showPicker();
      } catch {
        /* older browser: the icon still opens it */
      }
    });
    syncs.push(sync);
    sync();
  }
  // reset() clears the values without an input event.
  form.addEventListener('reset', () => setTimeout(() => syncs.forEach((s) => s())));
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
    if (!data['cf-turnstile-response']) {
      status.textContent = t.formCaptcha;
      status.className = 'form-status is-err';
      return;
    }
    status.textContent = t.formSending;
    status.className = 'form-status is-info';

    let ok = false;
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The locale is baked into the page at build time, so this is already
        // 'bs' or 'en'. It travels with the enquiry so the manager panel can
        // reply in the language the guest was actually reading.
        body: JSON.stringify({ ...data, lang: document.documentElement.lang }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    if (ok) {
      status.textContent = t.formOk;
      status.className = 'form-status is-ok';
      form.reset();
    } else {
      // One path now instead of two, so a failure is a real failure. Hand the
      // guest their mail client rather than a dead end — they have already
      // typed the message, and it is prefilled from what they entered.
      status.textContent = `${t.formErr} ${t.formMailto}`;
      status.className = 'form-status is-info';
      mailtoFallback(data);
    }
    if (window.turnstile) window.turnstile.reset();
  });
}

