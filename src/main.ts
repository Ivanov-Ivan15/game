import { createShipState, PlayerId, ShipState } from '../shared/physics.ts';
import { encodeInput, decodeSnapshot, MSG_SNAPSHOT, SnapshotPlayer } from '../shared/protocol.ts';
import { ClientPrediction } from './prediction.ts';

const canvas = (document.getElementById('gameCanvas') as HTMLCanvasElement) || document.createElement('canvas');
if (!document.body.contains(canvas)) {
  canvas.id = 'gameCanvas';
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);
}
const ctx = canvas.getContext('2d')!;

const keys = { thrust: false, left: false, right: false, fire: false };
const prediction = new ClientPrediction();

const localShip: ShipState = createShipState(0 as PlayerId, 400, 300);
let remotePlayers: readonly SnapshotPlayer[] = [];

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.thrust = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'Space') keys.fire = true;
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.thrust = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'Space') keys.fire = false;
});

const ws = new WebSocket(`ws://${location.host}/ws?roomId=room1&name=Player`);
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  console.log('✅ Connected to binary server stream');
};

ws.onmessage = (event: MessageEvent) => {
  if (event.data instanceof ArrayBuffer) {
    const snapshot = decodeSnapshot(event.data);
    if (snapshot.type === MSG_SNAPSHOT) {
      if (localShip.id === 0 && snapshot.players.length > 0) {
        localShip.id = snapshot.players[0]!.id;
      }
      prediction.reconcile(localShip, snapshot);
      remotePlayers = snapshot.players.filter((p: SnapshotPlayer) => p.id !== localShip.id);
    }
  }
};

let lastTime = performance.now();

function gameLoop(now: number): void {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (ws.readyState === WebSocket.OPEN) {
    const input = prediction.createInput(keys.thrust, keys.left, keys.right, keys.fire);
    prediction.predict(localShip, input, dt);
    
    const inputBuffer = encodeInput(input.seq, input.thrust, input.left, input.right, input.fire);
    ws.send(inputBuffer);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function draw(): void {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawShip(localShip, '#00ff00');

  for (const ship of remotePlayers) {
    drawShip(ship, '#ff0000');
  }
}

function drawShip(ship: { x: number; y: number; angle: number }, color: string): void {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

requestAnimationFrame(gameLoop);