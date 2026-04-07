/**
 * Bundled floor SVGs as React components (Metro: react-native-svg-transformer).
 * To add a floor: place `assets/floorN.svg`, add a static `require` below, and a case in `getFloorSvgComponent`.
 */

let Floor1Svg = null;
let Floor2Svg = null;

try {
  const m1 = require("../assets/floor1.svg");
  Floor1Svg = m1.default ?? m1;
} catch {
  Floor1Svg = null;
}

try {
  const m2 = require("../assets/floor2.svg");
  Floor2Svg = m2.default ?? m2;
} catch {
  Floor2Svg = null;
}

function getFloorSvgComponent(floor) {
  if (floor === 1) {
    return typeof Floor1Svg === "function" ? Floor1Svg : null;
  }
  if (floor === 2) {
    return typeof Floor2Svg === "function" ? Floor2Svg : null;
  }
  return null;
}

module.exports = { getFloorSvgComponent };
