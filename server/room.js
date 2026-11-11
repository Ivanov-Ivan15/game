import { EventEmitter } from 'events';
import { config } from './config.js';
import { MatchLogger } from './logger.js';

export class Room extends EventEmitter {
  constructor(id, name) {
    super();
    this.id = id;
    this.name = name;
    this.clients = new Map();
    this.logger = new MatchLogger(id);

    this.on('error', (err) => {
      console.error(`[Room Error] Room ${this.id}:`, err);
    });
  }

  addClient(ws, clientInfo) {
    this.clients.set(ws, {
      ...clientInfo,
      rateLimit: []
    });

    this.broadcast({
      type: 'user_joined',
      sender: 'System',
      text: `${clientInfo.name} приєднався до кімнати`
    });

    this.logger.log({ type: 'join', userId: clientInfo.id, userName: clientInfo.name });
  }

  removeClient(ws) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      this.broadcast({
        type: 'user_left',
        sender: 'System',
        text: `${client.name} залишив кімнату`
      });
      this.logger.log({ type: 'leave', userId: client.id });
    }

    if (this.clients.size === 0) {
      this.logger.close();
      this.emit('empty', this.id);
    }
  }

  handleMessage(ws, rawMessage) {
    if (Buffer.byteLength(rawMessage) > config.maxMessageSize) {
      ws.close(1009, 'Message too big');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawMessage.toString());
    } catch {
      ws.close(1007, 'Invalid JSON format');
      return;
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.type) {
      ws.close(1008, 'Invalid message structure');
      return;
    }

    const client = this.clients.get(ws);
    if (!client) return;

    const now = Date.now();
    client.rateLimit = client.rateLimit.filter((t) => now - t < config.rateLimitWindow);
    if (client.rateLimit.length >= config.rateLimitCount) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }
    client.rateLimit.push(now);

    switch (parsed.type) {
      case 'chat':
        if (typeof parsed.text !== 'string') {
          ws.close(1008, 'Chat text must be a string');
          return;
        }
        const chatMsg = {
          type: 'chat',
          sender: client.name,
          text: parsed.text,
          timestamp: now
        };
        this.broadcast(chatMsg);
        this.logger.log(chatMsg);
        break;

      default:
        ws.close(1008, `Unknown message type: ${parsed.type}`);
        break;
    }
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === ws.OPEN) {
        if (ws.bufferedAmount > 64 * 1024) {
          console.warn('Skipping send due to high bufferedAmount');
          continue;
        }
        ws.send(payload);
      }
    }
  }
}