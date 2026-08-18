import './style.css';
import { initGallery, createLightbox, attachHoverSwap, initHoverPreviews } from './gallery.js';

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

/* ---------- Destinacije hover-random media ---------- */
document.querySelectorAll('.dest-card__media[data-cat]').forEach((el) => {
  attachHoverSwap(el, el.dataset.cat);
});

/* ---------- Etaže + sadržaji: photo preview on hover ---------- */
initHoverPreviews();

/* ---------- Babanovac video: play once when scrolled into view ---------- */
const babanovacVideo = document.getElementById('babanovac-video');
const babanovacPlay = document.getElementById('babanovac-play');
if (babanovacVideo && babanovacPlay) {
  const showPlayButton = () => {
    babanovacPlay.hidden = false;
  };
  // A rejected play() must surface a control — iOS refuses autoplay in Low Power
  // Mode, and swallowing that left the visitor stuck on a static poster.
  const play = () => {
    babanovacPlay.hidden = true;
    babanovacVideo.play().catch(showPlayButton);
  };

  babanovacPlay.addEventListener('click', () => {
    babanovacVideo.preload = 'auto';
    play();
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;

  if (reduceMotion || saveData) {
    // Don't spend the visitor's data or override their motion preference — offer it.
    showPlayButton();
  } else {
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
  const body = [
    `Ime: ${d.name || ''}`,
    `Email: ${d.email || ''}`,
    `Telefon: ${d.phone || ''}`,
    `Dolazak: ${d.checkin || ''}`,
    `Odlazak: ${d.checkout || ''}`,
    `Gostiju: ${d.guests || ''}`,
    '',
    d.message || '',
  ].join('\n');
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    'Upit za rezervaciju — Vikendica Meri'
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
      status.textContent = 'Datum odlaska mora biti nakon datuma dolaska.';
      status.className = 'form-status is-err';
      document.getElementById('f-to').focus();
      return;
    }
    if (!WEB3FORMS_KEY) {
      status.textContent = 'Otvaramo vaš email klijent…';
      status.className = 'form-status is-info';
      mailtoFallback(data);
      return;
    }
    if (!data['h-captcha-response']) {
      status.textContent = 'Molimo potvrdite da niste robot (captcha).';
      status.className = 'form-status is-err';
      return;
    }
    status.textContent = 'Šaljemo…';
    status.className = 'form-status is-info';
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'Upit — Vikendica Meri', ...data }),
      });
      const json = await res.json();
      if (json.success) {
        status.textContent = 'Hvala! Vaš upit je poslan. Javit ćemo se uskoro.';
        status.className = 'form-status is-ok';
        form.reset();
        if (window.hcaptcha) window.hcaptcha.reset();
      } else throw new Error();
    } catch {
      status.textContent = 'Slanje nije uspjelo. Kontaktirajte nas direktno.';
      status.className = 'form-status is-err';
      if (window.hcaptcha) window.hcaptcha.reset();
    }
  });
}

