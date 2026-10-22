import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { integrate } from './physics.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const stepsEl = document.getElementById('steps');
const fpsEl = document.getElementById('fps');
const ftEl = document.getElementById('ft');

const width = 800;
const height = 600;
const dpr = window.devicePixelRatio || 1;

canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

ctx.scale(dpr, dpr);

let ship = { x: width / 2, y: height / 2, vx: 0, vy: 0, angle: 0 };
const input = createInput();

function update(dt) {
  ship = integrate(ship, input.getState(), dt, width, height);
}

function render() {
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  
  const stats = gameLoop.getStats();
  stepsEl.textContent = stats.stepsPerSecond;
  fpsEl.textContent = stats.framesPerSecond;
  ftEl.textContent = stats.frameTimeMs;
}

const gameLoop = createLoop({ update, render });
gameLoop.start();