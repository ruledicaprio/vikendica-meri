#!/usr/bin/env node
// Resize/compress a single photo into public/<category>/ for the gallery
// manifest to pick up. For a bulk rebuild from the curated map, use
// scripts/ingest-photos.js instead. Usage:
//   node scripts/process-photo.js <sourceFile> <category> <outputName.jpg> [--max=2200] [--quality=80] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../plugins/gallery-manifest.js';
import { writeMaster } from './lib/images.js';

function parseArgs(argv) {
  const positional = [];
  const flags = { max: 2200, quality: 80, force: false };
  for (const arg of argv) {
    if (arg === '--force') flags.force = true;
    else if (arg.startsWith('--max=')) flags.max = Number(arg.slice(6));
    else if (arg.startsWith('--quality=')) flags.quality = Number(arg.slice(10));
    else positional.push(arg);
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [source, category, outputName] = positional;

  if (!source || !category || !outputName) {
    console.error('Usage: node scripts/process-photo.js <sourceFile> <category> <outputName.jpg> [--max=2200] [--quality=80] [--force]');
    process.exit(1);
  }
  if (!CATEGORIES.includes(category)) {
    console.error(`Invalid category "${category}". Must be one of: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`Source file not found: ${source}`);
    process.exit(1);
  }

  const destDir = path.resolve(process.cwd(), 'public', category);
  const dest = path.join(destDir, outputName);
  if (fs.existsSync(dest) && !flags.force) {
    console.error(`Destination already exists: ${dest} (pass --force to overwrite)`);
    process.exit(1);
  }

  const { width, height, size } = await writeMaster(source, dest, {
    max: flags.max,
    quality: flags.quality,
  });
  console.log(`Wrote ${dest} — ${width}x${height}, ${(size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
