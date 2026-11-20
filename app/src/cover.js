// Sunset Panels — the poster renderer.
// renderCover draws the whole cover (sky, sun, panels, palms, caption) onto any
// 2D context at any size, so the editor preview and the full-res PNG exports
// are the same drawing. Photos are drawn cover-fit per panel with the panel's
// own zoom and pan; the caption is big condensed lettering over the low sun.

import { GRADES, paintSky, paintSun, paintSkyline, paintPalm, paintPhotoGrade, paintGrain, paintHalftone, paintVignette, paintStarburst, paintBarcode } from './art.js';
import { LAYOUTS, layoutPanels } from './layouts.js';

// Title stripe palettes, picked by the editor's title-colour swatch. The
// default (gold) is the yellow/pink/purple striped gradient.
export const TITLE_GRADIENTS = {
  '#ffd166': ['#ffe066', '#ff2e88', '#a855f7'],
  '#ffffff': ['#ffffff', '#ffd166', '#ff2e88'],
  '#2fd6ff': ['#a5f3fc', '#2fd6ff', '#7c3aed'],
  '#ff2e88': ['#ff8ac2', '#ff2e88', '#7c3aed'],
};

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', label: '1920 × 1080', w: 1920, h: 1080 },
];

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) || EXPORT_SIZES[2];
}

// Draw one photo cover-fit inside a panel rect, honouring zoom and pan.
// Pan is clamped so the photo always covers the panel (no empty edges).
// flip mirrors the photo horizontally around the panel's centre.
export function drawPanelPhoto(ctx, image, rect, zoom, ox, oy, flip = false) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return false;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const maxOx = Math.max(0, (dw - rect.w) / 2);
  const maxOy = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 + ox * maxOx;
  const dy = rect.y + (rect.h - dh) / 2 + oy * maxOy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (flip) {
    ctx.translate(rect.x + rect.w, rect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(image, dx - rect.x, dy - rect.y, dw, dh);
  } else {
    ctx.drawImage(image, dx, dy, dw, dh);
  }
  ctx.restore();
  return true;
}

// Empty panel placeholder: dark gradient, dashed frame, a short label.
function drawEmptyPanel(ctx, rect, u) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, '#2a1445');
  g.addColorStop(1, '#120826');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1.5, u * 1.5);
  ctx.setLineDash([u * 10, u * 8]);
  ctx.strokeRect(rect.x + u * 8, rect.y + u * 8, rect.w - u * 16, rect.h - u * 16);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `600 ${Math.max(14, u * 22)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

// Fit the title font so the text never runs past maxWidth.
function fitTitleFont(ctx, text, maxWidth, baseSize) {
  let size = baseSize;
  ctx.font = `400 ${size}px "Archivo Black", sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) size = Math.max(size * 0.45, size * (maxWidth / w));
  ctx.font = `400 ${size}px "Archivo Black", sans-serif`;
  return size;
}

// Big condensed title over the low sun: a yellow/pink/purple horizontal-stripe
// gradient fill, a purple 3D offset under a magenta offset, a black outline,
// tilted two degrees like a poster masthead.
export function drawPosterTitle(ctx, W, H, state, grade) {
  const u = W / 1080;
  const title = (state.title || '').toUpperCase();
  if (!title) return;
  const baseSize = H * 0.088 * (state.titleSize || 1);
  const size = fitTitleFont(ctx, title, W * 0.94, baseSize);
  const stripes = TITLE_GRADIENTS[state.titleColor] || TITLE_GRADIENTS['#ffd166'];
  ctx.save();
  ctx.translate(W / 2, H * 0.815);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // 3D depth: purple offset, then magenta offset, then the striped fill.
  ctx.fillStyle = '#7b2ff7';
  ctx.fillText(title, u * 13, u * 16);
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(title, u * 7, u * 9);
  // Black outline, then the striped gradient fill.
  if (state.outline !== false) {
    ctx.strokeStyle = '#14082e';
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeText(title, 0, 0);
  }
  const g = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
  g.addColorStop(0, stripes[0]);
  g.addColorStop(0.33, stripes[0]);
  g.addColorStop(0.34, stripes[1]);
  g.addColorStop(0.66, stripes[1]);
  g.addColorStop(0.67, stripes[2]);
  g.addColorStop(1, stripes[2]);
  // Glow (the Glow look slider): a soft magenta halo behind the striped
  // fill only, so the 3D offsets stay crisp. 0 keeps the original title.
  const glowAmt = state.glowAmount ?? 0;
  if (glowAmt > 0) {
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.28 * (glowAmt / 50);
  }
  ctx.fillStyle = g;
  ctx.fillText(title, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Neon script subtitle in Pacifico, tucked between the title and the
// tagline ribbon, with a dark outline so it reads over the bright sun.
export function drawScriptSubtitle(ctx, W, H, state) {
  const script = (state.script || '').trim();
  if (!script) return;
  const size = Math.max(16, H * 0.032);
  ctx.save();
  ctx.font = `400 ${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.translate(W / 2, H * 0.872);
  ctx.rotate(-0.02);
  ctx.strokeStyle = '#14082e';
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.strokeText(script, 0, 0);
  ctx.fillStyle = '#ff7ad9';
  ctx.fillText(script, 0, 0);
  ctx.restore();
}

// Role tag on a panel: a small black ribbon with a gold label at the
// panel's bottom-left corner, like a magazine cover's character names.
function drawRoleTag(ctx, rect, tag, u) {
  const label = (tag || '').toUpperCase();
  if (!label) return;
  const size = Math.max(11, Math.min(rect.w * 0.075, rect.h * 0.085));
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, size * 0.12)}px`; } catch { /* older canvas */ }
  const tw = ctx.measureText(label).width;
  const padX = size * 0.7;
  const padY = size * 0.42;
  const tagW = tw + padX * 2;
  const tagH = size + padY * 2;
  const tx = rect.x + Math.max(4, u * 6);
  const ty = rect.y + rect.h - tagH - Math.max(4, u * 6);
  ctx.fillStyle = 'rgba(12, 5, 26, 0.82)';
  ctx.fillRect(tx, ty, tagW, tagH);
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx + padX, ty + tagH / 2 + size * 0.04);
  ctx.restore();
}

// Top bar: five gold stars and a press quote on the left, a VOL. pill on
// the right. All original wording, no borrowed review text.
function drawTopBar(ctx, W, H, grade) {
  const u = W / 1080;
  const y = H * 0.021;
  const starSize = Math.max(13, H * 0.02);
  ctx.save();
  ctx.textBaseline = 'middle';
  // Stars.
  ctx.font = `${starSize}px sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'left';
  ctx.fillText('★★★★★', W * 0.03, y);
  const starsW = ctx.measureText('★★★★★').width;
  // Press quote.
  const quoteSize = Math.max(11, H * 0.017);
  ctx.font = `600 ${quoteSize}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, quoteSize * 0.14)}px`; } catch { /* older canvas */ }
  ctx.fillStyle = '#f5eefc';
  ctx.fillText('“A SUNSET YOU CAN PLAY” — THE COASTLINE TIMES', W * 0.03 + starsW + u * 14, y);
  // VOL. pill at the top-right.
  const pillText = 'VOL. 01';
  const pillSize = Math.max(11, H * 0.017);
  ctx.font = `600 ${pillSize}px Oswald, sans-serif`;
  const pillW = ctx.measureText(pillText).width + u * 28;
  const pillH = pillSize + H * 0.012;
  const px = W * 0.97 - pillW;
  const py = y - pillH / 2;
  ctx.strokeStyle = 'rgba(245, 238, 252, 0.85)';
  ctx.lineWidth = Math.max(1.5, u * 1.5);
  ctx.strokeRect(px, py, pillW, pillH);
  ctx.fillStyle = '#f5eefc';
  ctx.textAlign = 'center';
  ctx.fillText(pillText, px + pillW / 2, y + pillSize * 0.04);
  ctx.restore();
}

// "COMING SOON" stamp, tilted over the first panel's top-left corner.
// Centred just inside the panel corner (measured from the text width) so
// it never runs off the canvas on tall covers.
function drawComingSoon(ctx, W, H, rect) {
  const u = W / 1080;
  const size = Math.max(12, Math.min(H * 0.02, W * 0.024));
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, size * 0.18)}px`; } catch { /* older canvas */ }
  const tw = ctx.measureText('COMING SOON').width;
  const padX = size * 0.8;
  const padY = size * 0.45;
  const w = tw + padX * 2;
  const h = size + padY * 2;
  const cx = rect.x + w / 2 + Math.max(4, u * 6);
  const cy = rect.y + h / 2 + Math.max(4, u * 6);
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.fillStyle = 'rgba(12, 5, 26, 0.85)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(2, u * 2);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#ff5e8a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COMING SOON', 0, size * 0.04);
  ctx.restore();
}

// Starburst "ORIGINAL COVER ART" seal at the bottom-right, drawn like a
// sticker over the ribbon edge. Sits just above the credits line so the
// two never overlap.
function drawSeal(ctx, W, H, grade) {
  const u = W / 1080;
  const r = Math.max(26, H * 0.038);
  const cx = W * 0.925;
  const cy = H * 0.925;
  paintStarburst(ctx, cx, cy, r, 14, '#ffd166', '#14082e');
  ctx.save();
  ctx.fillStyle = '#14082e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.max(8, r * 0.2);
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  ctx.fillText('ORIGINAL', cx, cy - size * 0.55);
  ctx.fillText('COVER ART', cx, cy + size * 0.55);
  ctx.restore();
}

// Production-credits footer along the very bottom edge. The text is
// shrunk to fit between the barcode (left) and the seal (right), so it
// never runs off the canvas or under either of them.
function drawCredits(ctx, W, H) {
  const text = 'SUNSET PANELS PRESENTS  •  STARRING THE BOULEVARD QUEEN  •  A GOLDEN HOUR PRODUCTION';
  const maxW = W * 0.72;
  let size = Math.max(9, W * 0.0135);
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, size * 0.16)}px`; } catch { /* older canvas */ }
  while (ctx.measureText(text).width > maxW && size > 8) {
    size -= 0.5;
    ctx.font = `600 ${size}px Oswald, sans-serif`;
  }
  ctx.fillStyle = 'rgba(245, 238, 252, 0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H * 0.972);
  ctx.restore();
}

// Tagline on a translucent black ribbon under the title.
export function drawTaglineRibbon(ctx, W, H, state) {
  const tagline = (state.tagline || '').toUpperCase();
  if (!tagline) return;
  const u = W / 1080;
  const size = Math.max(13, H * 0.03);
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(2, size * 0.22)}px`; } catch { /* older canvas: no letter spacing */ }
  const tw = ctx.measureText(tagline).width;
  const padX = u * 26;
  const padY = H * 0.011;
  const ribbonW = Math.min(W * 0.92, tw + padX * 2);
  const ribbonH = size + padY * 2;
  const rx = (W - ribbonW) / 2;
  const ry = H * 0.895;
  ctx.fillStyle = 'rgba(12, 5, 26, 0.78)';
  ctx.fillRect(rx, ry, ribbonW, ribbonH);
  ctx.fillStyle = state.taglineColor || '#ffd166';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagline, W / 2, ry + ribbonH / 2 + size * 0.04);
  ctx.restore();
}

// Panel rects for a cover of size W x H with the given layout.
// The panel zone is the band the panels live in; the caption zone below it
// holds the sun, palms and lettering.
export function coverPanelRects(W, H, layout) {
  const gutter = Math.max(6, W * 0.012);
  const zone = { x: W * 0.03, y: H * 0.05, w: W * 0.94, h: H * 0.59, gutter };
  return layoutPanels(layout, zone);
}

// The whole poster. `state` carries photos, panels, layout, caption and look.
// Look amounts default to the original render (paint 100, grade 100,
// halftone 0, grain 50, glow 0), so covers drawn before the look sliders
// existed render exactly as they did.
export function renderCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const u = W / 1080;
  const paintS = (state.paintStrength ?? 100) / 100;
  const gradeS = (state.gradeStrength ?? 100) / 100;
  const grainAmt = state.grainAmount ?? (state.grain === false ? 0 : 50);
  const halfAmt = state.halftoneAmount ?? (state.halftone ? 100 : 0);
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  paintSky(ctx, W, H, grade, gradeS);
  paintSun(ctx, W / 2, H * 0.8, H * 0.115, grade);
  paintSkyline(ctx, W, H * 0.7, H, grade, 1234567);
  drawTopBar(ctx, W, H, grade);

  // Photo panels.
  const rects = coverPanelRects(W, H, state.layout);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = state.photos[panel.photo];
    const drawn = photo && photo.image ? drawPanelPhoto(ctx, photo.image, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0, !!panel.flip) : false;
    if (!drawn) drawEmptyPanel(ctx, rect, u);
    else paintPhotoGrade(ctx, rect, grade, paintS);
    drawRoleTag(ctx, rect, panel.tag, u);
    // White poster frame + thin dark inner line.
    const frame = Math.max(3, W * 0.004);
    ctx.lineWidth = frame;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = Math.max(1.5, W * 0.0015);
    ctx.strokeStyle = 'rgba(20, 8, 46, 0.9)';
    ctx.strokeRect(rect.x + frame, rect.y + frame, rect.w - 2 * frame, rect.h - 2 * frame);
  });
  if (rects.length) drawComingSoon(ctx, W, H, rects[0]);

  if (halfAmt > 0) paintHalftone(ctx, W, H * 0.68, H * 0.97, grade, halfAmt / 50);

  // Palm silhouettes framing the caption zone, bases just inside the edges
  // so the trunk and the frond fan read as trees, not stray strokes.
  paintPalm(ctx, W * 0.02, H * 1.0, H * 0.21, 0.16, grade);
  paintPalm(ctx, W * 0.98, H * 1.0, H * 0.19, -0.16, grade);

  drawPosterTitle(ctx, W, H, state, grade);
  drawScriptSubtitle(ctx, W, H, state);
  drawTaglineRibbon(ctx, W, H, state);

  // Bottom band: barcode ticket, seal sticker, credits footer.
  paintBarcode(ctx, W * 0.03, H * 0.935, W * 0.1, H * 0.048, 90210);
  drawSeal(ctx, W, H, grade);
  drawCredits(ctx, W, H);

  if (grainAmt > 0) paintGrain(ctx, W, H, Math.floor((W * H) / 900 * (grainAmt / 50)));
  paintVignette(ctx, W, H);
  ctx.restore();
}

// Render the cover to a fresh canvas at the given size.
export function renderToCanvas(W, H, state) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  renderCover(canvas.getContext('2d'), W, H, state);
  return canvas;
}
