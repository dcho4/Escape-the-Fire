/**
 * Evacuation route polylines per floor.
 *
 * Floors 1–2: paths from `floorGraph.js` (accessibility graph in `floorNodes.js`).
 * Other floors: presets from `routes.js` only.
 */

const { getRoutesForFloor } = require("./routes");
const { shortestPath } = require("./floorGraph");
const { getNodesForFloor, getNodeById } = require("./floorNodes");
const { getHighlightedRoomForUser } = require("./roomHighlight");

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Graph node to start routing from: room if user is inside one, else nearest non-exit node.
 * @param {{ x: number, y: number }} userLocation
 * @param {number} floor
 * @returns {string | null}
 */
function pickGraphRoutingStartId(userLocation, floor) {
  const room = getHighlightedRoomForUser(userLocation, floor);
  if (room) return room.id;
  let bestId = null;
  let bestD = Infinity;
  for (const n of getNodesForFloor(floor)) {
    if (n.type === "exit") continue;
    const d = dist(userLocation, { x: n.x, y: n.y });
    if (d < bestD) {
      bestD = d;
      bestId = n.id;
    }
  }
  return bestId;
}

/**
 * @param {string[]} pathIds
 * @returns {{ x: number, y: number }[]}
 */
function pathIdsToPoints(pathIds) {
  return pathIds.map((id) => {
    const n = getNodeById(id);
    return { x: n.x, y: n.y };
  });
}

/**
 * All evacuation goals on floor 2. `priority` is a tiebreaker only: `getSafestRoute` picks the
 * shortest fire-clear path first; when two paths have the same length, lower priority wins
 * (official exits 1–2, then mid, S, E1/E2, W1/W2).
 */
const F1_EXIT_GOALS = [
  { goalId: "f1_exit_1", routeId: "f1_exit1", priority: 0 },
  { goalId: "f1_exit_2", routeId: "f1_exit2", priority: 1 },
  { goalId: "f1_exit_3", routeId: "f1_exit3", priority: 2 },
];

const F2_EXIT_GOALS = [
  { goalId: "f2_exit_1", routeId: "f2_exit1", priority: 0 },
  { goalId: "f2_exit_2", routeId: "f2_exit2", priority: 1 },
  { goalId: "f2_exit_8", routeId: "f2_exit_mid", priority: 2 },
  { goalId: "f2_exit_7", routeId: "f2_exit_door_s", priority: 3 },
  { goalId: "f2_exit_3", routeId: "f2_exit_door_e1", priority: 4 },
  { goalId: "f2_exit_4", routeId: "f2_exit_door_e2", priority: 5 },
  { goalId: "f2_exit_5", routeId: "f2_exit_door_w1", priority: 6 },
  { goalId: "f2_exit_6", routeId: "f2_exit_door_w2", priority: 7 },
];

const SNAP_MERGE_EPS = 0.002;

/**
 * @param {number} floor
 * @param {{ x: number, y: number } | null | undefined} userLocation
 */
function getEvacuationRoutesForFloor(floor, userLocation) {
  const staticRoutes = getRoutesForFloor(floor);

  const useGraph =
    (floor === 1 || floor === 2) &&
    userLocation &&
    typeof userLocation.x === "number" &&
    typeof userLocation.y === "number";

  if (!useGraph) {
    return staticRoutes;
  }

  const startId = pickGraphRoutingStartId(userLocation, floor);
  if (!startId) return staticRoutes;

  const goals = floor === 1 ? F1_EXIT_GOALS : F2_EXIT_GOALS;
  const out = [];
  for (const { goalId, routeId, priority } of goals) {
    const pathIds = shortestPath(floor, startId, goalId);
    if (!pathIds || pathIds.length < 2) {
      const fallback = staticRoutes.find((r) => r.id === routeId);
      if (fallback) out.push({ ...fallback, priority });
      continue;
    }
    let pts = pathIdsToPoints(pathIds);
    if (dist(userLocation, pts[0]) > SNAP_MERGE_EPS) {
      pts = [{ x: userLocation.x, y: userLocation.y }, ...pts];
    } else {
      pts = [{ x: userLocation.x, y: userLocation.y }, ...pts.slice(1)];
    }
    out.push({ id: routeId, points: pts, priority });
  }

  return out.length > 0 ? out : staticRoutes;
}

/**
 * Human-readable destination for the evacuation panel (uses exit node labels from `floorNodes.js`).
 * @param {number} floor
 * @param {string} routeId
 */
function getRouteDisplayTitle(floor, routeId) {
  const goals = floor === 1 ? F1_EXIT_GOALS : floor === 2 ? F2_EXIT_GOALS : [];
  const hit = goals.find((g) => g.routeId === routeId);
  if (hit) {
    const node = getNodeById(hit.goalId);
    if (node && node.label) return node.label;
  }
  return routeId
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { getEvacuationRoutesForFloor, pickGraphRoutingStartId, getRouteDisplayTitle };
