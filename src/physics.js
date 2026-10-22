export function integrate(ship, input, dt, arenaWidth, arenaHeight) {
  let angle = ship.angle;
  if (input.left) angle -= 3.5 * dt;
  if (input.right) angle += 3.5 * dt;

  let vx = ship.vx;
  let vy = ship.vy;

  if (input.thrust) {
    const speed = 250;
    vx += Math.cos(angle) * speed * dt;
    vy += Math.sin(angle) * speed * dt;
  }

 
  vx *= 0.98;
  vy *= 0.98;

  let x = ship.x + vx;
  let y = ship.y + vy;

  
  if (x < 0) x += arenaWidth;
  if (x > arenaWidth) x -= arenaWidth;
  if (y < 0) y += arenaHeight;
  if (y > arenaHeight) y -= arenaHeight;

  return { x, y, vx, vy, angle };
}