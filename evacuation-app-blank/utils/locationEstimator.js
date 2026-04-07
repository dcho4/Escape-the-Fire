/**
 * Prototype indoor position from RSSI readings + known beacon coordinates.
 *
 * IMPROVE LATER:
 * - Replace weighted centroid with trilateration / particle filter / Kalman.
 * - Per-beacon path loss calibration (RSSI -> distance).
 * - Smoothing over time to reduce jitter (exponential moving average).
 *
 * `rssiByBeaconId`: { [beaconId: string]: number }
 * Returns normalized { x, y } or null if nothing usable.
 */
const { getBeaconsForFloor } = require("./beacons");

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Higher weight = stronger signal (closer / louder). Tunable for your hardware. */
function weightFromRssi(rssi) {
  if (typeof rssi !== "number" || Number.isNaN(rssi)) return 0;
  // RSSI is negative; map to a small positive weight. Clamp so outliers don’t dominate.
  const w = Math.max(0, (rssi + 100) / 40);
  return w * w;
}

function estimateLocationFromRssi(rssiByBeaconId, floor) {
  const beacons = getBeaconsForFloor(floor);
  let sumW = 0;
  let sumX = 0;
  let sumY = 0;

  for (const b of beacons) {
    const rssi = rssiByBeaconId[b.beaconId];
    if (rssi == null) continue;
    const w = weightFromRssi(rssi);
    if (w <= 0) continue;
    sumW += w;
    sumX += w * b.x;
    sumY += w * b.y;
  }

  if (sumW < 1e-6) return null;

  return {
    x: clamp01(sumX / sumW),
    y: clamp01(sumY / sumW),
  };
}

module.exports = { estimateLocationFromRssi, weightFromRssi };
