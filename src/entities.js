import { Vector2 } from './vector2.js';

export class Entity {
  static #nextId = 1;

  #id;
  isDead = false;

  constructor({ pos, vel = new Vector2(), radius = 10, kind = 'entity' }) {
    this.#id = Entity.#nextId++;
    this.pos = pos;
    this.vel = vel;
    this.radius = radius;
    this.kind = kind;
  }

  get id() {
    return this.#id;
  }

  update(dt, world) {
    this.pos = this.pos.add(this.vel.scale(dt));
    
    if (this.pos.x < 0) this.pos = new Vector2(world.width, this.pos.y);
    if (this.pos.x > world.width) this.pos = new Vector2(0, this.pos.y);
    if (this.pos.y < 0) this.pos = new Vector2(this.pos.x, world.height);
    if (this.pos.y > world.height) this.pos = new Vector2(this.pos.x, 0);
  }

  render(ctx) {}
}

export class Ship extends Entity {
  #hp = 100;

  constructor(pos) {
    super({ pos, radius: 15, kind: 'ship' });
    this.angle = 0;
  }

  get hp() {
    return this.#hp;
  }

  takeDamage(amount) {
    this.#hp = Math.max(0, this.#hp - amount);
    if (this.#hp === 0) this.isDead = true;
  }

  fire(world) {
    if (this.isDead) return;
    const noseOffset = new Vector2(Math.cos(this.angle), Math.sin(this.angle)).scale(15);
    const bulletPos = this.pos.add(noseOffset);
    const bulletVel = new Vector2(Math.cos(this.angle), Math.sin(this.angle)).scale(400);

    const bullet = new Bullet(bulletPos, bulletVel, true);
    world.spawn(bullet);
  }

  update(dt, world, input) {
    if (input) {
      if (input.left) this.angle -= 3.5 * dt;
      if (input.right) this.angle += 3.5 * dt;

      if (input.thrust) {
        const dir = new Vector2(Math.cos(this.angle), Math.sin(this.angle));
        this.vel = this.vel.add(dir.scale(250 * dt));
      }
    }

    this.vel = this.vel.scale(0.98);
    super.update(dt, world);
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

export class Bullet extends Entity {
  constructor(pos, vel, isHoming = false) {
    super({ pos, vel, radius: 3, kind: 'bullet' });
    this.ttl = 2.0;
    this.isHoming = isHoming;
  }

  update(dt, world) {
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.isDead = true;
      return;
    }

    if (this.isHoming) {
      let closest = null;
      let minDist = Infinity;
      for (const asteroid of world.ofKind('asteroid')) {
        const d = asteroid.pos.sub(this.pos).length();
        if (d < minDist) {
          minDist = d;
          closest = asteroid;
        }
      }

      if (closest) {
        const targetDir = closest.pos.sub(this.pos).normalize();
        const currentSpeed = this.vel.length();
        this.vel = this.vel.add(targetDir.scale(currentSpeed * 4 * dt)).normalize().scale(currentSpeed);
      }
    }

    super.update(dt, world);
  }

  render(ctx) {
    ctx.save();
    ctx.fillStyle = this.isHoming ? '#f43f5e' : '#facc15';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Asteroid extends Entity {
  constructor(pos, vel) {
    super({ pos, vel, radius: 20, kind: 'asteroid' });
  }

  render(ctx) {
    ctx.save();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export class Pickup extends Entity {
  constructor(pos) {
    super({ pos, radius: 10, kind: 'pickup' });
  }

  render(ctx) {
    ctx.save();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Particle extends Entity {
  constructor(pos, vel) {
    super({ pos, vel, radius: 2, kind: 'particle' });
    this.ttl = 2.0;
  }

  update(dt, world) {
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.isDead = true;
      return;
    }
    super.update(dt, world);
  }

  render(ctx) {
    ctx.save();
    ctx.fillStyle = `rgba(251, 146, 60, ${Math.max(0, this.ttl / 2)})`;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function checkCircleCollision(e1, e2) {
  const dist = e1.pos.sub(e2.pos).length();
  return dist < (e1.radius + e2.radius);
}