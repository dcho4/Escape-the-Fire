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
 * paste `x`/`y` here. Keep `id` stable.
 *
 * Floor 1 & 2 routing: edit `FLOOR_1_ACCESSIBLE_NODE_IDS` / `FLOOR_2_ACCESSIBLE_NODE_IDS` — each key
 * is a node id; values are nodes reachable in one step. Edges are generated in `floorGraph.js`.
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
 * @property {string[]} [accessibleNodeIds] — floors 1 & 2: filled from `FLOOR_*_ACCESSIBLE_NODE_IDS` at runtime
 * @property {{ outsideSafe?: boolean }} [meta] — e.g. outdoor muster / safe zone (for future UI / logic)
 */

/**
 * Floor 1 walk graph (single source of truth).
 * @type {Record<string, string[]>}
 */
const FLOOR_1_ACCESSIBLE_NODE_IDS = {
  f1_room_1: ["f1_hall_w_core"],
  f1_room_2: ["f1_hall_w_core"],
  f1_room_3: ["f1_hall_w_core"],
  f1_room_4: ["f1_hall_w_core"],
  f1_hall_w_core: ["f1_room_1", "f1_room_2", "f1_room_3", "f1_room_4", "f1_hall_w_s"],
  f1_hall_w_s: ["f1_hall_w_core", "f1_hall_w_bridge", "f1_exit_1", "f1_hall_mid"],
  f1_hall_w_bridge: ["f1_hall_w_s", "f1_room_w_n", "f1_exit_3"],
  f1_room_w_n: ["f1_hall_w_bridge"],
  f1_room_basketball_out: ["f1_hall_w_bridge"],
  f1_exit_1: ["f1_hall_w_s"],
  f1_exit_2: ["f1_hall_e"],
  f1_exit_3: ["f1_hall_w_bridge"],
  f1_room_move_1: ["f1_hall_mid", "f1_room_move_2", "f1_room_move_3"],
  f1_room_move_2: ["f1_room_move_1", "f1_room_move_3"],
  f1_room_move_3: ["f1_room_move_1", "f1_room_move_2", "f1_hall_move_e"],
  f1_hall_move_e: ["f1_room_move_3", "f1_room_move_4"],
  f1_room_move_4: ["f1_hall_move_e", "f1_room_tiny_1", "f1_room_tiny_2"],
  f1_room_tiny_1: ["f1_room_move_4"],
  f1_room_tiny_2: ["f1_room_move_4"],
  f1_hall_mid: ["f1_room_move_1", "f1_hall_e", "f1_hall_w_s"],
  f1_hall_e: ["f1_exit_2", "f1_hall_mid", "f1_hall_e_pre"],
  f1_hall_e_pre: ["f1_hall_e", "f1_room_misc"],
  f1_room_misc: ["f1_hall_e_pre"],
};

/**
 * Floor 2 walk graph (single source of truth). Change only here; do not duplicate in `floorGraph.js`.
 * @type {Record<string, string[]>}
 */
const FLOOR_2_ACCESSIBLE_NODE_IDS = {
  f2_exit_1: ["f2_hall_test"],
  f2_exit_2: ["f2_hall_n2"],
  f2_exit_3: ["f2_room_basketball_court_2"],
  f2_exit_4: ["f2_room_basketball_court_3"],
  f2_exit_5: ["f2_hall_w_exit_w1"],
  f2_exit_6: ["f2_hall_w_exit_w2"],
  f2_exit_7: ["f2_room_basketball_court_3", "f2_room_teens", "f2_hall_s_courts"],
  f2_exit_8: ["f2_hall_e2"],
  f2_hall_e1: ["f2_hall_e2", "f2_hall_w5", "f2_room_cafe_2"],
  f2_hall_e2: ["f2_exit_8", "f2_hall_e1", "f2_hall_e3", "f2_room_cafe_2"],
  // E3 → Teens: via f2_hall_n3 only. No direct E3–ec_mid (would shortcut past N3 now that ec_mid links the E-courts hall → Teens).
  f2_hall_e3: ["f2_hall_e2", "f2_hall_n3"],
  // NE mid ↔ E mid (courts): links the north-east spine to the courts hall (avoids forcing Teens as only bridge).
  f2_hall_ec_mid: ["f2_room_basketball_court_2", "f2_hall_e_courts_teens", "f2_hall_n3"],
  f2_hall_n1: ["f2_hall_e1", "f2_hall_test"],
  f2_hall_n2: ["f2_exit_2", "f2_hall_n3", "f2_hall_test", "f2_room_offices"],
  f2_hall_n3: ["f2_hall_e3", "f2_hall_n2", "f2_hall_ec_mid", "f2_room_teens", "f2_room_ne_n3"],
  f2_hall_test: ["f2_exit_1", "f2_hall_n1", "f2_room_basketball"],
  f2_hall_w1: [
    "f2_hall_w_exit_w1",
    "f2_hall_w_jog",
    "f2_hall_w2",
    "f2_room_6_game",
    "f2_room_classroom_1",
    "f2_room_classroom_2",
    "f2_room_youth",
  ],
  // No w2–w_bridge edge: path must go w2 → Youth → bridge (direct link was shorter but wrong visually).
  f2_hall_w2: [
    "f2_hall_w1",
    "f2_hall_w3",
    "f2_hall_w_exit_w2",
    "f2_hall_w_jog",
    "f2_room_classroom_3",
    "f2_room_classroom_5",
    "f2_room_youth",
  ],
  f2_hall_w_bridge: ["f2_room_youth", "f2_hall_w_exit_w2"],
  f2_hall_w3: ["f2_hall_w2", "f2_hall_w4", "f2_room_classroom_4"],
  f2_hall_w4: ["f2_hall_w3", "f2_hall_w5", "f2_room_cafe_2", "f2_room_cafe_3"],
  f2_hall_w5: ["f2_hall_e1", "f2_hall_w4", "f2_room_cafe", "f2_room_cafe_2"],
  f2_hall_w_exit_w1: ["f2_exit_5", "f2_hall_w1", "f2_hall_w2", "f2_hall_w_jog", "f2_room_youth"],
  f2_hall_w_exit_w2: ["f2_exit_6", "f2_hall_w2", "f2_hall_w_bridge", "f2_hall_w_jog", "f2_room_youth"],
  f2_hall_w_jog: ["f2_hall_w1", "f2_hall_w2", "f2_hall_w_exit_w1", "f2_hall_w_exit_w2", "f2_room_youth"],
  f2_room_6_game: ["f2_hall_w1"],
  f2_room_basketball: ["f2_hall_test"],
  f2_room_basketball_court_2: [
    "f2_exit_3",
    "f2_exit_4",
    "f2_hall_ec_mid",
    "f2_hall_s_courts",
    "f2_room_basketball_court_3",
  ],
  f2_room_basketball_court_3: ["f2_exit_4", "f2_exit_7", "f2_room_basketball_court_2"],
  f2_room_cafe: ["f2_hall_w5", "f2_room_cafe_3"],
  f2_room_cafe_2: ["f2_hall_e1", "f2_hall_e2", "f2_hall_w4", "f2_hall_w5"],
  f2_room_cafe_3: ["f2_hall_w4", "f2_room_cafe"],
  f2_room_classroom_1: ["f2_hall_w1"],
  f2_room_classroom_2: ["f2_hall_w1"],
  f2_room_classroom_3: ["f2_hall_w2"],
  f2_room_classroom_4: ["f2_hall_w3"],
  f2_room_classroom_5: ["f2_hall_w2"],
  f2_room_offices: ["f2_hall_n2"],
  f2_room_teens: [
    "f2_exit_7",
    "f2_hall_n3",
    "f2_hall_e_courts_teens",
    "f2_hall_s_courts",
    "f2_room_basketball_court_2",
    "f2_room_e_courts_s",
  ],
  f2_room_ne_n3: ["f2_hall_n3"],
  f2_room_e_courts_w: ["f2_hall_e_courts_teens"],
  f2_hall_e_courts_teens: ["f2_hall_ec_mid", "f2_room_teens", "f2_room_e_courts_w"],
  f2_room_e_courts_s: ["f2_room_teens"],
  f2_room_s_courts_n: ["f2_hall_s_courts"],
  f2_hall_s_courts: [
    "f2_room_teens",
    "f2_room_s_courts_n",
    "f2_exit_7",
    "f2_room_basketball_court_2",
  ],
  f2_room_youth: [
    "f2_hall_w1",
    "f2_hall_w2",
    "f2_hall_w_bridge",
    "f2_hall_w_exit_w1",
    "f2_hall_w_exit_w2",
    "f2_hall_w_jog",
  ],
};

function enrichFloor1Node(node) {
  const ids = FLOOR_1_ACCESSIBLE_NODE_IDS[node.id];
  return { ...node, accessibleNodeIds: ids ? [...ids] : [] };
}

function enrichFloor2Node(node) {
  const ids = FLOOR_2_ACCESSIBLE_NODE_IDS[node.id];
  return { ...node, accessibleNodeIds: ids ? [...ids] : [] };
}

function enrichNodeForFloor(floor, node) {
  if (floor === 1) return enrichFloor1Node(node);
  if (floor === 2) return enrichFloor2Node(node);
  return { ...node };
}

/** @type {Record<number, MapNode[]>} */
const NODES_BY_FLOOR = {
  // ---- Floor 1 (bottom) ----
  1: [
    {
      id: "f1_room_1",
      label: "Squash room 1",
      floor: 1,
      type: "room",
      x: 0.5057,
      y: 0.4833,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_2",
      label: "Squash room 2",
      floor: 1,
      type: "room",
      x: 0.4354,
      y: 0.4813,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_3",
      label: "Squash room 3",
      floor: 1,
      type: "room",
      x: 0.4365,
      y: 0.4403,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_4",
      label: "Squash room 4",
      floor: 1,
      type: "room",
      x: 0.5068,
      y: 0.441,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_basketball_out",
      label: "Basketball court (outside)",
      floor: 1,
      type: "room",
      x: 0.3094,
      y: 0.5479,
      roomRadius: 0.07,
      roomHighlightRadius: 0.055,
      meta: { outsideSafe: true },
    },
    {
      id: "f1_room_w_n",
      label: "Room · W north",
      floor: 1,
      type: "room",
      x: 0.3937,
      y: 0.4625,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_move_1",
      label: "Movement room 1",
      floor: 1,
      type: "room",
      x: 0.55,
      y: 0.4854,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_move_2",
      label: "Movement room 2",
      floor: 1,
      type: "room",
      x: 0.5427,
      y: 0.4389,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_move_3",
      label: "Movement room 3",
      floor: 1,
      type: "room",
      x: 0.5771,
      y: 0.4375,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_move_4",
      label: "Movement room 4",
      floor: 1,
      type: "room",
      x: 0.6156,
      y: 0.4368,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f1_room_tiny_1",
      label: "Tiny room 1",
      floor: 1,
      type: "room",
      x: 0.6422,
      y: 0.4285,
      roomRadius: 0.04,
      roomHighlightRadius: 0.032,
    },
    {
      id: "f1_room_tiny_2",
      label: "Tiny room 2",
      floor: 1,
      type: "room",
      x: 0.6432,
      y: 0.4486,
      roomRadius: 0.04,
      roomHighlightRadius: 0.032,
    },
    {
      id: "f1_room_misc",
      label: "Room",
      floor: 1,
      type: "room",
      x: 0.6396,
      y: 0.4778,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },

    { id: "f1_hall_w_core", label: "Hall · W core (4 rooms)", floor: 1, type: "hall", x: 0.4719, y: 0.4667 },
    { id: "f1_hall_w_s", label: "Hall · W south", floor: 1, type: "hall", x: 0.4724, y: 0.5236 },
    { id: "f1_hall_w_bridge", label: "Hall · W bridge", floor: 1, type: "hall", x: 0.4, y: 0.5194 },
    { id: "f1_hall_mid", label: "Hall · mid", floor: 1, type: "hall", x: 0.5516, y: 0.5257 },
    { id: "f1_hall_move_e", label: "Hall · movement E", floor: 1, type: "hall", x: 0.5943, y: 0.4694 },
    { id: "f1_hall_e_pre", label: "Hall · E (before exit 2)", floor: 1, type: "hall", x: 0.6292, y: 0.5035 },
    { id: "f1_hall_e", label: "Hall · E / exit 2", floor: 1, type: "hall", x: 0.5964, y: 0.5229 },

    { id: "f1_exit_1", label: "Exit 1", floor: 1, type: "exit", x: 0.4719, y: 0.5444 },
    { id: "f1_exit_2", label: "Exit 2", floor: 1, type: "exit", x: 0.5979, y: 0.5431 },
    { id: "f1_exit_3", label: "Exit 3", floor: 1, type: "exit", x: 0.3870, y: 0.5257 },
  ],

  // ---- Floor 2 (upper): add / adjust room & hallway nodes below ----
  2: [
    {
      id: "f2_room_6_game",
      label: "Room 6 · Game room",
      floor: 2,
      type: "room",
      x: 0.3,
      y: 0.4733,
      roomRadius: 0.09,
      roomHighlightRadius: 0.07,
    },

    { id: "f2_room_classroom_1", label: "Classroom 1", floor: 2, type: "room", x: 0.3125, y: 0.55, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_classroom_2", label: "Classroom 2", floor: 2, type: "room", x: 0.3542, y: 0.5493, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_classroom_3", label: "Classroom 3", floor: 2, type: "room", x: 0.3964, y: 0.55, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_classroom_4", label: "Classroom 4", floor: 2, type: "room", x: 0.437, y: 0.55, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_classroom_5", label: "Classroom 5", floor: 2, type: "room", x: 0.4208, y: 0.4556, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_youth", label: "Youth", floor: 2, type: "room", x: 0.3625, y: 0.4993, roomRadius: 0.06, roomHighlightRadius: 0.048 },

    { id: "f2_room_basketball", label: "Basketball room", floor: 2, type: "room", x: 0.5276, y: 0.325, roomRadius: 0.075, roomHighlightRadius: 0.058 },
    { id: "f2_room_offices", label: "Offices", floor: 2, type: "room", x: 0.6062, y: 0.3174, roomRadius: 0.065, roomHighlightRadius: 0.05 },
    { id: "f2_room_cafe", label: "Cafe", floor: 2, type: "room", x: 0.5057, y: 0.4618, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_cafe_2", label: "Cafe 2", floor: 2, type: "room", x: 0.5094, y: 0.5479, roomRadius: 0.055, roomHighlightRadius: 0.045 },
    { id: "f2_room_cafe_3", label: "Cafe 3", floor: 2, type: "room", x: 0.4568, y: 0.4604, roomRadius: 0.055, roomHighlightRadius: 0.045 },

    { id: "f2_room_teens", label: "Teens room", floor: 2, type: "room", x: 0.7182, y: 0.5174, roomRadius: 0.07, roomHighlightRadius: 0.055 },
    { id: "f2_room_basketball_court_2", label: "Basketball court 2", floor: 2, type: "room", x: 0.7729, y: 0.4493, roomRadius: 0.08, roomHighlightRadius: 0.062 },
    { id: "f2_room_basketball_court_3", label: "Basketball court 3", floor: 2, type: "room", x: 0.875, y: 0.5917, roomRadius: 0.085, roomHighlightRadius: 0.065 },

    {
      id: "f2_room_ne_n3",
      label: "Room · NE by N3",
      floor: 2,
      type: "room",
      x: 0.6417,
      y: 0.4993,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f2_room_e_courts_w",
      label: "Room · E courts (W)",
      floor: 2,
      type: "room",
      x: 0.6724,
      y: 0.5306,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f2_room_e_courts_s",
      label: "Room · E courts (S)",
      floor: 2,
      type: "room",
      x: 0.701,
      y: 0.5625,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },
    {
      id: "f2_room_s_courts_n",
      label: "Room · S courts (N)",
      floor: 2,
      type: "room",
      x: 0.726,
      y: 0.5903,
      roomRadius: 0.055,
      roomHighlightRadius: 0.045,
    },

    // Halls (waypoints) — paste order + earlier test node; ids stable for `floorGraph.js`.
    { id: "f2_hall_n2", label: "Hall · NE upper", floor: 2, type: "hall", x: 0.6089, y: 0.3979 },
    { id: "f2_hall_e1", label: "Hall · main E1", floor: 2, type: "hall", x: 0.5526, y: 0.5069 },
    { id: "f2_hall_n3", label: "Hall · NE mid", floor: 2, type: "hall", x: 0.6365, y: 0.4437 },
    { id: "f2_hall_w2", label: "Hall · main W2", floor: 2, type: "hall", x: 0.4078, y: 0.5062 },
    {
      id: "f2_hall_w_bridge",
      label: "Hall · W youth / exit W2",
      floor: 2,
      type: "hall",
      x: 0.3917,
      y: 0.5035,
    },
    { id: "f2_hall_w4", label: "Hall · main W4", floor: 2, type: "hall", x: 0.4693, y: 0.5035 },
    { id: "f2_hall_w5", label: "Hall · main W5", floor: 2, type: "hall", x: 0.5203, y: 0.5056 },
    { id: "f2_hall_w1", label: "Hall · main W1", floor: 2, type: "hall", x: 0.3318, y: 0.5049 },
    { id: "f2_hall_w3", label: "Hall · main W3", floor: 2, type: "hall", x: 0.424, y: 0.5056 },
    { id: "f2_hall_n1", label: "Hall · north jog", floor: 2, type: "hall", x: 0.551, y: 0.4562 },
    { id: "f2_hall_e2", label: "Hall · main E2", floor: 2, type: "hall", x: 0.5667, y: 0.5076 },
    { id: "f2_hall_e3", label: "Hall · main E3", floor: 2, type: "hall", x: 0.6172, y: 0.4715 },
    { id: "f2_hall_test", label: "Hall (test)", floor: 2, type: "hall", x: 0.5437, y: 0.3924 },
    { id: "f2_hall_w_jog", label: "Hall · W jog", floor: 2, type: "hall", x: 0.3724, y: 0.4653 },
    { id: "f2_hall_w_exit_w1", label: "Hall · W near exit W1", floor: 2, type: "hall", x: 0.3432, y: 0.466 },
    { id: "f2_hall_w_exit_w2", label: "Hall · W near exit W2", floor: 2, type: "hall", x: 0.3964, y: 0.4639 },
    { id: "f2_hall_ec_mid", label: "Hall · E mid (courts)", floor: 2, type: "hall", x: 0.6719, y: 0.4542 },
    {
      id: "f2_hall_e_courts_teens",
      label: "Hall · E courts / Teens",
      floor: 2,
      type: "hall",
      x: 0.687,
      y: 0.4868,
    },
    {
      id: "f2_hall_s_courts",
      label: "Hall · S courts / exit S",
      floor: 2,
      type: "hall",
      x: 0.7615,
      y: 0.5694,
    },

    { id: "f2_exit_1", label: "Exit 1", floor: 2, type: "exit", x: 0.5026, y: 0.4028 },
    { id: "f2_exit_2", label: "Exit 2", floor: 2, type: "exit", x: 0.6453, y: 0.3889 },
    { id: "f2_exit_3", label: "Exit East 1", floor: 2, type: "exit", x: 0.8708, y: 0.4736 },
    { id: "f2_exit_4", label: "Exit East 2", floor: 2, type: "exit", x: 0.8182, y: 0.5681 },
    { id: "f2_exit_5", label: "Exit West 1", floor: 2, type: "exit", x: 0.3406, y: 0.4299 },
    { id: "f2_exit_6", label: "Exit West 2", floor: 2, type: "exit", x: 0.3958, y: 0.4285 },
    { id: "f2_exit_7", label: "Exit South", floor: 2, type: "exit", x: 0.7964, y: 0.6021 },
    { id: "f2_exit_8", label: "Exit Mid", floor: 2, type: "exit", x: 0.6083, y: 0.5111 },
  ],
};

function getNodesForFloor(floor) {
  const raw = NODES_BY_FLOOR[floor];
  if (!raw) return [];
  if (floor === 1 || floor === 2) return raw.map((n) => enrichNodeForFloor(floor, n));
  return [...raw];
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
    if (found) return enrichNodeForFloor(Number(floor), found);
  }
  return null;
}

module.exports = {
  NODES_BY_FLOOR,
  FLOOR_1_ACCESSIBLE_NODE_IDS,
  FLOOR_2_ACCESSIBLE_NODE_IDS,
  getNodesForFloor,
  getNodesForPublicMapOverlay,
  getNodesForDevOverlay,
  getNodeById,
};
