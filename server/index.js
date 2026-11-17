// Minimal WebSocket relay for "Hold the Line" multiplayer prototype.
// Run: node server/index.js
// Env: PORT (Render sets this automatically)

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hold the Line multiplayer relay');
});

const wss = new WebSocketServer({ server });

const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, new Set());
  return rooms.get(code);
}

wss.on('connection', (ws) => {
  let roomCode = null;
  let playerId = Math.random().toString(36).slice(2, 10);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'join') {
      roomCode = (msg.room || 'default').toUpperCase();
      const room = getRoom(roomCode);
      room.add(ws);
      ws.send(JSON.stringify({ type: 'joined', playerId, room: roomCode, peers: room.size - 1 }));
      // notify others
      for (const peer of room) {
        if (peer !== ws) peer.send(JSON.stringify({ type: 'peer-joined', playerId }));
      }
      return;
    }
    if (msg.type === 'state' && roomCode) {
      const room = getRoom(roomCode);
      for (const peer of room) {
        if (peer !== ws) peer.send(JSON.stringify({ type: 'peer-state', playerId, payload: msg.payload }));
      }
      return;
    }
    if (msg.type === 'chat' && roomCode) {
      const room = getRoom(roomCode);
      for (const peer of room) {
        peer.send(JSON.stringify({ type: 'chat', playerId, text: msg.text }));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (roomCode) {
      const room = getRoom(roomCode);
      room.delete(ws);
      for (const peer of room) {
        peer.send(JSON.stringify({ type: 'peer-left', playerId }));
      }
      if (room.size === 0) rooms.delete(roomCode);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Hold the Line relay listening on ${PORT}`);
});
