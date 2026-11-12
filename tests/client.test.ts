import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createShipState, updateShip, PlayerId, SequenceNumber, InputState } from '../shared/physics.js';

interface PendingInput {
  seq: SequenceNumber;
  input: InputState;
  dt: number;
}

class ClientPredictor {
  public ship = createShipState(1 as PlayerId, 100, 100);
  public pending: PendingInput[] = [];

  applyLocalInput(seq: number, input: InputState, dt: number): void {
    const brandedSeq = seq as SequenceNumber;
    updateShip(this.ship, input, dt);
    this.pending.push({ seq: brandedSeq, input, dt });
  }

  reconcile(
    serverX: number,
    serverY: number,
    serverVx: number,
    serverVy: number,
    serverAngle: number,
    lastProcessedSeq: number
  ): void {
    this.ship.x = serverX;
    this.ship.y = serverY;
    this.ship.vx = serverVx;
    this.ship.vy = serverVy;
    this.ship.angle = serverAngle;

    this.pending = this.pending.filter(item => item.seq > lastProcessedSeq);
    for (const item of this.pending) {
      updateShip(this.ship, item.input, item.dt);
    }
  }
}

describe('Client Prediction, Server Reconciliation & Game Loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('matches server authoritative state when all inputs are acknowledged', () => {
    const dt = 1 / 30;
    const serverShip = createShipState(1 as PlayerId, 100, 100);
    const client = new ClientPredictor();

    const inp: InputState = { thrust: true, left: false, right: true, fire: false };
    updateShip(serverShip, inp, dt);
    client.applyLocalInput(1, inp, dt);

    expect(client.ship.x).toBeCloseTo(serverShip.x, 6);
    expect(client.ship.y).toBeCloseTo(serverShip.y, 6);

    client.reconcile(serverShip.x, serverShip.y, serverShip.vx, serverShip.vy, serverShip.angle, 1);
    expect(client.pending.length).toBe(0);
    expect(client.ship.x).toBeCloseTo(serverShip.x, 6);
  });

  it('replays unacknowledged inputs on top of server snapshot during reconciliation', () => {
    const dt = 1 / 30;
    const serverShip = createShipState(1 as PlayerId, 100, 100);
    const client = new ClientPredictor();

    const inp1: InputState = { thrust: true, left: false, right: false, fire: false };
    const inp2: InputState = { thrust: true, left: true, right: false, fire: false };

    updateShip(serverShip, inp1, dt);
    client.applyLocalInput(1, inp1, dt);
    client.applyLocalInput(2, inp2, dt);

    client.reconcile(serverShip.x, serverShip.y, serverShip.vx, serverShip.vy, serverShip.angle, 1);
    expect(client.pending.length).toBe(1);
    expect(client.pending[0].seq).toBe(2);

    updateShip(serverShip, inp2, dt);
    expect(client.ship.x).toBeCloseTo(serverShip.x, 5);
    expect(client.ship.y).toBeCloseTo(serverShip.y, 5);
    expect(client.ship.angle).toBeCloseTo(serverShip.angle, 5);
  });

  it('drops stale acknowledgements without duplicating movement', () => {
    const dt = 1 / 30;
    const client = new ClientPredictor();
    const inp: InputState = { thrust: true, left: false, right: false, fire: false };

    client.applyLocalInput(1, inp, dt);
    client.applyLocalInput(2, inp, dt);

    client.reconcile(100.3, 100, 0, 0, 0, 2);
    expect(client.pending.length).toBe(0);
    expect(client.ship.x).toBeCloseTo(100.3, 5);
  });

  it('executes fixed-timestep client game loop accurately with fake timers', () => {
    const ship = createShipState(1 as PlayerId, 200, 200);
    const stepMs = 16;
    const dt = stepMs / 1000;
    let ticks = 0;

    const timer = setInterval(() => {
      updateShip(ship, { thrust: true, left: false, right: false, fire: false }, dt);
      ticks++;
    }, stepMs);

    vi.advanceTimersByTime(stepMs * 30); // рівно 30 тіків (480 мс)
    clearInterval(timer);

    expect(ticks).toBe(30);
    expect(ship.x).toBeGreaterThan(200);
  });

  it('corrects client misprediction when server reports obstacle clamp', () => {
    const dt = 1 / 30;
    const client = new ClientPredictor();
    const inp: InputState = { thrust: true, left: false, right: false, fire: false };

    client.applyLocalInput(1, inp, dt);
    // Сервер повідомляє, що корабель уперся в стіну на x = 800
    client.reconcile(800, 100, 0, 0, 0, 1);
    expect(client.ship.x).toBe(800);
    expect(client.ship.vx).toBe(0);
  });

  it('handles multiple unacknowledged frames in sequence accurately', () => {
    const dt = 1 / 30;
    const serverShip = createShipState(1 as PlayerId, 300, 300);
    const client = new ClientPredictor();

    const inputs: InputState[] = [
      { thrust: true, left: false, right: true, fire: false },
      { thrust: true, left: false, right: true, fire: false },
      { thrust: false, left: true, right: false, fire: true },
      { thrust: true, left: false, right: false, fire: false }
    ];

    inputs.forEach((inp, idx) => client.applyLocalInput(idx + 1, inp, dt));
    updateShip(serverShip, inputs[0], dt);

    client.reconcile(serverShip.x, serverShip.y, serverShip.vx, serverShip.vy, serverShip.angle, 1);
    expect(client.pending.length).toBe(3);

    for (let i = 1; i < inputs.length; i++) {
      updateShip(serverShip, inputs[i], dt);
    }

    expect(client.ship.x).toBeCloseTo(serverShip.x, 5);
    expect(client.ship.y).toBeCloseTo(serverShip.y, 5);
    expect(client.ship.angle).toBeCloseTo(serverShip.angle, 5);
  });

  it('stops interval loop cleanly when cleared', () => {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
    }, 20);

    vi.advanceTimersByTime(100);
    clearInterval(timer);
    vi.advanceTimersByTime(200);

    expect(ticks).toBe(5);
  });

  it('preserves pending queue order monotonically by sequence number', () => {
    const client = new ClientPredictor();
    const inp: InputState = { thrust: false, left: true, right: false, fire: false };

    client.applyLocalInput(10, inp, 0.016);
    client.applyLocalInput(11, inp, 0.016);
    client.applyLocalInput(12, inp, 0.016);

    client.reconcile(100, 100, 0, 0, -0.048, 10);
    expect(client.pending.map(p => p.seq)).toEqual([11, 12]);
  });

  it('handles zero dt gracefully without NaN values', () => {
    const ship = createShipState(1 as PlayerId, 150, 250);
    updateShip(ship, { thrust: true, left: true, right: false, fire: true }, 0);
    expect(Number.isNaN(ship.x)).toBe(false);
    expect(Number.isNaN(ship.y)).toBe(false);
    expect(ship.x).toBe(150);
    expect(ship.y).toBe(250);
  });

  it('interpolates remote player position linearly between two snapshots', () => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    expect(lerp(100, 200, 0)).toBe(100);
    expect(lerp(100, 200, 0.5)).toBe(150);
    expect(lerp(100, 200, 1)).toBe(200);
  });

  it('wraps remote player angle across -PI / PI boundary cleanly', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    expect(diff).toBeCloseTo(0.2, 5);
  });

  it('simulates network jitter with delayed snapshot arrival using fake timers', () => {
    const client = new ClientPredictor();
    const inp: InputState = { thrust: true, left: false, right: false, fire: false };
    const dt = 1 / 30;

    client.applyLocalInput(1, inp, dt);
    setTimeout(() => {
      client.reconcile(100.33, 100, 10, 0, 0, 1);
    }, 120);

    expect(client.pending.length).toBe(1);
    vi.advanceTimersByTime(120);
    expect(client.pending.length).toBe(0);
  });
});