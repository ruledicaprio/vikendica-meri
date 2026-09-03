# Ponuda — izrada i održavanje web stranice za iznajmljivanje vikendice

**Referentni projekat:** [Vikendica Meri, Babanovac — Vlašić](https://vikendica-meri.iot-pages.workers.dev/)
**Datum ponude:** 3. 9. 2026. · **Važenje ponude:** 30 dana
**Valuta:** EUR, s preračunom u KM po fiksnom kursu 1 EUR = 1,95583 KM
**Sve cijene su bez PDV-a.**

---

## 1. Sažetak

Nudim izradu web stranice za iznajmljivanje smještaja izgrađenu na platformi koja je već
razvijena, testirana i u produkciji na referentnom projektu — a ne na WordPress temi.

Konkretno to znači:

- **Vlastiti kod, bez plugina.** Nema Elementora, nema 40 dodataka koje treba
  ažurirati i koji su najčešći ulaz za napad.
- **Trošak infrastrukture 90–170 € godišnje**, umjesto 300–600 € za hosting +
  licence plugina.
- **Rezervacije rade na vašoj stranici**, s vlastitom bazom i panelom za vlasnika —
  ne šaljete goste na Airbnb da biste naplatili proviziju od 15 %.
- **Kod je vaš.** Isporučuje se u vaš Git repozitorij, s dokumentacijom za
  održavanje.

---

## 2. Referentni obim — šta je već izgrađeno i u pogonu

Ovo nije procjena. Ovo je popis onoga što postoji, radi i može se otvoriti u pregledniku.

**57 commit-a · 9.262 linije koda (bez slika i lock fajlova) · 14.549 dodanih linija ukupno**

| Modul | Šta radi | Linija koda |
| :--- | :--- | ---: |
| **3D hero scena** | Proceduralna A-frame vikendica u Three.js. Prelaz zima ↔ ljeto vezan za scroll, shader nebo (domain-warped fbm), snijeg i zvijezde kao čestice, svjetla na hover, tri nivoa kvalitete prema snazi uređaja | 820 |
| **Dizajn sistem** | Kompletan responzivni CSS, tipografija, paleta, mobilni prolaz | 1.827 |
| **Struktura stranice** | Semantički HTML, sekcije: smještaj, destinacije, galerija, lokacija, dostupnost, FAQ, kontakt | 757 |
| **Panel za vlasnika** | Nadzorna ploča sa statistikom, detekcija preklapanja termina, grupisanje po mjesecima, potvrdi/odbij, ručne blokade, bilješke, filtri | 657 + 635 CSS + 76 HTML |
| **Worker API** | 6 ruta na Cloudflare Workers: zahtjev za rezervaciju, dostupnost, iCal izvoz, tri admin rute. Rate-limiting, Turnstile provjera, obavijest vlasniku | 540 |
| **Galerija** | Lightbox s trakom sličica, kategorije, mreža generisana u build-u | 432 + 192 |
| **Sistem za dva jezika** | 402 ključa × 2 jezika (bs / en). Stranica se renderuje po jeziku u build-u; build pada ako ključ nedostaje u jednom jeziku | 353 + 341 |
| **Kalendar dostupnosti** | Uživo iz baze, tri stanja (slobodno / na čekanju / zauzeto), odabir raspona | 335 |
| **Build dodaci (4)** | i18n render po jeziku, manifest galerije, generisanje sitemap-a, provjera da svaki link u strukturiranim podacima postoji | 487 |
| **Cloudflare Access** | RS256 verifikacija JWT-a nad JWKS-om, keširanje ključeva, cookie fallback — bez ijedne vanjske biblioteke | 113 |
| **Cjevovod za slike** | AVIF / WebP / JPEG × 4 širine, keš po hash-u sadržaja, `sharp`. 66 fotografija → ~600 varijanti | 190 |
| **Šabloni odgovora gostu** | Prijedlog odgovora na jeziku na kojem je gost čitao stranicu, za e-mail i WhatsApp | 95 |
| **Brza provjera u hero-u** | Kompaktna provjera termina koja gosta spušta na kalendar s već odabranim rasponom | 103 |
| **Video cjevovod** | Obrada snimka iz zraka, poster kadar | 101 |
| **Baza podataka** | Cloudflare D1 (SQLite), shema + migracije, indeksi za upit dostupnosti i rate-limit | 56 |
| **SEO** | Kompletan JSON-LD graf: `LodgingBusiness`, `FAQPage` (8 pitanja), `VideoObject`, `TouristAttraction`, `WebSite`, 6 × `ImageObject`, cijena, sadržaji, koordinate. Sitemap sa svih 60+ fotografija, `robots.txt`, canonical, OG, hreflang, Search Console | ~250 |
| **Sigurnost i keširanje** | Sigurnosna zaglavlja, pravila keširanja po tipu resursa, PWA manifest, ikone, 404 stranica | ~150 |
| **Dokumentacija za deploy** | Runbook s pravim zamkama koje su koštale ciklusa: verzija Node-a, Access cookie path, `run_worker_first`, JWKS | 163 |

**Ukupan uloženi razvoj referentnog projekta: ~440 sati.**

---

## 3. Paketi izrade

> Cijena svakog paketa sadrži **licencu platforme** — pravo korištenja gore
> opisane kodne baze — i **rad na prilagodbi** za vaš objekat. Ne plaćate 440 sati
> ispočetka; plaćate prilagodbu i pravo da koristite ono što je već napravljeno.

### Paket 1 — VITRINA

Za objekat koji je već na Airbnb-u/Booking-u i treba mu vlastita, ozbiljna adresa.

- Jednostranična prezentacija, bosanski + engleski
- Galerija s lightboxom i cjevovodom za slike (AVIF/WebP/JPEG, do 60 fotografija)
- Kontakt forma sa zaštitom od spama (Turnstile) i obavijesti na e-mail
- Kompletan SEO: JSON-LD, sitemap, Search Console, Google Business Profile
- Sigurnosna zaglavlja, PWA, 404, ikone
- Postavljanje domene, DNS-a, deploya na Cloudflare
- Predaja koda + 2 sata obuke

*Bez 3D scene, bez baze, bez kalendara, bez panela za vlasnika.*

**Obim prilagodbe: ~70 sati · Rok: 3–4 sedmice**

### **2.250 € · 4.400 KM**

---

### Paket 2 — PROFESIONALNI ⭐ *preporučeno*

Sve iz Paketa 1, plus ono što stranicu pretvara iz brošure u kanal prodaje:

- **3D hero scena** prilagođena vašem objektu (geometrija, paleta, sezona)
- **Kalendar dostupnosti uživo** + brza provjera termina u hero-u
- **Zahtjevi za rezervaciju idu u vašu bazu** (Cloudflare D1), ne u inbox
- **Panel za vlasnika** iza Cloudflare Access prijave:
  nadzorna ploča, upozorenje na preklapanja, potvrdi/odbij, ručne blokade
  termina, bilješke, prijedlozi odgovora gostu na bs/en preko e-maila,
  WhatsAppa i Vibera
- **iCal izvoz** (`/calendar.ics`) — vaš kalendar se može pretplatiti u Google
  Calendar, Apple Calendar, Airbnb
- Praćenje rada (observability) i logovanje tihih grešaka

**Obim prilagodbe: ~132 sata · Rok: 5–7 sedmica**

### **4.400 € · 8.600 KM**

> **Opcija:** bez 3D scene (hero od videa/fotografije) — **−750 € / −1.470 KM**
> → **3.650 € · 7.140 KM**

---

### Paket 3 — KANALI I NAPLATA

Sve iz Paketa 2, plus svi moduli iz tačke 4, uz **10 % popusta na module**.

**Obim prilagodbe: ~234 sata · Rok: 9–11 sedmica**

### **6.700 € · 13.100 KM**

---

## 4. Moduli po izboru

Mogu se dokupiti uz Paket 2 u bilo kojem trenutku, prije ili poslije primopredaje.

| Modul | Šta rješava | Sati | Cijena |
| :--- | :--- | ---: | ---: |
| **Sinhronizacija s Airbnb / Booking.com** | Dvosmjerni iCal: njihove rezervacije zatvaraju vaš kalendar, vaše zatvaraju njihov. Kraj dvostrukim rezervacijama. *Tabela u bazi je već pripremljena za ovo.* | 28 | **700 € · 1.370 KM** |
| **Automatski e-mail gostu** | Potvrda i odgovor idu gostu sa `@vasadomena.com`, s ispravnim SPF/DKIM/DMARC zapisima da ne padnu u spam | 14 | **350 € · 685 KM** |
| **Sezonski cjenovnik** | Cijene po sezoni/danu u sedmici/broju noći, s izračunom ukupne cijene odmah u formi | 20 | **500 € · 980 KM** |
| **Online uplata akontacije** | Plaćanje karticom (Stripe), potvrda rezervacije tek nakon uplate | 24 | **600 € · 1.175 KM** |
| **Analitika + kolačići** | Analitika koja poštuje privatnost, banner za saglasnost, usklađenost s GDPR-om | 10 | **250 € · 490 KM** |
| **Pravne stranice** | Politika privatnosti, uslovi korištenja, kućni red — na oba jezika | 6 | **150 € · 295 KM** |
| **Dodatni jezik** | npr. njemački ili nizozemski — 402 ključa, prijevod i provjera | 12 | **300 € · 585 KM** |
| **Google Business Profile** | Postavljanje i optimizacija, povezivanje sa stranicom | 6 | **150 € · 295 KM** |

**Nije uključeno u cijenu, ali mogu organizovati:** profesionalno fotografisanje i
snimanje dronom (podizvođač, **400–800 €**, fakturiše se po stvarnom trošku).

---

## 5. Šta cijena ne pokriva

Da ne bude nesporazuma kasnije:

- Sadržaj — tekstove i fotografije obezbjeđujete vi (ili se dogovara zasebno)
- Prijevod na dodatne jezike izvan bs/en (vidi module)
- Marketing, plaćeni oglasi, upravljanje društvenim mrežama
- Trošak domene i infrastrukture (tačka 7 — prolazni trošak, bez marže)
- Izmjene koncepta nakon odobrenog dizajna (naplaćuju se po satnici)
- Dvije runde revizija su uključene; svaka dodatna se naplaćuje

---

## 6. Održavanje

Stranica bez održavanja radi — dok se nešto ne promijeni: istekne domena, Cloudflare
promijeni podrazumijevanu postavku, Airbnb promijeni format iCal-a, treba ubaciti
nove cijene za sezonu. Zato održavanje nudim odvojeno od izrade.

| | **M0 — Samostalno** | **M1 — Osnovno** | **M2 — Aktivno** ⭐ | **M3 — Partner** |
| :--- | :---: | :---: | :---: | :---: |
| | *vi držite račune* | | *preporučeno* | *za 2+ objekta* |
| **Mjesečno** | **0 €** | **30 € · 59 KM** | **80 € · 157 KM** | **165 € · 323 KM** |
| **Godišnje (−10 %)** | — | **486 € · 950 KM** | **864 € · 1.690 KM** | **1.782 € · 3.485 KM** |
| Administracija domene, DNS-a, Cloudflarea | vi | ✅ | ✅ | ✅ |
| Infrastruktura plaćena i uključena | vi | ✅ | ✅ | ✅ |
| Nadzor dostupnosti (uptime) | — | ✅ | ✅ | ✅ |
| Mjesečna rezervna kopija baze | — | ✅ | ✅ | ✅ |
| Sigurnosna ažuriranja zavisnosti | — | kvartalno | mjesečno | mjesečno |
| Ispravke grešaka na isporučenom | — | ✅ | ✅ | ✅ |
| Izmjene sadržaja (tekst, cijene, fotografije) | — | 1 h/mj | 2 h/mj | 5 h/mj |
| Sezonsko osvježavanje sadržaja i cijena | — | — | ✅ | ✅ |
| Nadzor sinhronizacije kanala | — | — | ✅ | ✅ |
| SEO izvještaj + Search Console | — | — | kvartalno | mjesečno |
| Provjera performansi (Lighthouse) | — | — | kvartalno | mjesečno |
| Razvoj novih funkcija | po satu | po satu | po satu | 5 h/mj uključeno |
| **Vrijeme odziva** | po dogovoru | 3 radna dana | 1 radni dan | isti radni dan |

**Rad izvan paketa:** 30 € / 59 KM po satu.
Hitne intervencije, vikendom i van radnog vremena: 42 € / 82 KM po satu.

Neiskorišteni sati se ne prenose u naredni mjesec. Ugovor o održavanju je na 12
mjeseci, s otkaznim rokom od 30 dana.

---

## 7. Trošak infrastrukture — prolazni, bez marže

Ovo je najveća praktična prednost ovakve arhitekture. Isti troškovi bez obzira na paket:

| Stavka | Godišnje |
| :--- | ---: |
| `.com` domena (Cloudflare Registrar, po nabavnoj cijeni) | ~15 € |
| Cloudflare Workers — **besplatni plan je dovoljan** za promet vikendice | 0 € |
| Cloudflare Workers Paid (preporučeno kad krene sezona) | ~57 € |
| Cloudflare D1 baza, Turnstile, Access (do 50 korisnika) | 0 € |
| Slanje e-mailova (besplatni plan do 3.000 poruka/mj) | 0 € |
| E-mail sandučić na vlastitoj domeni (opcionalno, Zoho) | ~12 € |
| **Ukupno, realno** | **90–170 €/god** |

Za poređenje: WordPress hosting + tema + licence plugina za rezervacije obično
iznose **300–600 € godišnje**, uz veću površinu za sigurnosne propuste.

---

## 8. Plan isporuke

Na primjeru Paketa 2:

| Faza | Sadržaj | Trajanje |
| :--- | :--- | :--- |
| **1. Priprema** | Sastanak, prikupljanje sadržaja i fotografija, struktura stranice, dogovor o paleti | 1 sedmica |
| **2. Dizajn i obrada** | Obrada fotografija, dizajn, 3D scena prilagođena objektu | 1–2 sedmice |
| **3. Razvoj** | Sadržaj na oba jezika, kalendar, baza, forma, panel za vlasnika | 2 sedmice |
| **4. Infrastruktura** | Domena, DNS, Cloudflare, Access, Turnstile, e-mail, SEO, Search Console | 0,5 sedmica |
| **5. Testiranje** | Mobilni uređaji, preglednici, performanse, test rezervacije od kraja do kraja | 0,5 sedmica |
| **6. Primopredaja** | Obuka vlasnika (2 h), predaja koda i dokumentacije, prebacivanje računa na vas | 1 sedmica |

**Ukupno: 5–7 sedmica** od potvrde ponude i primitka sadržaja.

Rok teče od trenutka kada su fotografije i tekstovi dostavljeni. Kašnjenje sadržaja
pomjera rok isporuke za isto vrijeme.

---

## 9. Uslovi plaćanja

| Rata | Kada | Udio |
| :--- | :--- | ---: |
| Avans | Potpis ugovora, početak rada | **40 %** |
| Druga rata | Odobren dizajn i funkcionalna verzija na test adresi | **30 %** |
| Završna rata | Primopredaja, prebacivanje na produkcijsku domenu | **30 %** |

- Rok plaćanja: 15 dana od izdavanja fakture
- Održavanje se fakturiše kvartalno unaprijed, ili godišnje uz 10 % popusta
- Sve cijene su **bez PDV-a**; ako sam u sistemu PDV-a, dodaje se 17 %
- Plaćanje u KM po srednjem kursu CBBiH na dan fakture (fiksni kurs 1 EUR = 1,95583 KM)

---

## 10. Licenca i vlasništvo

**Vaše, u potpunosti i trajno:**
- Kompletan izvorni kod isporučene stranice, u vašem Git repozitoriju
- Sav sadržaj: fotografije, tekstovi, baza podataka
- Domena i svi računi (Cloudflare, e-mail) prelaze na vaše ime pri primopredaji
- Trajno, neisključivo pravo korištenja i izmjene isporučenog rješenja za vaš objekat
- **Niste vezani za mene.** Kod može preuzeti bilo koji drugi programer —
  dokumentacija za deploy se isporučuje upravo zbog toga

**Ostaje moje:**
- Jezgro platforme (build dodaci, cjevovod za slike, kostur Workera, panel za
  vlasnika) — licencira se, ne prodaje. Smijem ga koristiti za druge klijente,
  ali nikada s vašim sadržajem, fotografijama, tekstovima ili dizajnerskim
  identitetom.

**Isključivost za regiju** (obaveza da isto rješenje ne prodam drugom objektu na
Vlašiću / u vašoj opštini, na 3 godine): **+4.000 € · 7.825 KM**.

---

## 11. Zašto ovo, a ne gotovo rješenje

| | Ova ponuda | WordPress + plugini | Wix / Squarespace |
| :--- | :--- | :--- | :--- |
| Godišnji trošak | 90–170 € | 300–600 € | 200–400 € |
| Provizija po rezervaciji | **0 %** | 0 % | 0 % |
| Vlasništvo nad kodom | ✅ potpuno | djelimično | ❌ |
| Površina za napad | vlastiti kod, bez plugina | 20–40 plugina | zatvoreno |
| Brzina učitavanja | statika s ruba mreže | zavisi od hostinga | osrednja |
| Prilagodba | neograničena | ograničena temom | vrlo ograničena |
| Izlazak s platforme | `git clone` | migracija | podaci ostaju |

---

**Kontakt**
Rusmir Skopljak · rusmirskopljak@gmail.com

*Ova ponuda je informativnog karaktera i ne predstavlja obavezujuću ponudu u smislu
Zakona o obligacionim odnosima do potpisa ugovora.*
