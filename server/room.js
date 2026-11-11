import { EventEmitter } from 'events';
import { createShipState, updateShip, PlayerId, SequenceNumber, ShipState } from '../shared/physics.js';
import { encodeSnapshot, decodeInput, parseChatMessage, MSG_INPUT, SnapshotPlayer } from '../shared/protocol.js';

interface ClientWS {
  readyState: number;
  send(data: string | ArrayBuffer, options?: { binary?: boolean }): void;
  close(code?: number, data?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
}

interface ClientInfo {
  readonly id: PlayerId;
  readonly name: string;
}

interface RoomOptions {
  readonly maxPlayers?: number;
}

export class Room extends EventEmitter {
  public readonly id: string;
  private readonly maxPlayers: number;
  private readonly clients = new Map<ClientWS, ClientInfo>();
  private readonly players = new Map<PlayerId, ShipState>();
  private readonly lastProcessedSeq = new Map<PlayerId, SequenceNumber>();
  private nextPlayerId = 1;

  private readonly tickRate = 30;
  private readonly dt = 1 / this.tickRate;
  private readonly intervalId: ReturnType<typeof setInterval>;

  constructor(id: string, options: RoomOptions = {}) {
    super();
    this.id = id;
    this.maxPlayers = options.maxPlayers ?? 4;
    this.intervalId = setInterval(() => this.tick(), 1000 / this.tickRate);
  }

  public addClient(ws: ClientWS, name: string): boolean {
    if (this.clients.size >= this.maxPlayers) {
      ws.close(4001, 'Room is full');
      return false;
    }

    const playerId = this.nextPlayerId++ as PlayerId;
    const ship = createShipState(playerId, 100 + playerId * 50, 100 + playerId * 50);

    this.clients.set(ws, { id: playerId, name });
    this.players.set(playerId, ship);
    this.lastProcessedSeq.set(playerId, 0 as SequenceNumber);

    ws.on('message', (message: unknown, isBinary: boolean) => this.handleMessage(ws, message, isBinary));

    this.emit('user_joined', { playerId, name });
    return true;
  }

  public removeClient(ws: ClientWS): void {
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

  private handleMessage(ws: ClientWS, message: unknown, isBinary: boolean): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (isBinary || message instanceof ArrayBuffer || (typeof message === 'object' && message !== null && 'buffer' in message)) {
      let buffer: ArrayBuffer;
      if (message instanceof ArrayBuffer) {
        buffer = message;
      } else if (typeof message === 'object' && message !== null && 'buffer' in message) {
        const msgObj = message as { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };
        const offset = msgObj.byteOffset ?? 0;
        const length = msgObj.byteLength ?? msgObj.buffer.byteLength;
        buffer = msgObj.buffer.slice(offset, offset + length);
      } else {
        return;
      }

      const data = decodeInput(buffer);

      if (data.type === MSG_INPUT) {
        const ship = this.players.get(client.id);
        if (ship) {
          updateShip(ship, data, this.dt);
          this.lastProcessedSeq.set(client.id, data.seq);
        }
      }
    } else if (typeof message === 'string') {
      const chatMsg = parseChatMessage(message);
      if (chatMsg) {
        this.broadcast(JSON.stringify({
          type: 'chat',
          sender: client.name,
          text: chatMsg.text,
          timestamp: Date.now()
        }));
      }
    }
  }

  private tick(): void {
    const snapshotPlayers: SnapshotPlayer[] = Array.from(this.players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle
    }));

    for (const [ws, client] of this.clients.entries()) {
      const lastSeq = this.lastProcessedSeq.get(client.id) ?? (0 as SequenceNumber);
      const snapshotBuffer = encodeSnapshot(lastSeq, snapshotPlayers);
      if (ws.readyState === 1) {
        ws.send(snapshotBuffer, { binary: true });
      }
    }
  }

  public broadcast(message: string): void {
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  }

  public close(): void {
    clearInterval(this.intervalId);
    this.emit('close');
  }
}