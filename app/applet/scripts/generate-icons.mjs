import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generatePng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw Scanlines: each row starts with filter byte (0) + 4 bytes per pixel
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  const radius = isMaskable ? width * 0.45 : width * 0.42;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: Dark obsidian
      const bgR = 11 + Math.floor((x / width) * 20);
      const bgG = 12 + Math.floor((y / height) * 10);
      const bgB = 16;

      // Draw stylized 'F'
      const nx = x / width;
      const ny = y / height;

      const inVertBar = nx >= 0.32 && nx <= 0.44 && ny >= 0.25 && ny <= 0.75;
      const inTopBar = nx >= 0.32 && nx <= 0.72 && ny >= 0.25 && ny <= 0.37;
      const inMidBar = nx >= 0.32 && nx <= 0.62 && ny >= 0.45 && ny <= 0.55;

      const isF = inVertBar || inTopBar || inMidBar;

      if (isF) {
        // Bright radiant orange gradient
        rawData[pxOffset] = 255; // R
        rawData[pxOffset + 1] = Math.floor(85 + (ny * 50)); // G
        rawData[pxOffset + 2] = 0; // B
        rawData[pxOffset + 3] = 255; // A
      } else if (dist <= radius) {
        // Rounded app badge
        rawData[pxOffset] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
        rawData[pxOffset + 3] = 255;
      } else {
        if (isMaskable) {
          rawData[pxOffset] = 11;
          rawData[pxOffset + 1] = 12;
          rawData[pxOffset + 2] = 16;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = 0;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), generatePng(512, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), generatePng(180));

console.log('PWA icons successfully generated in public/icons/');
