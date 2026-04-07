/**
 * Floor map layout metadata for SVG base maps.
 *
 * ASPECT RATIO / NO DISTORTION:
 * - `width` / `height` must match your SVG `viewBox` size (or same ratio).
 * - When you replace `assets/floor1.svg`, update floor `1` here to that viewBox.
 * - MapView fits this rectangle into the phone viewport with letterboxing (contain).
 */

/** @typedef {{ width: number, height: number }} FloorDimensions */

/** Logical size per floor — keep in sync with each SVG’s viewBox. */
const FLOOR_SVG_LAYOUT = {
  1: { width: 400, height: 300 },
  2: { width: 400, height: 300 },
};

function getFloorMapPixelSize(floor) {
  return FLOOR_SVG_LAYOUT[floor] || { width: 4, height: 3 };
}

/** Fit map inside viewport while preserving aspect ratio. */
function fitMapToViewport(viewportW, viewportH, imageW, imageH) {
  if (!viewportW || !viewportH || !imageW || !imageH) {
    return { width: 0, height: 0 };
  }
  const ir = imageW / imageH;
  const vr = viewportW / viewportH;
  if (ir > vr) {
    const width = viewportW;
    const height = viewportW / ir;
    return { width, height };
  }
  const height = viewportH;
  const width = viewportH * ir;
  return { width, height };
}

module.exports = {
  FLOOR_SVG_LAYOUT,
  getFloorMapPixelSize,
  fitMapToViewport,
};
