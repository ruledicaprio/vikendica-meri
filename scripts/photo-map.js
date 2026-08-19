// Curated source → published mapping for the villa photos.
//
// The order here is the order visitors see: the manifest sorts filenames
// numerically, so the `NN-` prefix is what controls the gallery sequence, and
// `00-*` is the cover (pickCover() in src/gallery.js falls through to the first
// file when no `scene-*`/`front-*` name is present — which is why nothing in
// these categories uses those prefixes).
//
// Chosen by eye from contact sheets of data/img/, not from filenames.
// Filenames stay ASCII: they end up in URLs.

/** Gallery categories in display order. `vlasic`/`travnik` are appended by the plugin. */
export const VILLA_CATEGORIES = ['eksterijer', 'dnevni', 'kuhinja', 'sobe', 'kupatila'];

export const PHOTO_MAP = [
  // ---------------------------------------------------------------- eksterijer
  ['ext/front-2.jpg', 'eksterijer', '00-vikendica-prednja-strana.jpg'],
  ['ext/front-0-park.jpg', 'eksterijer', '01-vikendica-a-frame-ljeto.jpg'],
  ['ext/front-4.jpg', 'eksterijer', '05-vikendica-prilaz.jpg'],
  ['ext/front-1.jpg', 'eksterijer', '06-vikendica-vece-snijeg.jpg'],
  ['ext/front-3.jpg', 'eksterijer', '07-vikendica-zimski-pogled.jpg'],
  ['ext/back-0.jpg', 'eksterijer', '08-terasa-rostilj.jpg'],
  ['ext/back-1.jpg', 'eksterijer', '10-vikendica-bocna-strana.jpg'],
  ['ext/entrance-0-view.jpg', 'eksterijer', '12-ulaz-kamena-staza.jpg'],
  ['ext/entrance-2.jpg', 'eksterijer', '13-ulaz-prolaz.jpg'],
  ['ext/entrance-1.jpg', 'eksterijer', '14-ulaz-balkoni.jpg'],
  ['ext/scene-1-view.jpg', 'eksterijer', '15-okolina-zimi.jpg'],
  ['ext/scene-2-view.jpg', 'eksterijer', '16-okolina-borovi.jpg'],
  ['ext/scene-0-view.jpg', 'eksterijer', '17-okolina-naselje.jpg'],

  // --------------------------------------------------------------------- dnevni
  ['comm/common-0.JPEG', 'dnevni', '00-dnevni-boravak.jpg'],
  ['comm/common-1.JPEG', 'dnevni', '01-trpezarija.jpg'],
  ['comm/common-2-view.JPEG', 'dnevni', '02-hodnik.jpg'],

  // -------------------------------------------------------------------- kuhinja
  ['kitch/kitchen-6.jpg', 'kuhinja', '00-kuhinja.jpg'],
  ['kitch/kitchen-0-view.jpg', 'kuhinja', '01-kuhinja-pogled.jpg'],
  ['kitch/kitchen-3.jpg', 'kuhinja', '02-kuhinja-sudoper.jpg'],
  ['kitch/kitchen-2-stove.jpg', 'kuhinja', '03-kuhinja-stednjak.jpg'],
  ['kitch/kitchen-5.jpg', 'kuhinja', '04-kuhinja-frizider.jpg'],
  ['kitch/kitchen-1.jpg', 'kuhinja', '05-kuhinja-mikrovalna.jpg'],
  ['kitch/kitchen-8-kettle.jpg', 'kuhinja', '06-kuhinja-elementi.jpg'],
  ['kitch/kitchen-7.jpg', 'kuhinja', '07-kuhinja-ulaz.jpg'],
  ['kitch/kitchen-9-fridge-microvawe.jpg', 'kuhinja', '09-kuhinja-radna-ploca.jpg'],
  ['kitch/kitchen-4.jpg', 'kuhinja', '10-kuhinja-kutak.jpg'],

  // ----------------------------------------------------------------------- sobe
  ['bed/floor-1-room-2-fig-1.JPEG', 'sobe', '00-soba-bracna-sprat-1.jpg'],
  ['bed/floor-1-room-2-fig-0.JPEG', 'sobe', '01-soba-bracna-sprat-1-pogled.jpg'],
  ['bed/floor-1-room-1-fig-0.JPG', 'sobe', '03-soba-djecija-sprat-1.jpg'],
  ['bed/floor-2-room-1-fig-0.JPG', 'sobe', '04-soba-sprat-2-prva.jpg'],
  ['bed/floor-2-room-1-fig-3.JPG', 'sobe', '05-soba-sprat-2-prva-krevet.jpg'],
  ['bed/floor-2-room-1-fig-1.JPG', 'sobe', '06-soba-sprat-2-prva-ulaz.jpg'],
  ['bed/floor-2-room-1-fig-2.JPG', 'sobe', '07-soba-sprat-2-prva-balkon.jpg'],
  ['bed/floor-2-room-1-fig-4.JPG', 'sobe', '08-soba-sprat-2-prva-detalj.jpg'],
  ['bed/floor-2-room-2-fig-2.JPG', 'sobe', '09-soba-sprat-2-druga.jpg'],
  ['bed/floor-2-room-2-fig-1.JPG', 'sobe', '10-soba-sprat-2-druga-pogled.jpg'],
  ['bed/floor-2-room-2-fig-3.JPG', 'sobe', '11-soba-sprat-2-druga-prozor.jpg'],
  ['bed/floor-2-room-2-fig-0.JPG', 'sobe', '12-soba-sprat-2-druga-detalj.jpg'],

  // ------------------------------------------------------------------- kupatila
  ['bath/bath-floor-0-scene-2.jpg', 'kupatila', '00-kupatilo-prizemlje-tus.jpg'],
  ['bath/bath-floor-0-scene-1.jpg', 'kupatila', '01-kupatilo-prizemlje-kabina.jpg'],
  ['bath/bath-floor-0-scene-0.jpg', 'kupatila', '02-kupatilo-prizemlje-umivaonik.jpg'],
  ['bath/bath-floor-0-scene-3.jpg', 'kupatila', '03-kupatilo-prizemlje-pogled.jpg'],
  ['bath/bath-floor-1-scene-0.jpg', 'kupatila', '04-kupatilo-sprat-tus.jpg'],
  ['bath/bath-floor-1-scene-3.jpg', 'kupatila', '05-kupatilo-sprat-pogled.jpg'],
  ['bath/bath-floor-1-scene-1.jpg', 'kupatila', '06-kupatilo-sprat-ves-masina.jpg'],
  ['bath/bath-floor-1-scene-2.jpg', 'kupatila', '07-kupatilo-sprat-detalj.jpg'],
].map(([src, cat, name]) => ({ src: `data/img/${src}`, cat, name }));
