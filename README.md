# Escape the Fire

An indoor evacuation app that uses BLE beacons for real-time indoor positioning — a GPS alternative that works inside buildings.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16+
- npm (comes with Node.js)
- BLE-enabled device (Bluetooth 4.0+)
- At least 3 BLE beacons deployed in the building

---

## Setup

1. Clone the repo
```bash
   git clone https://github.com/dcho4/Escape-the-Fire.git
   cd Escape-the-Fire
```

2. Install dependencies
```bash
   cd evacuation-app-blank
   npm install
```

3. Start the app
```bash
   node index.js
```
   Or:
```bash
   npm start
```

4. Open in browser using local host, or deploy using Vercel

---

## Usage

1. Enable Bluetooth on your device
2. Grant location/Bluetooth permissions when prompted
3. The app will detect nearby beacons and calculate your position
4. Your location appears on the floor map
5. Follow the highlighted route to the nearest exit

---

## Troubleshooting

**No beacons detected** — Make sure Bluetooth is on, permissions are granted, and at least 3 beacons are powered on and in range.

**Port in use** — Run with a different port:
```bash
PORT=4000 node index.js
```

**"Cannot find module"** — Make sure you ran `npm install` inside the `evacuation-app-blank` folder.
