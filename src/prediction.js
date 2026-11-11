import { updateShip } from '../shared/physics.js';

export class ClientPrediction {
  constructor() {
    this.pendingInputs = [];
    this.seq = 0;
  }

  createInput(thrust, left, right, fire) {
    this.seq++;
    const input = { seq: this.seq, thrust, left, right, fire };
    this.pendingInputs.push(input);
    return input;
  }

  predict(ship, input, dt) {
    updateShip(ship, input, dt);
  }

  reconcile(ship, serverSnapshot) {
    const serverPlayer = serverSnapshot.players.find(p => p.id === ship.id);
    if (!serverPlayer) return;

    ship.x = serverPlayer.x;
    ship.y = serverPlayer.y;
    ship.angle = serverPlayer.angle;

    const lastSeq = serverSnapshot.lastProcessedSeq;
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > lastSeq);

    for (const input of this.pendingInputs) {
      updateShip(ship, input, 1 / 60);
    }
  }
}