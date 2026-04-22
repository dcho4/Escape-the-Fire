/**
 * Indoor position estimation from RSSI + beacon coordinates.
 *
 * Strategy:
 * - Use trilateration when >= 3 beacons have usable readings.
 * - Fall back to weighted centroid if trilateration cannot be solved.
 *
 * `rssiByBeaconId`: { [beaconId: string]: number }
 * Returns normalized { x, y } or null if nothing usable.
 */
const { getBeaconsForFloor } = require("./beacons");
const DEFAULT_TX_POWER_AT_1M = -59;
const DEFAULT_PATH_LOSS_EXPONENT = 2.0;
const MIN_BEACONS_FOR_TRILATERATION = 3;
const MIN_DISTANCE = 0.02;
const MAX_DISTANCE = 2.5;

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

function rssiToDistance(rssi, beacon) {
  if (typeof rssi !== "number" || Number.isNaN(rssi)) return null;
  const txPowerAt1m =
    typeof beacon?.txPowerAt1m === "number" ? beacon.txPowerAt1m : DEFAULT_TX_POWER_AT_1M;
  const n =
    typeof beacon?.pathLossExponent === "number" && beacon.pathLossExponent > 0
      ? beacon.pathLossExponent
      : DEFAULT_PATH_LOSS_EXPONENT;
  const meters = 10 ** ((txPowerAt1m - rssi) / (10 * n));
  if (!Number.isFinite(meters)) return null;
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, meters));
}

function solve2x2(a11, a12, a21, a22, b1, b2) {
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-8) return null;
  return {
    x: (b1 * a22 - b2 * a12) / det,
    y: (a11 * b2 - a21 * b1) / det,
  };
}

function trilaterateLeastSquares(samples) {
  if (!Array.isArray(samples) || samples.length < MIN_BEACONS_FOR_TRILATERATION) return null;
  const ref = samples[0];
  let s11 = 0;
  let s12 = 0;
  let s22 = 0;
  let t1 = 0;
  let t2 = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const cur = samples[i];
    const ai = 2 * (cur.x - ref.x);
    const bi = 2 * (cur.y - ref.y);
    const ci =
      ref.d * ref.d -
      cur.d * cur.d +
      cur.x * cur.x -
      ref.x * ref.x +
      cur.y * cur.y -
      ref.y * ref.y;

    s11 += ai * ai;
    s12 += ai * bi;
    s22 += bi * bi;
    t1 += ai * ci;
    t2 += bi * ci;
  }

  return solve2x2(s11, s12, s12, s22, t1, t2);
}

function weightedCentroidFromSamples(samples) {
  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  for (const s of samples) {
    const w = weightFromRssi(s.rssi);
    if (w <= 0) continue;
    sumW += w;
    sumX += w * s.x;
    sumY += w * s.y;
  }
  if (sumW < 1e-6) return null;
  return { x: sumX / sumW, y: sumY / sumW };
}

function estimateLocationFromRssi(rssiByBeaconId, floor) {
  const beacons = getBeaconsForFloor(floor);
  const samples = [];
  for (const b of beacons) {
    const rssi = rssiByBeaconId[b.beaconId];
    if (rssi == null) continue;
    const d = rssiToDistance(rssi, b);
    if (d == null) continue;
    samples.push({
      beaconId: b.beaconId,
      x: b.x,
      y: b.y,
      rssi,
      d,
    });
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => b.rssi - a.rssi);
  const strongestThree = samples.slice(0, MIN_BEACONS_FOR_TRILATERATION);
  const trilat = trilaterateLeastSquares(strongestThree);
  if (trilat && Number.isFinite(trilat.x) && Number.isFinite(trilat.y)) {
    return {
      x: clamp01(trilat.x),
      y: clamp01(trilat.y),
    };
  }
  const centroid = weightedCentroidFromSamples(samples);
  if (!centroid) return null;
  return {
    x: clamp01(centroid.x),
    y: clamp01(centroid.y),
  };
}

module.exports = {
  estimateLocationFromRssi,
  weightFromRssi,
  rssiToDistance,
  trilaterateLeastSquares,
};
