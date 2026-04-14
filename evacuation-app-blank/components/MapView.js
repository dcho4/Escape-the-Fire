/**
 * NOTE (Expo Go stability):
 * -----------------------------------------
 * The previous zoom/pan implementation used Reanimated worklets + Gesture API.
 * On iPhone Expo Go it was crashing with:
 *   [runtime not ready]: Error: Exception in HostFunction: <unknown>
 *
 * This version temporarily removes Reanimated-based zoom/pan and keeps:
 * - SVG base map
 * - route overlay
 * - fire zones
 * - user dot
 * - dev coordinate mode tap logging + markers
 *
 * Once stable, we can reintroduce zoom/pan in a safer way.
 */

const React = require("react");
const { View, Text, Pressable, StyleSheet, Platform, ScrollView } = require("react-native");
const Svg = require("react-native-svg").default;
const {
  Circle,
  G,
  Text: SvgText,
  Defs,
  RadialGradient,
  Stop,
  Polygon,
} = require("react-native-svg");

const RouteOverlay = require("./RouteOverlay");
const { getFloorMapPixelSize, fitMapToViewport } = require("../utils/floorMeta");

/** Map recenter FAB (⌖). Set `true` to show again; floor switch lives on the main screen now. */
const SHOW_RECENTER_FAB = false;

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeSvgId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9_]/g, "_");
}

function fireGradientId(z) {
  return `g_fire_${safeSvgId(z.id)}`;
}

function nodeMarkerFill(type) {
  switch (type) {
    case "exit":
      return "#188038";
    case "stairs":
      return "#e37400";
    case "hall":
      return "#5f6368";
    case "room":
      return "#1a73e8";
    default:
      return "#9aa0a6";
  }
}

function MapView({
  floor,
  svgMapComponent: SvgMap,
  mapNodes = [],
  userLocation,
  highlightedRoom = null,
  route,
  fireZones,
  adminMode,
  devMode,
  onAddFireZone,
  onDevTap,
  devMarkers = [],
  recenterTick = 0,
  followUser = false,
  fitMode = "contain",
  fullBleed = false,
}) {
  const scrollXRef = React.useRef(null);
  const scrollYRef = React.useRef(null);
  const mapPressRef = React.useRef(null);
  /** Visible map clip rect (for pageX/pageY → tap in viewport). */
  const mapViewportRef = React.useRef(null);
  /**
   * Synchronous scroll + zoom (updated in onScroll). React state is too stale on tap for placement math.
   * Matches UIScrollView: unscaled map coords = (contentOffset + touchInViewport) / zoomScale.
   */
  const scrollOffsetRef = React.useRef({ x: 0, y: 0, zoomScale: 1 });
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 });
  const [suppressFollowUntil, setSuppressFollowUntil] = React.useState(0);
  const [scrollState, setScrollState] = React.useState({
    zoomScale: 1,
    x: 0,
    y: 0,
  });
  const scrollStateRef = React.useRef(scrollState);
  scrollStateRef.current = scrollState;

  const { width: imgW, height: imgH } = getFloorMapPixelSize(floor);
  const { width: mapW, height: mapH } =
    fitMode === "cover"
      ? (() => {
          if (!viewport.w || !viewport.h || !imgW || !imgH) return { width: 0, height: 0 };
          const ir = imgW / imgH;
          const vr = viewport.w / viewport.h;
          if (ir > vr) {
            // Image is wider than viewport: fill height, overflow width.
            const height = viewport.h;
            const width = viewport.h * ir;
            return { width, height };
          }
          // Image is taller than viewport: fill width, overflow height.
          const width = viewport.w;
          const height = viewport.w / ir;
          return { width, height };
        })()
      : fitMapToViewport(viewport.w, viewport.h, imgW, imgH);

  const zonesOnThisFloor = (fireZones || []).filter((z) => z.floor === floor);
  const minMapSide = Math.min(mapW || 0, mapH || 0) || 1;
  const showMapContent = mapW > 0 && mapH > 0;

  const dotOuter = 14;
  const dotInner = 6;
  const dotLeft = userLocation && mapW ? userLocation.x * mapW - dotOuter / 2 : 0;
  const dotTop = userLocation && mapH ? userLocation.y * mapH - dotOuter / 2 : 0;
  const zForScroll = scrollState.zoomScale || 1;
  const followSuppressed = followUser && Date.now() < suppressFollowUntil;

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function recenterToUser(animated = true) {
    if (!scrollXRef.current || !scrollYRef.current || !userLocation || !showMapContent) return;
    const z = scrollState.zoomScale || 1;
    const contentW = mapW * z;
    const contentH = mapH * z;
    const targetX = userLocation.x * contentW - viewport.w / 2;
    const targetY = userLocation.y * contentH - viewport.h / 2;
    const x = clamp(targetX, 0, Math.max(0, contentW - viewport.w));
    const y = clamp(targetY, 0, Math.max(0, contentH - viewport.h));
    scrollXRef.current.scrollTo({ x, animated });
    scrollYRef.current.scrollTo({ y, animated });
  }

  function centerMap(animated = false) {
    if (!scrollXRef.current || !scrollYRef.current || !showMapContent) return;
    const z = scrollState.zoomScale || 1;
    const contentW = mapW * z;
    const contentH = mapH * z;
    const x = Math.max(0, (contentW - viewport.w) / 2);
    const y = Math.max(0, (contentH - viewport.h) / 2);
    scrollXRef.current.scrollTo({ x, animated });
    scrollYRef.current.scrollTo({ y, animated });
  }

  React.useEffect(() => {
    if (!recenterTick) return;
    setSuppressFollowUntil(0);
    recenterToUser(true);
  }, [recenterTick]);

  // On first layout / map size change, start centered (prevents "stuck on left edge" feel).
  React.useEffect(() => {
    if (!showMapContent) return;
    if (followUser && userLocation) return;
    centerMap(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMapContent, mapW, mapH, viewport.w, viewport.h]);

  React.useEffect(() => {
    if (!followUser) return;
    if (followSuppressed) return;
    recenterToUser(true);
  }, [followUser, followSuppressed, userLocation?.x, userLocation?.y, mapW, mapH, viewport.w, viewport.h, scrollState.zoomScale]);

  function dispatchMapTap(xn, yn) {
    if (devMode) {
      if (onDevTap) onDevTap({ floor, x: xn, y: yn });
      // eslint-disable-next-line no-console
      console.log("[DevMap] normalized tap", { floor, x: xn, y: yn });
      return;
    }
    if (adminMode && onAddFireZone) {
      onAddFireZone({ floor, x: xn, y: yn });
    }
  }

  /**
   * Fallback when measureInWindow fails: map-local coords → normalized (unreliable under zoom).
   */
  function normalizedFromLocal(lx, ly) {
    const { x: sx, y: sy, zoomScale: zIn } = scrollStateRef.current;
    const z = zIn || 1;
    const baseX = (sx + lx) / z;
    const baseY = (sy + ly) / z;
    return [clamp01(baseX / mapW), clamp01(baseY / mapH)];
  }

  function onMapPress(e) {
    if (!showMapContent) return;
    const ne = e.nativeEvent;

    const finishNormalized = (xn, yn) => {
      dispatchMapTap(xn, yn);
    };

    const pageX = ne.pageX;
    const pageY = ne.pageY;

    /**
     * iOS: measureInWindow on content inside a zoomed UIScrollView often returns *unscaled* layout
     * width/height while pageX/Y match the zoomed screen — fires land in the wrong place after pan/zoom.
     * Use viewport window origin + scroll offsets + zoomScale instead (same math as recenterToUser).
     */
    if (
      Platform.OS !== "web" &&
      typeof pageX === "number" &&
      typeof pageY === "number" &&
      mapViewportRef.current &&
      typeof mapViewportRef.current.measureInWindow === "function"
    ) {
      mapViewportRef.current.measureInWindow((vx, vy) => {
        const tx = pageX - vx;
        const ty = pageY - vy;
        const { x: xOff, y: yOff, zoomScale: zIn } = scrollOffsetRef.current;
        const z = zIn && zIn > 0 ? zIn : 1;
        const mapX = (xOff + tx) / z;
        const mapY = (yOff + ty) / z;
        finishNormalized(clamp01(mapX / mapW), clamp01(mapY / mapH));
      });
      return;
    }

    // Web / fallback: normalized position within the measured map view rect.
    if (
      typeof pageX === "number" &&
      typeof pageY === "number" &&
      mapPressRef.current &&
      typeof mapPressRef.current.measureInWindow === "function"
    ) {
      mapPressRef.current.measureInWindow((wx, wy, ww, wh) => {
        if (ww > 0 && wh > 0) {
          finishNormalized(clamp01((pageX - wx) / ww), clamp01((pageY - wy) / wh));
          return;
        }
        const [xn, yn] = normalizedFromLocal(ne.locationX ?? 0, ne.locationY ?? 0);
        finishNormalized(xn, yn);
      });
      return;
    }

    // react-native-web fallbacks when pageX/measure differ
    if (Platform.OS === "web") {
      const ox = ne.offsetX;
      const oy = ne.offsetY;
      if (typeof ox === "number" && typeof oy === "number" && !Number.isNaN(ox) && !Number.isNaN(oy)) {
        const [xn, yn] = normalizedFromLocal(ox, oy);
        finishNormalized(xn, yn);
        return;
      }
      const target = ne.target;
      if (target && typeof target.getBoundingClientRect === "function") {
        const rect = target.getBoundingClientRect();
        const cx = ne.clientX ?? pageX;
        const cy = ne.clientY ?? pageY;
        if (typeof cx === "number" && typeof cy === "number") {
          const [xn, yn] = normalizedFromLocal(cx - rect.left, cy - rect.top);
          finishNormalized(xn, yn);
          return;
        }
      }
    }

    const [xn, yn] = normalizedFromLocal(ne.locationX ?? 0, ne.locationY ?? 0);
    finishNormalized(xn, yn);
  }

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.viewport, fullBleed && styles.viewportFullBleed]}
        onLayout={(e) => setViewport({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <View style={styles.gestureHost} pointerEvents="box-none">
          {showMapContent ? (
            <View
              ref={mapViewportRef}
              collapsable={false}
              style={{ width: viewport.w, height: viewport.h }}
            >
            <ScrollView
              ref={scrollXRef}
              horizontal
              bounces={false}
              alwaysBounceHorizontal={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentInsetAdjustmentBehavior="never"
              onScrollBeginDrag={() => {
                if (followUser) setSuppressFollowUntil(Date.now() + 12_000);
              }}
              onScroll={(e) => {
                const ne = e.nativeEvent;
                const x = ne.contentOffset?.x ?? 0;
                scrollOffsetRef.current.x = x;
                setScrollState((prev) => ({ ...prev, x }));
              }}
              style={{ width: viewport.w, height: viewport.h }}
            >
              <ScrollView
                ref={scrollYRef}
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                // iOS pinch-zoom (Expo Go safe). Android will ignore zoomScale.
                minimumZoomScale={1}
                maximumZoomScale={4}
                bouncesZoom={false}
                nestedScrollEnabled
                onScrollBeginDrag={() => {
                  if (followUser) setSuppressFollowUntil(Date.now() + 12_000);
                }}
                onScroll={(e) => {
                  const ne = e.nativeEvent;
                  const y = ne.contentOffset?.y ?? 0;
                  const zs = typeof ne.zoomScale === "number" ? ne.zoomScale : scrollOffsetRef.current.zoomScale;
                  scrollOffsetRef.current.y = y;
                  scrollOffsetRef.current.zoomScale = zs;
                  setScrollState((prev) => ({
                    ...prev,
                    zoomScale: zs,
                    y,
                  }));
                }}
                contentContainerStyle={[
                  styles.scrollContent,
                  mapW * zForScroll <= viewport.w + 0.5 && styles.scrollCenterX,
                  mapH * zForScroll <= viewport.h + 0.5 && styles.scrollCenterY,
                ]}
                style={{ width: mapW, height: viewport.h }}
              >
                <Pressable
                  onPress={onMapPress}
                  style={{ width: mapW, height: mapH }}
                  disabled={!devMode && !adminMode}
                  accessibilityRole={!devMode && !adminMode ? undefined : "button"}
                  accessibilityLabel={
                    devMode ? "Map. Tap to record coordinates." : adminMode ? "Map. Tap to place a hazard." : "Map"
                  }
                  accessibilityHint={
                    devMode ? "Adds a developer pin at the tapped location" : adminMode ? "Adds a fire zone" : undefined
                  }
                >
                  <View
                    ref={mapPressRef}
                    collapsable={false}
                    pointerEvents="none"
                    style={StyleSheet.absoluteFillObject}
                  />
                  {SvgMap ? (
                    <View pointerEvents="none" style={{ width: mapW, height: mapH }}>
                      <SvgMap width={mapW} height={mapH} preserveAspectRatio="xMidYMid meet" />
                    </View>
                  ) : (
                    <View style={[styles.fallbackBox, { width: mapW, height: mapH }]}>
                      <Text style={styles.fallbackText}>
                        Missing SVG for floor {floor}. Add `assets/floor{floor}.svg` and `utils/mapSvgAssets.js` entry.
                      </Text>
                    </View>
                  )}

                  <RouteOverlay width={mapW} height={mapH} points={route ? route.points : null} />

                  <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                    <Svg width={mapW} height={mapH}>
                      <Defs>
                        {zonesOnThisFloor.map((z) => {
                          const cx = z.x * mapW;
                          const cy = z.y * mapH;
                          const r = z.radius * minMapSide;
                          const gid = fireGradientId(z);
                          return (
                            <RadialGradient
                              key={`def_${z.id}`}
                              id={gid}
                              cx={cx}
                              cy={cy - r * 0.1}
                              r={r * 1.4}
                              fx={cx - r * 0.12}
                              fy={cy - r * 0.38}
                              gradientUnits="userSpaceOnUse"
                            >
                              <Stop offset="0" stopColor="#fffde7" stopOpacity={1} />
                              <Stop offset="0.22" stopColor="#ffeb3b" stopOpacity={0.98} />
                              <Stop offset="0.52" stopColor="#ff6d00" stopOpacity={0.92} />
                              <Stop offset="1" stopColor="#870000" stopOpacity={0.35} />
                            </RadialGradient>
                          );
                        })}
                      </Defs>

                      {zonesOnThisFloor.map((z) => {
                        const cx = z.x * mapW;
                        const cy = z.y * mapH;
                        const r = z.radius * minMapSide;
                        const gid = fireGradientId(z);
                        return (
                          <G key={z.id}>
                            <Circle cx={cx} cy={cy} r={r * 1.14} fill={`url(#${gid})`} />
                            <Circle cx={cx - r * 0.24} cy={cy + r * 0.06} r={r * 0.4} fill="#ff3d00" opacity={0.75} />
                            <Circle cx={cx + r * 0.2} cy={cy + r * 0.08} r={r * 0.34} fill="#d50000" opacity={0.7} />
                            <Circle cx={cx} cy={cy - r * 0.2} r={r * 0.45} fill="#ffea00" opacity={0.5} />
                            <Polygon
                              points={`${cx},${cy - r * 1.28} ${cx - r * 0.22},${cy - r * 0.32} ${cx + r * 0.24},${cy - r * 0.34}`}
                              fill="#fff9c4"
                              opacity={0.88}
                            />
                            <Polygon
                              points={`${cx - r * 0.12},${cy - r * 1.15} ${cx - r * 0.32},${cy - r * 0.25} ${cx + r * 0.08},${cy - r * 0.28}`}
                              fill="#ffeb3b"
                              opacity={0.75}
                            />
                            <Polygon
                              points={`${cx + r * 0.1},${cy - r * 1.12} ${cx - r * 0.06},${cy - r * 0.26} ${cx + r * 0.3},${cy - r * 0.22}`}
                              fill="#ff9800"
                              opacity={0.72}
                            />
                          </G>
                        );
                      })}

                      {highlightedRoom ? (
                        <G key="room_highlight">
                          {(() => {
                            const cx = highlightedRoom.x * mapW;
                            const cy = highlightedRoom.y * mapH;
                            const hrNorm =
                              typeof highlightedRoom.roomHighlightRadius === "number"
                                ? highlightedRoom.roomHighlightRadius
                                : 0.13;
                            const hr = hrNorm * minMapSide * 0.5;
                            return (
                              <Circle
                                cx={cx}
                                cy={cy}
                                r={hr}
                                fill="rgba(56, 189, 248, 0.22)"
                                stroke="#22d3ee"
                                strokeWidth={3.5}
                                strokeDasharray="12 8"
                              />
                            );
                          })()}
                        </G>
                      ) : null}

                      {(mapNodes || []).map((n) => {
                        const cx = n.x * mapW;
                        const cy = n.y * mapH;
                        const r = devMode ? 7 : 6;
                        const fill = nodeMarkerFill(n.type);
                        return (
                          <G key={n.id}>
                            <Circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill={fill}
                              stroke="#ffffff"
                              strokeWidth={devMode ? 1.5 : 1}
                              opacity={0.95}
                            />
                            {devMode ? (
                              <SvgText x={cx + 10} y={cy - 6} fill="#202124" fontSize={11} fontWeight="600">
                                {n.label}
                              </SvgText>
                            ) : null}
                          </G>
                        );
                      })}

                      {(devMarkers || []).map((m) => (
                        <Circle
                          key={m.id}
                          cx={m.x * mapW}
                          cy={m.y * mapH}
                          r={6}
                          fill="#fbbc04"
                          stroke="#202124"
                          strokeWidth={1}
                        />
                      ))}
                    </Svg>
                  </View>

                  {userLocation ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.userDotOuter,
                        {
                          left: dotLeft,
                          top: dotTop,
                          width: dotOuter,
                          height: dotOuter,
                          borderRadius: dotOuter / 2,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.userDotInner,
                          {
                            width: dotInner,
                            height: dotInner,
                            borderRadius: dotInner / 2,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </Pressable>
              </ScrollView>
            </ScrollView>
            </View>
          ) : null}

          {SHOW_RECENTER_FAB ? (
            <Pressable
              onPress={() => {
                setSuppressFollowUntil(0);
                recenterToUser(true);
              }}
              style={[styles.recenterFab, { bottom: Platform.OS === "web" ? 12 : 18 }]}
              accessibilityRole="button"
              accessibilityLabel="Recenter"
              accessibilityHint="Centers the map on your current location"
            >
              <Text style={styles.recenterFabText}>⌖</Text>
            </Pressable>
          ) : null}

          {followSuppressed ? (
            <Pressable
              onPress={() => {
                setSuppressFollowUntil(0);
                recenterToUser(true);
              }}
              style={styles.resumeFollowPill}
              accessibilityRole="button"
              accessibilityLabel="Resume following your location"
              accessibilityHint="Re-centers the map and resumes auto-follow"
            >
              <Text style={styles.resumeFollowPillText}>Resume</Text>
            </Pressable>
          ) : null}

          {adminMode && !devMode ? (
            <View pointerEvents="none" style={styles.hintPill}>
              <Text style={styles.hintPillText}>Admin: tap to place hazard</Text>
            </View>
          ) : null}

          {devMode ? (
            <View pointerEvents="none" style={[styles.hintPill, styles.hintDev]}>
              <Text style={styles.hintPillText}>Dev: tap map for x,y · see nodes</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  viewport: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  viewportFullBleed: {
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
  },
  gestureHost: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
  },
  fallbackText: { color: "#94a3b8", padding: 16, textAlign: "center", fontSize: 14 },
  userDotOuter: {
    position: "absolute",
    backgroundColor: "rgba(224, 242, 254, 0.95)",
    borderWidth: 2,
    borderColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  userDotInner: {
    backgroundColor: "#0ea5e9",
  },
  recenterFab: {
    position: "absolute",
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#7dd3fc",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterFabText: { fontSize: 22, color: "#f8fafc", fontWeight: "800" },
  hintPill: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "rgba(21, 34, 56, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "85%",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  hintDev: {
    backgroundColor: "rgba(14, 116, 144, 0.92)",
    borderColor: "rgba(34, 211, 238, 0.55)",
  },
  hintPillText: { color: "#f1f5f9", fontSize: 12, fontWeight: "700" },
  scrollContent: {
    // Keep the map centered when zoomScale=1 and it's smaller than viewport.
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  scrollCenterX: { alignItems: "center" },
  scrollCenterY: { justifyContent: "center" },
  resumeFollowPill: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(21, 34, 56, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  resumeFollowPillText: { color: "#e0f2fe", fontWeight: "900", fontSize: 12 },
});

module.exports = MapView;
