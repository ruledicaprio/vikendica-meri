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
      if (/ulaz-kamena-staza/.test(n)) return 'Kamena staza do ulaza u vikendicu Meri';
      if (/ulaz-prolaz/.test(n)) return 'Prolaz pored vikendice Meri prema ulazu';
      if (/ulaz-balkoni/.test(n)) return 'Balkoni iznad ulaza u vikendicu Meri';
      if (/ulaz/.test(n)) return 'Ulaz u vikendicu Meri, Dolina Panjeva';
      if (/okolina-zimi/.test(n)) return 'Snijegom prekrivena okolina vikendice Meri, Babanovac';
      if (/okolina-borovi/.test(n)) return 'Borova šuma oko vikendice Meri na Vlašiću';
      if (/okolina-naselje/.test(n)) return 'Naselje Dolina Panjeva na Babanovcu, planina Vlašić';
      if (/okolina/.test(n)) return 'Okolina vikendice Meri na Babanovcu, planina Vlašić';
      if (/bocna/.test(n)) return 'Bočna strana A-frame vikendice Meri';
      if (/prilaz/.test(n)) return 'Prilaz i parking ispred vikendice Meri';
      if (/zimski-pogled/.test(n)) return 'Zimski pogled na A-frame vikendicu Meri, Babanovac';
      if (/vece-snijeg/.test(n)) return 'A-frame vikendica Meri uvečer pod snijegom, Babanovac';
      if (/snijeg|zimski|zimi/.test(n)) return 'A-frame vikendica Meri pod snijegom, Babanovac';
      if (/a-frame-ljeto/.test(n)) return 'A-frame vikendica Meri ljeti, Dolina Panjeva';
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
      if (/frizider/.test(n)) return 'Frižider u kuhinji vikendice Meri';
      if (/mikrovalna/.test(n)) return 'Mikrovalna pećnica u kuhinji vikendice Meri';
      if (/elementi/.test(n)) return 'Kuhinjski elementi i kuhalo za vodu u vikendici Meri';
      if (/radna-ploca/.test(n)) return 'Radna ploča u kuhinji vikendice Meri';
      if (/kutak/.test(n)) return 'Radni kutak u kuhinji vikendice Meri';
      if (/ulaz/.test(n)) return 'Ulaz u kuhinju vikendice Meri';
      if (/pogled/.test(n)) return 'Pogled na kuhinju vikendice Meri, Babanovac';
      return 'Potpuno opremljena kuhinja u vikendici Meri, Babanovac';
    },
    sobe: (n) => {
      const room = /bracna/.test(n)
        ? 'Bračna soba na 1. spratu vikendice Meri'
        : /djecija/.test(n)
          ? 'Dječija soba na 1. spratu vikendice Meri'
          : /druga/.test(n)
            ? 'Spavaća soba sa dva ležaja na 2. spratu vikendice Meri'
            : 'Spavaća soba sa balkonom na 2. spratu vikendice Meri';
      // The detail token is the tail of the curated filename; appending it is what
      // keeps five photos of one room from sharing a single alt.
      if (/-krevet/.test(n)) return `${room} — krevet`;
      if (/-balkon/.test(n)) return `${room} — balkon`;
      if (/-prozor/.test(n)) return `${room} — prozor`;
      if (/-ulaz/.test(n)) return `${room} — ulaz`;
      if (/-pogled/.test(n)) return `${room} — pogled`;
      if (/-detalj/.test(n)) return `${room} — detalj`;
      return room;
    },
    kupatila: (n) => {
      const room = /prizemlje/.test(n)
        ? 'Kupatilo u prizemlju vikendice Meri'
        : 'Kupatilo na spratu vikendice Meri';
      if (/ves-masina/.test(n)) return `${room} sa veš mašinom`;
      if (/umivaonik/.test(n)) return `${room} — umivaonik`;
      if (/kabina/.test(n)) return `${room} — tuš kabina`;
      if (/tus/.test(n)) return `${room} sa tuš kabinom`;
      if (/pogled/.test(n)) return `${room} — pogled`;
      if (/detalj/.test(n)) return `${room} — detalj`;
      return `${room} sa tuš kabinom`;
    },
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
      if (/ulaz-kamena-staza/.test(n)) return 'Stone path to the entrance of Vikendica Meri';
      if (/ulaz-prolaz/.test(n)) return 'Passage alongside Vikendica Meri towards the entrance';
      if (/ulaz-balkoni/.test(n)) return 'Balconies above the entrance to Vikendica Meri';
      if (/ulaz/.test(n)) return 'Entrance to Vikendica Meri, Dolina Panjeva';
      if (/okolina-zimi/.test(n)) return 'Snow-covered surroundings of Vikendica Meri, Babanovac';
      if (/okolina-borovi/.test(n)) return 'Pine forest around Vikendica Meri on Vlašić';
      if (/okolina-naselje/.test(n)) return 'The Dolina Panjeva settlement at Babanovac, Vlašić mountain';
      if (/okolina/.test(n)) return 'Surroundings of Vikendica Meri at Babanovac, Vlašić mountain';
      if (/bocna/.test(n)) return 'Side elevation of the Vikendica Meri A-frame';
      if (/prilaz/.test(n)) return 'Driveway and parking in front of Vikendica Meri';
      if (/zimski-pogled/.test(n)) return 'Winter view of the Vikendica Meri A-frame, Babanovac';
      if (/vece-snijeg/.test(n)) return 'Vikendica Meri A-frame in the evening under snow, Babanovac';
      if (/snijeg|zimski|zimi/.test(n)) return 'Vikendica Meri A-frame chalet under snow, Babanovac';
      if (/a-frame-ljeto/.test(n)) return 'Vikendica Meri A-frame chalet in summer, Dolina Panjeva';
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
      if (/frizider/.test(n)) return 'Fridge in the Vikendica Meri kitchen';
      if (/mikrovalna/.test(n)) return 'Microwave in the Vikendica Meri kitchen';
      if (/elementi/.test(n)) return 'Kitchen units and kettle at Vikendica Meri';
      if (/radna-ploca/.test(n)) return 'Worktop in the Vikendica Meri kitchen';
      if (/kutak/.test(n)) return 'Worktop corner in the Vikendica Meri kitchen';
      if (/ulaz/.test(n)) return 'Entrance to the Vikendica Meri kitchen';
      if (/pogled/.test(n)) return 'View of the Vikendica Meri kitchen, Babanovac';
      return 'Fully equipped kitchen at Vikendica Meri, Babanovac';
    },
    sobe: (n) => {
      const room = /bracna/.test(n)
        ? 'Double bedroom on the first floor of Vikendica Meri'
        : /djecija/.test(n)
          ? 'Children’s room on the first floor of Vikendica Meri'
          : /druga/.test(n)
            ? 'Twin bedroom on the second floor of Vikendica Meri'
            : 'Bedroom with balcony on the second floor of Vikendica Meri';
      // The detail token is the tail of the curated filename; appending it is what
      // keeps five photos of one room from sharing a single alt.
      if (/-krevet/.test(n)) return `${room} — the bed`;
      if (/-balkon/.test(n)) return `${room} — the balcony`;
      if (/-prozor/.test(n)) return `${room} — the window`;
      if (/-ulaz/.test(n)) return `${room} — the doorway`;
      if (/-pogled/.test(n)) return `${room} — the view`;
      if (/-detalj/.test(n)) return `${room} — detail`;
      return room;
    },
    kupatila: (n) => {
      const room = /prizemlje/.test(n)
        ? 'Ground-floor bathroom at Vikendica Meri'
        : 'Upstairs bathroom at Vikendica Meri';
      if (/ves-masina/.test(n)) return `${room} with the washing machine`;
      if (/umivaonik/.test(n)) return `${room} — the basin`;
      if (/kabina/.test(n)) return `${room} — the shower cabin`;
      if (/tus/.test(n)) return `${room} with shower cabin`;
      if (/pogled/.test(n)) return `${room} — the view`;
      if (/detalj/.test(n)) return `${room} — detail`;
      return `${room} with shower cabin`;
    },
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
