// Sunset Panels — painted backdrop art, all drawn in code.
// Nothing here is Rockstar artwork: the sky, sun, skyline and palm silhouettes
// are original shapes drawn with the canvas API. Grades change the palette.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#160a33', '#4b1460', '#a4236e', '#ff5e3a', '#ffb03a'],
    sun: '#ffe9a8',
    sunGlow: 'rgba(255, 176, 58, 0.55)',
    silhouette: '#170a2e',
    photoTint: ['rgba(255, 46, 136, 0.20)', 'rgba(255, 122, 47, 0.16)'],
  },
  neon: {
    label: 'Neon night',
    sky: ['#0a0626', '#1c0b4d', '#5b1a8a', '#c62b7e', '#2fd6ff'],
    sun: '#b8f4ff',
    sunGlow: 'rgba(47, 214, 255, 0.45)',
    silhouette: '#0b0620',
    photoTint: ['rgba(47, 214, 255, 0.18)', 'rgba(255, 46, 136, 0.18)'],
  },
  dusk: {
    label: 'Dusk purple',
    sky: ['#0d0722', '#2a0f4a', '#6d1a63', '#c94b6d', '#e8836b'],
    sun: '#ffd9b0',
    sunGlow: 'rgba(232, 131, 107, 0.5)',
    silhouette: '#120826',
    photoTint: ['rgba(109, 26, 99, 0.22)', 'rgba(201, 75, 109, 0.14)'],
  },
  golden: {
    label: 'Golden hour',
    sky: ['#1a0b2e', '#5c1a3d', '#b03a2e', '#ff7a2f', '#ffc93a'],
    sun: '#fff3c4',
    sunGlow: 'rgba(255, 201, 58, 0.55)',
    silhouette: '#1a0a24',
    photoTint: ['rgba(255, 122, 47, 0.20)', 'rgba(255, 201, 58, 0.16)'],
  },
  teal: {
    label: 'Tropic teal',
    sky: ['#041e28', '#0a3d4d', '#0e6b6b', '#2fd6a8', '#ffe9a8'],
    sun: '#e8fff4',
    sunGlow: 'rgba(47, 214, 168, 0.5)',
    silhouette: '#06222e',
    photoTint: ['rgba(14, 107, 107, 0.20)', 'rgba(47, 214, 168, 0.14)'],
  },
};

export const GRADE_IDS = Object.keys(GRADES);

// Mix two #rrggbb colours: t = 0 gives a, t = 1 gives b.
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Vertical sunset gradient over the whole cover. strength 1 is the full
// grade palette; lower strengths fade the sky towards a neutral dark
// blue-grey (the Grade look slider).
export function paintSky(ctx, W, H, grade, strength = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops = grade.sky;
  const fade = Math.max(0, Math.min(1, 1 - strength));
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), fade > 0 ? mixHex(color, '#232338', fade) : color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Big low sun with horizontal slits in its lower half (synthwave disc).
// cx, cy are the centre in cover pixels, r the radius.
export function paintSun(ctx, cx, cy, r, grade) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.1);
  glow.addColorStop(0, grade.sunGlow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.1, cy - r * 2.1, r * 4.2, r * 4.2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Slits: sky-coloured bands that grow thicker towards the bottom.
  ctx.fillStyle = grade.sky[grade.sky.length - 1];
  let y = cy + r * 0.08;
  let thick = r * 0.035;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, thick);
    y += thick + r * 0.16;
    thick *= 1.55;
  }
  ctx.restore();
}

// Low city skyline silhouette with a few lit windows, sitting on `baseY`.
// A continuous base band keeps it reading as one skyline, not a dashed strip.
export function paintSkyline(ctx, W, baseY, H, grade, seed) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  ctx.fillStyle = grade.silhouette;
  ctx.fillRect(0, baseY - H * 0.014, W, H * 0.014);
  let x = -W * 0.02;
  while (x < W * 1.02) {
    const bw = W * (0.03 + rnd() * 0.05);
    const bh = H * (0.02 + rnd() * 0.045);
    ctx.fillRect(x, baseY - H * 0.014 - bh, bw, bh + H * 0.014);
    // Antenna on some towers.
    if (rnd() > 0.7) ctx.fillRect(x + bw / 2 - 1, baseY - H * 0.014 - bh - H * 0.018, 2, H * 0.018);
    // Sparse lit windows, only on the towers.
    ctx.fillStyle = 'rgba(255, 209, 102, 0.8)';
    const cols = Math.max(1, Math.floor(bw / (W * 0.02)));
    const rows = Math.max(1, Math.floor(bh / (H * 0.02)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.7) {
          ctx.fillRect(x + W * 0.008 + c * W * 0.02, baseY - H * 0.014 - bh + H * 0.009 + r * H * 0.02, W * 0.005, H * 0.006);
        }
      }
    }
    ctx.fillStyle = grade.silhouette;
    x += bw + W * 0.006;
  }
}

// One palm silhouette: curved trunk + drooping fronds. (x, y) is the base.
export function paintPalm(ctx, x, y, size, lean, grade) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = grade.silhouette;
  ctx.fillStyle = grade.silhouette;
  ctx.lineCap = 'round';
  // Trunk: a gentle curve leaning up.
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.5, size * 0.16, -size * 0.92);
  ctx.stroke();
  // Fronds fan out from the trunk tip.
  const tipX = size * 0.16;
  const tipY = -size * 0.92;
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (-Math.PI * 0.92) + (i / (fronds - 1)) * Math.PI * 0.84;
    const len = size * (0.42 + (i % 2) * 0.1);
    const ex = tipX + Math.cos(a) * len;
    const ey = tipY + Math.sin(a) * len * 0.62 + size * 0.16;
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(tipX + Math.cos(a) * len * 0.5, tipY + Math.sin(a) * len * 0.4 - size * 0.1, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// Warm/cool tint over a photo rect so every panel shares the sunset grade.
// strength 1 is the full tint (the Paint look slider scales it down).
export function paintPhotoGrade(ctx, rect, grade, strength = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.max(0, Math.min(1, strength));
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, grade.photoTint[0]);
  g.addColorStop(1, grade.photoTint[1]);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// Film grain: sparse light/dark specks.
export function paintGrain(ctx, W, H, amount) {
  ctx.save();
  for (let i = 0; i < amount; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }
  ctx.restore();
}

// Halftone dots over a band (y0..y1): dots grow as the band goes down.
// strength scales the dot opacity (the Halftone look slider); 1 is the
// original strength.
export function paintHalftone(ctx, W, y0, y1, grade, strength = 1) {
  const step = Math.max(10, W * 0.016);
  ctx.save();
  ctx.fillStyle = grade.silhouette;
  ctx.globalAlpha = 0.16 * Math.max(0, Math.min(2, strength));
  let row = 0;
  for (let y = y0 + step / 2; y < y1; y += step, row++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const r = step * (0.08 + t * 0.3);
    for (let x = step / 2 + (row % 2) * step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Starburst seal shape: a zigzag circle for stickers and badges.
export function paintStarburst(ctx, cx, cy, r, points, fill, stroke) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.82;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

// Deterministic barcode: vertical bars from a seeded generator, so the same
// cover always draws the same bars. Drawn on a white ticket.
export function paintBarcode(ctx, x, y, w, h, seed) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#14082e';
  let bx = x + w * 0.06;
  const endX = x + w * 0.94;
  while (bx < endX) {
    const bw = w * (0.012 + rnd() * 0.03);
    if (rnd() > 0.35) ctx.fillRect(bx, y + h * 0.08, bw, h * 0.72);
    bx += bw + w * 0.014;
  }
  ctx.fillStyle = '#14082e';
  ctx.font = `600 ${Math.max(9, h * 0.14)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8 90210 07713 5', x + w / 2, y + h * 0.9);
  ctx.restore();
}

// Darkened corners so the poster reads as one image.
export function paintVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(8, 3, 20, 0)');
  g.addColorStop(1, 'rgba(8, 3, 20, 0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
