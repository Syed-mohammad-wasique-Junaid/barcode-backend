const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// State: occupancy + who is inside
let occupancy = 0;
let inside = new Set();

// Scan route
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
        code,
        action,
        occupancy,
        ts: new Date().toISOString()
    };


    broadcast(JSON.stringify({ type: "occupancy", payload }));

    res.json({ ok: true, payload });
});

// WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(msg) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
