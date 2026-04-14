/**
 * BLE scanning bridge for beacon-style indoor positioning.
 *
 * ---------------------------------------------------------------------------
 * EXPO GO
 * ---------------------------------------------------------------------------
 * Expo Go does not include native BLE scanning. For real hardware you need a
 * development build:
 *   - `eas build --profile development --platform android|ios`
 *   - `npx expo start --dev-client`
 *
 * ---------------------------------------------------------------------------
 * MOCK (Expo Go / fast prototyping)
 * ---------------------------------------------------------------------------
 * `useMock: true` simulates RSSI so UI + `estimateLocationFromRssi` work without hardware.
 *
 * ---------------------------------------------------------------------------
 * NATIVE (dev / production builds)
 * ---------------------------------------------------------------------------
 * `useMock: false` uses `react-native-ble-plx` to scan advertisements and emit a
 * `{ [beaconId]: rssi }` map. Each advertisement is matched to a beacon registry row
 * (see `utils/beacons.js`) by `beaconId` substring on `device.name`, `device.localName`,
 * or `device.id`, plus optional `bleNames` / `bleDeviceIdSubstrings`.
 */

const { Platform, PermissionsAndroid } = require("react-native");
const { getBeaconsForFloor } = require("../utils/beacons");

const NATIVE_RSSI_FLUSH_MS = 450;

function toLowerString(v) {
  return String(v || "").toLowerCase();
}

/**
 * @param {import('react-native-ble-plx').Device} device
 * @param {ReturnType<typeof getBeaconsForFloor>} beacons
 * @returns {string | null}
 */
function matchDeviceToBeaconId(device, beacons) {
  const id = toLowerString(device?.id);
  const name = toLowerString(device?.name || device?.localName);

  for (const b of beacons) {
    const beaconId = String(b?.beaconId || "");
    const bid = toLowerString(beaconId);
    if (!bid) continue;

    if (name === bid || id === bid) return beaconId;
    if (name.includes(bid) || id.includes(bid)) return beaconId;

    if (Array.isArray(b.bleNames)) {
      for (const n of b.bleNames) {
        const nn = toLowerString(n);
        if (nn && name.includes(nn)) return beaconId;
      }
    }

    if (Array.isArray(b.bleDeviceIdSubstrings)) {
      for (const s of b.bleDeviceIdSubstrings) {
        const ss = toLowerString(s);
        if (ss && id.includes(ss)) return beaconId;
      }
    }
  }

  return null;
}

async function ensureAndroidBlePermissions() {
  if (Platform.OS !== "android") return true;

  try {
    const v =
      typeof Platform.Version === "number"
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (v >= 31) {
      const scan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: "Bluetooth scan",
          message: "Bluetooth is used to detect nearby evacuation beacons.",
          buttonPositive: "OK",
        }
      );
      if (scan !== PermissionsAndroid.RESULTS.GRANTED) return false;

      const conn = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: "Bluetooth",
          message: "Bluetooth is required for beacon scanning.",
          buttonPositive: "OK",
        }
      );
      return conn === PermissionsAndroid.RESULTS.GRANTED;
    }

    const loc = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location",
        message:
          "On this Android version, location permission is required for Bluetooth scanning.",
        buttonPositive: "OK",
      }
    );
    return loc === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[bleScanner] Android permission error", e);
    }
    return false;
  }
}

function startNativeBleScan({ floor, onRssiByBeaconId }) {
  let cancelled = false;
  /** @type {import('react-native-ble-plx').BleManager | null} */
  let manager = null;
  /** @type {{ remove: () => void } | null} */
  let stateSub = null;
  let flushTimer = null;

  /** @type {Record<string, number>} */
  const rssiByBeaconId = {};
  const beacons = getBeaconsForFloor(floor);

  const flush = () => {
    if (cancelled) return;
    if (Object.keys(rssiByBeaconId).length === 0) return;
    onRssiByBeaconId({ ...rssiByBeaconId });
  };

  (async () => {
    const ok = await ensureAndroidBlePermissions();
    if (cancelled || !ok) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[bleScanner] Native BLE: permission denied or cancelled.");
      }
      return;
    }

    let BleManager;
    let State;
    try {
      const plx = require("react-native-ble-plx");
      BleManager = plx.BleManager;
      State = plx.State;
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[bleScanner] react-native-ble-plx could not be loaded.", e);
      }
      return;
    }

    try {
      manager = new BleManager();
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          "[bleScanner] BleManager init failed (use a dev build, not Expo Go).",
          e
        );
      }
      return;
    }

    const startScan = () => {
      if (cancelled || !manager) return;
      try {
        manager.stopDeviceScan();
      } catch (_) {
        // ignore
      }

      manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (cancelled || error || !device) return;

        const beaconId = matchDeviceToBeaconId(device, beacons);
        if (!beaconId) return;

        const rssi = device.rssi;
        if (typeof rssi !== "number" || !Number.isFinite(rssi)) return;
        rssiByBeaconId[beaconId] = rssi;
      });
    };

    stateSub = manager.onStateChange((state) => {
      if (cancelled || !manager) return;
      if (state === State.PoweredOn) {
        startScan();
      } else {
        try {
          manager.stopDeviceScan();
        } catch (_) {
          // ignore
        }
      }
    }, true);

    flushTimer = setInterval(flush, NATIVE_RSSI_FLUSH_MS);
  })();

  return () => {
    cancelled = true;
    if (flushTimer) clearInterval(flushTimer);

    if (stateSub) {
      try {
        stateSub.remove();
      } catch (_) {
        // ignore
      }
    }

    if (manager) {
      try {
        manager.stopDeviceScan();
      } catch (_) {
        // ignore
      }
      try {
        manager.destroy();
      } catch (_) {
        // ignore
      }
    }
  };
}

function startBleScanning({ floor, onRssiByBeaconId, useMock = true, mockIntervalMs = 900 } = {}) {
  if (typeof onRssiByBeaconId !== "function") return () => {};

  if (useMock) {
    const id = setInterval(() => {
      const beacons = getBeaconsForFloor(floor);
      const map = {};
      for (const b of beacons) {
        const jitter = Math.sin(Date.now() / 900 + b.beaconId.length) * 8;
        map[b.beaconId] = -65 + jitter + (Math.random() - 0.5) * 6;
      }
      onRssiByBeaconId(map);
    }, mockIntervalMs);
    return () => clearInterval(id);
  }

  if (Platform.OS === "web") {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[bleScanner] BLE scanning is not available on web.");
    }
    return () => {};
  }

  return startNativeBleScan({ floor, onRssiByBeaconId });
}

module.exports = { startBleScanning };
