// Runtime strings for the JS-rendered parts: gallery labels and alt text, the
// lightbox controls, form status messages and the calendar.
//
// Both locales ship in the one bundle (a few KB) and the active one is picked
// from <html lang>, which the build stamps per page.

const bs = {
  // Gallery
  categories: {
    eksterijer: 'Eksterijer',
    dnevni: 'Dnevni boravak',
    kuhinja: 'Kuhinja',
    sobe: 'Sobe',
    kupatila: 'Kupatila',
    vlasic: 'Planina Vlašić',
    travnik: 'Travnik',
  },
  openGallery: (label) => `Otvori galeriju: ${label}`,
  openPhoto: (i, n) => `Otvori fotografiju ${i} od ${n}`,
  showAll: (n) => `Prikaži sve (${n})`,
  close: 'Zatvori',
  prev: 'Prethodna',
  next: 'Sljedeća',
  // Bosnian count agreement: 1 fotografija, 2–4 fotografije, 5+ fotografija
  // (and the teens always take the last form).
  photoCount: (n) => {
    const last = n % 10;
    const teen = n % 100 >= 11 && n % 100 <= 14;
    if (!teen && last === 1) return `${n} fotografija`;
    if (!teen && last >= 2 && last <= 4) return `${n} fotografije`;
    return `${n} fotografija`;
  },
  photoSuffix: (i) => ` — fotografija ${i}`,

  // Alt text, derived from the curated filename.
  alt: {
    eksterijer: (n) => {
      if (/terasa/.test(n)) return 'Terasa vikendice Meri sa roštiljem, Babanovac';
      if (/dvoriste/.test(n)) return 'Dvorište vikendice Meri sa roštiljem i sjedenjem';
      if (/ulaz/.test(n)) return 'Ulaz u vikendicu Meri, Dolina Panjeva';
      if (/okolina/.test(n)) return 'Okolina vikendice Meri na Babanovcu, planina Vlašić';
      if (/bocna/.test(n)) return 'Bočna strana A-frame vikendice Meri';
      if (/snijeg|zimski|zimi/.test(n)) return 'A-frame vikendica Meri pod snijegom, Babanovac';
      return 'A-frame vikendica Meri, Dolina Panjeva, Babanovac';
    },
    dnevni: (n) => {
      if (/trpezarija/.test(n)) return 'Trpezarija sa velikim stolom u vikendici Meri';
      if (/hodnik/.test(n)) return 'Hodnik i stepenice u vikendici Meri';
      return 'Dnevni boravak sa kaminom i TV-om u vikendici Meri';
    },
    kuhinja: (n) => {
      if (/sudoper/.test(n)) return 'Sudoper i radna ploča u kuhinji vikendice Meri';
      if (/stednjak/.test(n)) return 'Šporet i rerna u kuhinji vikendice Meri';
      if (/frizider/.test(n)) return 'Frižider i mikrovalna u kuhinji vikendice Meri';
      if (/radna-ploca|kutak/.test(n)) return 'Radni kutak u kuhinji vikendice Meri';
      return 'Potpuno opremljena kuhinja u vikendici Meri, Babanovac';
    },
    sobe: (n) => {
      if (/bracna/.test(n)) return 'Bračna soba sa balkonom na 1. spratu vikendice Meri';
      if (/djecija/.test(n)) return 'Dječija soba na 1. spratu vikendice Meri';
      if (/druga/.test(n)) return 'Spavaća soba sa dva ležaja na 2. spratu vikendice Meri';
      return 'Spavaća soba sa balkonom na 2. spratu vikendice Meri';
    },
    kupatila: (n) =>
      /prizemlje/.test(n)
        ? 'Kupatilo u prizemlju vikendice Meri sa tuš kabinom'
        : 'Kupatilo na spratu vikendice Meri sa tuš kabinom',
    vlasic: (n) => {
      if (/galica/.test(n)) return 'Pogled na Galicu, planina Vlašić';
      if (/ugar/.test(n)) return 'Pogled na Ugar, planina Vlašić';
      return 'Planina Vlašić i Babanovac';
    },
    travnik: () => 'Grad Travnik, centralna Bosna',
  },

  // Video
  videoPlay: 'Pusti video',
  videoPause: 'Pauziraj video',

  // Credit
  creditPhoto: 'Foto',

  // Form
  formSending: 'Šaljemo…',
  formOk: 'Hvala! Vaš upit je poslan. Javit ćemo se uskoro.',
  formErr: 'Greška pri slanju. Pokušajte ponovo ili nas kontaktirajte direktno.',
  formCaptcha: 'Molimo potvrdite da niste robot (captcha).',
  formMailto: 'Otvaramo vaš email klijent…',
  formDates: 'Datum odlaska mora biti nakon datuma dolaska.',
  mailSubject: 'Upit za rezervaciju — Vikendica Meri',
  mailLabels: {
    name: 'Ime',
    email: 'Email',
    phone: 'Telefon',
    checkin: 'Dolazak',
    checkout: 'Odlazak',
    guests: 'Gostiju',
  },

  // Calendar
  months: [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
  ],
  days: ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'],
  calPrev: 'Prethodni mjesec',
  calNext: 'Sljedeći mjesec',
  calBooked: 'zauzeto',
  calPending: 'na čekanju',
  calPast: 'prošlo',
  calSend: 'Pošalji upit ↓',
  calClear: 'Poništi',
  calCapacity: 'do 10 osoba',
  calLegendAvailable: 'Slobodno',
  calLegendBooked: 'Zauzeto',
  calLegendPending: 'Na čekanju',
  calLegendSelected: 'Vaš odabir',
  calOffline: 'Trenutnu dostupnost nije moguće učitati — potvrdit ćemo termin na vaš upit.',
  nights: (n) => (n === 1 ? '1 noć' : `${n} noći`),
  formatDate: (d, months) => `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}.`,
};

const en = {
  categories: {
    eksterijer: 'Exterior',
    dnevni: 'Living room',
    kuhinja: 'Kitchen',
    sobe: 'Bedrooms',
    kupatila: 'Bathrooms',
    vlasic: 'Vlašić Mountain',
    travnik: 'Travnik',
  },
  openGallery: (label) => `Open gallery: ${label}`,
  openPhoto: (i, n) => `Open photo ${i} of ${n}`,
  showAll: (n) => `Show all (${n})`,
  close: 'Close',
  prev: 'Previous',
  next: 'Next',
  // English needs its own rule — the Bosnian 2–4 form has no equivalent here.
  photoCount: (n) => `${n} ${n === 1 ? 'photo' : 'photos'}`,
  photoSuffix: (i) => ` — photo ${i}`,

  alt: {
    eksterijer: (n) => {
      if (/terasa/.test(n)) return 'Terrace of Vikendica Meri with the grill, Babanovac';
      if (/dvoriste/.test(n)) return 'Yard of Vikendica Meri with grill and seating';
      if (/ulaz/.test(n)) return 'Entrance to Vikendica Meri, Dolina Panjeva';
      if (/okolina/.test(n)) return 'Surroundings of Vikendica Meri at Babanovac, Vlašić mountain';
      if (/bocna/.test(n)) return 'Side elevation of the Vikendica Meri A-frame';
      if (/snijeg|zimski|zimi/.test(n)) return 'Vikendica Meri A-frame chalet under snow, Babanovac';
      return 'Vikendica Meri A-frame chalet, Dolina Panjeva, Babanovac';
    },
    dnevni: (n) => {
      if (/trpezarija/.test(n)) return 'Dining area with a large table at Vikendica Meri';
      if (/hodnik/.test(n)) return 'Hallway and stairs at Vikendica Meri';
      return 'Living room with fireplace and TV at Vikendica Meri';
    },
    kuhinja: (n) => {
      if (/sudoper/.test(n)) return 'Sink and worktop in the Vikendica Meri kitchen';
      if (/stednjak/.test(n)) return 'Stove and oven in the Vikendica Meri kitchen';
      if (/frizider/.test(n)) return 'Fridge and microwave in the Vikendica Meri kitchen';
      if (/radna-ploca|kutak/.test(n)) return 'Worktop corner in the Vikendica Meri kitchen';
      return 'Fully equipped kitchen at Vikendica Meri, Babanovac';
    },
    sobe: (n) => {
      if (/bracna/.test(n)) return 'Double bedroom with balcony on the first floor of Vikendica Meri';
      if (/djecija/.test(n)) return 'Children’s room on the first floor of Vikendica Meri';
      if (/druga/.test(n)) return 'Twin bedroom on the second floor of Vikendica Meri';
      return 'Bedroom with balcony on the second floor of Vikendica Meri';
    },
    kupatila: (n) =>
      /prizemlje/.test(n)
        ? 'Ground-floor bathroom with shower cabin at Vikendica Meri'
        : 'Upstairs bathroom with shower cabin at Vikendica Meri',
    vlasic: (n) => {
      if (/galica/.test(n)) return 'View towards Galica, Vlašić mountain';
      if (/ugar/.test(n)) return 'View towards Ugar, Vlašić mountain';
      return 'Vlašić mountain and Babanovac';
    },
    travnik: () => 'The town of Travnik, central Bosnia',
  },

  videoPlay: 'Play video',
  videoPause: 'Pause video',

  creditPhoto: 'Photo',

  formSending: 'Sending…',
  formOk: 'Thank you! Your enquiry has been sent. We will be in touch shortly.',
  formErr: 'Sending failed. Please try again or contact us directly.',
  formCaptcha: 'Please confirm you are not a robot (captcha).',
  formMailto: 'Opening your email client…',
  formDates: 'The check-out date must be after the check-in date.',
  mailSubject: 'Booking enquiry — Vikendica Meri',
  mailLabels: {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    checkin: 'Check-in',
    checkout: 'Check-out',
    guests: 'Guests',
  },

  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  calPrev: 'Previous month',
  calNext: 'Next month',
  calBooked: 'booked',
  calPending: 'on hold',
  calPast: 'past',
  calSend: 'Send enquiry ↓',
  calClear: 'Clear',
  calCapacity: 'up to 10 guests',
  calLegendAvailable: 'Available',
  calLegendBooked: 'Booked',
  calLegendPending: 'On hold',
  calLegendSelected: 'Your selection',
  calOffline: 'Live availability could not be loaded — we will confirm your dates by reply.',
  nights: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
  formatDate: (d, months) => `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
};

const LOCALES = { bs, en };

/** Active locale, from the <html lang> the build stamped on this page. */
export const lang = LOCALES[document.documentElement.lang] ? document.documentElement.lang : 'bs';
export const t = LOCALES[lang];
