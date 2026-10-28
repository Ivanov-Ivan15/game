import { checkCircleCollision, Particle } from './entities.js';
import { Vector2 } from './vector2.js';

export class World {
  #entities = new Map();

  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.score = 0;
  }

  spawn(entity) {
    this.#entities.set(entity.id, entity);
  }

  despawn(id) {
    this.#entities.delete(id);
  }

  *ofKind(kind) {
    for (const entity of this.#entities.values()) {
      if (entity.kind === kind && !entity.isDead) {
        yield entity;
      }
    }
  }

  createExplosion(pos) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      const speed = 50 + Math.random() * 100;
      const vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
      this.spawn(new Particle(pos, vel));
    }
  }

  step(dt, input) {
    for (const entity of this.#entities.values()) {
      if (entity.kind === 'ship') {
        entity.update(dt, this, input);
      } else {
        entity.update(dt, this);
      }
    }

    const all = Array.from(this.#entities.values());
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];

        if (a.isDead || b.isDead) continue;

        if (checkCircleCollision(a, b)) {
          if ((a.kind === 'bullet' && b.kind === 'asteroid') || (a.kind === 'asteroid' && b.kind === 'bullet')) {
            a.isDead = true;
            b.isDead = true;
            this.score += 100;
            const asteroid = a.kind === 'asteroid' ? a : b;
            this.createExplosion(asteroid.pos);
          }
          if ((a.kind === 'ship' && b.kind === 'pickup') || (a.kind === 'pickup' && b.kind === 'ship')) {
            const pickup = a.kind === 'pickup' ? a : b;
            pickup.isDead = true;
            this.score += 500;
          }
          if ((a.kind === 'ship' && b.kind === 'asteroid') || (a.kind === 'asteroid' && b.kind === 'ship')) {
            const ship = a.kind === 'ship' ? a : b;
            const asteroid = a.kind === 'asteroid' ? a : b;
            ship.takeDamage(20);
            asteroid.isDead = true;
            this.createExplosion(asteroid.pos);
          }
        }
      }
    }

    for (const [id, entity] of this.#entities.entries()) {
      if (entity.isDead) {
        this.despawn(id);
      }
    }
  }

  render(ctx) {
    for (const entity of this.#entities.values()) {
      entity.render(ctx);
    }
  }
}