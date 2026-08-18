#!/usr/bin/env node
// Resize/compress a photo into public/<category>/ for the gallery manifest
// (see vite.config.js) to pick up. Usage:
//   node scripts/process-photo.js <sourceFile> <category> <outputName.jpg> [--max=2200] [--quality=80] [--force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const CATEGORIES = ['smjestaj', 'vlasic', 'travnik'];

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

  const tmpDest = `${dest}.tmp.jpg`;
  await sharp(source)
    .rotate()
    .resize({ width: flags.max, height: flags.max, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: flags.quality, mozjpeg: true })
    .toFile(tmpDest);
  fs.renameSync(tmpDest, dest);

  const { size } = fs.statSync(dest);
  const meta = await sharp(dest).metadata();
  console.log(`Wrote ${dest} — ${meta.width}x${meta.height}, ${(size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
