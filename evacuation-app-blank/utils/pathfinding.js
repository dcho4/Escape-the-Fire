/**
 * Route selection among predefined polylines (shortest valid path).
 *
 * REPLACE LATER WITH GRAPH PATHFINDING:
 * - Nodes: `utils/floorNodes.js`. Edges: `utils/floorGraph.js`.
 * - When fires block corridors, remove or penalize edges and run A* / Dijkstra
 *   from the user's nearest node to the nearest exit node.
 * - Keep segment–circle helpers for fire vs. polyline hit tests.
 */

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function routeDistance(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += dist(points[i], points[i + 1]);
  }
  return total;
}

function distancePointToSegment(p, a, b) {
  // Returns minimum distance from point p to segment ab (all in normalized space).
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return dist(p, a);

  let t = (apx * abx + apy * aby) / abLenSq;
  t = clamp01(t);

  const closest = { x: a.x + t * abx, y: a.y + t * aby };
  return dist(p, closest);
}

function segmentIntersectsCircle(a, b, center, radius) {
  const d = distancePointToSegment(center, a, b);
  return d <= radius;
}

function routeIsValid(routePoints, fireZonesOnFloor) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
  if (!Array.isArray(fireZonesOnFloor) || fireZonesOnFloor.length === 0) return true;

  for (let i = 0; i < routePoints.length - 1; i += 1) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    for (const z of fireZonesOnFloor) {
      const center = { x: z.x, y: z.y };
      if (segmentIntersectsCircle(a, b, center, z.radius)) return false;
    }
  }

  return true;
}

function getSafestRoute({ location, routes, fireZones, floor }) {
  const fireZonesOnFloor = (fireZones || []).filter((z) => z.floor === floor);
  const routeList = Array.isArray(routes) ? routes : [];

  // Optional: if routes don’t start exactly at the user's location, we can prepend location
  // to each route for distance scoring (keeps “closest route” behavior simple).
  const scored = routeList
    .map((r) => {
      const points = Array.isArray(r.points) ? r.points : [];
      const fullPoints =
        location && typeof location.x === "number" && typeof location.y === "number"
          ? [{ x: location.x, y: location.y }, ...points]
          : points;
      return {
        ...r,
        _fullPoints: fullPoints,
        _distance: routeDistance(fullPoints),
      };
    })
    .sort((a, b) => a._distance - b._distance);

  for (const r of scored) {
    if (routeIsValid(r._fullPoints, fireZonesOnFloor)) {
      return { id: r.id, points: r._fullPoints, distance: r._distance };
    }
  }

  return null;
}

module.exports = {
  routeDistance,
  segmentIntersectsCircle,
  routeIsValid,
  getSafestRoute,
};

