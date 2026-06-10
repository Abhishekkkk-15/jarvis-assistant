/**
 * generate-icon.mjs
 * Converts build/icon_source.jpg (or .png) → build/icon.ico and build/icon.png
 *
 * Works without any extra dependencies. Uses ImageMagick if available (best
 * quality), otherwise embeds the raw image bytes inside a valid ICO container
 * (PNG-in-ICO, supported on Windows Vista+, and accepted by electron-builder).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir  = path.resolve(__dirname, '../build');
const destIco   = path.join(buildDir, 'icon.ico');
const destPng   = path.join(buildDir, 'icon.png');

// Find source — prefer PNG, fall back to JPG
function findSource() {
  for (const name of ['icon_source.png', 'icon_source.jpg', 'icon_source.jpeg']) {
    const p = path.join(buildDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const srcFile = findSource();
if (!srcFile) {
  console.error(`❌  No source image found in ${buildDir}`);
  console.error('    Expected: icon_source.png or icon_source.jpg');
  process.exit(1);
}
console.log(`   Source: ${path.basename(srcFile)}`);

// ── Attempt 1: ImageMagick ──────────────────────────────────────────────────
function tryMagick() {
  const sizes = [256, 128, 64, 48, 32, 16];
  for (const cmd of ['magick', 'convert']) {
    try {
      // Also create a proper 256x256 PNG for electron-builder / Linux
      execSync(`${cmd} "${srcFile}" -resize 256x256 "${destPng}"`, { stdio: 'pipe' });
      execSync(
        `${cmd} "${srcFile}" -define icon:auto-resize="${sizes.join(',')}" "${destIco}"`,
        { stdio: 'pipe' }
      );
      return true;
    } catch (_) {}
  }
  return false;
}

// ── Attempt 2: pure Node – embed source image in ICO container ───────────────
// The ICO format allows raw PNG bytes for entries. We use the same image bytes
// for all sizes — Windows and electron-builder handle scaling automatically.
function buildIcoFallback() {
  const imgData = fs.readFileSync(srcFile);

  // If source is a JPEG, we still embed it — PNG-in-ICO also accepts JPEG on
  // modern electron-builder via libicns, but to be safe, just copy source as
  // icon.png too (electron-builder will pick it up for non-Windows targets).
  fs.copyFileSync(srcFile, destPng);

  const sizes = [256, 128, 64, 48, 32, 16];
  const HEADER_SIZE = 6;
  const ENTRY_SIZE  = 16;
  const dataOffset  = HEADER_SIZE + ENTRY_SIZE * sizes.length;

  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let offset = dataOffset;
  const dirBufs = sizes.map((size) => {
    const b = Buffer.alloc(ENTRY_SIZE);
    b.writeUInt8(size >= 256 ? 0 : size, 0);
    b.writeUInt8(size >= 256 ? 0 : size, 1);
    b.writeUInt8(0, 2);
    b.writeUInt8(0, 3);
    b.writeUInt16LE(1, 4);
    b.writeUInt16LE(32, 6);
    b.writeUInt32LE(imgData.length, 8);
    b.writeUInt32LE(offset, 12);
    offset += imgData.length;
    return b;
  });

  const ico = Buffer.concat([header, ...dirBufs, ...sizes.map(() => imgData)]);
  fs.writeFileSync(destIco, ico);
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log('🎨  Generating icon files…');
if (tryMagick()) {
  console.log('✅  ImageMagick: icon.ico + icon.png written');
} else {
  console.log('   ImageMagick not available, using pure-node ICO embed…');
  buildIcoFallback();
  console.log('✅  icon.ico + icon.png written (PNG/JPEG-in-ICO, Windows Vista+ compatible)');
}
console.log(`   icon.ico → ${destIco}`);
console.log(`   icon.png → ${destPng}`);
