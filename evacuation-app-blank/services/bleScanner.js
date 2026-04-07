/**
 * BLE scanning bridge for BlueCharm-style beacons.
 *
 * ---------------------------------------------------------------------------
 * EXPO GO LIMITATION (important)
 * ---------------------------------------------------------------------------
 * Expo Go does not expose general BLE scanning. For real hardware you need a
 * development build (EAS Build or `npx expo prebuild`) and a native module such as:
 *
 *   npx expo install react-native-ble-plx
 *
 * Then implement `startNativeBleScan` below using BleManager.scan(...), parse
 * advertised manufacturer data / service UUIDs to map packets -> beaconId, and
 * call `onRssiByBeaconId` with the latest RSSI per beacon.
 *
 * ---------------------------------------------------------------------------
 * PROTOTYPE (works in Expo Go)
 * ---------------------------------------------------------------------------
 * `useMock: true` runs a timer that simulates RSSI for beacons on the current
 * floor so you can test UI + `estimateLocationFromRssi` without hardware.
 */

const { getBeaconsForFloor } = require("../utils/beacons");

function startBleScanning({
  floor,
  onRssiByBeaconId,
  useMock = true,
  mockIntervalMs = 900,
} = {}) {
  if (typeof onRssiByBeaconId !== "function") {
    return () => {};
  }

  if (useMock) {
    const id = setInterval(() => {
      const beacons = getBeaconsForFloor(floor);
      const map = {};
      for (const b of beacons) {
        // Fake RSSI: stronger when “near” arbitrary phase (demo jitter)
        const jitter = Math.sin(Date.now() / 900 + b.beaconId.length) * 8;
        map[b.beaconId] = -65 + jitter + (Math.random() - 0.5) * 6;
      }
      onRssiByBeaconId(map);
    }, mockIntervalMs);
    return () => clearInterval(id);
  }

  // -------------------------------------------------------------------------
  // NATIVE BLE (fill in after installing react-native-ble-plx + dev build)
  // -------------------------------------------------------------------------
  // const { BleManager } = require('react-native-ble-plx');
  // const manager = new BleManager();
  // manager.startDeviceScan(null, null, (error, device) => { ... });
  // return () => { manager.stopDeviceScan(); };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      "[bleScanner] Native BLE not wired. Set useMock:true or implement native scan (see file header)."
    );
  }
  return () => {};
}

module.exports = { startBleScanning };
