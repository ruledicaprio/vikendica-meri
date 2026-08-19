// Build-time strings for index.html. Consumed only by plugins/i18n-html.js,
// never imported by the app, so none of this reaches the browser bundle.
//
// Every key here must appear as {{key}} in index.html and must exist in both
// locales — the plugin throws on either mismatch, so the two cannot drift.

export const bs = {
  lang: 'bs',
  ogLocale: 'bs_BA',
  path: '/',

  title: 'Vikendica Meri — A-frame vikendica na Vlašiću, Babanovac',
  description:
    'Vikendica Meri — klasična A-frame planinska vikendica u Dolini Panjeva, Babanovac, Vlašić. Smještaj za ~10 osoba, blizu ski-centra i grada Travnika.',
  ogTitle: 'Vikendica Meri — A-frame vikendica na Vlašiću, Babanovac',
  ogDescription:
    'Klasična A-frame planinska vikendica u Dolini Panjeva na Babanovcu. Smještaj za do 10 osoba, blizu ski-centra Vlašić.',
  ogImageAlt: 'A-frame vikendica Meri sa strmim drvenim krovom, Babanovac, Vlašić',

  ldDescription:
    'Klasična A-frame planinska vikendica sa strmim drvenim krovom i prostranim balkonima, u mirnoj Dolini Panjeva na Babanovcu, Vlašić. Smještaj za do 10 osoba.',
  ldOccupancyUnit: 'osoba',
  ldVideoName: 'Babanovac iz zraka — Vlašić',
  ldVideoDescription: 'Snimak iz zraka naselja Babanovac na planini Vlašić.',

  skipLink: 'Preskoči na sadržaj',
  navSmjestaj: 'Smještaj',
  navDestinacije: 'Planina Vlašić i Travnik',
  navGalerija: 'Galerija',
  navCta: 'Rezerviši&nbsp;→',
  navBurger: 'Otvori meni',
  langSwitchHref: '/en/',
  langSwitchLang: 'en',
  langSwitchLabel: 'English',
  langSwitchAria: 'Switch to English',

  heroSubtitle: 'Planina Vlašić · Babanovac',
  heroLocation: 'Dolina Panjeva · Babanovac · Vlašić',
  heroCtaPrimary: 'Pogledaj smještaj',
  heroCtaSecondary: 'Rezerviši',
  scrollHint: 'Istraži ↓',

  aboutKicker: 'O vikendici',
  aboutTitle: 'Topli planinski dom sa dušom',
  aboutP1:
    'Klasična A-frame vikendica sa strmim drvenim krovom, prostranim balkonima i pogledom na borovu šumu. Generacijama je ovo mjesto okupljanja porodice i prijatelja, gdje miris drveta i toplina peći stvaraju nezaboravan ugođaj.',
  aboutP2Before: 'Smještena u mirnoj Dolini Panjeva na Babanovcu, nudi udoban prostor za',
  aboutP2Strong: 'do 10 osoba',
  aboutP2After:
    '— idealno za zimske dane na snijegu i ljetne večeri uz roštilj. Centralno grijanje na pelet i drva čuva toplinu doma u svako doba godine.',
  factCapacity: '🛏️ Kapacitet ~10 osoba',
  factHeating: '🔥 Centralno grijanje',
  factLocation: '📍 Babanovac, Vlašić',
  // Also stated as priceRange/makesOffer in the JSON-LD; the two must agree.
  factPrice: '💰 100–200 KM / noć',

  floorsSubhead: 'Raspored po etažama',
  floorGround: 'Prizemlje',
  floorFirst: '1. sprat',
  floorSecond: '2. sprat',
  roomHallway: 'Predsoblje',
  roomBathroom: 'Kupatilo',
  roomLiving: 'Dnevni boravak',
  roomKitchen: 'Kuhinja',
  roomMaster: 'Soba: bračni + 1 single + balkon',
  roomKids: 'Dječija soba: 2× single',
  roomTwoSingle: 'Soba: 2× single',
  roomThreeSingle: 'Soba: 3× single + balkon',

  amenitiesSubhead: 'Sadržaji',
  amParking: 'Besplatan parking',
  amGrill: 'Roštilj',
  amKettle: 'Kuhalo',
  amOven: 'Rerna',
  amStove: 'Šporet',
  amMicrowave: 'Mikrovalna',
  amFridge: 'Frižider',
  amTv: 'LED TV',
  amWasher: 'Veš mašina',
  amHeating: 'Centralno grijanje (pelet/drva)',
  amHairdryer: 'Fen',
  amVacuum: 'Usisavač',

  videoKicker: 'Babanovac',
  videoTitle: 'Osjetite planinu iz vikendice',
  videoAria: 'Snimak iz zraka: Babanovac na Vlašiću',
  videoPlayAria: 'Pusti video',
  videoOverlay: 'Babanovac, Vlašić',
  videoCreditLabel: 'Video:',

  destKicker: 'Istraži okolinu',
  destTitle: 'Planina Vlašić &amp; Grad Travnik',
  destVlasicTitle: 'Planina Vlašić',
  destVlasicBody:
    'Vlašić je planina u centralnoj Bosni, poznat po ski-stazama Babanovca, borovim šumama i kristalnom zraku. Dolina Panjeva, gdje se nalazi Vikendica Meri, pruža mir i prirodu u svako godišnje doba.',
  destVlasicOnline: 'Vlašić online ↗',
  destSkiCentre: 'Ski-centar ↗',
  destLiveCams: '● Live kamere ↗',
  destLiveLift: '● Live: Lift Babanovac ↗',
  destTravnikTitle: 'Grad Travnik',
  destTravnikBody:
    'Travnik — bivša prijestolnica Bosanskog ejaleta — krasi se historijskim utvrđenjem, šarenom čaršijom i legendom o Ivi Andriću. Udaljen je 30 minuta od Vlašića i savršen za kulturni izlet.',
  destTravnikMuseum: 'Muzej Travnik ↗',

  galleryKicker: 'Galerija',
  galleryTitle: 'Pogledajte smještaj',

  calendarTitle: 'Dostupnost',
  floorViewPhoto: 'pogledaj fotografiju',
  contactKicker: 'Kontakt',
  contactTitle: 'Rezervišite svoj boravak',
  contactLead:
    'Za upite i rezervacije kontaktirajte nas telefonom, mailom ili putem poruke. Radujemo se vašoj posjeti.',
  contactAddress: 'Dolina Panjeva, Babanovac, Vlašić, BiH',
  contactWhatsappAria: 'Pošaljite WhatsApp poruku na +387 62 555 888',
  contactViberAria: 'Pošaljite Viber poruku na +387 62 555 888',
  contactNote: '🕑 Minimalni boravak: 2 noći',
  // Also stated as checkinTime/checkoutTime in the JSON-LD; the two must agree.
  contactCheckin: '🕓 Prijava od 14:00 · Odjava do 11:00',
  mapTitle: 'Lokacija — Vikendica Meri',
  mapButton: 'Otvori u Google Maps',

  formTitle: 'Pošaljite upit',
  formName: 'Ime i prezime',
  formNamePlaceholder: 'Vaše ime',
  formEmail: 'Email',
  formPhone: 'Telefon',
  formCheckin: 'Dolazak',
  formCheckout: 'Odlazak',
  formGuests: 'Broj gostiju',
  formMessage: 'Poruka',
  formMessagePlaceholder: 'Termin, broj noćenja, pitanja…',
  formSubmit: 'Pošalji upit',

  footerCopy: 'Vikendica Meri © 2026 · Vlašić, BiH',
  footerCreditLabel: 'Fotografije i video Vlašića:',
};

export const en = {
  lang: 'en',
  ogLocale: 'en_US',
  path: '/en/',

  title: 'Vikendica Meri — A-frame chalet on Vlašić mountain, Babanovac',
  description:
    'Vikendica Meri — a classic A-frame mountain chalet in Dolina Panjeva, Babanovac, Vlašić. Sleeps around 10, close to the ski centre and the town of Travnik.',
  ogTitle: 'Vikendica Meri — A-frame chalet on Vlašić mountain, Babanovac',
  ogDescription:
    'A classic A-frame mountain chalet in Dolina Panjeva, Babanovac. Sleeps up to 10, close to the Vlašić ski centre.',
  ogImageAlt: 'Vikendica Meri A-frame chalet with its steep timber roof, Babanovac, Vlašić',

  ldDescription:
    'A classic A-frame mountain chalet with a steep timber roof and generous balconies, in the quiet Dolina Panjeva valley at Babanovac, Vlašić. Sleeps up to 10.',
  ldOccupancyUnit: 'guests',
  ldVideoName: 'Babanovac from the air — Vlašić',
  ldVideoDescription: 'Aerial footage of the Babanovac settlement on Vlašić mountain.',

  skipLink: 'Skip to content',
  navSmjestaj: 'The chalet',
  navDestinacije: 'Vlašić &amp; Travnik',
  navGalerija: 'Gallery',
  navCta: 'Book&nbsp;→',
  navBurger: 'Open menu',
  langSwitchHref: '/',
  langSwitchLang: 'bs',
  langSwitchLabel: 'Bosanski',
  langSwitchAria: 'Prebaci na bosanski',

  heroSubtitle: 'Vlašić mountain · Babanovac',
  heroLocation: 'Dolina Panjeva · Babanovac · Vlašić',
  heroCtaPrimary: 'See the chalet',
  heroCtaSecondary: 'Book',
  scrollHint: 'Explore ↓',

  aboutKicker: 'About the chalet',
  aboutTitle: 'A warm mountain home with a soul',
  aboutP1:
    'A classic A-frame chalet with a steep timber roof, generous balconies and a view over the pine forest. For generations this has been where family and friends gather, where the scent of wood and the warmth of the stove make a stay memorable.',
  aboutP2Before: 'Set in the quiet Dolina Panjeva valley at Babanovac, it offers comfortable space for',
  aboutP2Strong: 'up to 10 people',
  aboutP2After:
    '— ideal for winter days in the snow and summer evenings around the grill. Central heating on pellets and wood keeps the house warm in every season.',
  factCapacity: '🛏️ Sleeps around 10',
  factHeating: '🔥 Central heating',
  factLocation: '📍 Babanovac, Vlašić',
  factPrice: '💰 100–200 KM / night',

  floorsSubhead: 'Floor by floor',
  floorGround: 'Ground floor',
  floorFirst: 'First floor',
  floorSecond: 'Second floor',
  roomHallway: 'Entrance hall',
  roomBathroom: 'Bathroom',
  roomLiving: 'Living room',
  roomKitchen: 'Kitchen',
  roomMaster: 'Bedroom: double + 1 single + balcony',
  roomKids: 'Children’s room: 2× single',
  roomTwoSingle: 'Bedroom: 2× single',
  roomThreeSingle: 'Bedroom: 3× single + balcony',

  amenitiesSubhead: 'Amenities',
  amParking: 'Free parking',
  amGrill: 'Grill',
  amKettle: 'Kettle',
  amOven: 'Oven',
  amStove: 'Stove',
  amMicrowave: 'Microwave',
  amFridge: 'Fridge',
  amTv: 'LED TV',
  amWasher: 'Washing machine',
  amHeating: 'Central heating (pellets/wood)',
  amHairdryer: 'Hairdryer',
  amVacuum: 'Vacuum cleaner',

  videoKicker: 'Babanovac',
  videoTitle: 'Feel the mountain from the chalet',
  videoAria: 'Aerial footage: Babanovac on Vlašić',
  videoPlayAria: 'Play video',
  videoOverlay: 'Babanovac, Vlašić',
  videoCreditLabel: 'Video:',

  destKicker: 'Explore the area',
  destTitle: 'Vlašić Mountain &amp; the Town of Travnik',
  destVlasicTitle: 'Vlašić Mountain',
  destVlasicBody:
    'Vlašić is a mountain in central Bosnia, known for the ski runs at Babanovac, its pine forests and its clear air. Dolina Panjeva, where Vikendica Meri sits, offers quiet and nature in every season.',
  destVlasicOnline: 'Vlašić online ↗',
  destSkiCentre: 'Ski centre ↗',
  destLiveCams: '● Live cameras ↗',
  destLiveLift: '● Live: Babanovac lift ↗',
  destTravnikTitle: 'Town of Travnik',
  destTravnikBody:
    'Travnik — once the capital of the Bosnian eyalet — is known for its historic fortress, its colourful old bazaar and its association with the writer Ivo Andrić. It is 30 minutes from Vlašić and makes a perfect day out.',
  destTravnikMuseum: 'Travnik Museum ↗',

  galleryKicker: 'Gallery',
  galleryTitle: 'Take a look inside',

  calendarTitle: 'Availability',
  floorViewPhoto: 'view photo',
  contactKicker: 'Contact',
  contactTitle: 'Book your stay',
  contactLead:
    'For enquiries and reservations, reach us by phone, email or the form below. We look forward to your visit.',
  contactAddress: 'Dolina Panjeva, Babanovac, Vlašić, Bosnia and Herzegovina',
  contactWhatsappAria: 'Message +387 62 555 888 on WhatsApp',
  contactViberAria: 'Message +387 62 555 888 on Viber',
  contactNote: '🕑 Minimum stay: 2 nights',
  contactCheckin: '🕓 Check-in from 14:00 · Check-out by 11:00',
  mapTitle: 'Location — Vikendica Meri',
  mapButton: 'Open in Google Maps',

  formTitle: 'Send an enquiry',
  formName: 'Full name',
  formNamePlaceholder: 'Your name',
  formEmail: 'Email',
  formPhone: 'Phone',
  formCheckin: 'Check-in',
  formCheckout: 'Check-out',
  formGuests: 'Number of guests',
  formMessage: 'Message',
  formMessagePlaceholder: 'Dates, number of nights, questions…',
  formSubmit: 'Send enquiry',

  footerCopy: 'Vikendica Meri © 2026 · Vlašić, Bosnia and Herzegovina',
  footerCreditLabel: 'Vlašić photography and video:',
};

export const LOCALES = { bs, en };
export const DEFAULT_LOCALE = 'bs';
