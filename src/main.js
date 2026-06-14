import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CabinHeroScene } from './hero-scene.js';
import { initGallery, createLightbox, attachHoverSwap } from './gallery.js';

gsap.registerPlugin(ScrollTrigger);

/* ---------- Hero 3D scene ---------- */
const heroMount = document.getElementById('hero-canvas');
const heroScene = new CabinHeroScene(heroMount);

/* ---------- Gallery + lightbox ---------- */
const openLightbox = createLightbox(document.body);
initGallery(document.getElementById('gallery-segments'), openLightbox);

/* ---------- Destinacije hover-random media ---------- */
document.querySelectorAll('.dest-card__media[data-cat]').forEach((el) => {
  attachHoverSwap(el, el.dataset.cat);
});

/* ---------- Navbar: transparent → dark after 100px ---------- */
const navbar = document.getElementById('navbar');
const onScrollNav = () => navbar.classList.toggle('is-solid', window.scrollY > 100);
onScrollNav();
window.addEventListener('scroll', onScrollNav, { passive: true });

/* ---------- Mobile menu ---------- */
const burger = document.getElementById('burger');
const navLinks = document.getElementById('nav-links');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
});

/* ---------- Smooth in-page scrolling ---------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    navLinks.classList.remove('is-open');
    burger.classList.remove('is-open');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ---------- Reveal on scroll ---------- */
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

/* ---------- Reservation form ----------
   Add a free Web3Forms access key to send in-page; otherwise opens the mail client. */
const WEB3FORMS_KEY = '';
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
    if (!WEB3FORMS_KEY) {
      status.textContent = 'Otvaramo vaš email klijent…';
      status.className = 'form-status is-info';
      mailtoFallback(data);
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
      } else throw new Error();
    } catch {
      status.textContent = 'Slanje nije uspjelo. Kontaktirajte nas direktno.';
      status.className = 'form-status is-err';
    }
  });
}

window.addEventListener('load', () => ScrollTrigger.refresh());
