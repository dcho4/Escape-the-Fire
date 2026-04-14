/**
 * Route selection among predefined polylines (shortest valid path).
 *
 * Floors 1–2 polylines are built in `utils/evacuationRoutes.js` from `floorGraph.js`
 * (Dijkstra along hall/room edges). Floor 1 still uses presets in `routes.js`.
 * When fires block corridors, filter edges or raise weights before path search.
 * Keep segment–circle helpers for fire vs. polyline hit tests.
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

function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return { point: { x: a.x, y: a.y }, t: 0 };
  let t = (apx * abx + apy * aby) / abLenSq;
  t = clamp01(t);
  return { point: { x: a.x + t * abx, y: a.y + t * aby }, t };
}

/**
 * Snap the user start point onto the polyline (closest point), then follow the rest of the route.
 * This avoids awkward "go to the middle then back up" artifacts when a preset route
 * doesn't start near the user's current room.
 */
function snapRouteStartToLocation(location, routePoints) {
  if (!location || typeof location.x !== "number" || typeof location.y !== "number") return routePoints;
  if (!Array.isArray(routePoints) || routePoints.length < 2) return routePoints;

  let best = null;
  let bestDist = Infinity;
  let bestSegIndex = 0;
  let bestT = 0;

  for (let i = 0; i < routePoints.length - 1; i += 1) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const { point, t } = closestPointOnSegment(location, a, b);
    const d = dist(location, point);
    if (d < bestDist) {
      bestDist = d;
      best = point;
      bestSegIndex = i;
      bestT = t;
    }
  }

  if (!best) return routePoints;

  // Build from: user -> snapped point -> remainder of route after the segment.
  // If the snapped point is very close to the segment end, skip it to avoid tiny zigzags.
  const segmentEnd = routePoints[bestSegIndex + 1];
  const nearEnd = dist(best, segmentEnd) < 1e-4 || bestT > 0.999;
  const rest = routePoints.slice(bestSegIndex + 1);
  const snapped = nearEnd ? rest : [best, ...rest];

  return [{ x: location.x, y: location.y }, ...snapped];
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

  const scored = routeList.map((r) => {
    const points = Array.isArray(r.points) ? r.points : [];
    const fullPoints = snapRouteStartToLocation(location, points);
    return {
      ...r,
      _fullPoints: fullPoints,
      _distance: routeDistance(fullPoints),
    };
  });

  // Prefer shortest safe path; priority is only a tiebreaker (e.g. official exits when distances match).
  scored.sort((a, b) => {
    const d = a._distance - b._distance;
    if (d !== 0) return d;
    const pa = typeof a.priority === "number" ? a.priority : 100;
    const pb = typeof b.priority === "number" ? b.priority : 100;
    return pa - pb;
  });

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

