import { z } from "zod";
const PROTOCOL_VERSION = 1;
const MSG_INPUT = 1;
const MSG_SNAPSHOT = 2;
const ChatMessageSchema = z.object({
  type: z.literal("chat"),
  text: z.string().min(1).max(200)
});
function parseChatMessage(raw) {
  try {
    const parsed = JSON.parse(raw);
    const result = ChatMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
function encodeInput(seq, thrust, left, right, fire) {
  const buffer = new ArrayBuffer(7);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, MSG_INPUT);
  view.setUint32(2, seq >>> 0, false);
  let flags = 0;
  if (thrust) flags |= 1 << 0;
  if (left) flags |= 1 << 1;
  if (right) flags |= 1 << 2;
  if (fire) flags |= 1 << 3;
  view.setUint8(6, flags);
  return buffer;
}
function decodeInput(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== 7) {
    throw new Error(`Malformed input buffer: expected 7 bytes, got ${buffer?.byteLength ?? "invalid"}`);
  }
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  const type = view.getUint8(1);
  if (version !== PROTOCOL_VERSION || type !== MSG_INPUT) {
    throw new Error(`Invalid input header: version=${version}, type=${type}`);
  }
  const seq = view.getUint32(2, false);
  const flags = view.getUint8(6);
  return {
    version,
    type,
    seq,
    thrust: (flags & 1 << 0) !== 0,
    left: (flags & 1 << 1) !== 0,
    right: (flags & 1 << 2) !== 0,
    fire: (flags & 1 << 3) !== 0
  };
}
function encodeSnapshot(lastProcessedSeq, players) {
  const headerSize = 8;
  const playerStride = 12;
  const buffer = new ArrayBuffer(headerSize + players.length * playerStride);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, MSG_SNAPSHOT);
  view.setUint32(2, lastProcessedSeq >>> 0, false);
  view.setUint16(6, players.length, false);
  let offset = headerSize;
  for (const player of players) {
    view.setUint16(offset, player.id, false);
    view.setFloat32(offset + 2, player.x, false);
    view.setFloat32(offset + 6, player.y, false);
    const quantizedAngle = Math.round(player.angle / Math.PI * 32767);
    const clampedAngle = Math.max(-32768, Math.min(32767, quantizedAngle));
    view.setInt16(offset + 10, clampedAngle, false);
    offset += playerStride;
  }
  return buffer;
}
function decodeSnapshot(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 8) {
    throw new Error(`Malformed snapshot buffer: too short (${buffer?.byteLength ?? "invalid"} bytes)`);
  }
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  const type = view.getUint8(1);
  if (version !== PROTOCOL_VERSION || type !== MSG_SNAPSHOT) {
    throw new Error(`Invalid snapshot header: version=${version}, type=${type}`);
  }
  const lastProcessedSeq = view.getUint32(2, false);
  const count = view.getUint16(6, false);
  const expectedLength = 8 + count * 12;
  if (buffer.byteLength !== expectedLength) {
    throw new Error(`Malformed snapshot buffer: expected ${expectedLength} bytes, got ${buffer.byteLength}`);
  }
  const players = [];
  let offset = 8;
  for (let i = 0; i < count; i++) {
    const id = view.getUint16(offset, false);
    const x = view.getFloat32(offset + 2, false);
    const y = view.getFloat32(offset + 6, false);
    const rawAngle = view.getInt16(offset + 10, false);
    const angle = rawAngle / 32767 * Math.PI;
    players.push({ id, x, y, angle });
    offset += 12;
  }
  return { version, type, lastProcessedSeq, players };
}
export {
  ChatMessageSchema,
  MSG_INPUT,
  MSG_SNAPSHOT,
  PROTOCOL_VERSION,
  decodeInput,
  decodeSnapshot,
  encodeInput,
  encodeSnapshot,
  parseChatMessage
};
