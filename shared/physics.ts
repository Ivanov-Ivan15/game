export type PlayerId = number & { readonly __brand: unique symbol };
export type SequenceNumber = number & { readonly __brand: unique symbol };

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
}

export function createShipState(id: PlayerId, x = 400, y = 300): ShipState {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0
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

  ship.vx *= Math.pow(0.98, dt * 60);
  ship.vy *= Math.pow(0.98, dt * 60);
}