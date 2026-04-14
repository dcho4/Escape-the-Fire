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
const { useSafeAreaInsets } = require("react-native-safe-area-context");
const { StatusBar } = require("expo-status-bar");

const MapView = require("./components/MapView");
const { getEvacuationRoutesForFloor } = require("./utils/evacuationRoutes");
const { getSafestRoute } = require("./utils/pathfinding");
const { createFireZone } = require("./utils/fireZones");
const { startBleScanning } = require("./services/bleScanner");
const { estimateLocationFromRssi } = require("./utils/locationEstimator");
const { FLOORS, getFloorConfig } = require("./utils/floorConfig");
const { getNodesForDevOverlay } = require("./utils/floorNodes");
const {
  pickUserLocation,
  getMockLocationPresets,
  resolveMockLocation,
  getDefaultMockPresetIdForFloor,
} = require("./utils/locationSource");
const { getHighlightedRoomForUser, describeMapPointForHazard } = require("./utils/roomHighlight");
const { getRouteDisplayTitle } = require("./utils/evacuationRoutes");

/**
 * Indoor evacuation UI — SVG vector base map + normalized overlays.
 *
 * • Replace vector art: `assets/floor1.svg`, `assets/floor2.svg` (keep viewBox in sync with `utils/floorMeta.js`).
 * • Nodes: `utils/floorNodes.js` — rooms, halls, stairs, exits.
 * • Graph (future routing): `utils/floorGraph.js`.
 * • Dev mode: tap map for coordinates; all node labels visible.
 */

function FloorChip({ label, active, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, styles.floorChipCompact]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel || `Switch to ${label}`}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function makeDevMarkerId() {
  return `devm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

module.exports = function App() {
  const insets = useSafeAreaInsets();
  const [floor, setFloor] = React.useState(1);
  const [adminMode, setAdminMode] = React.useState(false);
  const [devMode, setDevMode] = React.useState(false);
  const [fireZones, setFireZones] = React.useState([]);
  const [moreTools, setMoreTools] = React.useState(false);
  const [sheetVisible, setSheetVisible] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const [bleEnabled, setBleEnabled] = React.useState(false);
  const [bleMock, setBleMock] = React.useState(true);
  const [bleEstimated, setBleEstimated] = React.useState(null);

  // Default ON per request. (Zoom/pan is temporarily disabled in MapView for Expo Go stability.)
  const [followUser, setFollowUser] = React.useState(true);
  const [recenterTick, setRecenterTick] = React.useState(0);

  const [devMarkers, setDevMarkers] = React.useState([]);
  const [lastDevCoord, setLastDevCoord] = React.useState(null);
  const [mockLocationPresetId, setMockLocationPresetId] = React.useState(() =>
    getDefaultMockPresetIdForFloor(1)
  );

  const floorConfig = React.useMemo(() => getFloorConfig(floor), [floor]);
  const mockLocationPresets = React.useMemo(() => getMockLocationPresets(floor), [floor]);

  const SvgMap = floorConfig?.mapType === "svg" ? floorConfig.svgComponent : null;

  const mapNodes = React.useMemo(() => {
    // Only show nodes when authoring in Dev mode (keeps the map uncluttered).
    return devMode ? getNodesForDevOverlay(floor) : [];
  }, [floor, devMode]);

  const userLocation = React.useMemo(() => {
    const mockLocation = resolveMockLocation(floor, mockLocationPresetId);
    return pickUserLocation({
      floor,
      mockLocation,
      bleEnabled,
      bleEstimated,
    });
  }, [floor, bleEnabled, bleEstimated, mockLocationPresetId]);

  React.useEffect(() => {
    setMockLocationPresetId(getDefaultMockPresetIdForFloor(floor));
  }, [floor]);

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

  const routes = React.useMemo(() => getEvacuationRoutesForFloor(floor, userLocation), [floor, userLocation]);

  const bestRoute = React.useMemo(() => {
    return getSafestRoute({
      location: userLocation,
      routes,
      fireZones,
      floor,
    });
  }, [userLocation, routes, fireZones, floor]);

  const fireNoticeContent = React.useMemo(() => {
    if (!fireZones.length) return null;
    const lines = fireZones.map((z, i) => {
      const fCfg = getFloorConfig(z.floor);
      const where = describeMapPointForHazard(z.floor, z.x, z.y);
      return `${i + 1}. ${fCfg.label}: ${where}`;
    });
    const n = fireZones.length;
    const title = n === 1 ? "Hazard location" : `${n} hazards`;
    return { title, body: lines.join("\n") };
  }, [fireZones]);

  function addFireAt({ floor: f, x, y }) {
    setFireZones((prev) => [...prev, createFireZone({ floor: f, x, y, radius: 0.01125 })]);
  }

  function onDevTap({ floor: f, x, y }) {
    setDevMarkers((prev) => [...prev, { id: makeDevMarkerId(), floor: f, x, y }]);
    setLastDevCoord(`floor ${f}  x: ${x.toFixed(4)}  y: ${y.toFixed(4)}`);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <View style={styles.screen}>
            <View style={styles.mapFullscreen}>
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
                fitMode="cover"
                fullBleed
              />
              <View
                style={[styles.floorBar, { bottom: Math.max(insets.bottom, 10) + 8, right: 12 }]}
                pointerEvents="box-none"
              >
                <Text style={styles.floorBarLabel}>Floor</Text>
                <View style={styles.floorBarChips}>
                  {FLOORS.map((f) => (
                    <FloorChip
                      key={f.id}
                      label={f.id === 1 ? "1" : "2"}
                      active={floor === f.id}
                      onPress={() => setFloor(f.id)}
                      accessibilityLabel={`${f.label}. ${floor === f.id ? "Selected" : "Tap to select"}`}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Dropdown header (always on top unless deleted) */}
            {sheetVisible ? (
              <View style={styles.sheetWrap} pointerEvents="box-none">
                <View style={styles.sheetHeaderRow}>
                  <Pressable
                    onPress={() => setSheetOpen((v) => !v)}
                    style={styles.sheetHeader}
                    accessibilityRole="button"
                    accessibilityLabel={sheetOpen ? "Collapse evacuation panel" : "Expand evacuation panel"}
                  >
                    <Text style={styles.sheetTitle}>Evacuation</Text>
                    <Text style={styles.sheetChevron}>{sheetOpen ? "▼" : "▲"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSheetVisible(false)}
                    style={styles.sheetClose}
                    accessibilityRole="button"
                    accessibilityLabel="Hide evacuation panel"
                  >
                    <Text style={styles.sheetCloseText}>✕</Text>
                  </Pressable>
                </View>

                {sheetOpen ? (
                  <View style={styles.topCard}>
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
                    {bestRoute ? (
                      <View style={styles.routeOk}>
                        <Text style={styles.routeOkLabel}>Active route</Text>
                        <Text style={styles.routeOkValue} numberOfLines={2}>
                          {getRouteDisplayTitle(floor, bestRoute.id)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.routeWarn}>
                        <Text style={styles.routeWarnTitle}>No safe route</Text>
                        <Text style={styles.routeWarnSub}>Clear hazards or change floor.</Text>
                      </View>
                    )}
                    {fireNoticeContent ? (
                      <View style={styles.fireNotice}>
                        <Text style={styles.fireNoticeLabel}>{fireNoticeContent.title}</Text>
                        <Text style={styles.fireNoticeText}>{fireNoticeContent.body}</Text>
                      </View>
                    ) : null}
                    {lastDevCoord && devMode ? (
                      <Text style={styles.devCoordMono} numberOfLines={2}>
                        {lastDevCoord}
                      </Text>
                    ) : null}

                    <View style={styles.quickActionsRow}>
                      <Pressable
                        onPress={() => setMoreTools(!moreTools)}
                        style={styles.moreToggle}
                        accessibilityRole="button"
                        accessibilityLabel={moreTools ? "Hide tools and sensors" : "Show tools and sensors"}
                      >
                        <Text style={styles.moreToggleText}>{moreTools ? "Hide tools ▲" : "Tools & sensors ▼"}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setFireZones([])}
                        style={[styles.clearFiresBtn, fireZones.length === 0 && styles.clearFiresBtnDisabled]}
                        disabled={fireZones.length === 0}
                        accessibilityRole="button"
                        accessibilityLabel="Remove all fires"
                        accessibilityHint="Clears all hazard zones on all floors"
                      >
                        <Text style={styles.clearFiresBtnText}>Remove all fires</Text>
                      </Pressable>
                    </View>

                    {moreTools ? (
                      <ScrollView style={styles.toolsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        <View style={styles.toolRow}>
                          <Text style={styles.toolLabel}>Admin · hazard</Text>
                          <Switch
                            value={adminMode}
                            onValueChange={setAdminMode}
                            accessibilityLabel="Admin mode"
                            accessibilityHint="When enabled, tapping the map places a hazard"
                            trackColor={{ false: "#334155", true: "rgba(239, 68, 68, 0.55)" }}
                            thumbColor={adminMode ? "#fecaca" : "#64748b"}
                          />
                        </View>
                        <View style={styles.toolRow}>
                          <Text style={styles.toolLabel}>Dev · coords & nodes</Text>
                          <Switch
                            value={devMode}
                            onValueChange={setDevMode}
                            accessibilityLabel="Developer mode"
                            accessibilityHint="When enabled, map taps show coordinates and nodes are visible"
                            trackColor={{ false: "#334155", true: "rgba(14, 165, 233, 0.5)" }}
                            thumbColor={devMode ? "#7dd3fc" : "#64748b"}
                          />
                        </View>
                        <View style={styles.toolRow}>
                          <Text style={styles.toolLabel}>BLE position</Text>
                          <Switch
                            value={bleEnabled}
                            onValueChange={setBleEnabled}
                            accessibilityLabel="Bluetooth position"
                            accessibilityHint="Uses BLE beacons to estimate your position"
                          />
                        </View>
                        <View style={styles.toolRow}>
                          <Text style={[styles.toolLabel, !bleEnabled && styles.muted]}>BLE mock RSSI</Text>
                          <Switch
                            value={bleMock}
                            onValueChange={setBleMock}
                            disabled={!bleEnabled}
                            accessibilityLabel="Use mock Bluetooth signal"
                            accessibilityHint="Simulates BLE readings for testing"
                          />
                        </View>
                        <View style={styles.toolRow}>
                          <Text style={styles.toolLabel}>Follow user</Text>
                          <Switch
                            value={followUser}
                            onValueChange={setFollowUser}
                            accessibilityLabel="Follow user"
                            accessibilityHint="Keeps the map centered on your position"
                          />
                        </View>
                        <View style={styles.presetSection}>
                          <Text style={styles.toolLabel}>Test position (mock)</Text>
                          <Text style={[styles.toolHint, bleEnabled && styles.toolHintWarn]}>
                            {bleEnabled
                              ? "Turn off BLE position to drive the dot from presets below."
                              : "Tap a room to snap the user dot there and see routing / room highlight."}
                          </Text>
                          <View style={styles.presetChipWrap}>
                            {mockLocationPresets.map((p) => {
                              const active = mockLocationPresetId === p.id;
                              return (
                                <Pressable
                                  key={p.id}
                                  onPress={() => {
                                    if (!bleEnabled) setMockLocationPresetId(p.id);
                                  }}
                                  style={[
                                    styles.presetChip,
                                    active && styles.presetChipActive,
                                    bleEnabled && styles.presetChipDisabled,
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Test position ${p.label}`}
                                  accessibilityState={{ selected: active, disabled: bleEnabled }}
                                >
                                  <Text
                                    style={[styles.presetChipText, active && styles.presetChipTextActive]}
                                    numberOfLines={1}
                                  >
                                    {p.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <Pressable
                          onPress={() => setRecenterTick((t) => t + 1)}
                          style={styles.secondaryBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Recenter map"
                        >
                          <Text style={styles.secondaryBtnText}>Recenter map</Text>
                        </Pressable>
                        <View style={styles.bottomActions}>
                          <Pressable
                            onPress={() => setFireZones([])}
                            style={[styles.miniBtn, styles.miniBtnOutline]}
                            accessibilityRole="button"
                            accessibilityLabel="Clear hazards"
                          >
                            <Text style={styles.miniBtnText}>Clear hazards</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setDevMarkers([]);
                              setLastDevCoord(null);
                            }}
                            style={[styles.miniBtn, styles.miniBtnOutline]}
                            accessibilityRole="button"
                            accessibilityLabel="Clear developer pins"
                          >
                            <Text style={styles.miniBtnText}>Clear dev pins</Text>
                          </Pressable>
                        </View>
                      </ScrollView>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setSheetVisible(true);
                  setSheetOpen(true);
                }}
                style={styles.restorePill}
                accessibilityRole="button"
                accessibilityLabel="Show evacuation panel"
              >
                <Text style={styles.restorePillText}>Evacuation ▾</Text>
              </Pressable>
            )}
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
  screen: { flex: 1 },
  mapFullscreen: {
    ...StyleSheet.absoluteFillObject,
  },
  floorBar: {
    position: "absolute",
    alignItems: "flex-end",
    zIndex: 20,
    elevation: 8,
  },
  floorBarLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginRight: 2,
  },
  floorBarChips: {
    flexDirection: "row",
    gap: 8,
  },
  sheetWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 8,
  },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetHeader: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(21, 34, 56, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#f8fafc", letterSpacing: 0.2 },
  sheetChevron: { fontSize: 14, fontWeight: "900", color: "#7dd3fc" },
  sheetClose: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(21, 34, 56, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { fontSize: 16, fontWeight: "900", color: "#e2e8f0" },
  restorePill: {
    position: "absolute",
    left: 12,
    top: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(21, 34, 56, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  restorePillText: { color: "#e0f2fe", fontWeight: "900" },

  topCard: {
    marginTop: 10,
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
  appTitle: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginBottom: 8, letterSpacing: 0.3 },
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
  floorChipCompact: {
    minWidth: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(21, 34, 56, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
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
  fireNotice: {
    marginTop: 10,
    backgroundColor: "rgba(251, 146, 60, 0.12)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.4)",
  },
  fireNoticeLabel: { fontSize: 11, fontWeight: "700", color: "#fdba74", textTransform: "uppercase", letterSpacing: 0.7 },
  fireNoticeText: { fontSize: 14, fontWeight: "600", color: "#ffedd5", marginTop: 4, lineHeight: 20 },
  devCoordMono: {
    marginTop: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    color: "#7dd3fc",
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  moreToggle: { flex: 1, paddingVertical: 10 },
  moreToggleText: { fontSize: 13, fontWeight: "700", color: "#38bdf8" },
  clearFiresBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.55)",
  },
  clearFiresBtnDisabled: {
    opacity: 0.45,
  },
  clearFiresBtnText: { fontSize: 13, fontWeight: "800", color: "#fecaca" },
  toolsScroll: { maxHeight: 340, marginTop: 4 },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  toolLabel: { fontSize: 14, color: "#e2e8f0", fontWeight: "500" },
  toolHint: { fontSize: 12, color: "#94a3b8", marginTop: 6, lineHeight: 16 },
  toolHintWarn: { color: "#fcd34d" },
  presetSection: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  presetChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    maxWidth: "100%",
  },
  presetChipActive: {
    backgroundColor: "rgba(14, 165, 233, 0.28)",
    borderColor: "#38bdf8",
  },
  presetChipDisabled: { opacity: 0.45 },
  presetChipText: { fontSize: 12, fontWeight: "600", color: "#94a3b8" },
  presetChipTextActive: { color: "#e0f2fe" },
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
});
