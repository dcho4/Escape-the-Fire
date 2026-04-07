/**
 * Indoor map nodes (normalized x,y in 0..1, origin top-left of SVG viewBox).
 *
 * WHERE TO EDIT:
 * ---------------------------------------------------------------------------
 * • ROOM NODES — add objects with type: "room" (e.g. offices, labs).
 * • HALL / INTERSECTION NODES — type: "hall" for corridor joints & waypoints.
 * • STAIR NODES — type: "stairs" (landings, stair cores).
 * • EXIT NODES — type: "exit" (doors to outside, safe muster-related exits).
 *
 * Authoring workflow: enable Dev mode, tap the SVG map, copy console coords,
 * paste `x`/`y` here. Keep `id` stable — graph edges in `floorGraph.js` reference them.
 *
 * NODE SHAPE (expand with optional fields later, e.g. `meta: { roomNo: "101" }`):
 */

/** @typedef {'room' | 'hall' | 'stairs' | 'exit'} MapNodeType */

/**
 * @typedef {Object} MapNode
 * @property {string} id
 * @property {string} label
 * @property {number} floor
 * @property {MapNodeType} type
 * @property {number} x — normalized 0..1
 * @property {number} y — normalized 0..1
 * @property {string[]} [neighbors] — optional hints; canonical graph is `utils/floorGraph.js`
 */

/** @type {Record<number, MapNode[]>} */
const NODES_BY_FLOOR = {
  // ---- Floor 1 (bottom): add / adjust room & hallway nodes below ----
  1: [
    { id: "f1_hall_main_w", label: "Main hall W", floor: 1, type: "hall", x: 0.22, y: 0.55 },
    { id: "f1_hall_main_e", label: "Main hall E", floor: 1, type: "hall", x: 0.55, y: 0.55 },
    { id: "f1_hall_n", label: "North junction", floor: 1, type: "hall", x: 0.4, y: 0.35 },
    {
      id: "f1_room_west",
      label: "West wing",
      floor: 1,
      type: "room",
      x: 0.15,
      y: 0.55,
      roomRadius: 0.2,
      roomHighlightRadius: 0.14,
    },
    { id: "f1_stairs_core", label: "Stair core", floor: 1, type: "stairs", x: 0.5, y: 0.52 },
    { id: "f1_exit_a", label: "Exit A", floor: 1, type: "exit", x: 0.1, y: 0.2 },
    { id: "f1_exit_b", label: "Exit B", floor: 1, type: "exit", x: 0.9, y: 0.85 },
    { id: "f1_exit_c", label: "Exit C", floor: 1, type: "exit", x: 0.9, y: 0.15 },
  ],

  // ---- Floor 2 (upper): add / adjust room & hallway nodes below ----
  2: [
    { id: "f2_hall_center", label: "Center", floor: 2, type: "hall", x: 0.5, y: 0.55 },
    { id: "f2_hall_w", label: "West hall", floor: 2, type: "hall", x: 0.28, y: 0.55 },
    { id: "f2_hall_e", label: "East hall", floor: 2, type: "hall", x: 0.72, y: 0.55 },
    { id: "f2_stairs_w", label: "Stairs W", floor: 2, type: "stairs", x: 0.1, y: 0.5 },
    { id: "f2_stairs_e", label: "Stairs E", floor: 2, type: "stairs", x: 0.9, y: 0.4 },
    { id: "f2_stairs_n", label: "Stairs N", floor: 2, type: "stairs", x: 0.6, y: 0.2 },
    {
      id: "f2_room_north",
      label: "North rooms",
      floor: 2,
      type: "room",
      x: 0.5,
      y: 0.28,
      roomRadius: 0.18,
      roomHighlightRadius: 0.12,
    },
  ],
};

function getNodesForFloor(floor) {
  return NODES_BY_FLOOR[floor] ? [...NODES_BY_FLOOR[floor]] : [];
}

/** Shown when not in dev mode: exits & stairs only (less clutter). */
function getNodesForPublicMapOverlay(floor) {
  return getNodesForFloor(floor).filter((n) => n.type === "exit" || n.type === "stairs");
}

/** All node types shown in dev authoring mode. */
function getNodesForDevOverlay(floor) {
  return getNodesForFloor(floor);
}

function getNodeById(nodeId) {
  for (const floor of Object.keys(NODES_BY_FLOOR)) {
    const found = NODES_BY_FLOOR[floor].find((n) => n.id === nodeId);
    if (found) return found;
  }
  return null;
}

module.exports = {
  NODES_BY_FLOOR,
  getNodesForFloor,
  getNodesForPublicMapOverlay,
  getNodesForDevOverlay,
  getNodeById,
};
