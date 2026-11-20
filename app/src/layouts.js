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
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export function layoutPanels(id, zone) {
  const layout = LAYOUTS[id] || LAYOUTS['hero-split'];
  return layout.panels(zone);
}
