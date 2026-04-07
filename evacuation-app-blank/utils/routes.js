// Predefined evacuation routes per floor.

// All coordinates are normalized (0..1) in the same space as `assets/floor*.svg` viewBox.

//

// MAP AUTHORING:

// ---------------------------------------------------------------------------

// • Nodes (rooms, halls, stairs, exits): edit `utils/floorNodes.js`.

// • Graph edges for future pathfinding: edit `utils/floorGraph.js`.

// • These polylines are legacy presets until graph-based routing replaces them.



const routesByFloor = {

  1: [

    {

      id: "f1_exitA",

      points: [

        { x: 0.2, y: 0.8 },

        { x: 0.2, y: 0.5 },

        { x: 0.1, y: 0.2 },

      ],

    },

    {

      id: "f1_exitB",

      points: [

        { x: 0.2, y: 0.8 },
        { x: 0.55, y: 0.8 },

        { x: 0.9, y: 0.85 },

      ],

    },

    {

      id: "f1_exitC",

      points: [

        { x: 0.2, y: 0.8 },

        { x: 0.45, y: 0.55 },

        { x: 0.75, y: 0.35 },

        { x: 0.9, y: 0.15 },

      ],

    },

  ],

  2: [

    {

      id: "f2_stairsWest",

      points: [

        { x: 0.75, y: 0.75 },

        { x: 0.5, y: 0.75 },

        { x: 0.2, y: 0.7 },

        { x: 0.1, y: 0.5 },

      ],

    },

    {

      id: "f2_stairsEast",

      points: [

        { x: 0.75, y: 0.75 },

        { x: 0.85, y: 0.6 },

        { x: 0.9, y: 0.4 },

      ],

    },

    {

      id: "f2_stairsNorth",

      points: [

        { x: 0.75, y: 0.75 },

        { x: 0.75, y: 0.45 },

        { x: 0.6, y: 0.2 },

      ],

    },

  ],

};



function getRoutesForFloor(floor) {

  return routesByFloor[floor] || [];

}



module.exports = { routesByFloor, getRoutesForFloor };


