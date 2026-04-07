/**
 * Graph edges between node ids (for future pathfinding).
 *
 * WHERE TO CONNECT NODES FOR PATHFINDING:
 * ---------------------------------------------------------------------------
 * • List undirected links as one row with `bidirectional: true` (default).
 * • Use `weight` for distance/cost (optional); later compute from pixel geometry.
 * • When you add hallway segments, connect adjacent `hall` nodes and rooms to nearest hall.
 *
 * NEXT STEP (not implemented yet):
 * - Run A* / Dijkstra from user’s nearest node to nearest `exit` node.
 * - Remove edges that intersect fire zones (or raise weight).
 * - See `utils/pathfinding.js` for current polyline route logic to replace.
 */

const { getNodesForFloor } = require("./floorNodes");

/**
 * @typedef {Object} GraphEdge
 * @property {string} from
 * @property {string} to
 * @property {number} [weight]
 * @property {boolean} [bidirectional] default true
 */

/** @type {Record<number, GraphEdge[]>} */
const EDGES_BY_FLOOR = {
  // ---- Floor 1: connect nodes for routing (expand as you refine the map) ----
  1: [
    { from: "f1_room_west", to: "f1_hall_main_w", bidirectional: true },
    { from: "f1_hall_main_w", to: "f1_stairs_core", bidirectional: true },
    { from: "f1_stairs_core", to: "f1_hall_main_e", bidirectional: true },
    { from: "f1_hall_main_w", to: "f1_hall_n", bidirectional: true },
    { from: "f1_hall_main_e", to: "f1_hall_n", bidirectional: true },
    { from: "f1_hall_n", to: "f1_exit_c", bidirectional: true },
    { from: "f1_hall_main_w", to: "f1_exit_a", bidirectional: true },
    { from: "f1_hall_main_e", to: "f1_exit_b", bidirectional: true },
  ],

  // ---- Floor 2: example backbone (replace with your real topology) ----
  2: [
    { from: "f2_hall_w", to: "f2_hall_center", bidirectional: true },
    { from: "f2_hall_center", to: "f2_hall_e", bidirectional: true },
    { from: "f2_hall_center", to: "f2_room_north", bidirectional: true },
    { from: "f2_hall_w", to: "f2_stairs_w", bidirectional: true },
    { from: "f2_hall_e", to: "f2_stairs_e", bidirectional: true },
    { from: "f2_room_north", to: "f2_stairs_n", bidirectional: true },
  ],
};

function getEdgesForFloor(floor) {
  return EDGES_BY_FLOOR[floor] ? [...EDGES_BY_FLOOR[floor]] : [];
}

/**
 * Adjacency list: `adj[from] = [{ to, weight }, ...]`
 * Ready for Dijkstra / A* without pulling in a graph library.
 */
function buildAdjacencyList(floor) {
  const edges = getEdgesForFloor(floor);
  /** @type {Record<string, { to: string, weight: number }[]>} */
  const adj = {};

  for (const e of edges) {
    const w = e.weight != null ? e.weight : 1;
    const bothWays = e.bidirectional !== false;
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push({ to: e.to, weight: w });
    if (bothWays) {
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.to].push({ to: e.from, weight: w });
    }
  }
  return adj;
}

/** Euclidean distance in normalized space (cheap edge weight from node positions). */
function suggestEdgeWeight(fromId, toId, floor) {
  const nodes = getNodesForFloor(floor);
  const a = nodes.find((n) => n.id === fromId);
  const b = nodes.find((n) => n.id === toId);
  if (!a || !b) return 1;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

module.exports = {
  EDGES_BY_FLOOR,
  getEdgesForFloor,
  buildAdjacencyList,
  suggestEdgeWeight,
};
