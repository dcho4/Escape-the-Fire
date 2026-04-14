/**
 * Pick which room the user is "in" for map highlighting.
 *
 * Uses nearest `type: "room"` node in normalized coordinates. Tune `radius`
 * per node later with optional `roomRadius` on the node object.
 *
 * If no room is within `maxDistance`, returns null (user may be in a hall).
 */

const { getNodesForFloor } = require("./floorNodes");

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * @param {{ x: number, y: number }} userLocation normalized
 * @param {number} floor
 * @param {number} [maxDistance] max Euclidean distance in normalized space (0..~1.4)
 */
function getHighlightedRoomForUser(userLocation, floor, maxDistance = 0.22) {
  if (!userLocation || typeof userLocation.x !== "number" || typeof userLocation.y !== "number") {
    return null;
  }
  const rooms = getNodesForFloor(floor).filter((n) => n.type === "room");
  if (!rooms.length) return null;

  const maxD2 = maxDistance * maxDistance;
  let best = null;
  let bestD2 = Infinity;

  for (const room of rooms) {
    const r = typeof room.roomRadius === "number" ? room.roomRadius : maxDistance;
    const d2 = dist2(userLocation.x, userLocation.y, room.x, room.y);
    if (d2 <= r * r && d2 < bestD2) {
      best = room;
      bestD2 = d2;
    }
  }

  // If nothing within per-room radius, fall back to nearest room within maxDistance
  if (!best) {
    for (const room of rooms) {
      const d2 = dist2(userLocation.x, userLocation.y, room.x, room.y);
      if (d2 <= maxD2 && d2 < bestD2) {
        best = room;
        bestD2 = d2;
      }
    }
  }

  return best;
}

/** Normalized map units: how close a point must be to snap a landmark name for hazard copy. */
const NEAR_LANDMARK_FOR_COPY = 0.11;

function pct01(v) {
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

/**
 * Short phrase for UI when placing a hazard (fire) on the map.
 * @param {number} floor
 * @param {number} x
 * @param {number} y
 */
function describeMapPointForHazard(floor, x, y) {
  const nodes = getNodesForFloor(floor);
  if (!nodes.length) {
    return `about ${pct01(x)}% from the left, ${pct01(y)}% from the top`;
  }
  let best = nodes[0];
  let bestD2 = dist2(x, y, best.x, best.y);
  for (let i = 1; i < nodes.length; i += 1) {
    const n = nodes[i];
    const d2 = dist2(x, y, n.x, n.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = n;
    }
  }
  const d = Math.sqrt(bestD2);
  if (d <= NEAR_LANDMARK_FOR_COPY) {
    return `next to ${best.label}`;
  }
  return `around ${pct01(x)}% from the left edge and ${pct01(y)}% from the top`;
}

module.exports = { getHighlightedRoomForUser, describeMapPointForHazard };
