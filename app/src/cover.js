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

// Title styles (the editor's Title style switcher). Stripes is the
// default and renders exactly as the title always has: striped gradient
// fill + 3D offsets + black outline. Smooth keeps the same palette and
// offsets with a solid (unbanded) gradient. Neon outline is a neon tube:
// dark glyph fill (so the letter shapes read over busy photos) + a thick
// gradient stroke + a restrained glow, no 3D offsets.
export const TITLE_STYLES = [
  { id: 'stripes', label: 'Stripes' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'neon', label: 'Neon outline' },
];

// Title fonts (the editor's Title font picker, below the script subtitle).
// All four are OFL-licensed and vendored under app/fonts/. Archivo Black
// is the default, so the cover does not change unless the user picks one.
// Anton and Bebas Neue are the GTA-style options: tall, condensed, heavy
// poster lettering in the spirit of the GTA logo (the actual GTA font,
// Pricedown, is commercial and is NOT used here).
export const TITLE_FONTS = [
  { id: 'Archivo Black', label: 'Archivo Black' },
  { id: 'Anton', label: 'Anton' },
  { id: 'Bebas Neue', label: 'Bebas Neue' },
  { id: 'Oswald', label: 'Oswald' },
];

// Title colour templates (the editor's Colour template picker, below the
// script subtitle). Each preset is a three-stop gradient for the title.
// Sunset is the default and is exactly the striped gradient the cover
// always had (yellow/pink/purple) — do not change it. The other three were
// reworked for readability: their old top stops were near-white (#ff8ac2,
// #a5f3fc, #fef9c3), which washed out against the bright sunset sky, so
// every stop is now a saturated mid-to-deep colour — the title stays
// clearly readable in every font and style, with the dark outline and 3D
// offsets defining the letter shapes.
export const TITLE_TEMPLATES = [
  { id: 'sunset', label: 'Sunset', gradient: ['#ffe066', '#ff2e88', '#a855f7'] },
  { id: 'vice', label: 'Vice', gradient: ['#f472b6', '#db2777', '#7c3aed'] },
  { id: 'neon', label: 'Neon', gradient: ['#22d3ee', '#0891b2', '#c026d3'] },
  { id: 'gold', label: 'Gold', gradient: ['#facc15', '#ea580c', '#7c2d12'] },
];

// Per-photo sub-caption defaults (own wording): location · time · quip,
// shown as the second line under each panel's role tag.
export const PHOTO_SUBCAPTIONS = {
  boulevard: 'PALM ROW · 7:02 PM · NEVER BRAKES FOR SUNSET',
  pier: 'OLD PIER · 5:48 PM · CATCHES MORE THAN FISH',
  rider: 'COAST HIGHWAY · 6:15 PM · OUTRUNS THE DARK',
  boardwalk: 'BOARDWALK · 7:20 PM · KNOWS EVERY DOOR',
  marina: 'YACHT BASIN · 6:58 PM · STEALS EVERY SCENE',
  dusk: 'BACK ALLEY · 8:04 PM · MAKES PROBLEMS VANISH',
};

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', label: '1920 × 1080', w: 1920, h: 1080 },
];

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) || EXPORT_SIZES[2];
}

// Cover-fit transform for a photo in a panel rect (zoom + pan, clamped so
// the photo always covers the rect). Shared by drawPanelPhoto and the hero
// breakout, so the breakout is a seamless continuation of the panel photo.
function photoTransform(image, rect, zoom, ox, oy) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return null;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const maxOx = Math.max(0, (dw - rect.w) / 2);
  const maxOy = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 + ox * maxOx;
  const dy = rect.y + (rect.h - dh) / 2 + oy * maxOy;
  return { dx, dy, dw, dh };
}

// Draw one photo cover-fit inside a panel rect, honouring zoom and pan.
// Pan is clamped so the photo always covers the panel (no empty edges).
// flip mirrors the photo horizontally around the panel's centre.
export function drawPanelPhoto(ctx, image, rect, zoom, ox, oy, flip = false) {
  const t = photoTransform(image, rect, zoom, ox, oy);
  if (!t) return false;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (flip) {
    ctx.translate(rect.x + rect.w, rect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(image, t.dx - rect.x, t.dy - rect.y, t.dw, t.dh);
  } else {
    ctx.drawImage(image, t.dx, t.dy, t.dw, t.dh);
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

// Fit the title font so the text never runs past maxWidth. `font` is the
// title font family from state.titleFont (default 'Archivo Black').
function fitTitleFont(ctx, text, maxWidth, baseSize, font) {
  const family = font || 'Archivo Black';
  let size = baseSize;
  ctx.font = `400 ${size}px "${family}", sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) size = Math.max(size * 0.45, size * (maxWidth / w));
  ctx.font = `400 ${size}px "${family}", sans-serif`;
  return size;
}

// Big condensed title over the photo panels: the masthead IS the poster.
// It sits across the lower third of the panels (~0.63H, ~0.165H tall) with
// the same yellow/pink/purple striped gradient fill, purple 3D offset under
// a magenta offset, black outline, tilted two degrees. Faces stay clear
// because every sample frames its face in the top of its photo.
// `state.titleStyle` picks the fill: 'stripes' (default, striped gradient),
// 'smooth' (same palette and offsets, solid gradient) or 'neon' (neon tube:
// dark glyph fill, thick gradient stroke, restrained glow, no 3D offsets).
export function drawPosterTitle(ctx, W, H, state, grade) {
  const u = W / 1080;
  const title = (state.title || '').toUpperCase();
  if (!title) return;
  const baseSize = H * 0.165 * (state.titleSize || 1);
  const font = TITLE_FONTS.some((f) => f.id === state.titleFont) ? state.titleFont : 'Archivo Black';
  const size = fitTitleFont(ctx, title, W * 0.94, baseSize, font);
  // Colour template wins when set (default 'sunset' = the original
  // yellow/pink/purple); a manual Title-stripes swatch clears the template
  // and falls back to the swatch palette.
  const template = TITLE_TEMPLATES.find((t) => t.id === state.titleTemplate);
  const stripes = template ? template.gradient : (TITLE_GRADIENTS[state.titleColor] || TITLE_GRADIENTS['#ffd166']);
  const style = state.titleStyle || 'stripes';
  ctx.save();
  ctx.translate(W / 2, H * 0.63);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // 3D depth: purple offset, then magenta offset, then the gradient fill.
  // Kept shallow (about one glyph-stroke) so the offsets never reach the
  // role-tag blocks at the panels' bottom edge. Neon outline has no 3D
  // offsets, so the neon tube reads cleanly.
  if (style !== 'neon') {
    ctx.fillStyle = '#7b2ff7';
    ctx.fillText(title, u * 8, u * 10);
    ctx.fillStyle = '#ff2e88';
    ctx.fillText(title, u * 4, u * 5);
  }
  const g = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
  if (style === 'stripes') {
    // Banded gradient: hard stops split the palette into three stripes.
    g.addColorStop(0, stripes[0]);
    g.addColorStop(0.33, stripes[0]);
    g.addColorStop(0.34, stripes[1]);
    g.addColorStop(0.66, stripes[1]);
    g.addColorStop(0.67, stripes[2]);
    g.addColorStop(1, stripes[2]);
  } else {
    // Smooth / neon: the same palette as one continuous gradient.
    g.addColorStop(0, stripes[0]);
    g.addColorStop(0.5, stripes[1]);
    g.addColorStop(1, stripes[2]);
  }
  const glowAmt = state.glowAmount ?? 0;
  if (style === 'neon') {
    // Neon tube: a dark glyph fill first, so the letter shapes are solid
    // and readable over busy photos. The fill follows the glyphs exactly
    // (it is fillText with the same font), so the counters read as proper
    // holes inside dark letter bodies instead of one big empty space.
    // Then a thick gradient stroke is the glowing neon tube, with a
    // restrained glow so the shapes stay crisp instead of blurring out.
    if (state.outline !== false) {
      ctx.strokeStyle = '#14082e';
      ctx.lineWidth = Math.max(3, size * 0.17);
      ctx.strokeText(title, 0, 0);
    }
    ctx.fillStyle = '#14082e';
    ctx.fillText(title, 0, 0);
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.12 + (glowAmt > 0 ? size * 0.14 * (glowAmt / 50) : 0);
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.strokeText(title, 0, 0);
    ctx.shadowBlur = 0;
  } else {
    // Black outline, then the gradient fill (striped or smooth).
    if (state.outline !== false) {
      ctx.strokeStyle = '#14082e';
      ctx.lineWidth = Math.max(3, size * 0.14);
      ctx.strokeText(title, 0, 0);
    }
    // Glow (the Glow look slider): a soft magenta halo behind the fill
    // only, so the 3D offsets stay crisp. 0 keeps the original title.
    if (glowAmt > 0) {
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = size * 0.28 * (glowAmt / 50);
    }
    ctx.fillStyle = g;
    ctx.fillText(title, 0, 0);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// Neon script subtitle in Pacifico, overlapping the title's lower edge
// (just under the masthead's 3D shadow), with a dark outline so it reads
// over the bright photos. It sits above the role-tag blocks, which start
// at the panels' bottom edge.
export function drawScriptSubtitle(ctx, W, H, state) {
  const script = (state.script || '').trim();
  if (!script) return;
  const size = Math.max(16, H * 0.03);
  ctx.save();
  ctx.font = `400 ${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.translate(W / 2, H * 0.705);
  ctx.rotate(-0.02);
  ctx.strokeStyle = '#14082e';
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.strokeText(script, 0, 0);
  ctx.fillStyle = '#ff7ad9';
  ctx.fillText(script, 0, 0);
  ctx.restore();
}

// Role tag on a panel: a small black block at the panel's bottom-left
// corner, like a magazine cover's character names — the gold role name on
// top, the sub-caption (location · time · quip) in smaller pale type
// underneath. The block is kept tight (tag capped, sub shrunk to fit the
// panel width) so it stays clear of the masthead overlapping the panels
// above it. `sub` falls back to the photo's built-in sub-caption.
function drawRoleTag(ctx, rect, tag, sub, u) {
  const label = (tag || '').toUpperCase();
  const subLine = (sub || '').toUpperCase();
  if (!label && !subLine) return null;
  const size = Math.max(11, Math.min(rect.w * 0.075, rect.h * 0.085, u * 20));
  const padX = size * 0.7;
  const padTop = size * 0.3;
  const padBottom = size * 0.3;
  const tagH = size + padTop + padBottom;
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, size * 0.12)}px`; } catch { /* older canvas */ }
  const tagW = label ? ctx.measureText(label).width : 0;
  // Sub-caption: shrink until the block fits inside the panel.
  let subSize = Math.max(9, size * 0.58);
  let subW = 0;
  if (subLine) {
    ctx.font = `600 ${subSize}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(0.5, subSize * 0.08)}px`; } catch { /* older canvas */ }
    subW = ctx.measureText(subLine).width;
    while (subW + padX * 2 > rect.w - u * 8 && subSize > 8) {
      subSize -= 0.5;
      ctx.font = `600 ${subSize}px Oswald, sans-serif`;
      subW = ctx.measureText(subLine).width;
    }
  }
  const subH = subLine ? subSize * 1.3 + size * 0.12 : 0;
  const blockW = Math.max(tagW, subW) + padX * 2;
  const blockH = tagH + subH;
  const tx = rect.x + Math.max(4, u * 6);
  const ty = rect.y + rect.h - blockH - Math.max(4, u * 6);
  ctx.fillStyle = 'rgba(12, 5, 26, 0.82)';
  ctx.fillRect(tx, ty, blockW, blockH);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (label) {
    ctx.font = `600 ${size}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(1, size * 0.12)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffd166';
    ctx.fillText(label, tx + padX, ty + padTop + size / 2 + size * 0.04);
  }
  if (subLine) {
    ctx.font = `600 ${subSize}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(0.5, subSize * 0.08)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(245, 238, 252, 0.92)';
    ctx.fillText(subLine, tx + padX, ty + tagH + subH / 2);
  }
  ctx.restore();
  return { x: tx, y: ty, w: blockW, h: blockH };
}

// "WANTED ★★★★★" pill on a panel's top-right corner: gold pill, dark
// text, like a magazine's most-wanted badge. Drawn on one panel only
// (panel.wanted), up in the sky corner so it never covers a face.
function drawWantedPill(ctx, rect, u) {
  const size = Math.max(10, Math.min(rect.w * 0.05, rect.h * 0.055));
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.max(1, size * 0.1)}px`; } catch { /* older canvas */ }
  const label = 'WANTED ★★★★★';
  const tw = ctx.measureText(label).width;
  const padX = size * 0.7;
  const padY = size * 0.35;
  const w = tw + padX * 2;
  const h = size + padY * 2;
  const tx = rect.x + rect.w - w - Math.max(4, u * 6);
  const ty = rect.y + Math.max(4, u * 6);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(tx, ty, w, h);
  ctx.strokeStyle = '#14082e';
  ctx.lineWidth = Math.max(1.5, u * 1.5);
  ctx.strokeRect(tx, ty, w, h);
  ctx.fillStyle = '#14082e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx + padX, ty + h / 2 + size * 0.04);
  ctx.restore();
  return { x: tx, y: ty, w, h };
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
  const r = Math.max(26, H * 0.034);
  const cx = W * 0.925;
  const cy = H * 0.905;
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
  const ry = H * 0.825;
  ctx.fillStyle = 'rgba(12, 5, 26, 0.78)';
  ctx.fillRect(rx, ry, ribbonW, ribbonH);
  ctx.fillStyle = state.taglineColor || '#ffd166';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagline, W / 2, ry + ribbonH / 2 + size * 0.04);
  ctx.restore();
}

// Hero breakout ("pop-out hero"): the hero panel's photo continues past
// its frame by ~8% — to the right, over the neighbouring panels, or down
// when the hero already spans the full width (the banner layout) — with a
// soft drop shadow and the same white poster frame, so it reads as a
// layered cut-out overlapping its neighbours. Only the strip outside the
// hero frame is drawn (the panel itself is untouched), and the strip is
// capped at the photo's own cover-fit edge, so it never shows an empty
// band: the image continues seamlessly out of its frame. The strip is
// drawn after the panels but BEFORE the title and script: the masthead
// spans the full cover width, so a rectangular spill drawn above it would
// hide the left half of the title. The title and script therefore stay
// fully legible on top, and the spill reads behind them exactly like a
// poster printed over its photos. True background-removal cut-out is not
// possible offline (no segmentation model in the app); this breakout is
// the verifiable approximation. Returns the strip rect (or null) so
// renderCover can re-draw any role tag or pill it overlaps.
function drawHeroBreakout(ctx, W, H, state, rects, grade, paintS) {
  if (state.popout === false) return null;
  const hero = state.panels[0];
  const photo = hero && state.photos[hero.photo];
  const heroRect = rects[0];
  if (!hero || !photo || !photo.image || !heroRect) return null;
  const t = photoTransform(photo.image, heroRect, hero.zoom || 1, hero.ox || 0, hero.oy || 0);
  if (!t) return null;
  const u = W / 1080;
  const zoneRight = Math.max(...rects.map((r) => r.x + r.w));
  const zoneBottom = Math.max(...rects.map((r) => r.y + r.h));
  // The strip outside the hero frame, and which of its edges is shared
  // with the hero frame (that edge keeps the hero's own frame lines).
  let strip;
  let shared;
  if (heroRect.x + heroRect.w * 1.08 <= zoneRight + 1) {
    const right = Math.min(heroRect.x + heroRect.w * 1.08, t.dx + t.dw);
    if (right <= heroRect.x + heroRect.w + u * 4) return null;
    strip = { x: heroRect.x + heroRect.w, y: heroRect.y, w: right - (heroRect.x + heroRect.w), h: heroRect.h };
    shared = 'left';
  } else if (heroRect.y + heroRect.h * 1.08 <= zoneBottom + 1) {
    const bottom = Math.min(heroRect.y + heroRect.h * 1.08, t.dy + t.dh);
    if (bottom <= heroRect.y + heroRect.h + u * 4) return null;
    strip = { x: heroRect.x, y: heroRect.y + heroRect.h, w: heroRect.w, h: bottom - (heroRect.y + heroRect.h) };
    shared = 'top';
  } else {
    return null;
  }
  // Soft drop shadow, clipped so it never falls on the hero panel itself:
  // it lands on the neighbouring panels the strip overlaps.
  ctx.save();
  ctx.beginPath();
  if (shared === 'left') ctx.rect(strip.x, 0, W - strip.x, H);
  else ctx.rect(0, strip.y, W, H - strip.y);
  ctx.clip();
  ctx.shadowColor = 'rgba(20, 8, 46, 0.55)';
  ctx.shadowBlur = Math.max(6, u * 16);
  ctx.shadowOffsetX = u * 6;
  ctx.shadowOffsetY = u * 8;
  ctx.fillStyle = '#14082e';
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.restore();
  // The same photo, same transform, clipped to the strip: the image
  // continues seamlessly out of its frame.
  ctx.save();
  ctx.beginPath();
  ctx.rect(strip.x, strip.y, strip.w, strip.h);
  ctx.clip();
  if (hero.flip) {
    ctx.translate(heroRect.x + heroRect.w, heroRect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(photo.image, t.dx - heroRect.x, t.dy - heroRect.y, t.dw, t.dh);
  } else {
    ctx.drawImage(photo.image, t.dx, t.dy, t.dw, t.dh);
  }
  ctx.restore();
  paintPhotoGrade(ctx, strip, grade, paintS);
  // White poster frame around the strip; the thin dark inner line runs
  // along the three outer edges only, so it never doubles the hero's own
  // frame on the shared edge.
  const frame = Math.max(3, W * 0.004);
  ctx.save();
  ctx.lineWidth = frame;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(strip.x, strip.y, strip.w, strip.h);
  ctx.lineWidth = Math.max(1.5, W * 0.0015);
  ctx.strokeStyle = 'rgba(20, 8, 46, 0.9)';
  ctx.beginPath();
  const ix = strip.x + frame;
  const iy = strip.y + frame;
  const iw = strip.w - 2 * frame;
  const ih = strip.h - 2 * frame;
  if (shared === 'left') {
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + iw, iy);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.lineTo(ix, iy + ih);
  } else {
    ctx.moveTo(ix, iy + ih);
    ctx.lineTo(ix, iy);
    ctx.lineTo(ix + iw, iy);
    ctx.lineTo(ix + iw, iy + ih);
  }
  ctx.stroke();
  ctx.restore();
  return strip;
}

// Panel rects for a cover of size W x H with the given layout.
// The panel zone now runs to 0.80H so the photos fill most of the poster
// and the masthead can overlap their lower third; the footer band below
// it holds only the tagline ribbon, barcode, seal and credits.
export function coverPanelRects(W, H, layout) {
  const gutter = Math.max(6, W * 0.012);
  const zone = { x: W * 0.03, y: H * 0.05, w: W * 0.94, h: H * 0.75, gutter };
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
  paintSun(ctx, W / 2, H * 0.82, H * 0.11, grade);
  // Thin skyline footer strip at the very bottom (clipped so only the
  // towers' bases show), not the tall black band that used to cut the
  // cover in two.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H * 0.945, W, H * 0.055);
  ctx.clip();
  paintSkyline(ctx, W, H * 0.995, H, grade, 1234567);
  ctx.restore();
  drawTopBar(ctx, W, H, grade);

  // Photo panels. Role tags and WANTED pills are remembered so the hero
  // breakout (drawn next) can put back any it overlaps.
  const rects = coverPanelRects(W, H, state.layout);
  const overlays = [];
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = state.photos[panel.photo];
    const drawn = photo && photo.image ? drawPanelPhoto(ctx, photo.image, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0, !!panel.flip) : false;
    if (!drawn) drawEmptyPanel(ctx, rect, u);
    else paintPhotoGrade(ctx, rect, grade, paintS);
    const tagRect = drawRoleTag(ctx, rect, panel.tag, panel.sub || (photo && PHOTO_SUBCAPTIONS[photo.name]) || '', u);
    if (tagRect) overlays.push({ kind: 'tag', rect: tagRect, panelIndex: i });
    const pillRect = panel.wanted ? drawWantedPill(ctx, rect, u) : null;
    if (pillRect) overlays.push({ kind: 'pill', rect: pillRect, panelIndex: i });
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

  // Hero breakout strip over the neighbouring panels; any role tag or pill
  // it covers is re-drawn on top so no tag text or badge is ever clipped.
  const breakout = drawHeroBreakout(ctx, W, H, state, rects, grade, paintS);
  if (breakout) {
    const hits = (r) => r.x < breakout.x + breakout.w && r.x + r.w > breakout.x && r.y < breakout.y + breakout.h && r.y + r.h > breakout.y;
    overlays.forEach((job) => {
      if (!hits(job.rect)) return;
      const panel = state.panels[job.panelIndex] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
      const rect = rects[job.panelIndex];
      const photo = state.photos[panel.photo];
      if (job.kind === 'tag') drawRoleTag(ctx, rect, panel.tag, panel.sub || (photo && PHOTO_SUBCAPTIONS[photo.name]) || '', u);
      else drawWantedPill(ctx, rect, u);
    });
  }

  if (halfAmt > 0) paintHalftone(ctx, W, H * 0.81, H * 0.97, grade, halfAmt / 50);

  // Palm silhouettes framing the footer band, bases just inside the edges
  // so the trunk and the frond fan read as trees, not stray strokes.
  paintPalm(ctx, W * 0.02, H * 1.0, H * 0.12, 0.16, grade);
  paintPalm(ctx, W * 0.98, H * 1.0, H * 0.12, -0.16, grade);

  // Soft sun glow behind the masthead so the title reads as sitting in
  // front of the low sun, even though the sun itself is behind the panels.
  const glow = ctx.createRadialGradient(W / 2, H * 0.63, 0, W / 2, H * 0.63, Math.max(W, H) * 0.36);
  glow.addColorStop(0, grade.sunGlow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.27, W, H * 0.72);
  ctx.restore();

  drawPosterTitle(ctx, W, H, state, grade);
  drawScriptSubtitle(ctx, W, H, state);
  drawTaglineRibbon(ctx, W, H, state);

  // Bottom band: barcode ticket, seal sticker, credits footer.
  paintBarcode(ctx, W * 0.03, H * 0.885, W * 0.1, H * 0.045, 90210);
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
