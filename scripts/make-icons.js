#!/usr/bin/env node
// Generate the favicon/PWA icon set from public/favicon.svg, and the social-share
// card from a photo in public/eksterijer/. Both land in public/ so Vite copies
// them verbatim into dist/. Usage:
//   node scripts/make-icons.js [--photo=public/eksterijer/00-vikendica-prednja-strana.jpg] [--force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC = path.resolve(process.cwd(), 'public');
const SVG = path.join(PUBLIC, 'favicon.svg');
const DEFAULT_PHOTO = 'public/eksterijer/00-vikendica-prednja-strana.jpg';

// PNG icons rendered from the SVG mark.
const PNG_ICONS = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

function parseArgs(argv) {
  const flags = { photo: DEFAULT_PHOTO, force: false };
  for (const arg of argv) {
    if (arg === '--force') flags.force = true;
    else if (arg.startsWith('--photo=')) flags.photo = arg.slice(8);
  }
  return flags;
}

async function write(dest, buffer, force) {
  if (fs.existsSync(dest) && !force) {
    console.log(`skip  ${path.relative(process.cwd(), dest)} (exists, pass --force)`);
    return;
  }
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, dest);
  console.log(`wrote ${path.relative(process.cwd(), dest)} — ${(buffer.length / 1024).toFixed(1)} KB`);
}

// Wrap a 32x32 PNG in an ICO container. The ICO format accepts a raw PNG
// payload, so this is a 22-byte header plus the PNG — no extra dependency.
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size >= 256 ? 0 : size, 6); // width (0 means 256)
  header.writeUInt8(size >= 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette size
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18); // payload offset
  return Buffer.concat([header, png]);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(SVG)) {
    console.error(`Missing ${SVG} — the icon set is rendered from it.`);
    process.exit(1);
  }
  const svg = fs.readFileSync(SVG);

  for (const { name, size } of PNG_ICONS) {
    const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
    await write(path.join(PUBLIC, name), png, flags.force);
  }

  // Legacy /favicon.ico — browsers request it at the root whether or not it is linked.
  const ico32 = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();
  await write(path.join(PUBLIC, 'favicon.ico'), pngToIco(ico32, 32), flags.force);

  // Social card. Every exterior photo is portrait, so the 1.91:1 card is a thin
  // band and the crop position decides everything. Top gravity, not sharp's
  // attention strategy: attention chases local contrast and picked the stone
  // paving at the bottom of the frame, while the cabin — the actual subject —
  // sits at the top of a vertical architecture shot.
  if (!fs.existsSync(flags.photo)) {
    console.error(`Photo not found: ${flags.photo}`);
    process.exit(1);
  }
  const og = await sharp(flags.photo)
    .rotate()
    .resize(1200, 630, { fit: 'cover', position: sharp.gravity.north })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await write(path.join(PUBLIC, 'og-image.jpg'), og, flags.force);

  // Hero poster. Paints instantly while the Three.js scene loads in the
  // background, and stays as the final hero for reduced-motion and data-saver
  // visitors, who never download the 3D bundle at all. Same north crop as the
  // OG card, for the same reason.
  const poster = await sharp(flags.photo)
    .rotate()
    .resize(1600, 900, { fit: 'cover', position: sharp.gravity.north })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await write(path.join(PUBLIC, 'hero-poster.jpg'), poster, flags.force);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
