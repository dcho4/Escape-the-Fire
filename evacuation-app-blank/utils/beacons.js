/**
 * BlueCharm (or compatible) beacon registry for indoor positioning.
 *
 * HOW TO USE:
 * - Replace `beaconId` with the UUID / MAC / advertised id your firmware uses
 *   (whatever `react-native-ble-plx` exposes as device.id or service data).
 * - Set `floor`, `x`, `y` in normalized map coordinates (0..1) for that floor’s PNG.
 * - Add more rows as you install beacons in the building.
 *
 * Later: load this from JSON / remote config instead of hardcoding.
 */
const BLUECHARM_BEACONS = [
  { beaconId: "BLUECHARM-F1-A", floor: 1, x: 0.12, y: 0.78, label: "F1 near exit A" },
  { beaconId: "BLUECHARM-F1-B", floor: 1, x: 0.55, y: 0.82, label: "F1 corridor mid" },
  { beaconId: "BLUECHARM-F1-C", floor: 1, x: 0.82, y: 0.35, label: "F1 east wing" },
  { beaconId: "BLUECHARM-F2-A", floor: 2, x: 0.72, y: 0.72, label: "F2 landing" },
  { beaconId: "BLUECHARM-F2-B", floor: 2, x: 0.35, y: 0.55, label: "F2 west" },
  { beaconId: "BLUECHARM-F2-C", floor: 2, x: 0.88, y: 0.42, label: "F2 east" },
];

function getBeaconsForFloor(floor) {
  return BLUECHARM_BEACONS.filter((b) => b.floor === floor);
}

function getBeaconById(beaconId) {
  return BLUECHARM_BEACONS.find((b) => b.beaconId === beaconId) || null;
}

module.exports = { BLUECHARM_BEACONS, getBeaconsForFloor, getBeaconById };
