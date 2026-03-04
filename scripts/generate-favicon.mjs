// Generate JK favicon with Memphis colors
// Navy background with pink "J" and cyan "K"

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

// Memphis colors
const NAVY = { r: 26, g: 26, b: 46, a: 255 };     // #1a1a2e
const PINK = { r: 233, g: 30, b: 99, a: 255 };    // #e91e63
const CYAN = { r: 0, g: 188, b: 212, a: 255 };    // #00bcd4

// Pixel art letter definitions for 32x32 canvas
// Each letter is roughly 12 pixels wide, with spacing
// J: columns 3-14, K: columns 17-28

// J letter pattern (12x20, starting at row 6)
const J_PATTERN = [
  '  ########  ',
  '  ########  ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '     ##     ',
  '##   ##     ',
  '##   ##     ',
  '##  ##      ',
  ' ####       ',
  ' ###        ',
];

// K letter pattern (12x20, starting at row 6)
const K_PATTERN = [
  '##      ##  ',
  '##     ##   ',
  '##    ##    ',
  '##   ##     ',
  '##  ##      ',
  '## ##       ',
  '####        ',
  '####        ',
  '## ##       ',
  '##  ##      ',
  '##   ##     ',
  '##    ##    ',
  '##     ##   ',
  '##      ##  ',
  '##       ## ',
  '##        ##',
  '##        ##',
  '##        ##',
];

function createFavicon(size) {
  const png = new PNG({ width: size, height: size });

  // Fill with navy background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = NAVY.r;
      png.data[idx + 1] = NAVY.g;
      png.data[idx + 2] = NAVY.b;
      png.data[idx + 3] = NAVY.a;
    }
  }

  // Scale factor for different sizes
  const scale = size / 32;

  // Draw J (pink) - offset by 2 pixels from left, 6 from top
  const jOffsetX = Math.floor(2 * scale);
  const jOffsetY = Math.floor(6 * scale);
  drawLetter(png, J_PATTERN, jOffsetX, jOffsetY, PINK, scale);

  // Draw K (cyan) - offset by 17 pixels from left, 6 from top
  const kOffsetX = Math.floor(17 * scale);
  const kOffsetY = Math.floor(6 * scale);
  drawLetter(png, K_PATTERN, kOffsetX, kOffsetY, CYAN, scale);

  return png;
}

function drawLetter(png, pattern, offsetX, offsetY, color, scale) {
  for (let row = 0; row < pattern.length; row++) {
    const line = pattern[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] === '#') {
        // Draw a scaled pixel
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const x = Math.floor(offsetX + col * scale + sx);
            const y = Math.floor(offsetY + row * scale + sy);
            if (x >= 0 && x < png.width && y >= 0 && y < png.height) {
              const idx = (png.width * y + x) << 2;
              png.data[idx] = color.r;
              png.data[idx + 1] = color.g;
              png.data[idx + 2] = color.b;
              png.data[idx + 3] = color.a;
            }
          }
        }
      }
    }
  }
}

// Generate favicons
const publicDir = path.join(process.cwd(), 'public');

// 32x32 favicon
const favicon32 = createFavicon(32);
const buffer32 = PNG.sync.write(favicon32);
fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), buffer32);
console.log('Generated favicon-32.png');

// Standard favicon (64x64 for better quality, displays at various sizes)
const favicon64 = createFavicon(64);
const buffer64 = PNG.sync.write(favicon64);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), buffer64);
console.log('Generated favicon.png (64x64)');

console.log('Done! JK favicons generated with Memphis colors.');
