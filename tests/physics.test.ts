import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  SHIP_RADIUS,
  PlayerId,
  vecAdd,
  vecAddMut,
  vecScale,
  vecLengthSq,
  vecDistanceSq,
  checkCircleCollision,
  clampToArena,
  createShipState,
  updateShip,
  InputState
} from '../shared/physics.js';

const NO_INPUT: InputState = { thrust: false, left: false, right: false, fire: false };

describe('Vector math utilities', () => {
  it('vecAdd adds two vectors without mutating inputs', () => {
    const a = { x: 3, y: 4 };
    const b = { x: -1, y: 6 };
    const res = vecAdd(a, b);
    expect(res).toEqual({ x: 2, y: 10 });
    expect(a).toEqual({ x: 3, y: 4 });
  });

  it('vecAddMut mutates target vector in place', () => {
    const target = { x: 10, y: 20 };
    const res = vecAddMut(target, { x: 5, y: -5 });
    expect(res).toBe(target);
    expect(target).toEqual({ x: 15, y: 15 });
  });

  it('vecScale multiplies vector by scalar', () => {
    expect(vecScale({ x: 2, y: -3 }, 4)).toEqual({ x: 8, y: -12 });
    expect(vecScale({ x: 5, y: 7 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it('vecLengthSq returns squared length', () => {
    expect(vecLengthSq({ x: 3, y: 4 })).toBe(25);
    expect(vecLengthSq({ x: 0, y: 0 })).toBe(0);
  });

  it('vecDistanceSq calculates squared distance between points', () => {
    expect(vecDistanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
    expect(vecDistanceSq({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('Collisions & Arena boundaries', () => {
  it('detects overlapping circles', () => {
    const a = { x: 100, y: 100, radius: 15 };
    const b = { x: 120, y: 100, radius: 15 };
    expect(checkCircleCollision(a, b)).toBe(true);
  });

  it('detects touching circles at exact radius sum', () => {
    const a = { x: 0, y: 0, radius: 10 };
    const b = { x: 20, y: 0, radius: 10 };
    expect(checkCircleCollision(a, b)).toBe(true);
  });

  it('returns false for separated circles', () => {
    const a = { x: 0, y: 0, radius: 10 };
    const b = { x: 25, y: 0, radius: 10 };
    expect(checkCircleCollision(a, b)).toBe(false);
  });

  it('clampToArena keeps coordinates inside [0, width] x [0, height]', () => {
    const p1 = { x: -50, y: -10 };
    clampToArena(p1);
    expect(p1).toEqual({ x: 0, y: 0 });

    const p2 = { x: 9999, y: 8888 };
    clampToArena(p2);
    expect(p2).toEqual({ x: ARENA_WIDTH, y: ARENA_HEIGHT });
  });
});

describe('Ship physics & step determinism', () => {
  it('creates ship with default coordinates and radius', () => {
    const ship = createShipState(1 as PlayerId);
    expect(ship).toEqual({
      id: 1,
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: SHIP_RADIUS
    });
  });

  it('rotates left when left input is active', () => {
    const ship = createShipState(1 as PlayerId);
    updateShip(ship, { ...NO_INPUT, left: true }, 0.1);
    expect(ship.angle).toBeCloseTo(-0.3, 5);
  });

  it('rotates right when right input is active', () => {
    const ship = createShipState(1 as PlayerId);
    updateShip(ship, { ...NO_INPUT, right: true }, 0.1);
    expect(ship.angle).toBeCloseTo(0.3, 5);
  });

  it('cancels rotation when both left and right are pressed', () => {
    const ship = createShipState(1 as PlayerId);
    updateShip(ship, { ...NO_INPUT, left: true, right: true }, 0.1);
    expect(ship.angle).toBe(0);
  });

  it('accelerates forward along angle when thrust is pressed', () => {
    const ship = createShipState(1 as PlayerId, 100, 100);
    updateShip(ship, { ...NO_INPUT, thrust: true }, 0.1);
    expect(ship.x).toBeGreaterThan(100);
    expect(ship.vx).toBeGreaterThan(0);
    expect(ship.vy).toBeCloseTo(0, 5);
  });

  it('applies damping over time when thrust is released', () => {
    const ship = createShipState(1 as PlayerId);
    ship.vx = 100;
    updateShip(ship, NO_INPUT, 1 / 60);
    expect(ship.vx).toBeCloseTo(98, 5);
  });

  it('is 100% deterministic across two identical simulations', () => {
    const shipA = createShipState(1 as PlayerId, 250, 250);
    const shipB = createShipState(1 as PlayerId, 250, 250);

    const inputs: InputState[] = [
      { thrust: true, left: false, right: true, fire: false },
      { thrust: true, left: false, right: false, fire: true },
      { thrust: false, left: true, right: false, fire: false },
      { thrust: true, left: true, right: false, fire: false }
    ];

    for (const inp of inputs) {
      updateShip(shipA, inp, 1 / 30);
      updateShip(shipB, inp, 1 / 30);
    }

    expect(shipA).toEqual(shipB);
  });

  it('[fast-check] ship always stays inside arena boundaries for any sequence of inputs', () => {
    const inputArb = fc.record({
      thrust: fc.boolean(),
      left: fc.boolean(),
      right: fc.boolean(),
      fire: fc.boolean()
    });

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: ARENA_WIDTH, noNaN: true }),
        fc.double({ min: 0, max: ARENA_HEIGHT, noNaN: true }),
        fc.array(inputArb, { minLength: 1, maxLength: 50 }),
        (startX, startY, inputSeq) => {
          const ship = createShipState(1 as PlayerId, startX, startY);
          for (const inp of inputSeq) {
            updateShip(ship, inp, 1 / 30);
            if (ship.x < 0 || ship.x > ARENA_WIDTH || ship.y < 0 || ship.y > ARENA_HEIGHT) {
              return false;
            }
          }
          return true;
        }
      )
    );
  });

  it('[fast-check] collision check is symmetric for any two circles', () => {
    const circleArb = fc.record({
      x: fc.double({ min: -500, max: 1500, noNaN: true }),
      y: fc.double({ min: -500, max: 1500, noNaN: true }),
      radius: fc.double({ min: 1, max: 100, noNaN: true })
    });

    fc.assert(
      fc.property(circleArb, circleArb, (a, b) => {
        return checkCircleCollision(a, b) === checkCircleCollision(b, a);
      })
    );
  });
});

describe('Extended Physics Edge Cases', () => {
  it('vecAdd works with negative and fractional coordinates', () => {
    const res = vecAdd({ x: -2.5, y: 1.5 }, { x: 2.5, y: -1.5 });
    expect(res).toEqual({ x: 0, y: 0 });
  });

  it('vecAddMut handles zero delta without changing coordinates', () => {
    const v = { x: 42, y: -17 };
    vecAddMut(v, { x: 0, y: 0 });
    expect(v).toEqual({ x: 42, y: -17 });
  });

  it('vecScale with negative scalar inverts vector direction', () => {
    expect(vecScale({ x: 3, y: -4 }, -2)).toEqual({ x: -6, y: 8 });
  });

  it('vecLengthSq handles negative components properly', () => {
    expect(vecLengthSq({ x: -3, y: -4 })).toBe(25);
  });

  it('vecDistanceSq is symmetric for any two points', () => {
    const a = { x: 12, y: 34 };
    const b = { x: 56, y: 78 };
    expect(vecDistanceSq(a, b)).toBe(vecDistanceSq(b, a));
  });

  it('checkCircleCollision returns true when centers coincide', () => {
    const a = { x: 50, y: 50, radius: 5 };
    const b = { x: 50, y: 50, radius: 15 };
    expect(checkCircleCollision(a, b)).toBe(true);
  });

  it('clampToArena supports custom arena dimensions', () => {
    const pos = { x: 500, y: 500 };
    clampToArena(pos, 300, 200);
    expect(pos).toEqual({ x: 300, y: 200 });
  });

  it('clampToArena leaves valid interior points untouched', () => {
    const pos = { x: 400, y: 300 };
    clampToArena(pos);
    expect(pos).toEqual({ x: 400, y: 300 });
  });

  it('ship accelerates along rotated angle (90 degrees / PI/2)', () => {
    const ship = createShipState(1 as PlayerId, 400, 300);
    ship.angle = Math.PI / 2;
    updateShip(ship, { thrust: true, left: false, right: false, fire: false }, 0.1);
    expect(ship.vx).toBeCloseTo(0, 5);
    expect(ship.vy).toBeGreaterThan(0);
    expect(ship.y).toBeGreaterThan(300);
  });

  it('ship stops moving at top-left arena boundary', () => {
    const ship = createShipState(1 as PlayerId, 0, 0);
    ship.angle = Math.PI;
    updateShip(ship, { thrust: true, left: false, right: false, fire: false }, 0.5);
    expect(ship.x).toBe(0);
  });

  it('ship stops moving at bottom-right arena boundary', () => {
    const ship = createShipState(1 as PlayerId, ARENA_WIDTH, ARENA_HEIGHT);
    ship.angle = 0;
    updateShip(ship, { thrust: true, left: false, right: false, fire: false }, 0.5);
    expect(ship.x).toBe(ARENA_WIDTH);
  });

  it('createShipState assigns custom initial coordinates', () => {
    const ship = createShipState(7 as PlayerId, 123, 456);
    expect(ship.id).toBe(7);
    expect(ship.x).toBe(123);
    expect(ship.y).toBe(456);
  });
});