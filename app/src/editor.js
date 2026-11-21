// Sunset Panels — the editor.
// Wires the controls (photos, layout, per-panel crop, caption, look, export),
// keeps a live preview canvas, and serves the fixed ?shot= scenes the
// screenshots are taken from. No network: photos come from the file picker or
// the bundled samples, fonts are local files under app/fonts/.

import { LAYOUTS, LAYOUT_IDS } from './layouts.js';
import { GRADES, GRADE_IDS } from './art.js';
import { EXPORT_SIZES, sizeById, renderCover, renderToCanvas, coverPanelRects, PHOTO_SUBCAPTIONS, TITLE_STYLES, TITLE_FONTS, TITLE_TEMPLATES } from './cover.js';

const SAMPLES = [
  { file: 'boulevard.jpg', label: 'Boulevard' },
  { file: 'pier.jpg', label: 'Pier' },
  { file: 'rider.jpg', label: 'Rider' },
  { file: 'boardwalk.jpg', label: 'Boardwalk' },
  { file: 'marina.jpg', label: 'Marina' },
  { file: 'dusk.jpg', label: 'Dusk' },
];
const MAX_PHOTOS = 6;
const TITLE_COLORS = ['#ffffff', '#ffd166', '#2fd6ff', '#ff2e88'];
const PANEL_TAGS = ['THE DRIVER', 'THE ANGLER', 'THE RIDER', 'THE INSIDER', 'THE STARLET', 'THE FIXER'];
// Role tag that follows the photo (used by the fixed shot scenes).
const PHOTO_TAGS = {
  boulevard: 'THE DRIVER',
  pier: 'THE ANGLER',
  rider: 'THE RIDER',
  boardwalk: 'THE INSIDER',
  marina: 'THE STARLET',
  dusk: 'THE FIXER',
};
// Per-sample face centres (fractions of the photo), measured from the
// samples themselves: the face is what the panels must frame. All six
// samples are square (1:1) since the standardisation, cropped face-centred
// from their originals, so they behave identically in every panel.
// Faces sit in the upper part of the photo, centred horizontally except
// the pier (face left).
const PHOTO_FACE = {
  boulevard: { cx: 0.45, cy: 0.36, top: 0.11, bottom: 0.56 },
  pier: { cx: 0.35, cy: 0.20, top: 0.05, bottom: 0.32 },
  rider: { cx: 0.48, cy: 0.50, top: 0.40, bottom: 0.60 },
  boardwalk: { cx: 0.42, cy: 0.45, top: 0.20, bottom: 0.53 },
  marina: { cx: 0.50, cy: 0.47, top: 0.21, bottom: 0.66 },
  dusk: { cx: 0.50, cy: 0.38, top: 0.28, bottom: 0.48 },
};
// Per-sample framing defaults for the fixed shot scenes: zoom and pan
// starting points (autoFramePanels then re-solves the pan from PHOTO_FACE
// and PHOTO_SUBJECT). Rider and Dusk use zoom 1.0 — their subjects are
// tall (rider: face + legs + bike; dusk: driver + the whole SUV), so any
// extra zoom crops the subject out of the panel.
const PHOTO_FRAMING = {
  boulevard: { zoom: 1.15, ox: 0, oy: 0.85 },
  pier: { zoom: 1.15, ox: 0, oy: 0.85 },
  rider: { zoom: 1.0, ox: 0, oy: 0 },
  boardwalk: { zoom: 1.15, ox: 0, oy: 0.85 },
  marina: { zoom: 1.15, ox: 0, oy: 0.85 },
  dusk: { zoom: 1.0, ox: 0, oy: 0 },
};

// Per-sample subject ranges (fractions of the photo, vertical): the part
// that must stay visible in every panel — not just the face. Rider's
// subject is face + legs + bike (the old framing panned up to the face and
// cropped the legs out of the panel, so the regenerated photo looked no
// different from the old one); Dusk's subject is the driver + the whole
// SUV (the old framing cropped the car's roof and lower body). Samples
// without an entry here fall back to their face range (PHOTO_FACE top /
// bottom), which is what the framing used before.
const PHOTO_SUBJECT = {
  rider: { top: 0.40, bottom: 0.96 },
  dusk: { top: 0.12, bottom: 0.98 },
};

export const state = {
  layout: 'hero-split',
  photos: [],
  panels: [
    { photo: 0, zoom: 1.15, ox: 0, oy: 0, tag: 'THE DRIVER', sub: PHOTO_SUBCAPTIONS.boulevard, wanted: false, flip: false },
    { photo: 1, zoom: 1.15, ox: 0, oy: 0, tag: 'THE ANGLER', sub: PHOTO_SUBCAPTIONS.pier, wanted: true, flip: false },
    { photo: 2, zoom: 1.15, ox: 0, oy: 0, tag: 'THE RIDER', sub: PHOTO_SUBCAPTIONS.rider, wanted: false, flip: false },
    { photo: 3, zoom: 1.15, ox: 0, oy: 0, tag: 'THE INSIDER', sub: PHOTO_SUBCAPTIONS.boardwalk, wanted: false, flip: false },
    { photo: 4, zoom: 1.15, ox: 0, oy: 0, tag: 'THE STARLET', sub: PHOTO_SUBCAPTIONS.marina, wanted: false, flip: false },
  ],
  title: 'SUNSET BOULEVARD',
  tagline: 'EVERY SUNSET HAS A PRICE',
  script: 'chasing the golden hour',
  titleColor: '#ffd166',
  taglineColor: '#ffd166',
  titleSize: 1,
  titleStyle: 'stripes',
  titleFont: 'Archivo Black',
  titleTemplate: 'sunset',
  outline: true,
  // Pop-out hero (default ON): the hero photo breaks ~8% out of its frame
  // over the neighbouring panels, with a drop shadow and a white edge.
  popout: true,
  // Look amounts (0–100). Defaults reproduce the pre-slider render exactly:
  // full paint + grade, no halftone, medium grain, no title glow.
  paintStrength: 100,
  gradeStrength: 100,
  halftoneAmount: 0,
  grainAmount: 50,
  glowAmount: 0,
  grade: 'sunset',
  previewSize: 'landscape',
};

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const statusEl = $('status');
let previewQueued = false;
let dragPanel = null;
let dragLast = null;

// --- history (undo/redo) --------------------------------------------------
// Snapshots hold only the serialisable editor state: panels carry photo
// indices (never the Image objects), so a snapshot is a plain deep copy.
// The undo stack's top is always the current state; undo pops it onto the
// redo stack and applies the new top. commitHistory() is called after every
// completed edit (button click, slider release, drag end, debounced typing).
const HISTORY_FIELDS = ['layout', 'popout', 'title', 'tagline', 'script', 'titleColor', 'taglineColor', 'titleSize', 'titleStyle', 'titleFont', 'titleTemplate', 'outline', 'paintStrength', 'gradeStrength', 'halftoneAmount', 'grainAmount', 'glowAmount', 'grade'];
const undoStack = [];
const redoStack = [];
function snapshotState() {
  const snap = { panels: state.panels.map((p) => ({ ...p })) };
  HISTORY_FIELDS.forEach((k) => { snap[k] = state[k]; });
  return snap;
}
function applySnapshot(snap) {
  HISTORY_FIELDS.forEach((k) => { if (snap[k] !== undefined) state[k] = snap[k]; });
  if (snap.panels) state.panels = snap.panels.map((p) => ({ ...p }));
  syncAllControls();
  schedulePreview();
}
function commitHistory() {
  const snap = snapshotState();
  const top = undoStack[undoStack.length - 1];
  if (top && JSON.stringify(top) === JSON.stringify(snap)) return;
  undoStack.push(snap);
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}
function undoHistory() {
  if (undoStack.length < 2) return false;
  redoStack.push(undoStack.pop());
  applySnapshot(undoStack[undoStack.length - 1]);
  updateHistoryButtons();
  return true;
}
function redoHistory() {
  if (!redoStack.length) return false;
  const snap = redoStack.pop();
  undoStack.push(snap);
  applySnapshot(snap);
  updateHistoryButtons();
  return true;
}
function updateHistoryButtons() {
  const undoBtn = $('undo-btn');
  const redoBtn = $('redo-btn');
  if (undoBtn) undoBtn.disabled = undoStack.length < 2;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}
// Typing commits once, 500 ms after the last keystroke, so one edit is
// one undo step instead of one step per character.
let commitTimer = null;
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commitHistory, 500);
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// --- photos ---------------------------------------------------------------

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

async function loadSample(name) {
  const sample = SAMPLES.find((s) => s.file.startsWith(name)) || SAMPLES[0];
  const image = await loadImage(`samples/${sample.file}`);
  return { image, label: sample.label, source: 'sample', name: sample.file.replace('.jpg', '') };
}

async function loadDefaultPhotos() {
  const loaded = await Promise.all(SAMPLES.map((s) => loadSample(s.file.replace('.jpg', ''))));
  state.photos = loaded;
  rebuildPhotoSlots();
  rebuildPanelPhotoOptions();
}

function addPhoto(photo) {
  if (state.photos.length >= MAX_PHOTOS) {
    state.photos[MAX_PHOTOS - 1] = photo;
    setStatus(`Replaced photo ${MAX_PHOTOS} with ${photo.label}.`);
  } else {
    state.photos.push(photo);
    setStatus(`Added ${photo.label} as photo ${state.photos.length}.`);
  }
  rebuildPhotoSlots();
  rebuildPanelPhotoOptions();
  schedulePreview();
  commitHistory();
}

// --- preview --------------------------------------------------------------

function previewDimensions() {
  const size = sizeById(state.previewSize);
  const maxSide = 880;
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

export function renderPreview() {
  const dims = previewDimensions();
  if (preview.width !== dims.w || preview.height !== dims.h) {
    preview.width = dims.w;
    preview.height = dims.h;
  }
  renderCover(preview.getContext('2d'), dims.w, dims.h, state);
}

export function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => {
    previewQueued = false;
    renderPreview();
  });
}

function previewPanelRects() {
  return coverPanelRects(preview.width, preview.height, state.layout);
}

// Frame every panel's subject for the current layout at the current render
// size. Three rules, all driven by the measured face position (PHOTO_FACE)
// and the subject range (PHOTO_SUBJECT — the part that must stay visible,
// e.g. Rider's legs + bike, Dusk's whole SUV):
// - Horizontal: when the panel crops the photo sideways, pan so the face
//   centre lands in the middle of the panel (the rider's face sits on
//   the right of his photo, the angler's on the left — a centred crop
//   cuts both off).
// - Vertical: centre the SUBJECT in the panel (not just the face), so a
//   tall subject reads whole instead of being cropped at the panel's
//   bottom edge. If the subject is taller than the panel at the current
//   zoom, pull the zoom back until it fits (never below 1.0, which is
//   cover-fit — any lower would leave empty edges).
// - Title: when the panel runs under the masthead, the whole face must
//   sit clear of it — so if there is not enough vertical overflow to pan
//   the face above the title, zoom in (capped at 1.8) until there is,
//   then pan up just enough to bring the face's bottom to the title's
//   top edge. (The old rule centred the face in the clear strip, which
//   shoved the photo so far up that Rider's legs and Dusk's car fell
//   off the panel's bottom edge entirely; and the first version of this
//   fix only cleared the face's top, which still left the face hidden
//   behind the title in a small panel where the photo exactly fills
//   the panel height and cannot be panned at all.)
// Only ever called at setup (boot / shot scene), never during a render —
// the user can still drag any panel wherever they want afterwards.
function autoFramePanels(W, H) {
  const rects = coverPanelRects(W, H, state.layout);
  // Top edge of the masthead's glyphs (centre 0.63H minus half the cap
  // height, ~0.36 of the 0.175H title size, scaled by the title-size
  // slider), minus the outline, which extends a further 0.14 of the
  // title size above the glyphs. The 3D offsets only extend downwards.
  // (The outline matters: a face whose chin sits under it reads as
  // covered by the title even though it clears the glyph top.)
  const titleTop = H * (0.63 - 0.0875 * (state.titleSize || 1));
  state.panels.forEach((panel, i) => {
    const rect = rects[i];
    const photo = state.photos[panel.photo];
    if (!rect || !photo || !photo.image) return;
    const iw = photo.image.naturalWidth || photo.image.width;
    const ih = photo.image.naturalHeight || photo.image.height;
    if (!iw || !ih) return;
    const face = PHOTO_FACE[photo.name];
    const subject = PHOTO_SUBJECT[photo.name] || (face ? { top: face.top, bottom: face.bottom } : null);
    // Horizontal: centre the face when the photo is cropped sideways.
    let base = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
    let dw = iw * base;
    let dh = ih * base;
    if (face && dw > rect.w + 1) {
      const maxOx = (dw - rect.w) / 2;
      const dxTarget = rect.w / 2 - face.cx * dw;
      panel.ox = Math.max(-1, Math.min(1, (dxTarget - (rect.w - dw) / 2) / maxOx));
    }
    if (!subject) {
      // No measured face/subject (e.g. an upload): keep the old
      // pan-up-to-the-top rule.
      if (dh > rect.h + 1) panel.oy = Math.max(panel.oy, 0.85);
      return;
    }
    // The subject is taller than the panel at this zoom: pull the zoom
    // back until the subject fits (never below cover-fit, zoom 1.0).
    const subjH = (subject.bottom - subject.top) * dh;
    if (subjH > rect.h) {
      panel.zoom = Math.max(1, (panel.zoom || 1) * (rect.h / subjH));
      base = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
      dw = iw * base;
      dh = ih * base;
    }
    // Title: a panel under the masthead must keep the whole face above
    // the title. Panning up only works if the photo is taller than the
    // panel (dh > rect.h); when it exactly fills the panel there is
    // nothing to pan with, so zoom in (capped at 1.8) until the face
    // can be panned clear. The zoom needed is the one where the face's
    // bottom lands on the title's top edge at maximum pan-up.
    const underTitle = rect.y < titleTop && rect.y + rect.h > titleTop;
    if (underTitle && face) {
      const T = titleTop - rect.y; // title top edge, in panel coords
      const dhNeed = (rect.h - T) / (1 - face.bottom);
      // Never zoom so far that the subject stops fitting in the panel:
      // if the face cannot fully clear the title and keep the subject
      // whole, keep the subject whole and let the title cover the chin.
      const dhMaxSubj = rect.h / (subject.bottom - subject.top);
      const dhTarget = Math.min(dhNeed, dhMaxSubj);
      if (dh < dhTarget) {
        panel.zoom = Math.min(1.8, (panel.zoom || 1) * (dhTarget / dh));
        base = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
        dw = iw * base;
        dh = ih * base;
        // The zoom-in may have re-cropped the photo sideways: re-centre
        // the face horizontally.
        if (dw > rect.w + 1) {
          const maxOx = (dw - rect.w) / 2;
          const dxTarget = rect.w / 2 - face.cx * dw;
          panel.ox = Math.max(-1, Math.min(1, (dxTarget - (rect.w - dw) / 2) / maxOx));
        }
      }
    }
    // Vertical: centre the subject in the panel. dy is where the photo's
    // top edge lands relative to the panel's top edge; oy maps it into
    // the clamped pan range.
    const maxOy = Math.max(0, (dh - rect.h) / 2);
    if (maxOy <= 0) { panel.oy = 0; return; }
    const subjCy = (subject.top + subject.bottom) / 2;
    let dy = rect.h / 2 - subjCy * dh;
    // Title guard: pan up just enough to bring the face's bottom to the
    // title's top edge, so the whole face sits clear of the masthead.
    if (underTitle && face) {
      const T = titleTop - rect.y;
      const dyMax = T - face.bottom * dh;
      if (dy > dyMax) dy = dyMax;
    }
    panel.oy = Math.max(-1, Math.min(1, (dy - (rect.h - dh) / 2) / maxOy));
  });
}

// Drag on the preview to pan the photo inside the panel under the pointer.
function pointerToCanvas(event) {
  const rect = preview.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (preview.width / rect.width),
    y: (event.clientY - rect.top) * (preview.height / rect.height),
  };
}

preview.addEventListener('pointerdown', (event) => {
  const p = pointerToCanvas(event);
  const rects = previewPanelRects();
  const hit = rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  if (hit < 0) return;
  dragPanel = hit;
  dragLast = p;
  preview.setPointerCapture(event.pointerId);
});

preview.addEventListener('pointermove', (event) => {
  if (dragPanel === null || !dragLast) return;
  const p = pointerToCanvas(event);
  const rects = previewPanelRects();
  const rect = rects[dragPanel];
  const panel = state.panels[dragPanel];
  panel.ox = Math.max(-1, Math.min(1, panel.ox + (p.x - dragLast.x) / (rect.w * 0.5)));
  panel.oy = Math.max(-1, Math.min(1, panel.oy + (p.y - dragLast.y) / (rect.h * 0.5)));
  dragLast = p;
  syncPanelControls();
  schedulePreview();
});

preview.addEventListener('pointerup', () => { if (dragPanel !== null) commitHistory(); dragPanel = null; dragLast = null; });
preview.addEventListener('pointercancel', () => { dragPanel = null; dragLast = null; });

// --- controls -------------------------------------------------------------

function buttonRow(container, items, current, onPick) {
  container.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick' + (item.id === current ? ' picked' : '');
    button.textContent = item.label;
    if (item.title) button.title = item.title;
    button.addEventListener('click', () => {
      onPick(item.id);
      buttonRow(container, items, item.id, onPick);
      schedulePreview();
    });
    container.appendChild(button);
  });
}

function buildLayoutPicker() {
  buttonRow(
    $('layout-pick'),
    LAYOUT_IDS.map((id) => ({ id, label: LAYOUTS[id].label, title: LAYOUTS[id].blurb })),
    state.layout,
    (id) => {
      state.layout = id;
      buildPanelControls();
      rebuildPanelPhotoOptions();
      commitHistory();
    },
  );
}

function buildGradePicker() {
  buttonRow(
    $('grade-pick'),
    GRADE_IDS.map((id) => ({ id, label: GRADES[id].label })),
    state.grade,
    (id) => { state.grade = id; commitHistory(); },
  );
}

function buildTitleStylePicker() {
  buttonRow(
    $('title-style-pick'),
    TITLE_STYLES.map((s) => ({ id: s.id, label: s.label })),
    state.titleStyle || 'stripes',
    (id) => { state.titleStyle = id; commitHistory(); },
  );
}

function buildTitleFontPicker() {
  buttonRow(
    $('title-font-pick'),
    TITLE_FONTS.map((f) => ({ id: f.id, label: f.label })),
    state.titleFont || 'Archivo Black',
    (id) => { state.titleFont = id; commitHistory(); },
  );
}

function buildTitleTemplates() {
  buttonRow(
    $('title-template-pick'),
    TITLE_TEMPLATES.map((t) => ({ id: t.id, label: t.label })),
    state.titleTemplate || 'sunset',
    (id) => { state.titleTemplate = id; commitHistory(); },
  );
}

function buildTitleColors() {
  const box = $('title-colors');
  box.innerHTML = '';
  TITLE_COLORS.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch' + (color === state.titleColor ? ' picked' : '');
    swatch.style.background = color;
    swatch.setAttribute('aria-label', `Title colour ${color}`);
    swatch.addEventListener('click', () => {
      state.titleColor = color;
      // A manual swatch pick overrides the colour template.
      state.titleTemplate = null;
      buildTitleColors();
      buildTitleTemplates();
      schedulePreview();
      commitHistory();
    });
    box.appendChild(swatch);
  });
}

function rebuildPhotoSlots() {
  const box = $('photo-slots');
  box.innerHTML = '';
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (state.photos[i] ? '' : ' empty');
    slot.textContent = state.photos[i] ? `${i + 1}. ${state.photos[i].label}` : `${i + 1}. —`;
    box.appendChild(slot);
  }
}

function panelPhotoOptions(panelIndex) {
  const select = document.querySelector(`#panel-${panelIndex} select`);
  if (!select) return;
  const current = state.panels[panelIndex].photo;
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Photo ${i + 1} — ${photo.label}`;
    select.appendChild(option);
  });
  select.value = String(current);
}

function rebuildPanelPhotoOptions() {
  document.querySelectorAll('#panel-controls .panel-group').forEach((group, i) => panelPhotoOptions(i));
}

// One control group per panel of the current layout, with a photo picker,
// crop sliders and an editable role name-tag.
function buildPanelControls() {
  const count = LAYOUTS[state.layout].panelCount;
  const box = $('panel-controls');
  box.innerHTML = '';
  for (let i = 0; i < count; i++) {
    if (!state.panels[i]) {
      state.panels[i] = { photo: i % Math.max(1, state.photos.length), zoom: 1.15, ox: 0, oy: 0, tag: PANEL_TAGS[i] || '', sub: '', wanted: false, flip: false };
    }
    const group = document.createElement('fieldset');
    group.className = 'panel-group';
    group.id = `panel-${i}`;
    const legend = document.createElement('legend');
    legend.textContent = `Panel ${i + 1}`;
    group.appendChild(legend);

    // Flip (mirror this panel) and Swap (exchange this panel with the next).
    const actionRow = document.createElement('div');
    actionRow.className = 'row panel-actions';
    const flipBtn = document.createElement('button');
    flipBtn.type = 'button';
    flipBtn.className = 'mini' + (state.panels[i].flip ? ' picked' : '');
    flipBtn.textContent = 'Flip ↔';
    flipBtn.title = 'Mirror this panel horizontally';
    flipBtn.addEventListener('click', () => {
      flipPanel(i);
      buildPanelControls();
    });
    actionRow.appendChild(flipBtn);
    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'mini';
    swapBtn.textContent = i < count - 1 ? 'Swap →' : 'Swap ↺';
    swapBtn.title = 'Swap this panel with the next one';
    swapBtn.addEventListener('click', () => swapPanels(i));
    actionRow.appendChild(swapBtn);
    group.appendChild(actionRow);

    const photoLabel = document.createElement('label');
    photoLabel.textContent = 'Photo';
    const select = document.createElement('select');
    select.addEventListener('change', () => {
      state.panels[i].photo = Number(select.value);
      // The role tag and sub-caption follow the new photo's defaults.
      const photo = state.photos[state.panels[i].photo];
      if (photo) {
        state.panels[i].tag = PHOTO_TAGS[photo.name] || state.panels[i].tag;
        state.panels[i].sub = PHOTO_SUBCAPTIONS[photo.name] || '';
        const tagInput = group.querySelector('.tag-input');
        if (tagInput) tagInput.value = state.panels[i].tag;
        const subInput = group.querySelector('.sub-input');
        if (subInput) subInput.value = state.panels[i].sub;
      }
      schedulePreview();
      commitHistory();
    });
    photoLabel.appendChild(select);
    group.appendChild(photoLabel);

    const sliders = [
      { key: 'zoom', label: 'Zoom', min: 1, max: 2.5, step: 0.05 },
      { key: 'ox', label: 'Pan left–right', min: -1, max: 1, step: 0.05 },
      { key: 'oy', label: 'Pan up–down', min: -1, max: 1, step: 0.05 },
    ];
    sliders.forEach(({ key, label, min, max, step }) => {
      const sliderLabel = document.createElement('label');
      sliderLabel.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(state.panels[i][key]);
      input.dataset.panel = String(i);
      input.dataset.key = key;
      input.addEventListener('input', () => {
        state.panels[i][key] = Number(input.value);
        schedulePreview();
      });
      input.addEventListener('change', () => commitHistory());
      sliderLabel.appendChild(input);
      group.appendChild(sliderLabel);
    });

    const tagLabel = document.createElement('label');
    tagLabel.textContent = 'Name tag';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.maxLength = 16;
    tagInput.className = 'tag-input';
    tagInput.value = state.panels[i].tag || '';
    tagInput.addEventListener('input', () => {
      state.panels[i].tag = tagInput.value;
      schedulePreview();
      commitSoon();
    });
    tagLabel.appendChild(tagInput);
    group.appendChild(tagLabel);

    // Second line under the role tag: location · time · quip.
    const subLabel = document.createElement('label');
    subLabel.textContent = 'Sub-caption';
    const subInput = document.createElement('input');
    subInput.type = 'text';
    subInput.maxLength = 48;
    subInput.className = 'sub-input';
    subInput.placeholder = 'PLACE · 7:00 PM · QUIP';
    subInput.value = state.panels[i].sub || '';
    subInput.addEventListener('input', () => {
      state.panels[i].sub = subInput.value;
      schedulePreview();
      commitSoon();
    });
    subLabel.appendChild(subInput);
    group.appendChild(subLabel);

    // "WANTED ★★★★★" pill on this panel's top-right corner.
    const wantedLabel = document.createElement('label');
    wantedLabel.className = 'check';
    const wantedInput = document.createElement('input');
    wantedInput.type = 'checkbox';
    wantedInput.checked = !!state.panels[i].wanted;
    wantedInput.addEventListener('change', () => {
      state.panels[i].wanted = wantedInput.checked;
      schedulePreview();
      commitHistory();
    });
    wantedLabel.appendChild(wantedInput);
    wantedLabel.appendChild(document.createTextNode(' Wanted ★★★★★ pill'));
    group.appendChild(wantedLabel);

    box.appendChild(group);
  }
  rebuildPanelPhotoOptions();
}

function syncPanelControls() {
  document.querySelectorAll('#panel-controls input[type=range]').forEach((input) => {
    const panel = state.panels[Number(input.dataset.panel)];
    input.value = String(panel[input.dataset.key]);
  });
}

// --- per-panel flip / swap --------------------------------------------------

// Mirror one panel's photo horizontally.
export function flipPanel(i) {
  const panel = state.panels[i];
  if (!panel) return false;
  panel.flip = !panel.flip;
  commitHistory();
  schedulePreview();
  return panel.flip;
}

// Exchange one panel's photo and settings with the next panel's (wraps
// from the last panel back to the first).
export function swapPanels(i) {
  const count = LAYOUTS[state.layout].panelCount;
  const j = (i + 1) % count;
  if (i === j) return false;
  const tmp = state.panels[i];
  state.panels[i] = state.panels[j];
  state.panels[j] = tmp;
  buildPanelControls();
  commitHistory();
  schedulePreview();
  return true;
}

// --- spread one photo across all panels -----------------------------------
// Five distinct crops of one photo, cycled across the panels: wide (the
// whole photo, face up), face close-up, left detail (face right of centre,
// so more of the photo's left shows), right detail, tight detail. Every
// crop is face-aware: the face centre (PHOTO_FACE, or a generic
// upper-middle guess for an upload with no measured face) is placed at a
// chosen spot in the panel, so no panel shows an empty or face-less crop.
// Short panels that run under the masthead get the face centred in the
// clear strip above the title instead of the panel centre — the same rule
// autoFramePanels uses — so the title never covers a face.
const SPREAD_CROPS = [
  { kind: 'wide', zoom: 1.0, fx: 0.5 },
  { kind: 'face', zoom: 1.7, fx: 0.5 },
  { kind: 'left', zoom: 1.5, fx: 0.7 },
  { kind: 'right', zoom: 1.5, fx: 0.3 },
  { kind: 'tight', zoom: 2.2, fx: 0.5 },
];
const GENERIC_FACE = { cx: 0.5, cy: 0.3, top: 0.1, bottom: 0.4 };

// Pan (ox, oy) that puts the photo's face centre at (fx, fy) of the panel,
// clamped so the photo always covers the panel (the same cover-fit math as
// drawPanelPhoto). fy null means the panel centre, or the centre of the
// clear strip above the masthead when the panel is short and runs under it.
function panFaceTo(rect, photo, zoom, fx, fy, H) {
  const image = photo.image;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return { ox: 0, oy: 0 };
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const face = PHOTO_FACE[photo.name] || GENERIC_FACE;
  let ox = 0;
  let oy = 0;
  if (dw > rect.w + 1) {
    const maxOx = (dw - rect.w) / 2;
    ox = Math.max(-1, Math.min(1, ((fx * rect.w - face.cx * dw) - (rect.w - dw) / 2) / maxOx));
  }
  if (dh > rect.h + 1) {
    const maxOy = (dh - rect.h) / 2;
    let targetY = fy;
    if (targetY === null || targetY === undefined) {
      const titleTop = H * (0.63 - 0.063 * (state.titleSize || 1));
      const underTitle = rect.y < titleTop && rect.y + rect.h > titleTop;
      targetY = underTitle && rect.h < H * 0.45 ? ((titleTop - rect.y) / 2) / rect.h : 0.5;
    }
    oy = Math.max(-1, Math.min(1, ((targetY * rect.h - face.cy * dh) - (rect.h - dh) / 2) / maxOy));
  }
  return { ox, oy };
}

// Spread the FIRST loaded photo across every panel — all five panel
// slots, not just the current layout's — each with a different crop
// (SPREAD_CROPS, cycled). The first photo is the deterministic choice: it
// is photo 1 in the slots, and it is the photo a user with a single photo
// has loaded. Only the photo and its crop change — each panel keeps its
// own role tag, sub-caption and flip — and the whole spread is one undo
// step, so Undo restores the previous panels.
export function spreadOnePhoto(photoIndex = 0) {
  const photo = state.photos[photoIndex];
  if (!photo || !photo.image) {
    setStatus(photoIndex === 0 ? 'Load a photo first, then spread it across the panels.' : 'That photo is not loaded.');
    return false;
  }
  const count = LAYOUTS[state.layout].panelCount;
  const rects = coverPanelRects(preview.width, preview.height, state.layout);
  // Panels beyond the current layout's count get their crops from the
  // ensemble geometry (the layout with the most panels, six), so the
  // spread survives a layout switch: switching layouts still shows the
  // same photo in every panel instead of reviving the old photos in the
  // extra slots.
  const ensRects = state.layout === 'ensemble' ? rects : coverPanelRects(preview.width, preview.height, 'ensemble');
  for (let i = 0; i < state.panels.length; i++) {
    const panel = state.panels[i];
    const rect = i < count ? rects[i] : ensRects[i];
    if (!panel || !rect) continue;
    const crop = SPREAD_CROPS[i % SPREAD_CROPS.length];
    const pan = panFaceTo(rect, photo, crop.zoom, crop.fx, null, preview.height);
    panel.photo = photoIndex;
    panel.zoom = crop.zoom;
    panel.ox = pan.ox;
    panel.oy = pan.oy;
  }
  buildPanelControls();
  commitHistory();
  schedulePreview();
  setStatus(`Spread ${photo.label} across ${count} panel${count === 1 ? '' : 's'} — each with a different crop.`);
  return true;
}

// --- look sliders -----------------------------------------------------------
// Every slider drives a real renderer parameter (see art.js / cover.js):
// Paint = photo grade strength, Grade = sky grade strength, Halftone = dot
// strength, Grain = grain amount, Glow = magenta glow behind the title.
// No dead controls: 0 means the effect is off, 100 is full strength.
const LOOK_SLIDERS = [
  { key: 'paintStrength', label: 'Paint', title: 'Photo grade strength — how strongly the sunset grade tints the photos' },
  { key: 'gradeStrength', label: 'Grade', title: 'Sky grade strength — how strongly the sunset palette colours the sky' },
  { key: 'halftoneAmount', label: 'Halftone', title: 'Halftone dot strength over the caption band' },
  { key: 'grainAmount', label: 'Grain', title: 'Film grain amount' },
  { key: 'glowAmount', label: 'Glow', title: 'Magenta glow behind the title' },
];

function buildLookSliders() {
  const box = $('look-sliders');
  box.innerHTML = '';
  LOOK_SLIDERS.forEach(({ key, label, title }) => {
    const row = document.createElement('label');
    row.className = 'look-row';
    row.title = title;
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(state[key]);
    input.dataset.key = key;
    input.setAttribute('aria-label', `${label} — ${title}`);
    input.addEventListener('input', () => {
      state[key] = Number(input.value);
      schedulePreview();
    });
    input.addEventListener('change', () => commitHistory());
    row.appendChild(name);
    row.appendChild(input);
    box.appendChild(row);
  });
}

// Rebuild every control from state (after undo/redo, surprise, auto layout).
function syncAllControls() {
  buildLayoutPicker();
  buildGradePicker();
  buildTitleColors();
  buildTitleStylePicker();
  buildTitleFontPicker();
  buildTitleTemplates();
  buildPanelControls();
  buildLookSliders();
  syncStaticInputs();
  updateHistoryButtons();
}

function syncStaticInputs() {
  $('title-input').value = state.title;
  $('tagline-input').value = state.tagline;
  $('script-input').value = state.script;
  $('title-size').value = String(state.titleSize);
  buildTitleStylePicker();
  buildTitleFontPicker();
  buildTitleTemplates();
  $('outline-toggle').checked = state.outline !== false;
  $('popout-toggle').checked = state.popout !== false;
}

// --- surprise me / auto layout ----------------------------------------------

const SURPRISE_TITLES = ['GOLDEN HOUR', 'NEON NIGHTS', 'VELVET SUNSET', 'COASTLINE KINGS', 'MIDNIGHT DRIVE', 'PALM & NEON', 'LAST LIGHT', 'SUMMER STATIC'];
const SURPRISE_TAGLINES = ['ONE LAST SUMMER', 'DRIVE INTO THE LIGHT', 'THE CITY NEVER SLEEPS', 'GOLDEN HOUR, EVERY HOUR', 'WHERE THE PALMS MEET THE NEON', 'CHASE THE HORIZON', 'NO BRAKES AFTER DARK', 'EVERY SUNSET HAS A PRICE'];
const SURPRISE_SCRIPTS = ['one last summer', 'coastline nights', 'velvet and neon', 'the long way home', 'summer static', 'palms in the rearview', 'golden hour gang', 'chasing the golden hour'];
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// New random layout + grade + caption from the built-in lists.
export function surpriseMe() {
  state.layout = pick(LAYOUT_IDS);
  state.grade = pick(GRADE_IDS);
  state.title = pick(SURPRISE_TITLES);
  state.tagline = pick(SURPRISE_TAGLINES);
  state.script = pick(SURPRISE_SCRIPTS);
  state.titleColor = pick(TITLE_COLORS);
  state.titleTemplate = null;
  syncAllControls();
  commitHistory();
  schedulePreview();
  setStatus('Surprise! New layout, grade and caption.');
  return { layout: state.layout, grade: state.grade, title: state.title };
}

// The layout whose panel count best fits the loaded photos: one photo gets
// the big hero panel, two get the wide banner, three get equal columns,
// four or five get the five-panel magazine, six get the Ensemble (hero +
// scenic strip + 2x2) — the densest layout, matching the paid zone.
const AUTO_LAYOUT_BY_PHOTOS = { 1: 'hero-split', 2: 'banner', 3: 'triple-strip', 4: 'magazine', 5: 'magazine', 6: 'ensemble' };
export function autoLayout() {
  const n = state.photos.filter((p) => p && p.image).length;
  const layout = AUTO_LAYOUT_BY_PHOTOS[n] || 'magazine';
  if (layout !== state.layout) {
    state.layout = layout;
    syncAllControls();
    commitHistory();
    schedulePreview();
    setStatus(`Auto layout: ${LAYOUTS[layout].label} for ${n} photo${n === 1 ? '' : 's'}.`);
  } else {
    setStatus(`Auto layout: ${LAYOUTS[layout].label} already fits ${n} photo${n === 1 ? '' : 's'}.`);
  }
  return state.layout;
}

function buildPreviewSizePicker() {
  buttonRow(
    $('preview-size'),
    EXPORT_SIZES.map((s) => ({ id: s.id, label: s.label })),
    state.previewSize,
    (id) => { state.previewSize = id; },
  );
}

function buildExportButtons() {
  const box = $('export-buttons');
  box.innerHTML = '';
  EXPORT_SIZES.forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'export';
    button.textContent = `Export PNG ${size.label}`;
    button.addEventListener('click', async () => {
      await exportCoverPNG(size.id);
    });
    box.appendChild(button);
  });
}

export async function exportCoverPNG(sizeId) {
  const size = sizeById(sizeId);
  const canvas = renderToCanvas(size.w, size.h, state);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sunset-panels-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`Saved sunset-panels-${size.w}x${size.h}.png`);
  return blob;
}

// All three post sizes in one click, one file per size.
export async function exportAllPNG() {
  const blobs = [];
  for (const size of EXPORT_SIZES) {
    blobs.push(await exportCoverPNG(size.id));
  }
  setStatus(`Saved 3 PNGs: ${EXPORT_SIZES.map((s) => s.label).join(', ')}.`);
  return blobs;
}

function buildSampleButtons() {
  const box = $('sample-buttons');
  box.innerHTML = '';
  SAMPLES.forEach((sample) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Use ${sample.label} sample`;
    button.addEventListener('click', async () => {
      addPhoto(await loadSample(sample.file.replace('.jpg', '')));
    });
    box.appendChild(button);
  });
}

function bindStaticControls() {
  $('spread-btn').addEventListener('click', () => spreadOnePhoto());
  $('upload').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    for (const file of files) {
      try {
        const image = await loadImage(URL.createObjectURL(file));
        addPhoto({ image, label: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Upload', source: 'upload' });
      } catch {
        setStatus(`Could not read ${file.name}.`);
      }
    }
    event.target.value = '';
  });
  $('title-input').addEventListener('input', (e) => { state.title = e.target.value; schedulePreview(); commitSoon(); });
  $('tagline-input').addEventListener('input', (e) => { state.tagline = e.target.value; schedulePreview(); commitSoon(); });
  $('script-input').addEventListener('input', (e) => { state.script = e.target.value; schedulePreview(); commitSoon(); });
  $('title-size').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); schedulePreview(); });
  $('title-size').addEventListener('change', () => commitHistory());
  $('outline-toggle').addEventListener('change', (e) => { state.outline = e.target.checked; schedulePreview(); commitHistory(); });
  $('popout-toggle').addEventListener('change', (e) => { state.popout = e.target.checked; schedulePreview(); commitHistory(); });
}

// The action toolbar under the preview: undo/redo, surprise, auto layout,
// export all. Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo
// (not while typing in a text field — the browser's own undo wins there).
function bindToolbar() {
  $('undo-btn').addEventListener('click', () => undoHistory());
  $('redo-btn').addEventListener('click', () => redoHistory());
  $('surprise-btn').addEventListener('click', () => surpriseMe());
  $('auto-btn').addEventListener('click', () => autoLayout());
  $('export-all-btn').addEventListener('click', async () => { await exportAllPNG(); });
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undoHistory(); }
    else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redoHistory(); }
  });
}

// --- fixed screenshot scenes ----------------------------------------------

async function applyShotScene() {
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (!shot) return false;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photoName = query.get('photo') || 'pier';
  const layout = query.get('layout') || 'hero-split';
  const title = query.get('caption') || 'SUNSET HEIST';
  const tagline = query.get('tagline') || 'EVERY SUNSET HAS A PRICE';
  const script = query.get('script') || 'chasing the golden hour';
  const grade = query.get('grade') || 'sunset';
  const sizeParam = query.get('size') || '1920x1080';
  const [sw, sh] = sizeParam.split('x').map(Number);
  if (LAYOUTS[layout]) state.layout = layout;
  if (GRADES[grade]) state.grade = grade;
  // Pop-out hero for the scene: ?popout=0 turns it off, anything else
  // (including absent) keeps the default ON.
  if (query.get('popout') === '0') state.popout = false;
  else if (query.get('popout') === '1') state.popout = true;
  // Title style for the scene: ?titlestyle=stripes|smooth|chrome|neon.
  // An unknown value keeps the default Stripes, so shots 1/3/4 render
  // exactly as they do now.
  const styleParam = query.get('titlestyle');
  if (styleParam && TITLE_STYLES.some((s) => s.id === styleParam)) state.titleStyle = styleParam;
  state.title = title;
  state.tagline = tagline;
  state.script = script;
  // Photos for the scene: an explicit comma list (?photos=pier,boulevard,…)
  // or the legacy pair (the named photo + the other kit sample).
  const photosParam = query.get('photos');
  const photoNames = photosParam
    ? photosParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [photoName, photoName === 'pier' ? 'boulevard' : 'pier'];
  const loaded = [];
  for (const name of photoNames) loaded.push(await loadSample(name));
  state.photos = loaded;
  // One panel entry per panel of the layout, each photo framed by its
  // per-sample defaults so faces land inside the window. Panels take
  // distinct photos in order (no duplicate face inside a cover); the
  // second panel carries the WANTED pill (the first panel's top corners
  // already hold the COMING SOON stamp, which the pill would collide
  // with in narrow layouts).
  const count = LAYOUTS[state.layout].panelCount;
  state.panels = Array.from({ length: count }, (_, i) => {
    const name = photoNames[i % photoNames.length];
    const framing = PHOTO_FRAMING[name] || { zoom: 1.15, ox: 0, oy: 0 };
    return { photo: i % loaded.length, zoom: framing.zoom, ox: framing.ox, oy: framing.oy, tag: PHOTO_TAGS[name] || PANEL_TAGS[i] || '', sub: PHOTO_SUBCAPTIONS[name] || '', wanted: i === 1, flip: false };
  });
  // Per-scene vertical-pan overrides (?oy=a,b,c): the small side panels are
  // wide and short, so the centred crop cuts faces off — the cover scenes pin
  // their oy near the top of the photo instead. Only the scenes that carry
  // the param change; the editor and triple-strip scenes keep the defaults.
  // The auto-frame above already pans up to the faces; an explicit override
  // still wins where a scene carries one.
  if (shot === 'cover' && sw > 0 && sh > 0) autoFramePanels(sw, sh);
  else autoFramePanels(preview.width, preview.height);
  // (Note: ''.split(',').map(Number) is [0], not [], so an absent param
  // must not reach the loop at all — it used to silently zero panel 0.)
  const oyParam = query.get('oy');
  const oyOverride = oyParam ? oyParam.split(',').map(Number) : [];
  oyOverride.forEach((oy, i) => {
    if (state.panels[i] && Number.isFinite(oy)) state.panels[i].oy = Math.max(-1, Math.min(1, oy));
  });
  // ?spread=<name> (editor shots): spread one loaded photo across every
  // panel with different crops, so the shot shows the feature working.
  // The named photo is the spread source; an unknown name falls back to
  // the first loaded photo.
  const spreadName = query.get('spread');
  if (spreadName !== null) {
    const idx = state.photos.findIndex((p) => p.name === spreadName);
    spreadOnePhoto(idx >= 0 ? idx : 0);
  }
  rebuildPhotoSlots();
  buildPanelControls();
  syncStaticInputs();
  if (shot === 'cover' && sw > 0 && sh > 0) {
    preview.width = sw;
    preview.height = sh;
    renderCover(preview.getContext('2d'), sw, sh, state);
  } else {
    renderPreview();
  }
  return true;
}

async function waitForFonts() {
  try {
    await Promise.all([
      document.fonts.load('400 100px "Archivo Black"'),
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 100px "Bebas Neue"'),
      document.fonts.load('900 100px "Barlow Condensed"'),
      document.fonts.load('400 100px Staatliches'),
      document.fonts.load('600 40px Oswald'),
      document.fonts.load('500 40px Oswald'),
      document.fonts.load('400 60px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch { /* fall back to system fonts if a file fails to load */ }
}

// --- boot -------------------------------------------------------------------

async function boot() {
  buildLayoutPicker();
  buildGradePicker();
  buildTitleColors();
  buildTitleStylePicker();
  buildTitleFontPicker();
  buildTitleTemplates();
  buildSampleButtons();
  buildPanelControls();
  buildLookSliders();
  buildPreviewSizePicker();
  buildExportButtons();
  bindStaticControls();
  bindToolbar();
  await waitForFonts();
  const isShot = await applyShotScene();
  if (!isShot) {
    await loadDefaultPhotos();
    autoFramePanels(preview.width, preview.height);
    renderPreview();
  }
  commitHistory();
  updateHistoryButtons();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

window.sunsetPanels = { state, renderPreview, exportCoverPNG, exportAllPNG, loadSample, EXPORT_SIZES, undo: undoHistory, redo: redoHistory, surpriseMe, autoLayout, flipPanel, swapPanels, spreadOnePhoto, coverPanelRects, commitHistory };
boot();
