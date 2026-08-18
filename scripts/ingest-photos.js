#!/usr/bin/env node
// Rebuild the villa photo folders in public/ from the curated map in
// scripts/photo-map.js. Idempotent — safe to re-run after editing the map.
//   node scripts/ingest-photos.js [--clean] [--dry]
//
// --clean removes any file in a target category that the map no longer lists,
//         so the map is the single source of truth for what is published.
import fs from 'node:fs';
import path from 'node:path';
import { PHOTO_MAP, VILLA_CATEGORIES } from './photo-map.js';
import { writeMaster } from './lib/images.js';

const ROOT = process.cwd();
const flags = {
  clean: process.argv.includes('--clean'),
  dry: process.argv.includes('--dry'),
};

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exitCode = 1;
}

async function main() {
  // Validate the map before touching the filesystem.
  const seen = new Set();
  let bad = false;
  for (const { src, cat, name } of PHOTO_MAP) {
    if (!VILLA_CATEGORIES.includes(cat)) { fail(`unknown category "${cat}" for ${name}`); bad = true; }
    if (!fs.existsSync(path.join(ROOT, src))) { fail(`missing source: ${src}`); bad = true; }
    const key = `${cat}/${name}`;
    if (seen.has(key)) { fail(`duplicate destination: ${key}`); bad = true; }
    seen.add(key);
  }
  for (const cat of VILLA_CATEGORIES) {
    const covers = PHOTO_MAP.filter((p) => p.cat === cat && p.name.startsWith('00-'));
    if (covers.length !== 1) { fail(`${cat} needs exactly one 00-* cover, found ${covers.length}`); bad = true; }
  }
  if (bad) return;

  if (flags.dry) {
    for (const { src, cat, name } of PHOTO_MAP) console.log(`${src}  ->  public/${cat}/${name}`);
    console.log(`\n${PHOTO_MAP.length} photos across ${VILLA_CATEGORIES.length} categories (dry run)`);
    return;
  }

  let bytes = 0;
  for (const { src, cat, name } of PHOTO_MAP) {
    const dest = path.join(ROOT, 'public', cat, name);
    const { width, height, size } = await writeMaster(path.join(ROOT, src), dest);
    bytes += size;
    console.log(`${cat}/${name.padEnd(36)} ${width}x${height}  ${(size / 1024).toFixed(0)} KB`);
  }

  if (flags.clean) {
    for (const cat of VILLA_CATEGORIES) {
      const dir = path.join(ROOT, 'public', cat);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!seen.has(`${cat}/${f}`)) {
          fs.unlinkSync(path.join(dir, f));
          console.log(`removed stale ${cat}/${f}`);
        }
      }
    }
  }

  console.log(`\n${PHOTO_MAP.length} photos, ${(bytes / 1048576).toFixed(1)} MB total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
