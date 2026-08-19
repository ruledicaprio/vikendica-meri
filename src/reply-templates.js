// Guest reply templates, in the language the guest was reading the site in.
//
// These are a starting point the owner edits before sending, not a generated
// final message — which is why they are prose with the facts filled in rather
// than a rigid form letter.
//
// Deliberately free of DOM and of the manager panel's own strings: when a
// sending domain exists and the Worker mails guests through Resend, it imports
// this file unchanged. That is also why the shape is (request) => {subject,
// body} and not markup.

const MONTHS = {
  bs: ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna',
       'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

function fmt(ymd, lang) {
  if (!ymd) return '';
  const d = new Date(`${ymd}T12:00:00`);
  // No trailing dot after the Bosnian year, even though a date written on its own
  // takes one: these only ever appear mid-sentence, where it collides with the
  // sentence's own full stop and reads as "2026..".
  return lang === 'en'
    ? `${MONTHS.en[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    : `${d.getDate()}. ${MONTHS.bs[d.getMonth()]} ${d.getFullYear()}`;
}

/** First name only — a full name in a greeting reads like a form letter. */
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

const TEXT = {
  bs: {
    confirmSubject: 'Potvrda rezervacije — Vikendica Meri',
    declineSubject: 'Vaš upit — Vikendica Meri',
    confirm: (n, dates) =>
      `Poštovani/a ${n},\n\n` +
      `Hvala Vam na upitu. Sa zadovoljstvom potvrđujemo Vašu rezervaciju${dates}.\n\n` +
      `Dolazak je od 14:00, odlazak do 11:00.\n\n` +
      `Javite nam ako imate dodatnih pitanja ili ako Vam trebaju upute za dolazak.\n\n` +
      `Srdačan pozdrav,\nVikendica Meri\nBabanovac, Vlašić`,
    decline: (n, dates) =>
      `Poštovani/a ${n},\n\n` +
      `Hvala Vam na upitu. Nažalost, termin${dates} je već zauzet.\n\n` +
      `Ako Vam odgovaraju drugi datumi, rado ćemo provjeriti dostupnost — ` +
      `slobodni termini vidljivi su i na našoj stranici.\n\n` +
      `Srdačan pozdrav,\nVikendica Meri\nBabanovac, Vlašić`,
    // Dates read differently mid-sentence than as a heading, so each template
    // builds its own clause rather than sharing one formatted string.
    confirmDates: (a, b) => ` od ${a} do ${b}`,
    declineDates: (a, b) => ` od ${a} do ${b}`,
  },
  en: {
    confirmSubject: 'Booking confirmed — Vikendica Meri',
    declineSubject: 'Your enquiry — Vikendica Meri',
    confirm: (n, dates) =>
      `Dear ${n},\n\n` +
      `Thank you for your enquiry. We are glad to confirm your booking${dates}.\n\n` +
      `Check-in is from 14:00, check-out by 11:00.\n\n` +
      `Do let us know if you have any questions, or if you would like directions.\n\n` +
      `Kind regards,\nVikendica Meri\nBabanovac, Vlašić`,
    decline: (n, dates) =>
      `Dear ${n},\n\n` +
      `Thank you for your enquiry. Unfortunately those dates${dates} are already booked.\n\n` +
      `If other dates would suit you we would be happy to check availability — ` +
      `free dates are also shown on our website.\n\n` +
      `Kind regards,\nVikendica Meri\nBabanovac, Vlašić`,
    confirmDates: (a, b) => ` from ${a} to ${b}`,
    declineDates: (a, b) => ` from ${a} to ${b}`,
  },
};

/**
 * Build a reply for one request, or null when a template does not apply.
 *
 * An enquiry with no dates is legitimate — the form does not require them — but
 * neither template means anything without them: there is no booking to confirm,
 * and "those dates are already taken" names no dates. Those get null and the
 * owner answers in their own words.
 *
 * @param {object} req  a row from /api/admin/requests
 * @param {'confirm'|'decline'} kind
 * @returns {{subject: string, body: string} | null}
 */
export function replyFor(req, kind) {
  if (!req.checkin || !req.checkout) return null;
  const lang = req.lang === 'en' ? 'en' : 'bs';
  const T = TEXT[lang];
  const dates = T[`${kind}Dates`](fmt(req.checkin, lang), fmt(req.checkout, lang));
  return {
    subject: T[`${kind}Subject`],
    body: T[kind](firstName(req.name), dates),
  };
}
