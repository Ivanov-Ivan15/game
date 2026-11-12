import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Room } from '../server/room.js';
import { encodeInput, decodeSnapshot } from '../shared/protocol.js';
import { PlayerId } from '../shared/physics.js';

class MockWS extends EventEmitter {
  public readyState = 1;
  public sentMessages: (string | ArrayBuffer)[] = [];
  public closedWith: { code?: number; reason?: string } | null = null;

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closedWith = { code, reason };
  }
}

describe('Server Room & Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds clients up to maxPlayers and rejects overflow with 4001', () => {
    const room = new Room('r1', { maxPlayers: 2 });
    const ws1 = new MockWS();
    const ws2 = new MockWS();
    const ws3 = new MockWS();

    expect(room.addClient(ws1, 'Alice')).toBe(true);
    expect(room.addClient(ws2, 'Bob')).toBe(true);
    expect(room.addClient(ws3, 'Charlie')).toBe(false);
    expect(ws3.closedWith?.code).toBe(4001);
    room.close();
  });

  it('updates player ship position when valid binary input arrives', () => {
    const room = new Room('r1');
    const ws = new MockWS();
    room.addClient(ws, 'Alice');

    const beforeX = room.getPlayer(1 as PlayerId)!.x;
    const inputBuf = encodeInput(1, true, false, false, false);
    ws.emit('message', inputBuf, true);

    const afterX = room.getPlayer(1 as PlayerId)!.x;
    expect(afterX).toBeGreaterThan(beforeX);
    room.close();
  });

  it('enforces rate limit when client exceeds maxMsgsPerSec', () => {
    const room = new Room('r1', { maxMsgsPerSec: 5 });
    const ws = new MockWS();
    room.addClient(ws, 'Spammer');

    let rateLimitHits = 0;
    room.on('rate_limited', () => rateLimitHits++);

    const inputBuf = encodeInput(1, true, false, false, false);
    for (let i = 0; i < 10; i++) {
      ws.emit('message', inputBuf, true);
    }

    expect(rateLimitHits).toBe(5);
    room.close();
  });

  it('resets rate limit window after 1 second', () => {
    const room = new Room('r1', { maxMsgsPerSec: 2 });
    const ws = new MockWS();
    room.addClient(ws, 'Player');

    let rateLimitHits = 0;
    room.on('rate_limited', () => rateLimitHits++);

    const inputBuf = encodeInput(1, false, true, false, false);
    ws.emit('message', inputBuf, true);
    ws.emit('message', inputBuf, true);
    ws.emit('message', inputBuf, true);
    expect(rateLimitHits).toBe(1);

    vi.advanceTimersByTime(1050);
    ws.emit('message', inputBuf, true);
    expect(rateLimitHits).toBe(1);
    room.close();
  });

  it('emits protocol_error instead of crashing on corrupted binary payload', () => {
    const room = new Room('r1');
    const ws = new MockWS();
    room.addClient(ws, 'Hacker');

    let errors = 0;
    room.on('protocol_error', () => errors++);

    ws.emit('message', new ArrayBuffer(2), true);
    expect(errors).toBe(1);
    room.close();
  });

  it('broadcasts valid chat messages and ignores invalid chat payloads', () => {
    const room = new Room('r1');
    const ws1 = new MockWS();
    const ws2 = new MockWS();
    room.addClient(ws1, 'Alice');
    room.addClient(ws2, 'Bob');

    ws1.emit('message', JSON.stringify({ type: 'chat', text: 'Hello Bob' }), false);
    ws1.emit('message', JSON.stringify({ type: 'chat', text: '' }), false);

    expect(ws2.sentMessages.length).toBe(1);
    const parsed = JSON.parse(ws2.sentMessages[0] as string);
    expect(parsed.sender).toBe('Alice');
    expect(parsed.text).toBe('Hello Bob');
    room.close();
  });

  it('sends binary snapshots at 30Hz tick rate using fake timers', () => {
    const room = new Room('r1');
    const ws = new MockWS();
    room.addClient(ws, 'Alice');

    const inputBuf = encodeInput(9, true, false, false, false);
    ws.emit('message', inputBuf, true);

    vi.advanceTimersByTime(100);
    const binarySnapshots = ws.sentMessages.filter(m => m instanceof ArrayBuffer) as ArrayBuffer[];
    expect(binarySnapshots.length).toBeGreaterThanOrEqual(2);

    const decoded = decodeSnapshot(binarySnapshots[0]);
    expect(decoded.lastProcessedSeq).toBe(9);
    expect(decoded.players.length).toBe(1);
    room.close();
  });

  it('closes room automatically when last player disconnects', () => {
    const room = new Room('r1');
    const ws = new MockWS();
    let closed = false;
    room.on('close', () => (closed = true));

    room.addClient(ws, 'Solo');
    room.removeClient(ws);

    expect(room.getPlayerCount()).toBe(0);
    expect(closed).toBe(true);
  });
});