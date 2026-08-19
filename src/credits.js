// Photo & video credit.
//
// Keyed by exact path, deliberately not by category: only the aerial Vlašić work
// is Adel's. The older scene-*-vlasic.jpg shots in the same folder are not his
// and must not carry his name. The Travnik old-town shot is Almin's — his name
// was sitting in the file's IPTC author field the whole time, which is how it
// was found.
import { t } from './i18n/ui.js';

export const ADEL = {
  name: 'Adel Huseinspahić',
  // `url` is the one the inline credit links to; `sameAs` is everything else,
  // and feeds the Person node in the JSON-LD.
  url: 'https://www.youtube.com/@AdelHuseinspahic',
  sameAs: [
    'https://www.youtube.com/@AdelHuseinspahic',
    'https://www.shutterstock.com/g/adel+huseinspahic',
  ],
};

export const ALMIN = {
  name: 'Almin Tabak',
  // Tumblr first: it is the portfolio, where the photography is the point.
  // The social profiles stay as sameAs so the identity still resolves.
  url: 'https://almintabak.tumblr.com/',
  sameAs: [
    'https://almintabak.tumblr.com/',
    'https://www.instagram.com/alminijum/',
    'https://www.facebook.com/tabak.almin/',
  ],
};

// Path → photographer. A Map rather than a per-person Set: there are two of them
// now, and a second Set would make "who shot this?" a search instead of a lookup.
const CREDITED = new Map([
  ['/vlasic/scene-0.jpg', ADEL],
  ['/vlasic/scene-0-galica.jpg', ADEL],
  ['/vlasic/scene-0-ugar.jpg', ADEL],
  ['/vlasic/scene-1-galica.jpg', ADEL],
  ['/vlasic/scene-1-ugar.jpg', ADEL],
  ['/travnik/scene-0-photo-44.jpg', ALMIN],
]);

/** The credit for a photo URL, or null when it is not credited. */
export function creditFor(url) {
  return CREDITED.get(url) ?? null;
}

/** Small inline credit line. `label` is the localised noun ("Foto" / "Photo"). */
export function creditHtml(credit, label = t.creditPhoto) {
  if (!credit) return '';
  return (
    `<span class="media-credit">${label}: ` +
    `<a href="${credit.url}" target="_blank" rel="noopener author">${credit.name}</a> ©</span>`
  );
}
