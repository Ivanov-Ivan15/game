import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { World } from './world.js';
import { Ship, Asteroid, Pickup } from './entities.js';
import { Vector2 } from './vector2.js';

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

const world = new World(width, height);
const ship = new Ship(new Vector2(width / 2, height / 2));
world.spawn(ship);

world.spawn(new Asteroid(new Vector2(100, 100), new Vector2(30, 20)));
world.spawn(new Asteroid(new Vector2(600, 400), new Vector2(-20, 40)));
world.spawn(new Pickup(new Vector2(400, 200)));

const input = createInput(() => {
  ship.fire(world);
});

function update(dt) {
  world.step(dt, input.getState());
}

function render() {
  ctx.clearRect(0, 0, width, height);
  world.render(ctx);

  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`HP: ${ship.hp}`, 10, 25);
  ctx.fillText(`Score: ${world.score}`, 10, 45);

  const stats = gameLoop.getStats();
  stepsEl.textContent = stats.stepsPerSecond;
  fpsEl.textContent = stats.framesPerSecond;
  ftEl.textContent = stats.frameTimeMs;
}

const gameLoop = createLoop({ update, render });
gameLoop.start();