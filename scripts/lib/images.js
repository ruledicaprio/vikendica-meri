import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const MASTER_MAX = 2200;
export const MASTER_QUALITY = 80;

/**
 * Write a resized/compressed master JPEG, creating parent directories as needed.
 *
 * `.rotate()` is not optional: 29 of the source photos carry EXIF orientation 6,
 * so without it they land sideways *and* report a transposed aspect ratio.
 * Dimensions are read back from the written file, i.e. after rotation.
 */
export async function writeMaster(src, dest, { max = MASTER_MAX, quality = MASTER_QUALITY } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp.jpg`;
  await sharp(src)
    .rotate()
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(tmp);
  fs.renameSync(tmp, dest);

  const { size } = fs.statSync(dest);
  const { width, height } = await sharp(dest).metadata();
  return { width, height, size };
}
