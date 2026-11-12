import { EventEmitter } from 'events';
import { createShipState, updateShip } from '../shared/physics.js';
import { encodeSnapshot, decodeInput, parseChatMessage, MSG_INPUT } from '../shared/protocol.js';
import { logger } from './pinoLogger.js';

export class Room extends EventEmitter {
  constructor(id, options = {}) {
    super();
    const opts = typeof options === 'string' ? { name: options } : options;
    this.id = id;
    this.name = opts.name ?? `Room ${id}`;
    this.maxPlayers = opts.maxPlayers ?? 128;
    this.maxMsgsPerSec = opts.maxMsgsPerSec ?? 60;
    this.clients = new Map();
    this.players = new Map();
    this.lastProcessedSeq = new Map();
    this.nextPlayerId = 1;
    this.logger = { close() {} };
    this.log = logger.child({ roomId: this.id });

    this.metrics = {
      messagesIn: 0,
      messagesOut: 0,
      bytesIn: 0,
      bytesOut: 0,
      lastTickMs: 0
    };

    this.tickRate = 30;
    this.dt = 1 / this.tickRate;
    this.intervalId = setInterval(() => this.tick(), 1000 / this.tickRate);
  }

  addClient(ws, nameOrUser) {
    if (this.clients.size >= this.maxPlayers) {
      ws.close(4001, 'Room is full');
      return false;
    }

    const name = typeof nameOrUser === 'string' ? nameOrUser : (nameOrUser?.name ?? 'Player');
    const playerId = this.nextPlayerId++;
    const ship = createShipState(playerId, 100 + (playerId % 10) * 50, 100 + (playerId % 8) * 50);

    this.clients.set(ws, {
      id: playerId,
      name,
      msgCount: 0,
      badPackets: 0,
      windowStart: Date.now()
    });
    this.players.set(playerId, ship);
    this.lastProcessedSeq.set(playerId, 0);

    if (typeof ws.on === 'function') {
      ws.on('message', (message, isBinary) => this.handleMessage(ws, message, isBinary));
    }

    this.log.info({ event: 'user_joined', playerId, name }, 'Player joined room');
    this.emit('user_joined', { playerId, name });
    return true;
  }

  removeClient(ws) {
    const client = this.clients.get(ws);
    if (!client) return;

    this.clients.delete(ws);
    this.players.delete(client.id);
    this.lastProcessedSeq.delete(client.id);

    this.log.info({ event: 'user_left', playerId: client.id, name: client.name }, 'Player left room');
    this.emit('user_left', { playerId: client.id, name: client.name });

    if (this.clients.size === 0) {
      this.close();
      this.emit('empty', this.id);
    }
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getPlayerCount() {
    return this.players.size;
  }

  isRateLimited(client) {
    const now = Date.now();
    if (now - client.windowStart >= 1000) {
      client.windowStart = now;
      client.msgCount = 0;
    }
    client.msgCount++;
    return client.msgCount > this.maxMsgsPerSec;
  }

  handleMessage(ws, message, isBinary) {
    const client = this.clients.get(ws);
    if (!client) return;

    this.metrics.messagesIn++;
    const byteLen = typeof message === 'string'
      ? Buffer.byteLength(message, 'utf8')
      : (message?.byteLength ?? 0);
    this.metrics.bytesIn += byteLen;

    if (this.isRateLimited(client)) {
      client.badPackets++;
      this.emit('rate_limited', { playerId: client.id });
      if (client.badPackets > 100 && typeof ws.close === 'function') {
        this.log.warn({ event: 'flood_kick', playerId: client.id }, 'Disconnecting flooding client');
        ws.close(1008, 'Rate limit exceeded');
      }
      return;
    }

    if (isBinary === false && Buffer.isBuffer(message)) {
      message = message.toString('utf8');
    }

    if (typeof message === 'string') {
      const chatMsg = parseChatMessage(message);
      if (chatMsg) {
        this.broadcast(JSON.stringify({
          type: 'chat',
          sender: client.name,
          text: chatMsg.text,
          timestamp: Date.now()
        }));
      }
      return;
    }

    if (isBinary || message instanceof ArrayBuffer || (typeof message === 'object' && message !== null && 'buffer' in message)) {
      let buffer;
      if (message instanceof ArrayBuffer) {
        buffer = message;
      } else if (typeof message === 'object' && message !== null && 'buffer' in message) {
        const msgObj = message;
        const offset = msgObj.byteOffset ?? 0;
        const length = msgObj.byteLength ?? msgObj.buffer.byteLength;
        buffer = msgObj.buffer.slice(offset, offset + length);
      } else {
        return;
      }

      try {
        const data = decodeInput(buffer);
        if (data.type === MSG_INPUT) {
          const ship = this.players.get(client.id);
          if (ship) {
            updateShip(ship, data, this.dt);
            this.lastProcessedSeq.set(client.id, data.seq);
          }
        }
      } catch (err) {
        client.badPackets++;
        this.log.warn({ event: 'protocol_error', playerId: client.id }, 'Invalid binary packet');
        this.emit('protocol_error', { playerId: client.id, error: err });
        if (client.badPackets > 20 && typeof ws.close === 'function') {
          this.log.warn({ event: 'corrupted_flood_kick', playerId: client.id }, 'Disconnecting client sending corrupted frames');
          ws.close(1008, 'Too many malformed packets');
        }
      }
    }
  }

  tick() {
    const start = performance.now();
    const snapshotPlayers = Array.from(this.players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle
    }));

    for (const [ws, client] of this.clients.entries()) {
      const lastSeq = this.lastProcessedSeq.get(client.id) ?? 0;
      const snapshotBuffer = encodeSnapshot(lastSeq, snapshotPlayers);
      if (ws.readyState === 1) {
        ws.send(snapshotBuffer, { binary: true });
        this.metrics.messagesOut++;
        this.metrics.bytesOut += snapshotBuffer.byteLength;
      }
    }
    this.metrics.lastTickMs = Number((performance.now() - start).toFixed(3));
  }

  broadcast(message) {
    const len = Buffer.byteLength(message, 'utf8');
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(message);
        this.metrics.messagesOut++;
        this.metrics.bytesOut += len;
      }
    }
  }

  close() {
    clearInterval(this.intervalId);
    this.log.info({ event: 'room_closed' }, 'Room closed');
    this.emit('close');
  }
}