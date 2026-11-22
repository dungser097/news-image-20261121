// The World in One Day - 21 November 2026.
// A newspaper front page drawn from scratch with the Node 22 standard
// library only: own framebuffer, own PNG encoder, own 5x7 bitmap font.
// No network, no exec, no eval. Deterministic: two runs, same bytes.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';

const W = 1024;
const H = 1024;

// Palette.
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [27, 27, 27];
const RED: RGB = [179, 38, 30];
const NAVY: RGB = [31, 58, 95];
const TEAL: RGB = [46, 110, 126];
const SKY: RGB = [220, 233, 242];
const SAND: RGB = [217, 196, 154];
const ORANGE: RGB = [232, 134, 46];
const YELLOW: RGB = [242, 194, 48];
const LIGHTRED: RGB = [255, 217, 208];
const GRAY: RGB = [107, 107, 107];
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

// 5x7 bitmap font. Each glyph is 7 rows of 5 cells ('#' = ink).
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '..#..', '..#..', '..#..', '..#..', '...#.'],
  ')': ['.#...', '..#..', '..#..', '..#..', '..#..', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '...#.', '..#..', '.#...', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '*': ['.....', '.#.#.', '..#..', '.###.', '..#..', '.#.#.', '.....'],
};

class FB {
  data: Uint8Array;
  constructor() {
    this.data = new Uint8Array(W * H * 3);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  // Filled circle.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    }
  }
  // Circle outline, 1px.
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  // Filled polygon (scanline).
  poly(pts: Array<[number, number]>, c: RGB): void {
    let minY = H;
    let maxY = 0;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y - a[1]) / (b[1] - a[1]);
          xs.push(Math.round(a[0] + t * (b[0] - a[0])));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = xs[k]; x <= xs[k + 1]; x++) this.set(x, y, c);
      }
    }
  }
  // Parabolic arc from (x0,y0) to (x1,y1), peaking `lift` px above the chord.
  arc(x0: number, y0: number, x1: number, y1: number, lift: number, c: RGB): void {
    const steps = 48;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t - lift * 4 * t * (1 - t));
      this.line(px, py, x, y, c);
      px = x;
      py = y;
    }
  }
  textWidth(s: string, scale: number): number {
    return s.length * 6 * scale;
  }
  text(s: string, x: number, y: number, scale: number, c: RGB): void {
    const up = s.toUpperCase();
    for (let i = 0; i < up.length; i++) {
      const g = FONT[up[i]] || FONT[' '];
      const ox = x + i * 6 * scale;
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 5; col++) {
          if (g[r][col] === '#') {
            this.rect(ox + col * scale, y + r * scale, scale, scale, c);
          }
        }
      }
    }
  }
  // Greedy word wrap. Returns lines that fit maxWidth.
  wrap(s: string, maxWidth: number, scale: number): string[] {
    const words = s.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur === '' ? w : cur + ' ' + w;
      if (this.textWidth(next, scale) <= maxWidth) {
        cur = next;
      } else {
        if (cur !== '') lines.push(cur);
        cur = w;
      }
    }
    if (cur !== '') lines.push(cur);
    return lines;
  }
}

// ---- PNG encoding (color type 2, 8-bit RGB, filter 0) ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(fb: FB): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(fb.data.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Page drawing ----
const M = 28; // outer margin
const CW = 476; // card width
const CG = 16; // card gap

function drawLeadScene(fb: FB, x: number, y: number, w: number, h: number): void {
  // Stylised Gulf scene: sky, sea, land, Bahrain island, missile arcs,
  // explosion, and a US Fifth Fleet ship.
  fb.rect(x, y, w, h, SKY);
  const seaY = y + 78;
  fb.rect(x, seaY, w, h - 78, TEAL);
  // Land masses left and right (sand), abstract Arabian shoreline.
  fb.poly(
    [
      [x, y],
      [x + 150, y],
      [x + 190, y + 40],
      [x + 120, y + 78],
      [x, y + 78],
    ],
    SAND,
  );
  fb.poly(
    [
      [x + w, y],
      [x + w - 210, y],
      [x + w - 260, y + 46],
      [x + w - 170, y + 78],
      [x + w, y + 78],
    ],
    SAND,
  );
  // Bahrain island: small dark island mid-sea.
  const ix = x + 470;
  const iy = seaY + 44;
  fb.poly(
    [
      [ix - 26, iy - 6],
      [ix - 8, iy - 16],
      [ix + 18, iy - 10],
      [ix + 26, iy + 6],
      [ix + 6, iy + 16],
      [ix - 18, iy + 12],
    ],
    INK,
  );
  // Explosion starburst over the island.
  const ex = ix;
  const ey = iy - 26;
  const star: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const r = i % 2 === 0 ? 34 : 15;
    star.push([Math.round(ex + r * Math.cos(a)), Math.round(ey + r * Math.sin(a))]);
  }
  fb.poly(star, ORANGE);
  fb.disc(ex, ey, 12, YELLOW);
  // Missile arcs from the upper right toward the island.
  fb.arc(x + w - 60, y + 8, ix + 10, iy - 30, 46, RED);
  fb.arc(x + w - 140, y + 2, ix - 6, iy - 28, 60, RED);
  fb.disc(x + w - 60, y + 8, 4, RED);
  fb.disc(x + w - 140, y + 2, 4, RED);
  // Ship: US Fifth Fleet, lower left of the sea.
  const sx = x + 120;
  const sy = seaY + 40;
  fb.poly(
    [
      [sx, sy],
      [sx + 96, sy],
      [sx + 84, sy + 16],
      [sx + 10, sy + 16],
    ],
    INK,
  );
  fb.rect(sx + 40, sy - 18, 5, 18, INK);
  fb.rect(sx + 58, sy - 12, 4, 12, INK);
  fb.text('US 5TH FLEET', sx - 8, sy + 22, 2, WHITE);
  // Labels.
  fb.text('BAHRAIN', ix - 30, iy + 26, 2, WHITE);
  fb.text('GULF', x + w - 96, seaY + 64, 2, WHITE);
  // Frame.
  fb.rect(x, y, w, 3, INK);
  fb.rect(x, y + h - 3, w, 3, INK);
  fb.rect(x, y, 3, h, INK);
  fb.rect(x + w - 3, y, 3, h, INK);
}

function drawCard(
  fb: FB,
  x: number,
  y: number,
  accent: RGB,
  kicker: string,
  headline: string,
  body: string,
): void {
  fb.rect(x, y, CW, 148, WHITE);
  fb.rect(x, y, CW, 6, accent);
  fb.rect(x, y + 147, CW, 1, GRAY);
  fb.text(kicker, x + 14, y + 16, 2, accent);
  fb.text(headline, x + 14, y + 40, 3, INK);
  const lines = fb.wrap(body, CW - 28, 2);
  for (let i = 0; i < lines.length && i < 3; i++) {
    fb.text(lines[i], x + 14, y + 70 + i * 15, 2, INK);
  }
  // Small corner mark: filled square + dot.
  fb.rect(x + CW - 34, y + 116, 18, 18, accent);
  fb.disc(x + CW - 25, y + 125, 4, WHITE);
}

function drawPage(): FB {
  const fb = new FB();
  fb.fill(PAPER);

  // Masthead.
  const title = 'THE WORLD IN ONE DAY';
  fb.text(title, (W - fb.textWidth(title, 5)) / 2, 26, 5, NAVY);
  fb.rect(M, 74, W - 2 * M, 3, RED);
  const date = 'SATURDAY, 21 NOVEMBER 2026';
  fb.text(date, (W - fb.textWidth(date, 2)) / 2, 86, 2, RED);
  fb.rect(M, 110, W - 2 * M, 2, INK);

  // Lead.
  fb.text('MANAMA, BAHRAIN - THE GULF', M, 126, 2, RED);
  const lead = 'IRAN STRIKES BAHRAIN';
  fb.text(lead, (W - fb.textWidth(lead, 4)) / 2, 148, 4, INK);
  const deck =
    "IRAN'S REVOLUTIONARY GUARDS SAY MISSILES AND DRONES HIT US POSITIONS AT AL-RIFFA AND AWALI. BAHRAIN SAYS THE ATTACK HIT A CIVILIAN INDUSTRIAL SITE.";
  const deckLines = fb.wrap(deck, W - 2 * M, 2);
  for (let i = 0; i < deckLines.length; i++) {
    fb.text(deckLines[i], M, 188 + i * 15, 2, INK);
  }
  drawLeadScene(fb, M, 224, W - 2 * M, 164);
  const detail =
    'THE ATTACK STARTED A FIRE, WITH NO INJURIES. IRAN ALSO SAYS IT DOWNED A US DRONE NEAR QESHM ISLAND; THE US DENIES IRAN HIT AN F-16.';
  const detailLines = fb.wrap(detail, W - 2 * M, 2);
  for (let i = 0; i < detailLines.length; i++) {
    fb.text(detailLines[i], M, 398 + i * 15, 2, INK);
  }
  fb.rect(M, 440, W - 2 * M, 2, INK);

  // Card grid, 2 x 2.
  drawCard(
    fb,
    M,
    452,
    RED,
    'MEXICO - SINALOA',
    'CHAPO ISIDRO CAPTURED',
    'MEXICAN FORCES SEIZE FBI MOST-WANTED FAUSTO ISIDRO MEZA FLORES IN SINALOA. AT LEAST 11 DEAD AS GUNFIGHTS FOLLOW.',
  );
  drawCard(
    fb,
    M + CW + CG,
    452,
    NAVY,
    'UKRAINE - KRYVYI RIH',
    'MISSILE HITS KRYVYI RIH',
    'A TRIPLE-TAP STRIKE KILLS A BOY, 7, AND A PARAMEDIC. 28 OF ABOUT 60 WOUNDED REMAIN IN HOSPITAL.',
  );
  drawCard(
    fb,
    M,
    608,
    TEAL,
    'BALTIC - GULF OF FINLAND',
    'SHIP ABLAZE IN THE GULF',
    'DRONES HIT THE MILITARY-LINKED SPARTA II. ITS 16 CREW ESCAPE BY LIFEBOAT AS FINLAND LEADS THE RESCUE.',
  );
  drawCard(
    fb,
    M + CW + CG,
    608,
    [90, 110, 40],
    'CLIMATE - ANTALYA',
    'COP31 CLOSE TO A DEAL',
    'ANTALYA TALKS RUN PAST DEADLINE. SUMMIT CHIEF SAYS A TEXT ALL PARTIES CAN AGREE ON IS READY.',
  );

  // Markets band.
  fb.rect(M, 772, W - 2 * M, 74, NAVY);
  fb.text('MARKETS', M + 16, 782, 2, YELLOW);
  fb.text('NASDAQ ERASES ITS 2026 GAINS', M + 16, 800, 3, WHITE);
  fb.text('S&P 500 -3.7%    DOW -1.9%    NASDAQ -5.3%    NVIDIA -14%', M + 16, 826, 2, LIGHTRED);

  // Also today.
  fb.text('ALSO TODAY', M, 862, 2, RED);
  const items = [
    'DENGUE: MOSQUITOES CUT CHILD CASES 69% IN A BRAZIL STUDY',
    "TRUMP DEFENDS PUTIN TIES; ZELENSKY CALLS HIM 'A KILLER'",
    'NVIDIA HALTS H200 CHIP EXPORTS TO CHINA',
    'NEPAL PM BEGINS FIRST INDIA VISIT, TO MEET MODI',
  ];
  for (let i = 0; i < items.length; i++) {
    const ix = M + (i % 2) * (CW + CG);
    const iy = 886 + Math.floor(i / 2) * 42;
    fb.rect(ix, iy + 3, 8, 8, RED);
    const lines = fb.wrap(items[i], CW - 24, 2);
    for (let j = 0; j < lines.length; j++) {
      fb.text(lines[j], ix + 18, iy + j * 15, 2, INK);
    }
  }

  // Footer.
  fb.rect(M, 978, W - 2 * M, 1, GRAY);
  const foot = 'ONE DAY. ONE PICTURE. - MAKE.FUN';
  fb.text(foot, (W - fb.textWidth(foot, 2)) / 2, 988, 2, GRAY);

  return fb;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG(drawPage());
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  const sha = crypto.createHash('sha256').update(png).digest('hex');
  console.log(`Wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
}

main();
