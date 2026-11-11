import { EventEmitter } from 'events';
import { createShipState, updateShip } from '../shared/physics.js';
import { encodeSnapshot, decodeInput, MSG_INPUT } from '../shared/protocol.js';

export class Room extends EventEmitter {
  constructor(id, options = {}) {
    super();
    this.id = id;
    this.maxPlayers = options.maxPlayers || 4;
    this.clients = new Map();
    this.players = new Map();
    this.lastProcessedSeq = new Map();
    this.nextPlayerId = 1;

    this.tickRate = 30;
    this.dt = 1 / this.tickRate;
    this.intervalId = setInterval(() => this.tick(), 1000 / this.tickRate);
  }

  addClient(ws, name) {
    if (this.clients.size >= this.maxPlayers) {
      ws.close(4001, 'Room is full');
      return false;
    }

    const playerId = this.nextPlayerId++;
    const ship = createShipState(playerId, 100 + playerId * 50, 100 + playerId * 50);

    this.clients.set(ws, { id: playerId, name });
    this.players.set(playerId, ship);
    this.lastProcessedSeq.set(playerId, 0);

    ws.on('message', (message, isBinary) => this.handleMessage(ws, message, isBinary));

    this.emit('user_joined', { playerId, name });
    return true;
  }

  removeClient(ws) {
    const client = this.clients.get(ws);
    if (!client) return;

    this.clients.delete(ws);
    this.players.delete(client.id);
    this.lastProcessedSeq.delete(client.id);

    this.emit('user_left', { playerId: client.id, name: client.name });

    if (this.clients.size === 0) {
      this.close();
    }
  }

  handleMessage(ws, message, isBinary) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (isBinary || message instanceof ArrayBuffer || Buffer.isBuffer(message)) {
      const buffer = message.buffer ? message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) : message;
      const data = decodeInput(buffer);

      if (data.type === MSG_INPUT) {
        const ship = this.players.get(client.id);
        if (ship) {
          updateShip(ship, data, this.dt);
          this.lastProcessedSeq.set(client.id, data.seq);
        }
      }
    } else {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'chat') {
          this.broadcast(JSON.stringify({
            type: 'chat',
            sender: client.name,
            text: payload.text,
            timestamp: Date.now()
          }));
        }
      } catch (e) {}
    }
  }

  tick() {
    const playerArray = Array.from(this.players.values());

    for (const [ws, client] of this.clients.entries()) {
      const lastSeq = this.lastProcessedSeq.get(client.id) || 0;
      const snapshotBuffer = encodeSnapshot(lastSeq, playerArray);
      if (ws.readyState === 1) {
        ws.send(snapshotBuffer, { binary: true });
      }
    }
  }

  broadcast(message) {
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  }

  close() {
    clearInterval(this.intervalId);
    this.emit('close');
  }
}