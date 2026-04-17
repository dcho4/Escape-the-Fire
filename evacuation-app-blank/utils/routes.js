// Predefined evacuation routes per floor.

// All coordinates are normalized (0..1) in the same space as `assets/floor*.svg` viewBox.

//

// MAP AUTHORING:

// ---------------------------------------------------------------------------

// • Nodes (rooms, halls, stairs, exits): edit `utils/floorNodes.js`.

// • Graph / accessibility: `utils/floorNodes.js` + `utils/floorGraph.js` (floors 1–2).

// • Polylines here are fallbacks when graph routing cannot build a path.



const routesByFloor = {
  1: [
    {
      id: "f1_exit1",
      points: [
        { x: 0.55, y: 0.5 },
        { x: 0.4724, y: 0.5236 },
        { x: 0.4719, y: 0.5444 },
      ],
    },
    {
      id: "f1_exit2",
      points: [
        { x: 0.55, y: 0.5 },
        { x: 0.5964, y: 0.5229 },
        { x: 0.5979, y: 0.5431 },
      ],
    },
    {
      id: "f1_exit3",
      points: [
        { x: 0.55, y: 0.5 },
        { x: 0.4, y: 0.5194 },
        { x: 0.4021, y: 0.5444 },
      ],
    },
  ],

  2: [
    {
      id: "f2_exit1",
      points: [
        { x: 0.5057, y: 0.4618 },
        { x: 0.5437, y: 0.3924 },
        { x: 0.5026, y: 0.4028 },
      ],
    },
    {
      id: "f2_exit2",
      points: [
        { x: 0.5057, y: 0.4618 },
        { x: 0.5437, y: 0.3924 },
        { x: 0.6062, y: 0.3174 },
        { x: 0.6453, y: 0.3889 },
      ],
    },
    {
      id: "f2_exit_north_private",
      points: [
        { x: 0.5057, y: 0.4618 },
        { x: 0.5437, y: 0.3924 },
        { x: 0.4958, y: 0.3778 },
        { x: 0.4865, y: 0.3806 },
      ],
    },
    {
      id: "f2_exit_bb_n",
      points: [
        { x: 0.5057, y: 0.4618 },
        { x: 0.5437, y: 0.3924 },
        { x: 0.5276, y: 0.325 },
        { x: 0.4849, y: 0.3618 },
      ],
    },
  ],

};



function getRoutesForFloor(floor) {

  return routesByFloor[floor] || [];

}



module.exports = { routesByFloor, getRoutesForFloor };


