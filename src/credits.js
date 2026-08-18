// Photo & video credit.
//
// Keyed by exact path, deliberately not by category: only the aerial Vlašić work
// is Adel's. The older scene-*-vlasic.jpg shots in the same folder are not his
// and must not carry his name.
import { t } from './i18n/ui.js';

export const ADEL = {
  name: 'Adel Huseinspahić',
  youtube: 'https://www.youtube.com/@AdelHuseinspahic',
  shutterstock: 'https://www.shutterstock.com/g/adel+huseinspahic',
};

const CREDITED = new Set([
  '/vlasic/scene-0.jpg',
  '/vlasic/scene-0-galica.jpg',
  '/vlasic/scene-0-ugar.jpg',
  '/vlasic/scene-1-galica.jpg',
  '/vlasic/scene-1-ugar.jpg',
]);

/** The credit for a photo URL, or null when it is not credited. */
export function creditFor(url) {
  return CREDITED.has(url) ? ADEL : null;
}

/** Small inline credit line. `label` is the localised noun ("Foto" / "Photo"). */
export function creditHtml(credit, label = t.creditPhoto) {
  if (!credit) return '';
  return (
    `<span class="media-credit">${label}: ` +
    `<a href="${credit.youtube}" target="_blank" rel="noopener author">${credit.name}</a> ©</span>`
  );
}
