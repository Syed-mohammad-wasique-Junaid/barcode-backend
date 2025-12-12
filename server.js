const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(express.json());

// Allow requests from any origin (for deployment across domains).
// In production you may want to restrict to your frontend origin.
app.use(cors());

// If you still serve frontend from backend in local dev, adjust the path.
// When deployed we host frontend separately, so serving static is optional.
// app.use(express.static(path.join(__dirname, '..', 'frontend')));

// In-memory state
let occupancy = 0;
let inside = new Set();

// POST /scan endpoint used by frontend
app.post('/scan', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  let action = "enter";
  if (inside.has(code)) {
    inside.delete(code);
    occupancy = Math.max(0, occupancy - 1);
    action = "exit";
  } else {
    inside.add(code);
    occupancy += 1;
  }

  const payload = {
    occupancy,
    action,
    ts: new Date().toISOString()
  };

  broadcast(JSON.stringify({ type: "occupancy", payload }));

  return res.json({ ok: true, payload });
});

// Basic health endpoint
app.get('/health', (req, res) => res.json({ ok: true, occupancy }));

// Setup HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
