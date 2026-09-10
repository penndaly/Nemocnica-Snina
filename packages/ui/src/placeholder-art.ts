/**
 * placeholder-art.ts — branded illustrated placeholders for every image slot.
 *
 * Ported from design_handoff_nemocnica_snina/assets/placeholder-art.js (geometry
 * kept verbatim) with one deliberate change: colours come from packages/ui's
 * current design tokens (src/globals.css :root), not the prototype's own
 * copies of them. The prototype's --terra/--amber/--ink-3 predate this
 * project's WCAG AA contrast fixes (see globals.css comments) — reusing the
 * fixed values keeps the illustrations on the same palette the rest of the
 * site actually ships, instead of reintroducing already-fixed colours into
 * every hero background.
 *
 * No faces, no identifiable detail, no institution names — compliance
 * constraint (IMG-0 findings: ~40% of licence-clean stock candidates leaked
 * a real institution or a recognisable face), not a style note.
 */

/* Mirrors packages/ui/src/globals.css :root. Keep in sync by hand — these are
 * baked into generated SVG strings, which can't reference CSS custom
 * properties at the point they're built. */
const TOKENS = {
  sky1: '#eef4fa', // --blue-50
  sky2: '#dce8f4', // --blue-100
  cream: '#faf6f0', // --bg
  sand: '#f4ede2', // --bg-2
  b900: '#14375f', // --blue-900
  b700: '#1e5290', // --blue-700
  b600: '#2563a8', // --blue-600
  b500: '#3a7cc0', // --blue-500
  b200: '#b9d2ea', // --blue-200
  b100: '#dce8f4', // --blue-100
  b50: '#eef4fa', // --blue-50
  terra: '#a0592f', // --terra (AA-fixed; prototype has the pre-fix #c06a38)
  terra50: '#f8ece3', // --terra-50
  green: '#2f8a64', // --green
  green50: '#e6f2ec', // --green-50
  amber: '#8a5a12', // --amber (AA-fixed; prototype has the pre-fix #c08a2e)
  warm: '#e8dccb', // --warm-200
  line: '#e7ddcf', // --line
  ink3: '#71695e', // --ink-3 (AA-fixed; prototype has the pre-fix #8a8073)
  white: '#ffffff',
} as const;

const W = 1600;
const H = 900;

/* ---- primitives ---- */
const rect = (x: number, y: number, w: number, h: number, f: string, rx?: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${rx ? ` rx="${rx}"` : ''}/>`;
const circle = (x: number, y: number, rad: number, f: string) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${f}"/>`;
const path = (d: string, f: string) => `<path d="${d}" fill="${f}"/>`;
const line = (x1: number, y1: number, x2: number, y2: number, s: string, w2?: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w2 || 6}" stroke-linecap="round"/>`;

/** window grid on a facade */
function grid(x: number, y: number, cols: number, rows: number, cw: number, ch: number, gx: number, gy: number, f: string): string {
  let s = '';
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) s += rect(x + i * (cw + gx), y + j * (ch + gy), cw, ch, f, 3);
  return s;
}
/** abstract person: head + shoulders, no facial detail */
function person(x: number, y: number, h2: number, body: string, skin?: string): string {
  const hd = h2 * 0.19;
  return (
    circle(x, y - h2 * 0.78, hd, skin || TOKENS.warm) +
    path(`M${x - h2 * 0.36} ${y} q0 ${-h2 * 0.52} ${h2 * 0.36} ${-h2 * 0.52} q${h2 * 0.36} 0 ${h2 * 0.36} ${h2 * 0.52} z`, body)
  );
}
const bed = (x: number, y: number, w: number, hcol: string) =>
  rect(x, y, w, 26, TOKENS.white, 8) +
  rect(x + 10, y - 22, w * 0.42, 26, TOKENS.b100, 10) +
  rect(x, y + 26, 14, 40, hcol) +
  rect(x + w - 14, y + 26, 14, 40, hcol) +
  rect(x + w - 8, y - 62, 10, 88, hcol, 5);

/* ---- scenes ---- */
type SceneName =
  | 'campus'
  | 'aerial'
  | 'corridor'
  | 'ward'
  | 'nurse'
  | 'consult'
  | 'team'
  | 'equipment'
  | 'lab'
  | 'imaging'
  | 'pharmacy'
  | 'video'
  | 'archive'
  | 'education'
  | 'waiting'
  | 'reception'
  | 'admin'
  | 'booking'
  | 'news'
  | 'portrait'
  | 'docs';

const S: Record<SceneName, () => string> = {
  campus: () =>
    rect(0, 0, W, 620, 'url(#sky)') +
    path(`M0 560 q260 -110 520 -40 q300 84 560 -26 q300 -128 520 -34 L${W} 620 L0 620 z`, '#dfe9dd') +
    rect(0, 620, W, 280, TOKENS.sand) +
    rect(180, 300, 470, 320, TOKENS.white) +
    rect(180, 300, 470, 26, TOKENS.b600) +
    grid(216, 366, 6, 4, 52, 40, 20, 24, TOKENS.b100) +
    rect(650, 210, 560, 410, '#fbfaf7') +
    rect(650, 210, 560, 30, TOKENS.b700) +
    grid(692, 288, 7, 5, 54, 42, 18, 22, TOKENS.b50) +
    rect(1210, 380, 260, 240, TOKENS.white) +
    grid(1240, 430, 3, 3, 54, 42, 22, 26, TOKENS.b100) +
    rect(880, 96, 34, 116, TOKENS.b600, 6) +
    rect(838, 138, 118, 34, TOKENS.b600, 6) +
    rect(300, 620, 1000, 12, TOKENS.warm) +
    circle(1360, 520, 74, '#cddcc7') +
    rect(1352, 520, 16, 100, '#b6a992') +
    circle(120, 546, 56, '#cddcc7') +
    rect(112, 546, 14, 76, '#b6a992') +
    rect(700, 520, 150, 100, TOKENS.b100, 8) +
    rect(760, 560, 34, 60, TOKENS.b600, 4),

  aerial: () =>
    rect(0, 0, W, H, '#e9ede4') +
    path(`M0 0 h${W} v${H} h${-W} z`, '#e9ede4') +
    rect(120, 120, 620, 300, TOKENS.white, 6) +
    rect(150, 150, 560, 40, TOKENS.b100, 4) +
    rect(150, 214, 560, 40, TOKENS.b100, 4) +
    rect(150, 278, 560, 40, TOKENS.b100, 4) +
    rect(800, 120, 380, 470, '#fbfaf7', 6) +
    grid(830, 160, 4, 6, 62, 46, 22, 24, TOKENS.b50) +
    rect(1240, 240, 240, 350, TOKENS.white, 6) +
    grid(1270, 280, 2, 4, 78, 52, 24, 28, TOKENS.b100) +
    rect(0, 620, W, 90, '#cfc6b6') +
    rect(0, 656, W, 8, TOKENS.white) +
    rect(120, 740, 1360, 120, '#ddd4c4', 8) +
    Array.from({ length: 11 }, (_, i) => rect(170 + i * 118, 758, 76, 44, TOKENS.b200, 5)).join('') +
    circle(300, 470, 62, '#c6d6bd') +
    circle(430, 512, 44, '#c6d6bd') +
    circle(1400, 690, 40, '#c6d6bd') +
    rect(760, 470, 20, 150, '#cfc6b6'),

  corridor: () =>
    rect(0, 0, W, H, '#f2f5f8') +
    path('M0 0 L520 250 L1080 250 L1600 0 z', '#e6edf4') +
    path(`M0 ${H} L520 640 L1080 640 L1600 ${H} z`, '#e2dbcd') +
    path(`M0 0 L520 250 L520 640 L0 ${H} z`, '#f7f4ee') +
    path(`M1600 0 L1080 250 L1080 640 L1600 ${H} z`, '#f7f4ee') +
    rect(520, 250, 560, 390, '#eef2f6') +
    path('M690 640 L690 380 L910 380 L910 640 z', TOKENS.b100) +
    path('M120 300 L300 372 L300 620 L120 700 z', TOKENS.b200) +
    path('M1300 372 L1480 300 L1480 700 L1300 620 z', TOKENS.b200) +
    rect(560, 150, 120, 18, TOKENS.white, 9) +
    rect(760, 190, 90, 14, TOKENS.white, 7) +
    person(430, 620, 190, TOKENS.b600) +
    person(1160, 610, 170, TOKENS.terra),

  ward: () =>
    rect(0, 0, W, 640, '#f4f7fa') +
    rect(0, 640, W, 260, '#e6dfd1') +
    rect(980, 150, 460, 330, TOKENS.b50, 8) +
    line(1210, 150, 1210, 480, TOKENS.white, 10) +
    line(980, 315, 1440, 315, TOKENS.white, 10) +
    rect(940, 130, 40, 380, TOKENS.warm, 6) +
    rect(1440, 130, 40, 380, TOKENS.warm, 6) +
    bed(300, 560, 520, TOKENS.b500) +
    person(430, 540, 150, TOKENS.b100, TOKENS.warm) +
    rect(120, 470, 130, 170, TOKENS.white, 8) +
    rect(140, 500, 90, 12, TOKENS.b100, 6) +
    circle(185, 560, 26, TOKENS.green50) +
    rect(880, 430, 120, 210, TOKENS.white, 8) +
    rect(900, 460, 80, 60, TOKENS.b100, 6) +
    circle(940, 580, 22, TOKENS.terra50),

  nurse: () =>
    rect(0, 0, W, 660, '#f5f8fa') +
    rect(0, 660, W, 240, '#e6dfd1') +
    rect(1040, 120, 420, 320, TOKENS.b50, 10) +
    line(1250, 120, 1250, 440, TOKENS.white, 10) +
    bed(240, 600, 560, TOKENS.b500) +
    person(400, 578, 160, TOKENS.b100) +
    person(860, 660, 300, TOKENS.green) +
    rect(806, 500, 28, 44, TOKENS.white, 6) +
    rect(120, 500, 110, 160, TOKENS.white, 8) +
    circle(175, 560, 24, TOKENS.terra50) +
    rect(1180, 520, 200, 140, TOKENS.white, 10) +
    rect(1210, 550, 140, 16, TOKENS.b100, 8) +
    rect(1210, 584, 100, 16, TOKENS.b100, 8),

  consult: () =>
    rect(0, 0, W, 620, '#f4f7fa') +
    rect(0, 620, W, 280, '#e2dbcd') +
    rect(1060, 110, 400, 300, TOKENS.b50, 10) +
    line(1260, 110, 1260, 410, TOKENS.white, 10) +
    rect(160, 140, 280, 330, TOKENS.white, 8) +
    grid(190, 176, 2, 4, 100, 50, 20, 22, TOKENS.b100) +
    rect(420, 620, 760, 34, TOKENS.white, 8) +
    rect(470, 654, 30, 130, '#cfc6b6') +
    rect(1100, 654, 30, 130, '#cfc6b6') +
    person(620, 620, 250, TOKENS.b600) +
    person(980, 620, 240, TOKENS.terra) +
    rect(760, 500, 170, 120, TOKENS.white, 8) +
    rect(780, 520, 130, 80, TOKENS.b100, 4) +
    rect(800, 620, 90, 12, '#cfc6b6', 4),

  team: () => {
    const cols = [TOKENS.b600, TOKENS.green, TOKENS.b500, TOKENS.terra, TOKENS.b700, TOKENS.green];
    let f = '';
    for (let i = 0; i < 6; i++) f += person(230 + i * 232, 760 - (i % 2 ? 20 : 0), 330, cols[i]!);
    return (
      rect(0, 0, W, 620, '#eef3f8') +
      rect(0, 620, W, 280, '#e6dfd1') +
      grid(120, 210, 6, 2, 180, 130, 52, 44, TOKENS.white) +
      rect(0, 560, W, 70, '#dfe8f1') +
      f +
      rect(720, 90, 30, 100, TOKENS.b600, 5) +
      rect(684, 126, 102, 30, TOKENS.b600, 5)
    );
  },

  equipment: () =>
    rect(0, 0, W, 680, '#eef3f7') +
    rect(0, 680, W, 220, '#ded6c6') +
    rect(300, 180, 700, 500, TOKENS.white, 14) +
    rect(350, 230, 600, 300, '#dbe6f1', 8) +
    `<path d="M380 400 h90 l40 -110 l60 220 l50 -170 l40 60 h280" fill="none" stroke="${TOKENS.b600}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
    rect(390, 570, 200, 22, TOKENS.b100, 11) +
    rect(620, 570, 120, 22, TOKENS.green50, 11) +
    rect(620, 680, 60, 180, '#c2b8a5') +
    rect(500, 850, 300, 24, '#c2b8a5', 12) +
    rect(1080, 300, 300, 380, TOKENS.white, 12) +
    grid(1110, 340, 2, 4, 118, 60, 24, 26, TOKENS.b50) +
    circle(1230, 200, 60, TOKENS.terra50) +
    circle(1230, 200, 30, TOKENS.terra),

  lab: () =>
    rect(0, 0, W, 640, '#f1f6f3') +
    rect(0, 640, W, 260, '#ded6c6') +
    rect(0, 120, W, 40, '#e7dfd0') +
    rect(120, 160, 1360, 14, TOKENS.warm) +
    rect(220, 200, 240, 200, TOKENS.white, 8) +
    grid(250, 230, 3, 2, 50, 60, 20, 20, TOKENS.green50) +
    rect(1140, 200, 240, 200, TOKENS.white, 8) +
    grid(1170, 230, 3, 2, 50, 60, 20, 20, TOKENS.b50) +
    rect(120, 640, 1360, 30, TOKENS.white, 6) +
    path('M560 640 l0 -120 l-40 -70 l0 -60 l90 0 l0 60 l-40 70 l0 120 z', TOKENS.b200) +
    path('M600 640 l0 -90 l-30 -52 l0 -48 l70 0 l0 48 l-30 52 l0 90 z', TOKENS.green50) +
    rect(700, 480, 46, 160, TOKENS.b100, 8) +
    rect(760, 520, 46, 120, TOKENS.terra50, 8) +
    rect(820, 500, 46, 140, TOKENS.green50, 8) +
    path('M980 640 l0 -60 l-24 0 l0 -40 l70 0 l0 40 l-24 0 l0 60 z', '#b9c4cf') +
    circle(1015, 470, 34, '#cbd5de') +
    rect(1000, 400, 30, 80, '#b9c4cf', 6) +
    person(340, 640, 260, TOKENS.white) +
    circle(340, 437, 30, TOKENS.warm),

  imaging: () =>
    rect(0, 0, W, 680, '#eef2f7') +
    rect(0, 680, W, 220, '#dcd4c4') +
    circle(880, 420, 210, '#e2e9f1') +
    circle(880, 420, 162, TOKENS.white) +
    circle(880, 420, 104, '#dbe4ee') +
    `<path d="M880 210 a210 210 0 0 1 175 93" fill="none" stroke="${TOKENS.b500}" stroke-width="14" stroke-linecap="round"/>` +
    rect(430, 556, 820, 28, TOKENS.white, 14) +
    rect(400, 584, 120, 100, '#c2b8a5', 8) +
    rect(560, 530, 360, 28, TOKENS.b100, 14) +
    circle(586, 516, 22, TOKENS.warm) +
    rect(120, 300, 190, 260, TOKENS.white, 10) +
    rect(146, 330, 138, 96, '#2f3e4d', 6) +
    rect(146, 446, 138, 12, TOKENS.b100, 6) +
    rect(146, 476, 96, 12, TOKENS.b100, 6) +
    rect(1330, 260, 170, 300, TOKENS.white, 10) +
    grid(1356, 292, 1, 3, 118, 62, 0, 26, TOKENS.b50),

  pharmacy: () =>
    rect(0, 0, W, 700, '#f6f2ea') +
    rect(0, 700, W, 200, '#ded6c6') +
    [0, 1, 2].map((i) => rect(140, 150 + i * 150, 620, 16, '#c9bda7', 4)).join('') +
    [0, 1, 2]
      .map((i) =>
        Array.from({ length: 8 }, (_, j) =>
          rect(160 + j * 74, 80 + i * 150, 44, 70, [TOKENS.b100, TOKENS.green50, TOKENS.terra50, TOKENS.b200][(i + j) % 4]!, 6),
        ).join(''),
      )
      .join('') +
    rect(880, 150, 560, 420, TOKENS.white, 10) +
    grid(920, 190, 4, 4, 100, 60, 24, 26, TOKENS.b50) +
    rect(140, 640, 1160, 60, TOKENS.white, 10) +
    rect(140, 700, 1160, 26, '#c9bda7') +
    rect(1000, 560, 150, 84, TOKENS.b100, 8) +
    person(560, 640, 220, TOKENS.green) +
    person(880, 660, 200, TOKENS.b600) +
    rect(1240, 80, 26, 90, TOKENS.green, 5) +
    rect(1212, 112, 82, 26, TOKENS.green, 5),

  video: () =>
    rect(0, 0, W, H, '#f2f5f9') +
    rect(260, 130, 1080, 640, '#2f3e4d', 20) +
    rect(292, 162, 1016, 540, TOKENS.b50, 12) +
    circle(800, 380, 108, TOKENS.b200) +
    path('M690 560 q0 -130 110 -130 q110 0 110 130 z', TOKENS.b500) +
    rect(1080, 200, 190, 130, TOKENS.white, 10) +
    circle(1175, 246, 30, TOKENS.warm) +
    path('M1120 310 q0 -42 55 -42 q55 0 55 42 z', TOKENS.terra) +
    rect(560, 640, 480, 62, TOKENS.white, 31) +
    circle(640, 671, 22, TOKENS.green) +
    circle(720, 671, 22, TOKENS.b600) +
    circle(800, 671, 22, TOKENS.b600) +
    circle(960, 671, 22, '#c0392b') +
    rect(600, 770, 400, 22, '#2f3e4d', 11) +
    rect(680, 792, 240, 40, '#2f3e4d', 6) +
    rect(120, 300, 90, 90, TOKENS.green50, 12) +
    rect(1400, 460, 90, 90, TOKENS.terra50, 12),

  archive: () =>
    rect(0, 0, W, H, '#efe6d6') +
    rect(60, 60, W - 120, H - 120, '#e6d9c2') +
    rect(110, 110, W - 220, H - 220, '#f3ebdd') +
    path('M200 620 q240 -90 480 -34 q280 66 500 -20 L1400 620 z', '#ddd0b6') +
    rect(420, 330, 380, 290, '#cbbb9d') +
    rect(420, 330, 380, 22, '#b09b78') +
    grid(456, 384, 5, 3, 46, 44, 20, 24, '#efe6d6') +
    rect(820, 380, 260, 240, '#d6c7a9') +
    grid(850, 424, 3, 2, 46, 44, 22, 26, '#efe6d6') +
    rect(596, 240, 24, 92, '#b09b78', 5) +
    rect(568, 272, 80, 24, '#b09b78', 5) +
    rect(200, 618, 1200, 10, '#c0ae8c') +
    circle(1240, 520, 60, '#c9be9c') +
    rect(1232, 520, 14, 98, '#b09b78'),

  education: () =>
    rect(0, 0, W, 660, '#f4f7fa') +
    rect(0, 660, W, 240, '#e2dbcd') +
    rect(240, 110, 700, 420, TOKENS.white, 12) +
    rect(290, 210, 300, 20, TOKENS.b100, 10) +
    rect(290, 260, 460, 20, TOKENS.b100, 10) +
    rect(290, 310, 380, 20, TOKENS.b100, 10) +
    rect(290, 380, 90, 110, TOKENS.b500, 6) +
    rect(400, 410, 90, 80, TOKENS.green, 6) +
    rect(510, 350, 90, 140, TOKENS.terra, 6) +
    rect(1020, 190, 380, 300, TOKENS.b50, 10) +
    person(360, 830, 260, TOKENS.b600) +
    person(660, 850, 250, TOKENS.green) +
    person(960, 830, 240, TOKENS.terra) +
    rect(180, 530, 40, 140, '#c2b8a5'),

  waiting: () =>
    rect(0, 0, W, 640, '#f5f7f9') +
    rect(0, 640, W, 260, '#e4ddcf') +
    rect(120, 140, 520, 330, TOKENS.b50, 10) +
    line(380, 140, 380, 470, TOKENS.white, 10) +
    rect(80, 120, 30, 370, TOKENS.warm, 6) +
    rect(650, 120, 30, 370, TOKENS.warm, 6) +
    circle(1340, 220, 62, TOKENS.white) +
    circle(1340, 220, 54, TOKENS.b50) +
    line(1340, 220, 1340, 186, TOKENS.b700, 7) +
    line(1340, 220, 1366, 232, TOKENS.b700, 7) +
    [0, 1, 2, 3]
      .map(
        (i) =>
          rect(220 + i * 230, 600, 190, 30, TOKENS.b500, 8) +
          rect(220 + i * 230, 500, 190, 100, TOKENS.b200, 10) +
          rect(236 + i * 230, 630, 16, 90, '#8d8577') +
          rect(378 + i * 230, 630, 16, 90, '#8d8577'),
      )
      .join('') +
    person(315, 600, 200, TOKENS.terra) +
    person(775, 600, 190, TOKENS.b700) +
    circle(1300, 600, 74, '#cddcc7') +
    rect(1288, 600, 24, 120, '#b6a992') +
    rect(1250, 716, 100, 40, '#c2b8a5', 8),

  reception: () =>
    rect(0, 0, W, 640, '#f4f7fa') +
    rect(0, 640, W, 260, '#e4ddcf') +
    rect(700, 110, 760, 340, TOKENS.b50, 10) +
    grid(740, 150, 3, 2, 200, 120, 30, 30, TOKENS.white) +
    rect(200, 560, 1000, 170, TOKENS.white, 10) +
    rect(200, 520, 1000, 46, TOKENS.b600, 8) +
    rect(240, 596, 300, 20, TOKENS.b100, 10) +
    rect(240, 636, 200, 20, TOKENS.b100, 10) +
    person(420, 520, 250, TOKENS.b700) +
    person(700, 520, 240, TOKENS.green) +
    rect(1240, 420, 190, 130, TOKENS.white, 8) +
    rect(1264, 446, 142, 78, '#2f3e4d', 4) +
    rect(120, 260, 26, 92, TOKENS.b600, 5) +
    rect(94, 292, 78, 26, TOKENS.b600, 5) +
    rect(1300, 700, 24, 160, '#c2b8a5') +
    rect(1200, 690, 224, 16, TOKENS.terra, 8),

  admin: () =>
    rect(0, 0, W, 620, 'url(#sky)') +
    rect(0, 620, W, 280, '#e4ddcf') +
    rect(280, 170, 1040, 450, '#fbfaf7') +
    rect(280, 170, 1040, 34, TOKENS.b700) +
    grid(330, 250, 8, 4, 84, 54, 30, 30, TOKENS.b50) +
    rect(700, 500, 200, 120, TOKENS.b600, 6) +
    rect(760, 530, 80, 90, TOKENS.white, 4) +
    rect(240, 606, 1120, 16, TOKENS.warm) +
    rect(180, 80, 10, 540, '#b6a992') +
    path('M190 100 l150 40 l-150 40 z', TOKENS.b600) +
    circle(1420, 520, 66, '#cddcc7') +
    rect(1410, 520, 16, 100, '#b6a992'),

  booking: () =>
    rect(0, 0, W, H, '#f3f6fa') +
    rect(520, 90, 560, 730, '#2f3e4d', 46) +
    rect(552, 150, 496, 610, TOKENS.white, 26) +
    rect(600, 200, 200, 22, TOKENS.b100, 11) +
    rect(600, 260, 400, 120, TOKENS.b50, 12) +
    circle(650, 320, 30, TOKENS.b500) +
    rect(700, 300, 220, 16, TOKENS.b100, 8) +
    rect(700, 330, 150, 16, TOKENS.b100, 8) +
    Array.from({ length: 12 }, (_, i) => rect(600 + (i % 4) * 106, 420 + Math.floor(i / 4) * 76, 86, 56, i === 5 ? TOKENS.b600 : TOKENS.b50, 10)).join('') +
    rect(600, 660, 400, 60, TOKENS.terra, 14) +
    rect(140, 250, 300, 300, TOKENS.white, 14) +
    rect(180, 300, 220, 18, TOKENS.b100, 9) +
    rect(180, 340, 160, 18, TOKENS.b100, 9) +
    circle(230, 430, 40, TOKENS.green50) +
    rect(1160, 320, 300, 300, TOKENS.white, 14) +
    rect(1200, 370, 220, 18, TOKENS.b100, 9) +
    rect(1200, 410, 160, 18, TOKENS.b100, 9) +
    circle(1250, 500, 40, TOKENS.terra50),

  news: () =>
    rect(0, 0, W, H, '#f4f1ea') +
    rect(120, 120, 660, 660, TOKENS.white, 14) +
    rect(160, 170, 580, 300, TOKENS.b100, 10) +
    rect(160, 510, 380, 24, TOKENS.b600, 12) +
    rect(160, 560, 580, 20, TOKENS.warm, 10) +
    rect(160, 600, 500, 20, TOKENS.warm, 10) +
    rect(160, 640, 420, 20, TOKENS.warm, 10) +
    rect(830, 120, 650, 300, TOKENS.white, 14) +
    rect(870, 160, 200, 140, TOKENS.green50, 10) +
    rect(1100, 170, 340, 20, TOKENS.warm, 10) +
    rect(1100, 210, 280, 20, TOKENS.warm, 10) +
    rect(1100, 260, 160, 22, TOKENS.green, 11) +
    rect(830, 460, 650, 320, TOKENS.white, 14) +
    rect(870, 500, 200, 160, TOKENS.terra50, 10) +
    rect(1100, 510, 340, 20, TOKENS.warm, 10) +
    rect(1100, 550, 280, 20, TOKENS.warm, 10) +
    rect(1100, 600, 160, 22, TOKENS.terra, 11),

  portrait: () =>
    rect(0, 0, W, H, TOKENS.b50) +
    circle(800, 380, 210, TOKENS.warm) +
    path('M420 900 q0 -300 380 -300 q380 0 380 300 z', TOKENS.b500) +
    path('M660 640 q140 90 280 0 l0 60 q-140 80 -280 0 z', TOKENS.white),

  docs: () =>
    rect(0, 0, W, H, '#f4f1ea') +
    rect(420, 90, 760, 720, TOKENS.white, 12) +
    rect(490, 170, 340, 28, TOKENS.b700, 14) +
    [0, 1, 2, 3, 4, 5].map((i) => rect(490, 260 + i * 56, i % 3 === 2 ? 420 : 620, 20, TOKENS.warm, 10)).join('') +
    rect(490, 640, 240, 56, TOKENS.b600, 12) +
    rect(150, 240, 260, 340, '#efe9dd', 10) +
    rect(190, 290, 180, 16, TOKENS.warm, 8) +
    rect(190, 326, 140, 16, TOKENS.warm, 8) +
    rect(1190, 300, 260, 340, '#efe9dd', 10) +
    rect(1230, 350, 180, 16, TOKENS.warm, 8) +
    rect(1230, 386, 140, 16, TOKENS.warm, 8) +
    circle(1080, 700, 70, TOKENS.green50) +
    `<path d="M1046 700 l24 26 l48 -54" fill="none" stroke="${TOKENS.green}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`,
};

/* ---- slot id -> scene ---- */
const MAP: Record<string, SceneName> = {
  'home-campus': 'campus',
  'home-care-1': 'nurse',
  'home-care-2': 'consult',
  'home-care-3': 'equipment',
  'about-hero': 'campus',
  'about-history': 'archive',
  'about-invest': 'equipment',
  'patients-hero': 'reception',
  'patients-admission': 'reception',
  'patients-pharmacy': 'pharmacy',
  'patients-room': 'ward',
  'patients-visit': 'ward',
  'patients-nurse': 'nurse',
  'patients-discharge': 'corridor',
  'careers-hero': 'team',
  'careers-1': 'nurse',
  'careers-2': 'corridor',
  'careers-3': 'education',
  'education-hero': 'education',
  'departments-hero': 'corridor',
  'clinics-hero': 'waiting',
  'diagnostics-hero': 'imaging',
  'diag-1': 'imaging',
  'diag-2': 'lab',
  'diag-3': 'equipment',
  'services-hero': 'nurse',
  'physicians-hero': 'team',
  'news-hero': 'news',
  'contact-hero': 'aerial',
  'booking-hero': 'booking',
  'telehealth-hero': 'video',
  'teleconsult-hero': 'video',
  'disclosure-hero': 'admin',
};

/** department slots (dept-<id> / dept-<id>-hero) */
const DEPT: Record<string, SceneName> = {
  chirurgia: 'equipment',
  interne: 'ward',
  gynekologia: 'nurse',
  pediatria: 'ward',
  oaim: 'equipment',
  fro: 'education',
  neonatologia: 'nurse',
  neurologicka: 'consult',
  ortopedicka: 'imaging',
  kardiologicka: 'equipment',
};

export function sceneFor(id: string | null | undefined): SceneName {
  if (!id) return 'campus';
  if (MAP[id]) return MAP[id];
  if (/^doc-/.test(id)) return 'portrait';
  if (/^dept-/.test(id)) return DEPT[id.slice(5).replace(/-hero$/, '')] || 'ward';
  if (/^doc(ument)?s?-/.test(id)) return 'docs';
  if (/lab|biochem|hemato/.test(id)) return 'lab';
  if (/pharm|lekar(en)?/.test(id)) return 'pharmacy';
  if (/hero/.test(id)) return 'campus';
  return 'ward';
}

const SCENE_CACHE: Partial<Record<SceneName, string>> = {};

/** Data-URI-encoded SVG for a named scene (memoised). Not base64 — matches the prototype. */
export function sceneDataUri(name: SceneName): string {
  const cached = SCENE_CACHE[name];
  if (cached) return cached;
  const body = (S[name] || S.ward)();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TOKENS.sky1}"/><stop offset="1" stop-color="${TOKENS.sky2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${TOKENS.cream}"/>${body}</svg>`;
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  SCENE_CACHE[name] = uri;
  return uri;
}

/** Colourful monogram avatar — an identifiable stand-in for a real physician portrait. */
const AVATAR_PALETTE: Array<[string, string]> = [
  [TOKENS.b600, '#ffffff'],
  [TOKENS.green, '#ffffff'],
  [TOKENS.terra, '#ffffff'],
  [TOKENS.b700, '#ffffff'],
  [TOKENS.b500, '#ffffff'],
  ['#7a6aa8', '#ffffff'],
];

export function monogram(initials: string): string {
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  const [bg, fg] = AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
  const safe = initials.replace(/[<&>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="${bg}"/><circle cx="330" cy="70" r="120" fill="#ffffff" fill-opacity=".07"/><circle cx="60" cy="350" r="90" fill="#000000" fill-opacity=".06"/><text x="200" y="200" text-anchor="middle" dominant-baseline="central" font-family="Georgia,'Times New Roman',serif" font-size="150" font-weight="600" fill="${fg}">${safe}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export type { SceneName };
