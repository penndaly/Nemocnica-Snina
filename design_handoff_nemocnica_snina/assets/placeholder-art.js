/* placeholder-art.js — branded illustrated placeholders for every <image-slot>.
   Generates a flat, on-palette SVG scene per slot so the site presents fully
   dressed before real photography lands (IMG-1). A dropped photo overrides the
   art automatically — image-slot prefers the stored image over `src`.
   Load AFTER image-slot.js + media.js. */
(function () {
  const C = {
    sky1: "#eef4fa", sky2: "#dce8f4", cream: "#faf6f0", sand: "#f4ede2",
    b900: "#14375f", b700: "#1e5290", b600: "#2563a8", b500: "#3a7cc0",
    b200: "#b9d2ea", b100: "#dce8f4", b50: "#eef4fa",
    terra: "#c06a38", terra50: "#f8ece3", green: "#2f8a64", green50: "#e6f2ec",
    amber: "#c08a2e", warm: "#e8dccb", line: "#e7ddcf", ink3: "#8a8073", white: "#ffffff"
  };
  const W = 1600, H = 900;

  /* ---- primitives ---- */
  const r = (x, y, w, h, f, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${rx ? ` rx="${rx}"` : ""}/>`;
  const c = (x, y, rad, f) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${f}"/>`;
  const p = (d, f) => `<path d="${d}" fill="${f}"/>`;
  const ln = (x1, y1, x2, y2, s, w2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w2 || 6}" stroke-linecap="round"/>`;

  /* window grid on a facade */
  function grid(x, y, cols, rows, cw, ch, gx, gy, f) {
    let s = "";
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
      s += r(x + i * (cw + gx), y + j * (ch + gy), cw, ch, f, 3);
    return s;
  }
  /* abstract person: head + shoulders, no facial detail */
  function person(x, y, h2, body, skin) {
    const hd = h2 * 0.19;
    return c(x, y - h2 * 0.78, hd, skin || C.warm) +
      p(`M${x - h2 * 0.36} ${y} q0 ${-h2 * 0.52} ${h2 * 0.36} ${-h2 * 0.52} q${h2 * 0.36} 0 ${h2 * 0.36} ${h2 * 0.52} z`, body);
  }
  const bed = (x, y, w, hcol) =>
    r(x, y, w, 26, C.white, 8) + r(x + 10, y - 22, w * 0.42, 26, C.b100, 10) +
    r(x, y + 26, 14, 40, hcol) + r(x + w - 14, y + 26, 14, 40, hcol) +
    r(x + w - 8, y - 62, 10, 88, hcol, 5);

  /* ---- scenes ---- */
  const S = {};

  S.campus = () =>
    r(0, 0, W, 620, "url(#sky)") +
    p(`M0 560 q260 -110 520 -40 q300 84 560 -26 q300 -128 520 -34 L${W} 620 L0 620 z`, "#dfe9dd") +
    r(0, 620, W, 280, C.sand) +
    r(180, 300, 470, 320, C.white) + r(180, 300, 470, 26, C.b600) +
    grid(216, 366, 6, 4, 52, 40, 20, 24, C.b100) +
    r(650, 210, 560, 410, "#fbfaf7") + r(650, 210, 560, 30, C.b700) +
    grid(692, 288, 7, 5, 54, 42, 18, 22, C.b50) +
    r(1210, 380, 260, 240, C.white) + grid(1240, 430, 3, 3, 54, 42, 22, 26, C.b100) +
    r(880, 96, 34, 116, C.b600, 6) + r(838, 138, 118, 34, C.b600, 6) +
    r(300, 620, 1000, 12, C.warm) +
    c(1360, 520, 74, "#cddcc7") + r(1352, 520, 16, 100, "#b6a992") +
    c(120, 546, 56, "#cddcc7") + r(112, 546, 14, 76, "#b6a992") +
    r(700, 520, 150, 100, C.b100, 8) + r(760, 560, 34, 60, C.b600, 4);

  S.aerial = () =>
    r(0, 0, W, H, "#e9ede4") +
    p(`M0 0 h${W} v${H} h${-W} z`, "#e9ede4") +
    r(120, 120, 620, 300, C.white, 6) + r(120, 120, 620, 300, "none", 0) +
    r(150, 150, 560, 40, C.b100, 4) + r(150, 214, 560, 40, C.b100, 4) + r(150, 278, 560, 40, C.b100, 4) +
    r(800, 120, 380, 470, "#fbfaf7", 6) + grid(830, 160, 4, 6, 62, 46, 22, 24, C.b50) +
    r(1240, 240, 240, 350, C.white, 6) + grid(1270, 280, 2, 4, 78, 52, 24, 28, C.b100) +
    r(0, 620, W, 90, "#cfc6b6") + r(0, 656, W, 8, C.white) +
    r(120, 740, 1360, 120, "#ddd4c4", 8) +
    Array.from({ length: 11 }, (_, i) => r(170 + i * 118, 758, 76, 44, C.b200, 5)).join("") +
    c(300, 470, 62, "#c6d6bd") + c(430, 512, 44, "#c6d6bd") + c(1400, 690, 40, "#c6d6bd") +
    r(760, 470, 20, 150, "#cfc6b6");

  S.corridor = () =>
    r(0, 0, W, H, "#f2f5f8") +
    p(`M0 0 L520 250 L1080 250 L${W} 0 z`, "#e6edf4") +
    p(`M0 ${H} L520 640 L1080 640 L${W} ${H} z`, "#e2dbcd") +
    p(`M0 0 L520 250 L520 640 L0 ${H} z`, "#f7f4ee") +
    p(`M${W} 0 L1080 250 L1080 640 L${W} ${H} z`, "#f7f4ee") +
    r(520, 250, 560, 390, "#eef2f6") +
    p("M690 640 L690 380 L910 380 L910 640 z", C.b100) +
    p("M120 300 L300 372 L300 620 L120 700 z", C.b200) +
    p("M1300 300 L1480 700 L1480 620 L1300 372 z".replace(/1480 700/, "1300 372"), C.b200) +
    p("M1300 372 L1480 300 L1480 700 L1300 620 z", C.b200) +
    r(560, 150, 120, 18, C.white, 9) + r(760, 190, 90, 14, C.white, 7) +
    person(430, 620, 190, C.b600) + person(1160, 610, 170, C.terra);

  S.ward = () =>
    r(0, 0, W, 640, "#f4f7fa") + r(0, 640, W, 260, "#e6dfd1") +
    r(980, 150, 460, 330, C.b50, 8) + r(980, 150, 460, 330, "none") +
    ln(1210, 150, 1210, 480, C.white, 10) + ln(980, 315, 1440, 315, C.white, 10) +
    r(940, 130, 40, 380, C.warm, 6) + r(1440, 130, 40, 380, C.warm, 6) +
    bed(300, 560, 520, C.b500) +
    person(430, 540, 150, C.b100, C.warm) +
    r(120, 470, 130, 170, C.white, 8) + r(140, 500, 90, 12, C.b100, 6) + c(185, 560, 26, C.green50) +
    r(880, 430, 120, 210, C.white, 8) + r(900, 460, 80, 60, C.b100, 6) + c(940, 580, 22, C.terra50);

  S.nurse = () =>
    r(0, 0, W, 660, "#f5f8fa") + r(0, 660, W, 240, "#e6dfd1") +
    r(1040, 120, 420, 320, C.b50, 10) + ln(1250, 120, 1250, 440, C.white, 10) +
    bed(240, 600, 560, C.b500) +
    person(400, 578, 160, C.b100) +
    person(860, 660, 300, C.green) +
    r(806, 500, 28, 44, C.white, 6) +
    r(120, 500, 110, 160, C.white, 8) + c(175, 560, 24, C.terra50) +
    r(1180, 520, 200, 140, C.white, 10) + r(1210, 550, 140, 16, C.b100, 8) + r(1210, 584, 100, 16, C.b100, 8);

  S.consult = () =>
    r(0, 0, W, 620, "#f4f7fa") + r(0, 620, W, 280, "#e2dbcd") +
    r(1060, 110, 400, 300, C.b50, 10) + ln(1260, 110, 1260, 410, C.white, 10) +
    r(160, 140, 280, 330, C.white, 8) + grid(190, 176, 2, 4, 100, 50, 20, 22, C.b100) +
    r(420, 620, 760, 34, C.white, 8) + r(470, 654, 30, 130, "#cfc6b6") + r(1100, 654, 30, 130, "#cfc6b6") +
    person(620, 620, 250, C.b600) +
    person(980, 620, 240, C.terra) +
    r(760, 500, 170, 120, C.white, 8) + r(780, 520, 130, 80, C.b100, 4) + r(800, 620, 90, 12, "#cfc6b6", 4);

  S.team = () => {
    const cols = [C.b600, C.green, C.b500, C.terra, C.b700, C.green];
    let f = "";
    for (let i = 0; i < 6; i++) f += person(230 + i * 232, 760 - (i % 2 ? 20 : 0), 330, cols[i]);
    return r(0, 0, W, 620, "#eef3f8") + r(0, 620, W, 280, "#e6dfd1") +
      grid(120, 210, 6, 2, 180, 130, 52, 44, C.white) +
      r(0, 560, W, 70, "#dfe8f1") + f +
      r(720, 90, 30, 100, C.b600, 5) + r(684, 126, 102, 30, C.b600, 5);
  };

  S.equipment = () =>
    r(0, 0, W, 680, "#eef3f7") + r(0, 680, W, 220, "#ded6c6") +
    r(300, 180, 700, 500, C.white, 14) +
    r(350, 230, 600, 300, "#dbe6f1", 8) +
    p("M380 400 h90 l40 -110 l60 220 l50 -170 l40 60 h280", "none") +
    `<path d="M380 400 h90 l40 -110 l60 220 l50 -170 l40 60 h280" fill="none" stroke="${C.b600}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
    r(390, 570, 200, 22, C.b100, 11) + r(620, 570, 120, 22, C.green50, 11) +
    r(620, 680, 60, 180, "#c2b8a5") + r(500, 850, 300, 24, "#c2b8a5", 12) +
    r(1080, 300, 300, 380, C.white, 12) + grid(1110, 340, 2, 4, 118, 60, 24, 26, C.b50) +
    c(1230, 200, 60, C.terra50) + c(1230, 200, 30, C.terra);

  S.lab = () =>
    r(0, 0, W, 640, "#f1f6f3") + r(0, 640, W, 260, "#ded6c6") +
    r(0, 120, W, 40, "#e7dfd0") + r(120, 160, 1360, 14, C.warm) +
    r(220, 200, 240, 200, C.white, 8) + grid(250, 230, 3, 2, 50, 60, 20, 20, C.green50) +
    r(1140, 200, 240, 200, C.white, 8) + grid(1170, 230, 3, 2, 50, 60, 20, 20, C.b50) +
    r(120, 640, 1360, 30, C.white, 6) +
    p("M560 640 l0 -120 l-40 -70 l0 -60 l90 0 l0 60 l-40 70 l0 120 z", C.b200) +
    p("M600 640 l0 -90 l-30 -52 l0 -48 l70 0 l0 48 l-30 52 l0 90 z", C.green50) +
    r(700, 480, 46, 160, C.b100, 8) + r(760, 520, 46, 120, C.terra50, 8) + r(820, 500, 46, 140, C.green50, 8) +
    p("M980 640 l0 -60 l-24 0 l0 -40 l70 0 l0 40 l-24 0 l0 60 z", "#b9c4cf") +
    c(1015, 470, 34, "#cbd5de") + r(1000, 400, 30, 80, "#b9c4cf", 6) +
    person(340, 640, 260, C.white) + c(340, 437, 30, C.warm);

  S.imaging = () =>
    r(0, 0, W, 680, "#eef2f7") + r(0, 680, W, 220, "#dcd4c4") +
    c(880, 420, 210, "#e2e9f1") + c(880, 420, 162, C.white) + c(880, 420, 104, "#dbe4ee") +
    `<path d="M880 210 a210 210 0 0 1 175 93" fill="none" stroke="${C.b500}" stroke-width="14" stroke-linecap="round"/>` +
    r(430, 556, 820, 28, C.white, 14) + r(400, 584, 120, 100, "#c2b8a5", 8) +
    r(560, 530, 360, 28, C.b100, 14) +
    c(586, 516, 22, C.warm) +
    r(120, 300, 190, 260, C.white, 10) + r(146, 330, 138, 96, "#2f3e4d", 6) + r(146, 446, 138, 12, C.b100, 6) + r(146, 476, 96, 12, C.b100, 6) +
    r(1330, 260, 170, 300, C.white, 10) + grid(1356, 292, 1, 3, 118, 62, 0, 26, C.b50);

  S.pharmacy = () =>
    r(0, 0, W, 700, "#f6f2ea") + r(0, 700, W, 200, "#ded6c6") +
    [0, 1, 2].map(i => r(140, 150 + i * 150, 620, 16, "#c9bda7", 4)).join("") +
    [0, 1, 2].map(i => Array.from({ length: 8 }, (_, j) =>
      r(160 + j * 74, 80 + i * 150, 44, 70, [C.b100, C.green50, C.terra50, C.b200][(i + j) % 4], 6)).join("")).join("") +
    r(880, 150, 560, 420, C.white, 10) + grid(920, 190, 4, 4, 100, 60, 24, 26, C.b50) +
    r(140, 640, 1160, 60, C.white, 10) + r(140, 700, 1160, 26, "#c9bda7") +
    r(1000, 560, 150, 84, C.b100, 8) +
    person(560, 640, 220, C.green) + person(880, 660, 200, C.b600) +
    r(1240, 80, 26, 90, C.green, 5) + r(1212, 112, 82, 26, C.green, 5);

  S.video = () =>
    r(0, 0, W, H, "#f2f5f9") +
    r(260, 130, 1080, 640, "#2f3e4d", 20) + r(292, 162, 1016, 540, C.b50, 12) +
    c(800, 380, 108, C.b200) + p("M690 560 q0 -130 110 -130 q110 0 110 130 z", C.b500) +
    r(1080, 200, 190, 130, C.white, 10) + c(1175, 246, 30, C.warm) + p("M1120 310 q0 -42 55 -42 q55 0 55 42 z", C.terra) +
    r(560, 640, 480, 62, C.white, 31) +
    c(640, 671, 22, C.green) + c(720, 671, 22, C.b600) + c(800, 671, 22, C.b600) + c(960, 671, 22, "#c0392b") +
    r(600, 770, 400, 22, "#2f3e4d", 11) + r(680, 792, 240, 40, "#2f3e4d", 6) +
    r(120, 300, 90, 90, C.green50, 12) + r(1400, 460, 90, 90, C.terra50, 12);

  S.archive = () =>
    r(0, 0, W, H, "#efe6d6") +
    r(60, 60, W - 120, H - 120, "#e6d9c2") +
    r(110, 110, W - 220, H - 220, "#f3ebdd") +
    p(`M200 620 q240 -90 480 -34 q280 66 500 -20 L1400 620 z`, "#ddd0b6") +
    r(420, 330, 380 + 0, 290, "#cbbb9d") + r(420, 330, 380, 22, "#b09b78") +
    grid(456, 384, 5, 3, 46, 44, 20, 24, "#efe6d6") +
    r(820, 380, 260, 240, "#d6c7a9") + grid(850, 424, 3, 2, 46, 44, 22, 26, "#efe6d6") +
    r(596, 240, 24, 92, "#b09b78", 5) + r(568, 272, 80, 24, "#b09b78", 5) +
    r(200, 618, 1200, 10, "#c0ae8c") +
    c(1240, 520, 60, "#c9be9c") + r(1232, 520, 14, 98, "#b09b78");

  S.education = () =>
    r(0, 0, W, 660, "#f4f7fa") + r(0, 660, W, 240, "#e2dbcd") +
    r(240, 110, 700, 420, C.white, 12) + r(240, 110, 700, 40, C.b600, 0) +
    r(290, 210, 300, 20, C.b100, 10) + r(290, 260, 460, 20, C.b100, 10) + r(290, 310, 380, 20, C.b100, 10) +
    r(290, 380, 90, 110, C.b500, 6) + r(400, 410, 90, 80, C.green, 6) + r(510, 350, 90, 140, C.terra, 6) +
    r(1020, 190, 380, 300, C.b50, 10) +
    person(360, 830, 260, C.b600) + person(660, 850, 250, C.green) + person(960, 830, 240, C.terra) +
    r(180, 530, 40, 140, "#c2b8a5");

  S.waiting = () =>
    r(0, 0, W, 640, "#f5f7f9") + r(0, 640, W, 260, "#e4ddcf") +
    r(120, 140, 520, 330, C.b50, 10) + ln(380, 140, 380, 470, C.white, 10) +
    r(80, 120, 30, 370, C.warm, 6) + r(650, 120, 30, 370, C.warm, 6) +
    c(1340, 220, 62, C.white) + c(1340, 220, 54, C.b50) + ln(1340, 220, 1340, 186, C.b700, 7) + ln(1340, 220, 1366, 232, C.b700, 7) +
    [0, 1, 2, 3].map(i => r(220 + i * 230, 600, 190, 30, C.b500, 8) + r(220 + i * 230, 500, 190, 100, C.b200, 10) + r(236 + i * 230, 630, 16, 90, "#8d8577") + r(378 + i * 230, 630, 16, 90, "#8d8577")).join("") +
    person(315, 600, 200, C.terra) + person(775, 600, 190, C.b700) +
    c(1300, 600, 74, "#cddcc7") + r(1288, 600, 24, 120, "#b6a992") + r(1250, 716, 100, 40, "#c2b8a5", 8);

  S.reception = () =>
    r(0, 0, W, 640, "#f4f7fa") + r(0, 640, W, 260, "#e4ddcf") +
    r(700, 110, 760, 340, C.b50, 10) + grid(740, 150, 3, 2, 200, 120, 30, 30, C.white) +
    r(200, 560, 1000, 170, C.white, 10) + r(200, 520, 1000, 46, C.b600, 8) +
    r(240, 596, 300, 20, C.b100, 10) + r(240, 636, 200, 20, C.b100, 10) +
    person(420, 520, 250, C.b700) + person(700, 520, 240, C.green) +
    r(1240, 420, 190, 130, C.white, 8) + r(1264, 446, 142, 78, "#2f3e4d", 4) +
    r(120, 260, 26, 92, C.b600, 5) + r(94, 292, 78, 26, C.b600, 5) +
    r(1300, 700, 24, 160, "#c2b8a5") + r(1200, 690, 224, 16, C.terra, 8);

  S.admin = () =>
    r(0, 0, W, 620, "url(#sky)") + r(0, 620, W, 280, "#e4ddcf") +
    r(280, 170, 1040, 450, "#fbfaf7") + r(280, 170, 1040, 34, C.b700) +
    grid(330, 250, 8, 4, 84, 54, 30, 30, C.b50) +
    r(700, 500, 200, 120, C.b600, 6) + r(760, 530, 80, 90, C.white, 4) +
    r(240, 606, 1120, 16, C.warm) +
    r(180, 80, 10, 540, "#b6a992") + p("M190 100 l150 40 l-150 40 z", C.b600) +
    c(1420, 520, 66, "#cddcc7") + r(1410, 520, 16, 100, "#b6a992");

  S.booking = () =>
    r(0, 0, W, H, "#f3f6fa") +
    r(520, 90, 560, 730, "#2f3e4d", 46) + r(552, 150, 496, 610, C.white, 26) +
    r(600, 200, 200, 22, C.b100, 11) +
    r(600, 260, 400, 120, C.b50, 12) + c(650, 320, 30, C.b500) + r(700, 300, 220, 16, C.b100, 8) + r(700, 330, 150, 16, C.b100, 8) +
    Array.from({ length: 12 }, (_, i) => r(600 + (i % 4) * 106, 420 + Math.floor(i / 4) * 76, 86, 56, i === 5 ? C.b600 : C.b50, 10)).join("") +
    r(600, 660, 400, 60, C.terra, 14) +
    r(140, 250, 300, 300, C.white, 14) + r(180, 300, 220, 18, C.b100, 9) + r(180, 340, 160, 18, C.b100, 9) + c(230, 430, 40, C.green50) +
    r(1160, 320, 300, 300, C.white, 14) + r(1200, 370, 220, 18, C.b100, 9) + r(1200, 410, 160, 18, C.b100, 9) + c(1250, 500, 40, C.terra50);

  S.news = () =>
    r(0, 0, W, H, "#f4f1ea") +
    r(120, 120, 660, 660, C.white, 14) + r(160, 170, 580, 300, C.b100, 10) +
    r(160, 510, 380, 24, C.b600, 12) + r(160, 560, 580, 20, C.warm, 10) + r(160, 600, 500, 20, C.warm, 10) + r(160, 640, 420, 20, C.warm, 10) +
    r(830, 120, 650, 300, C.white, 14) + r(870, 160, 200, 140, C.green50, 10) + r(1100, 170, 340, 20, C.warm, 10) + r(1100, 210, 280, 20, C.warm, 10) + r(1100, 260, 160, 22, C.green, 11) +
    r(830, 460, 650, 320, C.white, 14) + r(870, 500, 200, 160, C.terra50, 10) + r(1100, 510, 340, 20, C.warm, 10) + r(1100, 550, 280, 20, C.warm, 10) + r(1100, 600, 160, 22, C.terra, 11);

  S.portrait = () =>
    r(0, 0, W, H, C.b50) +
    c(800, 380, 210, C.warm) +
    p("M420 900 q0 -300 380 -300 q380 0 380 300 z", C.b500) +
    p("M660 640 q140 90 280 0 l0 60 q-140 80 -280 0 z", C.white);

  S.docs = () =>
    r(0, 0, W, H, "#f4f1ea") +
    r(420, 90, 760, 720, C.white, 12) +
    r(490, 170, 340, 28, C.b700, 14) +
    [0, 1, 2, 3, 4, 5].map(i => r(490, 260 + i * 56, i % 3 === 2 ? 420 : 620, 20, C.warm, 10)).join("") +
    r(490, 640, 240, 56, C.b600, 12) +
    r(150, 240, 260, 340, "#efe9dd", 10) + r(190, 290, 180, 16, C.warm, 8) + r(190, 326, 140, 16, C.warm, 8) +
    r(1190, 300, 260, 340, "#efe9dd", 10) + r(1230, 350, 180, 16, C.warm, 8) + r(1230, 386, 140, 16, C.warm, 8) +
    c(1080, 700, 70, C.green50) + `<path d="M1046 700 l24 26 l48 -54" fill="none" stroke="${C.green}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;

  /* ---- slot id → scene ---- */
  const MAP = {
    "home-campus": "campus", "home-care-1": "nurse", "home-care-2": "consult", "home-care-3": "equipment",
    "about-hero": "campus", "about-history": "archive", "about-invest": "equipment",
    "patients-hero": "reception", "patients-admission": "reception", "patients-pharmacy": "pharmacy",
    "patients-room": "ward", "patients-visit": "ward", "patients-nurse": "nurse", "patients-discharge": "corridor",
    "careers-hero": "team", "careers-1": "nurse", "careers-2": "corridor", "careers-3": "education",
    "education-hero": "education", "departments-hero": "corridor", "clinics-hero": "waiting",
    "diagnostics-hero": "imaging", "diag-1": "imaging", "diag-2": "lab", "diag-3": "equipment",
    "services-hero": "nurse", "physicians-hero": "team", "news-hero": "news", "contact-hero": "aerial",
    "booking-hero": "booking", "telehealth-hero": "video", "teleconsult-hero": "video",
    "disclosure-hero": "admin"
  };
  /* department slots (dept-<id>) */
  const DEPT = {
    chirurgia: "equipment", interne: "ward", gynekologia: "nurse", pediatria: "ward",
    oaim: "equipment", fro: "education", neonatologia: "nurse", neurologicka: "consult",
    ortopedicka: "imaging", kardiologicka: "equipment"
  };

  function sceneFor(id) {
    if (!id) return "campus";
    if (MAP[id]) return MAP[id];
    if (/^doc-/.test(id)) return "portrait";
    if (/^dept-/.test(id)) return DEPT[id.slice(5).replace(/-hero$/, "")] || "ward";
    if (/^doc(ument)?s?-/.test(id)) return "docs";
    if (/lab|biochem|hemato/.test(id)) return "lab";
    if (/pharm|lekar(en)?/.test(id)) return "pharmacy";
    if (/hero/.test(id)) return "campus";
    return "ward";
  }

  /* monogram avatar — colourful, identifiable stand-in for a real portrait */
  const AV = [[C.b600, "#ffffff"], [C.green, "#ffffff"], [C.terra, "#ffffff"], [C.b700, "#ffffff"], [C.b500, "#ffffff"], ["#7a6aa8", "#ffffff"]];
  function monogram(ini) {
    let h = 0; for (let i = 0; i < ini.length; i++) h = (h * 31 + ini.charCodeAt(i)) >>> 0;
    const [bg, fg] = AV[h % AV.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="${bg}"/><circle cx="330" cy="70" r="120" fill="#ffffff" fill-opacity=".07"/><circle cx="60" cy="350" r="90" fill="#000000" fill-opacity=".06"/><text x="200" y="200" text-anchor="middle" dominant-baseline="central" font-family="Georgia,'Times New Roman',serif" font-size="150" font-weight="600" fill="${fg}">${ini.replace(/[<&>]/g, "")}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const CACHE = {};
  function build(name) {
    if (CACHE[name]) return CACHE[name];
    const body = (S[name] || S.ward)();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky1}"/><stop offset="1" stop-color="${C.sky2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${C.cream}"/>${body}</svg>`;
    return (CACHE[name] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  }

  function fill(root) {
    (root || document).querySelectorAll("image-slot").forEach((el) => {
      if (el.getAttribute("src")) return;
      const ini = el.getAttribute("data-initials");
      el.setAttribute("src", ini ? monogram(ini) : build(sceneFor(el.id || el.getAttribute("id"))));
      el.setAttribute("data-placeholder-art", "");
    });
  }

  window.PlaceholderArt = { fill, scene: build, sceneFor };

  function run() { fill(); requestAnimationFrame(() => fill()); setTimeout(fill, 250); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
