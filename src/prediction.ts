import { updateShip, InputState, ShipState, SequenceNumber } from '../shared/physics.ts';
import { DecodedSnapshot, SnapshotPlayer } from '../shared/protocol.ts';

export type PendingInput = InputState & {
  seq: SequenceNumber;
};

export class ClientPrediction {
  private pendingInputs: PendingInput[] = [];
  private seq = 0;

  public createInput(thrust: boolean, left: boolean, right: boolean, fire: boolean): PendingInput {
    this.seq++;
    const input: PendingInput = {
      seq: this.seq as SequenceNumber,
      thrust,
      left,
      right,
      fire
    };
    this.pendingInputs.push(input);
    return input;
  }

  public predict(ship: ShipState, input: InputState, dt: number): void {
    updateShip(ship, input, dt);
  }

  public reconcile(ship: ShipState, serverSnapshot: DecodedSnapshot): void {
    const serverPlayer = serverSnapshot.players.find((p: SnapshotPlayer) => p.id === ship.id);
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