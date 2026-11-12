import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PlayerId } from '../shared/physics.js';
import {
  PROTOCOL_VERSION,
  MSG_INPUT,
  MSG_SNAPSHOT,
  encodeInput,
  decodeInput,
  encodeSnapshot,
  decodeSnapshot,
  parseChatMessage
} from '../shared/protocol.js';

describe('Binary Input Protocol', () => {
  it('encodes input to exact 7-byte ArrayBuffer', () => {
    const buf = encodeInput(42, true, false, true, false);
    expect(buf.byteLength).toBe(7);
  });

  it('roundtrips specific input flags accurately', () => {
    const buf = encodeInput(12345, true, false, true, true);
    const decoded = decodeInput(buf);
    expect(decoded).toEqual({
      version: PROTOCOL_VERSION,
      type: MSG_INPUT,
      seq: 12345,
      thrust: true,
      left: false,
      right: true,
      fire: true
    });
  });

  it('throws on truncated input buffer without crashing process', () => {
    const shortBuf = new ArrayBuffer(4);
    expect(() => decodeInput(shortBuf)).toThrow(/Malformed input buffer/);
  });

  it('throws on wrong protocol version or message type', () => {
    const buf = encodeInput(1, true, false, false, false);
    const view = new DataView(buf);
    view.setUint8(0, 99);
    expect(() => decodeInput(buf)).toThrow(/Invalid input header/);
  });

  it('[fast-check] roundtrips any valid input packet losslessly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (seq, thrust, left, right, fire) => {
          const encoded = encodeInput(seq, thrust, left, right, fire);
          const decoded = decodeInput(encoded);
          return (
            decoded.version === PROTOCOL_VERSION &&
            decoded.type === MSG_INPUT &&
            decoded.seq === seq &&
            decoded.thrust === thrust &&
            decoded.left === left &&
            decoded.right === right &&
            decoded.fire === fire
          );
        }
      )
    );
  });

  it('[fast-check] rejects arbitrary corrupted/short buffers with Error', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 6 }), (bytes) => {
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        try {
          decodeInput(buf);
          return false;
        } catch (e) {
          return e instanceof Error;
        }
      })
    );
  });
});

describe('Binary Snapshot Protocol', () => {
  it('matches exact wire format length: 8 + players.length * 12', () => {
    const players = [
      { id: 1 as PlayerId, x: 10, y: 20, angle: 0 },
      { id: 2 as PlayerId, x: 30, y: 40, angle: 1.5 }
    ];
    const buf = encodeSnapshot(100, players);
    expect(buf.byteLength).toBe(8 + 2 * 12);
  });

  it('handles empty snapshot with 0 players', () => {
    const buf = encodeSnapshot(77, []);
    expect(buf.byteLength).toBe(8);
    const decoded = decodeSnapshot(buf);
    expect(decoded.lastProcessedSeq).toBe(77);
    expect(decoded.players).toEqual([]);
  });

  it('throws on corrupted snapshot byte length', () => {
    const players = [{ id: 1 as PlayerId, x: 10, y: 20, angle: 0 }];
    const valid = encodeSnapshot(1, players);
    const truncated = valid.slice(0, 14);
    expect(() => decodeSnapshot(truncated)).toThrow(/Malformed snapshot buffer/);
  });

  it('[fast-check] snapshot roundtrip preserves players and angle within Int16 quantization tolerance', () => {
    const playerArb = fc.record({
      id: fc.integer({ min: 1, max: 65535 }).map(n => n as PlayerId),
      x: fc.float({ min: 0, max: 800, noNaN: true }),
      y: fc.float({ min: 0, max: 600, noNaN: true }),
      angle: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true })
    });

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(playerArb, { minLength: 0, maxLength: 20 }),
        (lastSeq, players) => {
          const encoded = encodeSnapshot(lastSeq, players);
          if (encoded.byteLength !== 8 + players.length * 12) return false;

          const decoded = decodeSnapshot(encoded);
          if (decoded.lastProcessedSeq !== lastSeq) return false;
          if (decoded.players.length !== players.length) return false;

          for (let i = 0; i < players.length; i++) {
            const orig = players[i];
            const dec = decoded.players[i];
            if (dec.id !== orig.id) return false;
            if (Math.abs(dec.x - orig.x) > 0.01) return false;
            if (Math.abs(dec.y - orig.y) > 0.01) return false;
            const angleDiff = Math.abs(Math.atan2(Math.sin(dec.angle - orig.angle), Math.cos(dec.angle - orig.angle)));
            if (angleDiff > 0.001) return false;
          }
          return true;
        }
      )
    );
  });
});

describe('Chat Zod Validation', () => {
  it('accepts valid chat JSON message', () => {
    const msg = parseChatMessage(JSON.stringify({ type: 'chat', text: 'Привіт!' }));
    expect(msg).toEqual({ type: 'chat', text: 'Привіт!' });
  });

  it('rejects empty text or text longer than 200 chars', () => {
    expect(parseChatMessage(JSON.stringify({ type: 'chat', text: '' }))).toBeNull();
    expect(parseChatMessage(JSON.stringify({ type: 'chat', text: 'a'.repeat(201) }))).toBeNull();
  });

  it('rejects malformed JSON or wrong message type', () => {
    expect(parseChatMessage('{bad json')).toBeNull();
    expect(parseChatMessage(JSON.stringify({ type: 'hack', text: 'hi' }))).toBeNull();
  });

  it('[fast-check] accepts any valid string 1..200 and rejects out-of-range strings', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (text) => {
        const parsed = parseChatMessage(JSON.stringify({ type: 'chat', text }));
        return parsed !== null && parsed.text === text;
      })
    );

    fc.assert(
      fc.property(fc.string({ minLength: 201, maxLength: 300 }), (longText) => {
        return parseChatMessage(JSON.stringify({ type: 'chat', text: longText })) === null;
      })
    );
  });
});