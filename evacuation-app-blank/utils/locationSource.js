/**
 * Location source abstraction (prototype-friendly).
 *
 * Ready to swap location inputs later:
 * - mock (hardcoded / scripted)
 * - BLE estimator (already scaffolded in services/bleScanner + utils/locationEstimator)
 * - manual selection (e.g. pick a room/node)
 */

const { getNodesForFloor } = require("./floorNodes");

/** Default test-position room when switching floors (no "Default mock" chip). */
function getDefaultMockPresetIdForFloor(floor) {
  if (floor === 2) return "f2_room_cafe";
  return "f1_room_1";
}

/** Fallback coords if a preset id is missing from the graph. */
function getMockLocationForFloor(floor) {
  const id = getDefaultMockPresetIdForFloor(floor);
  const node = getNodesForFloor(floor).find((n) => n.id === id && n.type === "room");
  if (node) return { x: node.x, y: node.y };
  if (floor === 1) {
    const squash1 = getNodesForFloor(1).find((n) => n.id === "f1_room_1");
    if (squash1) return { x: squash1.x, y: squash1.y };
  }
  return { x: 0.5, y: 0.5 };
}

/**
 * Presets for Tools → "Test position": room nodes only.
 * @param {number} floor
 * @returns {{ id: string, label: string, x: number, y: number }[]}
 */
function getMockLocationPresets(floor) {
  return getNodesForFloor(floor)
    .filter((n) => n.type === "room")
    .map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y }));
}

/**
 * @param {number} floor
 * @param {string | null | undefined} presetId
 */
function resolveMockLocation(floor, presetId) {
  const id = presetId || getDefaultMockPresetIdForFloor(floor);
  const found = getMockLocationPresets(floor).find((p) => p.id === id);
  return found ? { x: found.x, y: found.y } : getMockLocationForFloor(floor);
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

module.exports = {
  getMockLocationForFloor,
  getMockLocationPresets,
  resolveMockLocation,
  pickUserLocation,
  getDefaultMockPresetIdForFloor,
};
