/**
 * Location source abstraction (prototype-friendly).
 *
 * Ready to swap location inputs later:
 * - mock (hardcoded / scripted)
 * - BLE estimator (already scaffolded in services/bleScanner + utils/locationEstimator)
 * - manual selection (e.g. pick a room/node)
 */

function getMockLocationForFloor(floor) {
  // Placed near `type: "room"` nodes so “current room” highlight demos clearly.
  if (floor === 2) return { x: 0.52, y: 0.3 };
  return { x: 0.16, y: 0.56 };
}

/**
 * Decide which location to use right now.
 * Keep the policy in one place so the UI can remain simple.
 */
function pickUserLocation({ floor, mockLocation, bleEnabled, bleEstimated }) {
  if (bleEnabled && bleEstimated && typeof bleEstimated.x === "number" && typeof bleEstimated.y === "number") {
    return bleEstimated;
  }
  return mockLocation || getMockLocationForFloor(floor);
}

module.exports = { getMockLocationForFloor, pickUserLocation };

