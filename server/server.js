import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { monitorEventLoopDelay } from 'perf_hooks';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { Room } from './room.js';
import { MatchLogger } from './logger.js';
import { logger } from './pinoLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const rooms = new Map();
const ipConnections = new Map();
let isShuttingDown = false;
let isReady = false;

const elMonitor = monitorEventLoopDelay({ resolution: 20 });
elMonitor.enable();

let prevMetricsTime = Date.now();
let prevMsgsIn = 0;
let prevMsgsOut = 0;
let prevBytesIn = 0;
let prevBytesOut = 0;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (config.allowedOrigins === '*') return true;
  return config.allowedOrigins.includes(origin);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      gitSha: config.gitSha,
      uptime: Number(process.uptime().toFixed(2))
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/ready') {
    if (!isReady || isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_ready', shuttingDown: isShuttingDown }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready', rooms: rooms.size }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/metrics') {
    let totalPlayers = 0;
    let totalMsgsIn = 0;
    let totalMsgsOut = 0;
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let maxTickMs = 0;

    for (const room of rooms.values()) {
      totalPlayers += room.clients.size;
      totalMsgsIn += room.metrics.messagesIn;
      totalMsgsOut += room.metrics.messagesOut;
      totalBytesIn += room.metrics.bytesIn;
      totalBytesOut += room.metrics.bytesOut;
      if (room.metrics.lastTickMs > maxTickMs) {
        maxTickMs = room.metrics.lastTickMs;
      }
    }

    const now = Date.now();
    const elapsedSec = Math.max((now - prevMetricsTime) / 1000, 0.001);
    const msgsPerSec = Number((((totalMsgsIn - prevMsgsIn) + (totalMsgsOut - prevMsgsOut)) / elapsedSec).toFixed(2));
    const bytesPerSec = Number((((totalBytesIn - prevBytesIn) + (totalBytesOut - prevBytesOut)) / elapsedSec).toFixed(2));

    prevMetricsTime = now;
    prevMsgsIn = totalMsgsIn;
    prevMsgsOut = totalMsgsOut;
    prevBytesIn = totalBytesIn;
    prevBytesOut = totalBytesOut;

    const mem = process.memoryUsage();
    const eventLoopLagMs = Number((elMonitor.mean / 1e6).toFixed(3));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      players: totalPlayers,
      rooms: rooms.size,
      messagesPerSec: Math.max(0, msgsPerSec),
      bytesPerSec: Math.max(0, bytesPerSec),
      stepTimeMs: maxTickMs,
      eventLoopLagMs,
      memoryMb: {
        rss: Number((mem.rss / 1024 / 1024).toFixed(2)),
        heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(2))
      }
    }));
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
  if (isShuttingDown) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }

  const origin = request.headers.origin;
  if (!isOriginAllowed(origin)) {
    logger.warn({ event: 'origin_rejected', origin }, 'Rejected WebSocket upgrade due to Origin');
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  const ip = getClientIp(request);
  const currentIpCount = ipConnections.get(ip) || 0;
  if (currentIpCount >= config.maxConnectionsPerIp) {
    logger.warn({ event: 'ip_limit_rejected', ip, count: currentIpCount }, 'Rejected WebSocket upgrade due to IP limit');
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    socket.destroy();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

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
  const ip = getClientIp(req);
  ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roomId = url.searchParams.get('roomId') || 'default';
  const userName = url.searchParams.get('name') || `User_${Math.floor(Math.random() * 1000)}`;

  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= config.maxRooms) {
      ws.close(4002, 'Server room limit reached');
      return;
    }
    room = new Room(roomId, { name: `Room ${roomId}`, maxPlayers: config.maxPlayersPerRoom });
    rooms.set(roomId, room);

    room.on('empty', (id) => {
      rooms.delete(id);
      logger.info({ event: 'room_deleted', roomId: id }, 'Room deleted (empty)');
    });
  }

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  room.addClient(ws, { id: Date.now().toString(), name: userName });

  const cleanup = () => {
    const count = (ipConnections.get(ip) || 1) - 1;
    if (count <= 0) ipConnections.delete(ip);
    else ipConnections.set(ip, count);
    room.removeClient(ws);
  };

  ws.on('close', cleanup);

  ws.on('error', (err) => {
    logger.error({ event: 'ws_error', roomId, err: err.message }, 'WebSocket client error');
    cleanup();
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
  isReady = true;
  logger.info({ event: 'server_started', host: config.host, port: config.port }, 'Server listening');
});

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  isReady = false;

  logger.info({ event: 'shutdown_start', signal }, 'Received shutdown signal');
  clearInterval(heartbeatInterval);

  const forceExitTimer = setTimeout(() => {
    logger.error({ event: 'shutdown_timeout' }, 'Forced exit after timeout');
    process.exit(1);
  }, 8000);
  forceExitTimer.unref();

  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'shutdown', reason: 'Server restarting' }));
      ws.close(1001, 'Server shutting down');
    }
  });

  rooms.forEach((room) => {
    room.close();
    room.logger.close();
  });

  server.close(() => {
    logger.info({ event: 'shutdown_complete' }, 'HTTP and WebSocket servers closed cleanly');
    pinoFlushAndExit(0);
  });
}

function pinoFlushAndExit(code) {
  if (typeof logger.flush === 'function') {
    logger.flush();
  }
  setTimeout(() => process.exit(code), 50);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.fatal({ event: 'uncaught_exception', err: err.stack || err.message }, 'Uncaught exception, exiting');
  pinoFlushAndExit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ event: 'unhandled_rejection', reason: String(reason) }, 'Unhandled rejection, exiting');
  pinoFlushAndExit(1);
});