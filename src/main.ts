import { createShipState, PlayerId, ShipState } from '../shared/physics.ts';
import { encodeInput, decodeSnapshot, MSG_SNAPSHOT, SnapshotPlayer } from '../shared/protocol.ts';
import { ClientPrediction } from './prediction.ts';

const params = new URLSearchParams(location.search);
const roomId = params.get('roomId') || 'room1';
const playerName = params.get('name') || `Player_${Math.floor(Math.random() * 1000)}`;

const roomLabel = document.getElementById('room-label');
if (roomLabel) roomLabel.textContent = roomId;

const playersCountEl = document.getElementById('players-count');
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;

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

(window as any).__GAME_STATE__ = {
  get localShip() { return localShip; },
  get remotePlayers() { return remotePlayers; },
  get keys() { return keys; },
  connected: false
};

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (document.activeElement === chatInput) return;
  const k = e.key.toLowerCase();
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w') keys.thrust = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd') keys.right = true;
  if (e.code === 'Space' || k === ' ') keys.fire = true;
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w') keys.thrust = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd') keys.right = false;
  if (e.code === 'Space' || k === ' ') keys.fire = false;
});

const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProto}//${location.host}/ws?roomId=${encodeURIComponent(roomId)}&name=${encodeURIComponent(playerName)}`);
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  (window as any).__GAME_STATE__.connected = true;
};

ws.onmessage = (event: MessageEvent) => {
  if (event.data instanceof ArrayBuffer) {
    const snapshot = decodeSnapshot(event.data);
    if (snapshot.type === MSG_SNAPSHOT && snapshot.players.length > 0) {
      if (localShip.id === 0) {
        const maxId = Math.max(...snapshot.players.map((p: SnapshotPlayer) => p.id));
        localShip.id = maxId as PlayerId;
      }
      prediction.reconcile(localShip, snapshot);
      remotePlayers = snapshot.players.filter((p: SnapshotPlayer) => p.id !== localShip.id);
      if (playersCountEl) playersCountEl.textContent = String(snapshot.players.length);
    }
  } else if (typeof event.data === 'string') {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat' && chatMessagesEl) {
        const line = document.createElement('div');
        line.className = 'chat-line';
        line.textContent = `${msg.sender}: ${msg.text}`;
        chatMessagesEl.appendChild(line);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      }
    } catch {
    }
  }
};

if (chatForm && chatInput) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text }));
      chatInput.value = '';
    }
  });
}

function step(): void {
  const dt = 1 / 30;

  if (ws.readyState === WebSocket.OPEN && localShip.id > 0) {
    const input = prediction.createInput(keys.thrust, keys.left, keys.right, keys.fire);
    prediction.predict(localShip, input, dt);

    const inputBuffer = encodeInput(input.seq, input.thrust, input.left, input.right, input.fire);
    ws.send(inputBuffer);
  }

  draw();
}

function draw(): void {
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawShip(localShip, '#22c55e');
  for (const ship of remotePlayers) {
    drawShip(ship, '#ef4444');
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

setInterval(step, 1000 / 30);