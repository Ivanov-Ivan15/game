import { z } from 'zod';
import { PlayerId, SequenceNumber } from './physics.js';

export const PROTOCOL_VERSION = 1;
export const MSG_INPUT = 1;
export const MSG_SNAPSHOT = 2;

export const ChatMessageSchema = z.object({
  type: z.literal('chat'),
  text: z.string().min(1).max(200),
  sender: z.string().optional()
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export interface DecodedInput {
  readonly version: number;
  readonly type: number;
  readonly seq: SequenceNumber;
  readonly thrust: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly fire: boolean;
}

export interface SnapshotPlayer {
  readonly id: PlayerId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export interface DecodedSnapshot {
  readonly version: number;
  readonly type: number;
  readonly lastProcessedSeq: SequenceNumber;
  readonly players: readonly SnapshotPlayer[];
}

export function encodeInput(seq: number, thrust: boolean, left: boolean, right: boolean, fire: boolean): ArrayBuffer {
  const buffer = new ArrayBuffer(7);
  const view = new DataView(buffer);
  
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, MSG_INPUT);
  view.setUint32(2, seq, true);
  
  let flags = 0;
  if (thrust) flags |= 1;
  if (left) flags |= 2;
  if (right) flags |= 4;
  if (fire) flags |= 8;
  view.setUint8(6, flags);

  return buffer;
}

export function decodeInput(buffer: ArrayBuffer): DecodedInput {
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  const type = view.getUint8(1);
  const seq = view.getUint32(2, true) as SequenceNumber;
  const flags = view.getUint8(6);

  return {
    version,
    type,
    seq,
    thrust: !!(flags & 1),
    left: !!(flags & 2),
    right: !!(flags & 4),
    fire: !!(flags & 8)
  };
}

export function encodeSnapshot(lastProcessedSeq: number, players: readonly SnapshotPlayer[]): ArrayBuffer {
  const bufferLength = 8 + players.length * 12;
  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);

  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, MSG_SNAPSHOT);
  view.setUint32(2, lastProcessedSeq, true);
  view.setUint16(6, players.length, true);

  let offset = 8;
  for (const p of players) {
    view.setUint16(offset, p.id, true);
    view.setFloat32(offset + 2, p.x, true);
    view.setFloat32(offset + 6, p.y, true);
    const angleInt16 = Math.round((p.angle / (2 * Math.PI)) * 32767);
    view.setInt16(offset + 10, angleInt16, true);
    offset += 12;
  }

  return buffer;
}

export function decodeSnapshot(buffer: ArrayBuffer): DecodedSnapshot {
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  const type = view.getUint8(1);
  const lastProcessedSeq = view.getUint32(2, true) as SequenceNumber;
  const playerCount = view.getUint16(6, true);

  const players: SnapshotPlayer[] = [];
  let offset = 8;
  for (let i = 0; i < playerCount; i++) {
    const id = view.getUint16(offset, true) as PlayerId;
    const x = view.getFloat32(offset + 2, true);
    const y = view.getFloat32(offset + 6, true);
    const angleInt16 = view.getInt16(offset + 10, true);
    const angle = (angleInt16 / 32767) * (2 * Math.PI);

    players.push({ id, x, y, angle });
    offset += 12;
  }

  return { version, type, lastProcessedSeq, players };
}

export function parseChatMessage(jsonString: string): ChatMessage | null {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = ChatMessageSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}