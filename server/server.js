import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { Room } from './room.js';
import { MatchLogger } from './logger.js';

// Збереження активних кімнат: roomId -> Room instance
const rooms = new Map();

// Створення HTTP сервера
const server = http.createServer((req, res) => {
  // Заголовки CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. GET /health — перевірка стану сервера
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // 2. GET /api/rooms — список кімнат
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

  // 3. GET /api/replay?matchId=... — стрім повтору матчу
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

  // Відхилення будь-яких інших шляхів з кодом 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

// Створення WebSocket сервера поверх HTTP
const wss = new WebSocketServer({ noServer: true });

// Обробка підключення та handshake HTTP upgrade
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

  // Отримання або створення кімнати
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room(roomId, `Room ${roomId}`);
    rooms.set(roomId, room);

    // Видалення порожньої кімнати
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

  ws.on('message', (message) => {
    room.handleMessage(ws, message);
  });

  ws.on('close', () => {
    room.removeClient(ws);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket Client Error]', err);
    room.removeClient(ws);
  });
});

// 4. Ping / Pong раз на 15с (якщо 2 пропущені pong — розрив з'єднання)
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[Ping/Pong] Client non-responsive, terminating connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Запуск сервера
server.listen(config.port, config.host, () => {
  console.log(`[Server] Running on http://${config.host}:${config.port}`);
});

// 5. SIGINT / SIGTERM — граціозне закриття сокетів та логів, вихід з кодом 0
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
    console.log('[Server] Closed all connections. Exiting with code 0.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));