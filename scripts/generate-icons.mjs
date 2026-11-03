import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../public/icons');
mkdirSync(iconsDir, { recursive: true });

// CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // Filter type 0 (None)
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Distance from point (px, py) to segment (ax, ay)-(bx, by)
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Signed distance to triangle (for anti-aliased prism rendering)
function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function blend(dst, srcR, srcG, srcB, srcA) {
  const a = Math.max(0, Math.min(1, srcA));
  if (a <= 0) return;
  const outA = a + dst.a * (1 - a);
  if (outA <= 0) return;
  dst.r = (srcR * a + dst.r * dst.a * (1 - a)) / outA;
  dst.g = (srcG * a + dst.g * dst.a * (1 - a)) / outA;
  dst.b = (srcB * a + dst.b * dst.a * (1 - a)) / outA;
  dst.a = outA;
}

function renderPrismIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);

  const rays = [
    { x1: 76, y1: 48, x2: 116, y2: 28, r: 239, g: 68, b: 68 },   // Red
    { x1: 79, y1: 55, x2: 118, y2: 43, r: 249, g: 115, b: 22 },  // Orange
    { x1: 82, y1: 62, x2: 119, y2: 58, r: 234, g: 179, b: 8 },   // Yellow
    { x1: 84, y1: 69, x2: 119, y2: 73, r: 34, g: 197, b: 94 },   // Green
    { x1: 86, y1: 76, x2: 118, y2: 88, r: 6, g: 182, b: 212 },   // Cyan
    { x1: 88, y1: 83, x2: 114, y2: 102, r: 168, g: 85, b: 247 }, // Purple
  ];

  // Triangle vertices in 128x128 normalized coordinates
  const tx1 = 62, ty1 = 20;
  const tx2 = 24, ty2 = 98;
  const tx3 = 100, ty3 = 98;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2 supersampling for crisp edges at 16x16 through 128x128
      let accR = 0, accG = 0, accB = 0, accA = 0;
      const samples = [0.25, 0.75];

      for (const sy of samples) {
        for (const sx of samples) {
          const nx = ((x + sx) / size) * 128;
          const ny = ((y + sy) / size) * 128;

          const pixel = { r: 0, g: 0, b: 0, a: 0 };

          // 1. Rounded squircle background with luminous border (contrasts on both Light & Dark themes)
          const half = 60;
          const corner = 26;
          const qx = Math.max(0, Math.abs(nx - 64) - (half - corner));
          const qy = Math.max(0, Math.abs(ny - 64) - (half - corner));
          const distSquircle = Math.hypot(qx, qy) - corner;

          if (distSquircle <= 1.2) {
            const bgAlpha = Math.max(0, Math.min(1, 0.5 - distSquircle));
            const gradT = (nx + ny) / 256;
            const bgR = 14 + gradT * 14;
            const bgG = 17 + gradT * 12;
            const bgB = 28 + gradT * 24;
            blend(pixel, bgR, bgG, bgB, bgAlpha);

            // Border rim
            const rimDist = Math.abs(distSquircle + 2.0);
            if (rimDist < 2.4) {
              const rimAlpha = Math.max(0, 1 - rimDist / 2.4) * 0.85 * bgAlpha;
              const rimR = 129 + gradT * 115;
              const rimG = 140 - gradT * 26;
              const rimB = 248 - gradT * 66;
              blend(pixel, rimR, rimG, rimB, rimAlpha);
            }

            // 2. Incoming White Light Beam
            const beamDist = distToSegment(nx, ny, 10, 70, 46, 58);
            if (beamDist < 4.5) {
              const bAlpha = Math.max(0, 1 - beamDist / 4.5);
              blend(pixel, 255, 255, 255, bAlpha);
            }

            // 3. Refracted Spectral Beams
            for (const ray of rays) {
              const rDist = distToSegment(nx, ny, ray.x1, ray.y1, ray.x2, ray.y2);
              if (rDist < 4.0) {
                const rAlpha = Math.max(0, 1 - rDist / 4.0);
                blend(pixel, ray.r, ray.g, ray.b, rAlpha);
              }
            }

            // 4. Glass Prism Triangle Fill & Bright Edge
            const inTri = pointInTriangle(nx, ny, tx1, ty1, tx2, ty2, tx3, ty3);
            if (inTri) {
              const glassT = (ny - 20) / 78;
              blend(
                pixel,
                210 - glassT * 90,
                225 - glassT * 95,
                255 - glassT * 20,
                0.34
              );
            }

            const e1 = distToSegment(nx, ny, tx1, ty1, tx2, ty2);
            const e2 = distToSegment(nx, ny, tx2, ty2, tx3, ty3);
            const e3 = distToSegment(nx, ny, tx3, ty3, tx1, ty1);
            const edgeDist = Math.min(e1, e2, e3);
            if (edgeDist < 3.2) {
              const eAlpha = Math.max(0, 1 - edgeDist / 3.2);
              blend(pixel, 248, 250, 252, eAlpha);
            }
          }

          accR += pixel.r;
          accG += pixel.g;
          accB += pixel.b;
          accA += pixel.a;
        }
      }

      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(accR / 4);
      rgba[idx + 1] = Math.round(accG / 4);
      rgba[idx + 2] = Math.round(accB / 4);
      rgba[idx + 3] = Math.round((accA / 4) * 255);
    }
  }

  return encodePng(size, size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  const pngBuffer = renderPrismIcon(size);
  const outPath = resolve(iconsDir, `icon-${size}.png`);
  writeFileSync(outPath, pngBuffer);
  console.log(`Generated ${outPath} (${pngBuffer.length} bytes)`);
}
