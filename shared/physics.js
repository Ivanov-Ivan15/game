const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const SHIP_RADIUS = 15;
function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}
function vecAddMut(target, delta) {
  target.x += delta.x;
  target.y += delta.y;
  return target;
}
function vecScale(v, s) {
  return { x: v.x * s, y: v.y * s };
}
function vecLengthSq(v) {
  return v.x * v.x + v.y * v.y;
}
function vecDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function checkCircleCollision(a, b) {
  const rSum = a.radius + b.radius;
  return vecDistanceSq(a, b) <= rSum * rSum;
}
function clampToArena(entity, width = ARENA_WIDTH, height = ARENA_HEIGHT) {
  if (entity.x < 0) entity.x = 0;
  if (entity.x > width) entity.x = width;
  if (entity.y < 0) entity.y = 0;
  if (entity.y > height) entity.y = height;
}
function createShipState(id, x = 400, y = 300) {
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
function updateShip(ship, input, dt) {
  if (input.left) ship.angle -= 3 * dt;
  if (input.right) ship.angle += 3 * dt;
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
export {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  SHIP_RADIUS,
  checkCircleCollision,
  clampToArena,
  createShipState,
  updateShip,
  vecAdd,
  vecAddMut,
  vecDistanceSq,
  vecLengthSq,
  vecScale
};
