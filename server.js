const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(express.json());

// ===============================
// Serve Frontend
// ===============================

app.use(
  express.static(
    path.join(__dirname, "..", "frontend")
  )
);

// ===============================
// Application State
// ===============================

let occupancy = 0;

let peakOccupancy = 0;

let totalScans = 0;

let inside = new Set();

let lastScan = null;

let recentActivity = [];

// ===============================
// Helpers
// ===============================

function addActivity(entry) {
  recentActivity.unshift(entry);

  if (recentActivity.length > 10) {
    recentActivity.pop();
  }
}

function getStatsPayload() {
  return {
    occupancy,
    peakOccupancy,
    totalScans,
    lastScan,
    recentActivity,
  };
}

function broadcast(type, payload) {
  const message = JSON.stringify({
    type,
    payload,
  });

  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN
    ) {
      client.send(message);
    }
  });
}

// ===============================
// Scan Endpoint
// ===============================

app.post("/scan", (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      error: "Missing code",
    });
  }

  let action = "enter";

  if (inside.has(code)) {
    inside.delete(code);

    occupancy = Math.max(
      0,
      occupancy - 1
    );

    action = "exit";
  } else {
    inside.add(code);

    occupancy += 1;
  }

  totalScans++;

  peakOccupancy = Math.max(
    peakOccupancy,
    occupancy
  );

  const scanData = {
    code,
    action,
    occupancy,
    ts: new Date().toISOString(),
  };

  lastScan = scanData;

  addActivity(scanData);

  // Broadcast occupancy event
  broadcast(
    "occupancy",
    scanData
  );

  // Broadcast updated statistics
  broadcast(
    "stats",
    getStatsPayload()
  );

  res.json({
    ok: true,
    payload: scanData,
  });
});

// ===============================
// HTTP + WebSocket Server
// ===============================

const server =
  http.createServer(app);

const wss =
  new WebSocket.Server({
    server,
  });

// ===============================
// On New Dashboard Connection
// ===============================

wss.on(
  "connection",
  (socket) => {
    socket.send(
      JSON.stringify({
        type: "init",
        payload:
          getStatsPayload(),
      })
    );
  }
);

// ===============================
// Health Endpoint
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    occupancy,
    peakOccupancy,
    totalScans,
  });
});

// ===============================
// Start Server
// ===============================

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});