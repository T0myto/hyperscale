// Génère icon-192.png et icon-512.png (icônes de l'application installée), sans dépendance.
// Le dessin est le même que icon.svg : un carré encre, trois unités de baie blanches, un voyant orange.
// Usage : node tools/gen-icons.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');
// Rectangles sur une grille de 64 : [x, y, largeur, hauteur, couleur]
const SHAPES = [[0, 0, 64, 64, '16191d']];
for (const y of [17, 28, 39]) {
  SHAPES.push([15, y, 34, 8, 'ffffff'], [19, y + 3.2, 14, 1.6, 'c3c8cd'], [42.4, y + 2.7, 3.2, 2.6, y === 17 ? 'd9480f' : '16191d']);
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4), sum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
function png(n) {
  const k = n / 64, px = Buffer.alloc(n * (n * 3 + 1));
  for (const [x, y, w, h, col] of SHAPES) {
    const rgb = [0, 2, 4].map(i => parseInt(col.slice(i, i + 2), 16));
    for (let j = Math.round(y * k); j < Math.round((y + h) * k); j++)
      for (let i = Math.round(x * k); i < Math.round((x + w) * k); i++) px.set(rgb, j * (n * 3 + 1) + 1 + i * 3);
  }
  const head = Buffer.alloc(13); head.writeUInt32BE(n, 0); head.writeUInt32BE(n, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const n of [192, 512]) { fs.writeFileSync(path.join(root, `icon-${n}.png`), png(n)); console.log(`icon-${n}.png généré`); }
