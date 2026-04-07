const React = require("react");
const { View } = require("react-native");
const Svg = require("react-native-svg").default;
const { Polyline } = require("react-native-svg");

/**
 * Evacuation route in normalized coordinates. Rendered above SVG base map;
 * parent `MapView` applies pinch/pan to the whole layer so alignment holds.
 */
function RouteOverlay({
  width,
  height,
  points,
  stroke = "#38bdf8",
  strokeWidth = 5,
}) {
  if (!width || !height || !Array.isArray(points) || points.length < 2) return null;

  const polylinePoints = points.map((p) => `${p.x * width},${p.y * height}`).join(" ");

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Svg width={width} height={height}>
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.92}
        />
      </Svg>
    </View>
  );
}

module.exports = RouteOverlay;
