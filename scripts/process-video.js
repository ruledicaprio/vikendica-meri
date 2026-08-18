#!/usr/bin/env node
// Trim/compress a video into public/video/ and extract a matching poster frame.
// Usage:
//   node scripts/process-video.js <sourceFile> [--trim-end=1] [--max-width=1280] [--crf=26] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

function parseArgs(argv) {
  const positional = [];
  const flags = { trimEnd: 1, maxWidth: 1280, crf: 26, force: false };
  for (const arg of argv) {
    if (arg === '--force') flags.force = true;
    else if (arg.startsWith('--trim-end=')) flags.trimEnd = Number(arg.slice(11));
    else if (arg.startsWith('--max-width=')) flags.maxWidth = Number(arg.slice(12));
    else if (arg.startsWith('--crf=')) flags.crf = Number(arg.slice(6));
    else positional.push(arg);
  }
  return { positional, flags };
}

function probeDuration(source) {
  const out = execFileSync(ffprobeStatic.path, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'json',
    source,
  ]);
  return Number(JSON.parse(out.toString()).format.duration);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [source] = positional;

  if (!source) {
    console.error('Usage: node scripts/process-video.js <sourceFile> [--trim-end=1] [--max-width=1280] [--crf=26] [--force]');
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`Source file not found: ${source}`);
    process.exit(1);
  }

  const destDir = path.resolve(process.cwd(), 'public', 'video');
  fs.mkdirSync(destDir, { recursive: true });
  const videoDest = path.join(destDir, 'babanovac.mp4');
  const posterDest = path.join(destDir, 'babanovac-poster.jpg');
  if ((fs.existsSync(videoDest) || fs.existsSync(posterDest)) && !flags.force) {
    console.error(`Destination already exists in ${destDir} (pass --force to overwrite)`);
    process.exit(1);
  }

  const duration = probeDuration(source);
  const outDuration = duration - flags.trimEnd;
  console.log(`Source duration: ${duration.toFixed(2)}s -> trimmed to ${outDuration.toFixed(2)}s`);
  if (outDuration <= 0) {
    console.error('Trim end exceeds source duration.');
    process.exit(1);
  }

  const tmpVideo = `${videoDest}.tmp.mp4`;
  execFileSync(ffmpegPath, [
    '-y',
    '-i', source,
    '-ss', '0',
    '-t', String(outDuration),
    '-vf', `scale='min(${flags.maxWidth},iw)':-2`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(flags.crf),
    '-an',
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    tmpVideo,
  ]);
  fs.renameSync(tmpVideo, videoDest);

  const tmpPoster = `${posterDest}.tmp.jpg`;
  execFileSync(ffmpegPath, [
    '-y',
    '-i', videoDest,
    '-frames:v', '1',
    '-update', '1',
    '-q:v', '3',
    tmpPoster,
  ]);
  fs.renameSync(tmpPoster, posterDest);

  const videoSize = fs.statSync(videoDest).size;
  const posterSize = fs.statSync(posterDest).size;
  console.log(`Wrote ${videoDest} — ${(videoSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Wrote ${posterDest} — ${(posterSize / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
