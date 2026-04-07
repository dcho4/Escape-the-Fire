const { getFloorSvgComponent } = require("./mapSvgAssets");
const { FLOOR_SVG_LAYOUT } = require("./floorMeta");
const { getNodesForFloor } = require("./floorNodes");
const { getEdgesForFloor } = require("./floorGraph");

/**
 * Floor configuration (single source of truth).
 *
 * WHAT YOU EDIT LATER:
 * - **SVG**: `assets/floor1.svg`, `assets/floor2.svg` + `utils/mapSvgAssets.js`
 * - **SVG viewBox size**: `utils/floorMeta.js` (FLOOR_SVG_LAYOUT)
 * - **Nodes**: `utils/floorNodes.js`
 * - **Edges** (for future graph routing): `utils/floorGraph.js`
 */

/** @typedef {'svg' | 'graph' | 'placeholder'} MapType */

/**
 * @typedef {Object} FloorConfig
 * @property {number} id
 * @property {string} label
 * @property {MapType} mapType
 * @property {{ width: number, height: number }} mapDimensions
 * @property {Function|null} svgComponent
 * @property {Array} nodes
 * @property {Array} edges
 */

/** @type {FloorConfig[]} */
const FLOORS = [
  {
    id: 1,
    label: "Floor 1 (Bottom)",
    mapType: "svg",
    mapDimensions: FLOOR_SVG_LAYOUT[1],
    svgComponent: getFloorSvgComponent(1),
    nodes: getNodesForFloor(1),
    edges: getEdgesForFloor(1),
  },
  {
    id: 2,
    label: "Floor 2 (Upper)",
    mapType: "svg",
    mapDimensions: FLOOR_SVG_LAYOUT[2],
    svgComponent: getFloorSvgComponent(2),
    nodes: getNodesForFloor(2),
    edges: getEdgesForFloor(2),
  },
];

function getFloorConfig(floorId) {
  return FLOORS.find((f) => f.id === floorId) || FLOORS[0];
}

module.exports = { FLOORS, getFloorConfig };

