/**
 * Graph edges between node ids (for future pathfinding).
 *
 * WHERE TO CONNECT NODES FOR PATHFINDING:
 * ---------------------------------------------------------------------------
 * • Floors 1 & 2: edges are built from `FLOOR_*_ACCESSIBLE_NODE_IDS` in `floorNodes.js`.
 *   Do not duplicate those pairs here.
 * • Optional `weight` on an edge overrides geometric length.
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
const EDGES_BY_FLOOR = {};

/**
 * Undirected edges from each node’s `accessibleNodeIds` (see `FLOOR_*_ACCESSIBLE_NODE_IDS`).
 * @param {number} floor
 * @returns {GraphEdge[]}
 */
function buildEdgesFromAccessibility(floor) {
  const nodes = getNodesForFloor(floor);
  const seen = new Set();
  /** @type {GraphEdge[]} */
  const edges = [];
  for (const n of nodes) {
    const ids = n.accessibleNodeIds;
    if (!Array.isArray(ids)) continue;
    for (const tid of ids) {
      const a = n.id < tid ? n.id : tid;
      const b = n.id < tid ? tid : n.id;
      const k = `${a}\0${b}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ from: n.id, to: tid, bidirectional: true });
    }
  }
  return edges;
}

function getEdgesForFloor(floor) {
  if (floor === 1 || floor === 2) return buildEdgesFromAccessibility(floor);
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

/**
 * Weighted adjacency for pathfinding (edge length in map space).
 * @param {number} floor
 * @returns {Record<string, { to: string, weight: number }[]>}
 */
function buildWeightedAdjacencyList(floor) {
  const edges = getEdgesForFloor(floor);
  /** @type {Record<string, { to: string, weight: number }[]>} */
  const adj = {};
  for (const e of edges) {
    const w = e.weight != null ? e.weight : suggestEdgeWeight(e.from, e.to, floor);
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

/**
 * Shortest path between graph nodes (Dijkstra). Returns ordered node ids or null.
 * @param {number} floor
 * @param {string} startId
 * @param {string} goalId
 * @returns {string[] | null}
 */
function shortestPath(floor, startId, goalId) {
  const nodes = getNodesForFloor(floor);
  const nodeIds = nodes.map((n) => n.id);
  if (!nodeIds.includes(startId) || !nodeIds.includes(goalId)) return null;

  const adj = buildWeightedAdjacencyList(floor);
  const INF = Number.POSITIVE_INFINITY;
  /** @type {Record<string, number>} */
  const dist = {};
  /** @type {Record<string, string | undefined>} */
  const prev = {};
  for (const id of nodeIds) dist[id] = INF;
  dist[startId] = 0;

  const visited = new Set();
  while (true) {
    let u = null;
    let best = INF;
    for (const id of nodeIds) {
      if (!visited.has(id) && dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (u === null || best === INF) break;
    if (u === goalId) break;
    visited.add(u);
    for (const { to, weight } of adj[u] || []) {
      const nd = dist[u] + weight;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = u;
      }
    }
  }

  if (dist[goalId] === INF) return null;

  const path = [];
  let cur = goalId;
  while (true) {
    path.push(cur);
    if (cur === startId) break;
    const p = prev[cur];
    if (p === undefined) return null;
    cur = p;
  }
  path.reverse();
  return path;
}

module.exports = {
  EDGES_BY_FLOOR,
  buildEdgesFromAccessibility,
  getEdgesForFloor,
  buildAdjacencyList,
  buildWeightedAdjacencyList,
  suggestEdgeWeight,
  shortestPath,
};
