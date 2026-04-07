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

module.exports = { getHighlightedRoomForUser };
