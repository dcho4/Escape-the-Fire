const React = require("react");
const {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  ScrollView,
  Platform,
} = require("react-native");
const { GestureHandlerRootView } = require("react-native-gesture-handler");
const { StatusBar } = require("expo-status-bar");

const MapView = require("./components/MapView");
const { getRoutesForFloor } = require("./utils/routes");
const { getSafestRoute } = require("./utils/pathfinding");
const { createFireZone } = require("./utils/fireZones");
const { startBleScanning } = require("./services/bleScanner");
const { estimateLocationFromRssi } = require("./utils/locationEstimator");
const { FLOORS, getFloorConfig } = require("./utils/floorConfig");
const { getNodesForPublicMapOverlay, getNodesForDevOverlay } = require("./utils/floorNodes");
const { getMockLocationForFloor, pickUserLocation } = require("./utils/locationSource");
const { getHighlightedRoomForUser } = require("./utils/roomHighlight");

/**
 * Indoor evacuation UI — SVG vector base map + normalized overlays.
 *
 * • Replace vector art: `assets/floor1.svg`, `assets/floor2.svg` (keep viewBox in sync with `utils/floorMeta.js`).
 * • Nodes: `utils/floorNodes.js` — rooms, halls, stairs, exits.
 * • Graph (future routing): `utils/floorGraph.js`.
 * • Dev mode: tap map for coordinates; all node labels visible.
 */

function FloorChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function makeDevMarkerId() {
  return `devm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

module.exports = function App() {
  const [floor, setFloor] = React.useState(1);
  const [adminMode, setAdminMode] = React.useState(false);
  const [devMode, setDevMode] = React.useState(false);
  const [fireZones, setFireZones] = React.useState([]);
  const [moreTools, setMoreTools] = React.useState(false);

  const [bleEnabled, setBleEnabled] = React.useState(false);
  const [bleMock, setBleMock] = React.useState(true);
  const [bleEstimated, setBleEstimated] = React.useState(null);

  // Default ON per request. (Zoom/pan is temporarily disabled in MapView for Expo Go stability.)
  const [followUser, setFollowUser] = React.useState(true);
  const [recenterTick, setRecenterTick] = React.useState(0);

  const [devMarkers, setDevMarkers] = React.useState([]);
  const [lastDevCoord, setLastDevCoord] = React.useState(null);

  const floorConfig = React.useMemo(() => getFloorConfig(floor), [floor]);

  const SvgMap = floorConfig?.mapType === "svg" ? floorConfig.svgComponent : null;

  const mapNodes = React.useMemo(() => {
    return devMode ? getNodesForDevOverlay(floor) : getNodesForPublicMapOverlay(floor);
  }, [floor, devMode]);

  const userLocation = React.useMemo(() => {
    return pickUserLocation({
      floor,
      mockLocation: getMockLocationForFloor(floor),
      bleEnabled,
      bleEstimated,
    });
  }, [floor, bleEnabled, bleEstimated]);

  const highlightedRoom = React.useMemo(
    () => getHighlightedRoomForUser(userLocation, floor),
    [userLocation, floor]
  );

  React.useEffect(() => {
    setBleEstimated(null);
  }, [floor]);

  React.useEffect(() => {
    if (!bleEnabled) {
      setBleEstimated(null);
      return undefined;
    }
    return startBleScanning({
      floor,
      useMock: bleMock,
      onRssiByBeaconId: (rssiMap) => {
        setBleEstimated(estimateLocationFromRssi(rssiMap, floor));
      },
    });
  }, [bleEnabled, bleMock, floor]);

  const routes = React.useMemo(() => getRoutesForFloor(floor), [floor]);

  const bestRoute = React.useMemo(() => {
    return getSafestRoute({
      location: userLocation,
      routes,
      fireZones,
      floor,
    });
  }, [userLocation, routes, fireZones, floor]);

  function addFireAt({ floor: f, x, y }) {
    setFireZones((prev) => [...prev, createFireZone({ floor: f, x, y, radius: 0.08 })]);
  }

  function onDevTap({ floor: f, x, y }) {
    setDevMarkers((prev) => [...prev, { id: makeDevMarkerId(), floor: f, x, y }]);
    setLastDevCoord(`floor ${f}  x: ${x.toFixed(4)}  y: ${y.toFixed(4)}`);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          {/* Status / route card (maps-style top sheet) */}
          <View style={styles.topCard}>
            <Text style={styles.appTitle}>Evacuation</Text>
            {highlightedRoom ? (
              <View style={styles.youAreHere}>
                <Text style={styles.youAreHereLabel}>You appear to be in</Text>
                <Text style={styles.youAreHereValue} numberOfLines={1}>
                  {highlightedRoom.label}
                </Text>
              </View>
            ) : (
              <View style={styles.youAreHereMuted}>
                <Text style={styles.youAreHereMutedText}>Position: corridor / unknown area</Text>
              </View>
            )}
            <View style={styles.chipRow}>
              {FLOORS.map((f) => (
                <FloorChip key={f.id} label={f.label} active={floor === f.id} onPress={() => setFloor(f.id)} />
              ))}
            </View>
          {bestRoute ? (
            <View style={styles.routeOk}>
              <Text style={styles.routeOkLabel}>Active route</Text>
              <Text style={styles.routeOkValue} numberOfLines={1}>
                {bestRoute.id}
              </Text>
            </View>
          ) : (
            <View style={styles.routeWarn}>
              <Text style={styles.routeWarnTitle}>No safe route</Text>
              <Text style={styles.routeWarnSub}>Clear hazards or change floor.</Text>
            </View>
          )}
          {lastDevCoord && devMode ? (
            <Text style={styles.devCoordMono} numberOfLines={2}>
              {lastDevCoord}
            </Text>
          ) : null}
          <Pressable onPress={() => setMoreTools(!moreTools)} style={styles.moreToggle}>
            <Text style={styles.moreToggleText}>{moreTools ? "Hide tools ▲" : "Tools & sensors ▼"}</Text>
          </Pressable>
          {moreTools ? (
            <ScrollView style={styles.toolsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <View style={styles.toolRow}>
                <Text style={styles.toolLabel}>Admin · hazard</Text>
                <Switch
                  value={adminMode}
                  onValueChange={setAdminMode}
                  trackColor={{ false: "#334155", true: "rgba(239, 68, 68, 0.55)" }}
                  thumbColor={adminMode ? "#fecaca" : "#64748b"}
                />
              </View>
              <View style={styles.toolRow}>
                <Text style={styles.toolLabel}>Dev · coords & nodes</Text>
                <Switch
                  value={devMode}
                  onValueChange={setDevMode}
                  trackColor={{ false: "#334155", true: "rgba(14, 165, 233, 0.5)" }}
                  thumbColor={devMode ? "#7dd3fc" : "#64748b"}
                />
              </View>
              <View style={styles.toolRow}>
                <Text style={styles.toolLabel}>BLE position</Text>
                <Switch value={bleEnabled} onValueChange={setBleEnabled} />
              </View>
              <View style={styles.toolRow}>
                <Text style={[styles.toolLabel, !bleEnabled && styles.muted]}>BLE mock RSSI</Text>
                <Switch value={bleMock} onValueChange={setBleMock} disabled={!bleEnabled} />
              </View>
              <View style={styles.toolRow}>
                <Text style={styles.toolLabel}>Follow user</Text>
                <Switch value={followUser} onValueChange={setFollowUser} />
              </View>
              <Pressable
                onPress={() => setRecenterTick((t) => t + 1)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Recenter map</Text>
              </Pressable>
              <View style={styles.bottomActions}>
                <Pressable
                  onPress={() => setFireZones([])}
                  style={[styles.miniBtn, styles.miniBtnOutline]}
                >
                  <Text style={styles.miniBtnText}>Clear hazards</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDevMarkers([]);
                    setLastDevCoord(null);
                  }}
                  style={[styles.miniBtn, styles.miniBtnOutline]}
                >
                  <Text style={styles.miniBtnText}>Clear dev pins</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}
          </View>

          <View style={styles.mapShell}>
            <MapView
              floor={floor}
              svgMapComponent={SvgMap}
              mapNodes={mapNodes}
              userLocation={userLocation}
              highlightedRoom={highlightedRoom}
              route={bestRoute}
              fireZones={fireZones}
              adminMode={adminMode}
              devMode={devMode}
              onAddFireZone={addFireAt}
              onDevTap={onDevTap}
              devMarkers={devMarkers.filter((m) => m.floor === floor)}
              recenterTick={recenterTick}
              followUser={followUser}
            />
          </View>
        </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  topCard: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 14,
    backgroundColor: "#152238",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  youAreHere: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.45)",
  },
  youAreHereLabel: { fontSize: 11, fontWeight: "700", color: "#67e8f9", textTransform: "uppercase", letterSpacing: 0.8 },
  youAreHereValue: { fontSize: 17, fontWeight: "800", color: "#ecfeff", marginTop: 4 },
  youAreHereMuted: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  youAreHereMutedText: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  chipActive: { backgroundColor: "rgba(14, 165, 233, 0.35)", borderColor: "#38bdf8" },
  chipLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  chipLabelActive: { color: "#e0f2fe" },
  routeOk: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.45)",
  },
  routeOkLabel: { fontSize: 12, color: "#86efac", fontWeight: "700" },
  routeOkValue: { fontSize: 15, color: "#f0fdf4", fontWeight: "800", marginTop: 4 },
  routeWarn: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
  },
  routeWarnTitle: { fontSize: 15, fontWeight: "800", color: "#fca5a5" },
  routeWarnSub: { fontSize: 13, color: "#cbd5e1", marginTop: 4 },
  devCoordMono: {
    marginTop: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    color: "#7dd3fc",
  },
  moreToggle: { marginTop: 12, paddingVertical: 6 },
  moreToggleText: { fontSize: 13, fontWeight: "700", color: "#38bdf8" },
  toolsScroll: { maxHeight: 220, marginTop: 4 },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  toolLabel: { fontSize: 14, color: "#e2e8f0", fontWeight: "500" },
  muted: { color: "#64748b" },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(14, 165, 233, 0.2)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  secondaryBtnText: { color: "#7dd3fc", fontWeight: "800", fontSize: 14 },
  bottomActions: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 4 },
  miniBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  miniBtnOutline: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  miniBtnText: { fontSize: 13, fontWeight: "700", color: "#cbd5e1" },
  mapShell: {
    flex: 1,
    margin: 12,
    marginTop: 10,
    minHeight: 200,
  },
});
