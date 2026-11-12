import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { Room } from './room.js';
import { MatchLogger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const rooms = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rooms') {
    const roomList = Array.from(rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      players: r.clients.size
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(roomList));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/replay') {
    const matchId = url.searchParams.get('matchId');
    const replayStream = MatchLogger.getReplayStream(matchId);

    if (!replayStream) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Replay not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    replayStream.pipe(res);
    return;
  }

  // Роздача статики (index.html, dist/*, public/*) для браузера і Playwright
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const candidates = [
    path.join(rootDir, filePath),
    path.join(rootDir, 'dist', filePath),
    path.join(rootDir, 'public', filePath)
  ];

  for (const candidate of candidates) {
    if (candidate.startsWith(rootDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext = path.extname(candidate);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(candidate).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('roomId') || 'default';
  const userName = url.searchParams.get('name') || `User_${Math.floor(Math.random() * 1000)}`;

  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId, `Room ${roomId}`);
    rooms.set(roomId, room);

    room.on('empty', (id) => {
      rooms.delete(id);
      console.log(`[Server] Room ${id} deleted (empty)`);
    });
  }

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  room.addClient(ws, { id: Date.now().toString(), name: userName });

  ws.on('close', () => {
    room.removeClient(ws);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket Client Error]', err);
    room.removeClient(ws);
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(config.port, config.host, () => {
  console.log(`[Server] Running on http://${config.host}:${config.port}`);
});

function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  clearInterval(heartbeatInterval);

  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server shutting down');
  });

  rooms.forEach((room) => {
    room.logger.close();
  });

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));