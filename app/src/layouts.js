// Sunset Panels — poster layouts.
// Each layout describes the photo panels as fractions of the panel zone
// (the rectangle the panels live in, given as {x, y, w, h} in cover pixels).
// The cover renderer asks a layout for its panels and draws one photo per panel.

export const LAYOUTS = {
  'hero-split': {
    label: 'Hero split',
    blurb: 'One big hero panel, two stacked beside it.',
    panelCount: 3,
    panels(zone) {
      const g = zone.gutter;
      const heroW = zone.w * 0.62;
      const sideX = zone.x + heroW + g;
      const sideW = zone.x + zone.w - sideX;
      const midY = zone.y + zone.h / 2;
      return [
        { x: zone.x, y: zone.y, w: heroW, h: zone.h },
        { x: sideX, y: zone.y, w: sideW, h: midY - zone.y - g / 2 },
        { x: sideX, y: midY + g / 2, w: sideW, h: zone.y + zone.h - midY - g / 2 },
      ];
    },
  },

  'triple-strip': {
    label: 'Triple strip',
    blurb: 'Three equal columns, side by side.',
    panelCount: 3,
    panels(zone) {
      const g = zone.gutter;
      const colW = (zone.w - 2 * g) / 3;
      return [0, 1, 2].map((i) => ({
        x: zone.x + i * (colW + g),
        y: zone.y,
        w: colW,
        h: zone.h,
      }));
    },
  },

  banner: {
    label: 'Banner',
    blurb: 'One wide panel on top, two below it.',
    panelCount: 3,
    panels(zone) {
      const g = zone.gutter;
      const topH = zone.h * 0.58;
      const bottomY = zone.y + topH + g;
      const bottomH = zone.y + zone.h - bottomY;
      const midX = zone.x + zone.w / 2;
      return [
        { x: zone.x, y: zone.y, w: zone.w, h: topH },
        { x: zone.x, y: bottomY, w: midX - zone.x - g / 2, h: bottomH },
        { x: midX + g / 2, y: bottomY, w: zone.x + zone.w - midX - g / 2, h: bottomH },
      ];
    },
  },

  magazine: {
    label: 'Magazine',
    blurb: 'One hero panel, four small beside it.',
    panelCount: 5,
    panels(zone) {
      const g = zone.gutter;
      const heroW = zone.w * 0.55;
      const sideX = zone.x + heroW + g;
      const sideW = zone.x + zone.w - sideX;
      const colW = (sideW - g) / 2;
      const rowH = (zone.h - g) / 2;
      return [
        { x: zone.x, y: zone.y, w: heroW, h: zone.h },
        { x: sideX, y: zone.y, w: colW, h: rowH },
        { x: sideX + colW + g, y: zone.y, w: colW, h: rowH },
        { x: sideX, y: zone.y + rowH + g, w: colW, h: rowH },
        { x: sideX + colW + g, y: zone.y + rowH + g, w: colW, h: rowH },
      ];
    },
  },

  // Ensemble (Round 6): six panels — the densest layout, matching the
  // paid zone (every paid-zone cover has 6–7 panels; Magazine tops out
  // at 5). Hero on the left (full height), right side a wide scenic
  // strip on top and a 2x2 grid below. The rows are UNEQUAL on purpose:
  // strip 0.16 + row 1 0.28 of zone height (+ gutters) put row 2's top
  // edge at ~0.42H, leaving ~0.12H of clear space above the masthead
  // (title top 0.5425H) — the same clear-strip geometry the guard
  // already proves for Magazine's bottom row. Equal rows would push
  // row 2 to ~0.51H, where the clear strip is only ~0.04H and the
  // guard cannot keep faces whole (the face would be cut at the top
  // and covered at the chin). The strip sits fully above the masthead,
  // so it never needs the title guard; it is a scene panel — a wide
  // landscape slice (pier, dusk) — the way the top covers mix scene
  // panels in with the faces.
  ensemble: {
    label: 'Ensemble',
    blurb: 'Hero, a scenic strip, and four small panels.',
    panelCount: 6,
    panels(zone) {
      const g = zone.gutter;
      const heroW = zone.w * 0.50;
      const sideX = zone.x + heroW + g;
      const sideW = zone.x + zone.w - sideX;
      const stripH = zone.h * 0.16;
      const row1H = zone.h * 0.28;
      const row2Y = zone.y + stripH + g + row1H + g;
      const row2H = zone.y + zone.h - row2Y;
      const colW = (sideW - g) / 2;
      return [
        { x: zone.x, y: zone.y, w: heroW, h: zone.h },
        { x: sideX, y: zone.y, w: sideW, h: stripH },
        { x: sideX, y: zone.y + stripH + g, w: colW, h: row1H },
        { x: sideX + colW + g, y: zone.y + stripH + g, w: colW, h: row1H },
        { x: sideX, y: row2Y, w: colW, h: row2H },
        { x: sideX + colW + g, y: row2Y, w: colW, h: row2H },
      ];
    },
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export function layoutPanels(id, zone) {
  const layout = LAYOUTS[id] || LAYOUTS['hero-split'];
  return layout.panels(zone);
}
