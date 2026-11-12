export type PlayerId = number & { readonly __brand: unique symbol };
export type SequenceNumber = number & { readonly __brand: unique symbol };

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
export const SHIP_RADIUS = 15;

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputState {
  thrust: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface ShipState {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
}

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecAddMut(target: Vec2, delta: Vec2): Vec2 {
  target.x += delta.x;
  target.y += delta.y;
  return target;
}

export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vecLengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function vecDistanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function checkCircleCollision(a: Vec2 & { radius: number }, b: Vec2 & { radius: number }): boolean {
  const rSum = a.radius + b.radius;
  return vecDistanceSq(a, b) <= rSum * rSum;
}

export function clampToArena(entity: Vec2, width = ARENA_WIDTH, height = ARENA_HEIGHT): void {
  if (entity.x < 0) entity.x = 0;
  if (entity.x > width) entity.x = width;
  if (entity.y < 0) entity.y = 0;
  if (entity.y > height) entity.y = height;
}

export function createShipState(id: PlayerId, x = 400, y = 300): ShipState {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: SHIP_RADIUS
  };
}

export function updateShip(ship: ShipState, input: InputState, dt: number): void {
  if (input.left) ship.angle -= 3.0 * dt;
  if (input.right) ship.angle += 3.0 * dt;

  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * 300 * dt;
    ship.vy += Math.sin(ship.angle) * 300 * dt;
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  clampToArena(ship);

  const damping = Math.pow(0.98, dt * 60);
  ship.vx *= damping;
  ship.vy *= damping;
}