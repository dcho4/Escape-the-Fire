function makeId() {
  return `fz_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createFireZone({ floor, x, y, radius }) {
  return {
    id: makeId(),
    floor,
    x,
    y,
    radius,
  };
}

module.exports = { createFireZone };

