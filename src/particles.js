/**
 * particles.js — Particle Resonance System
 * 
 * When a key is pressed, particles burst from it.
 * - Pitch → color (low = warm reds/golds, high = cool cyans/magentas)
 * - Volume (air pressure) → particle force/count
 * - Antigravity affects particles too — they float upward
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 400;
  }

  /**
   * Emit particles from a key position
   * @param {number} x - key center x
   * @param {number} y - key top y
   * @param {number} freq - note frequency (for color)
   * @param {number} pressure - air pressure 0-1 (for intensity)
   */
  emit(x, y, freq, pressure) {
    const count = Math.floor(3 + pressure * 10);
    const color = this._freqToColor(freq);
    const force = 0.5 + pressure * 2.5;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Recycle oldest particle
        this.particles.shift();
      }

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // mostly upward
      const speed = force * (0.5 + Math.random() * 0.8);

      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.012,
        size: 1.5 + Math.random() * 3,
        color: color,
        alpha: 0.7 + Math.random() * 0.3,
      });
    }
  }

  /**
   * Emit bellows "air" particles
   */
  emitBellows(x, y, pressure) {
    const count = Math.floor(5 + pressure * 15);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const angle = (Math.random() - 0.5) * Math.PI * 0.8; // spread rightward
      const speed = 1 + pressure * 3;

      this.particles.push({
        x: x + 40,
        y: y + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed + 1.5,
        vy: Math.sin(angle) * speed * 0.5 - 0.5,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.015,
        size: 1 + Math.random() * 2.5,
        color: { r: 100, g: 200, b: 255 }, // soft blue for air
        alpha: 0.4 + Math.random() * 0.2,
      });
    }
  }

  /** Map frequency to color — warm reds for low, cool cyans for high */
  _freqToColor(freq) {
    // Normalize freq from ~130Hz (C3) to ~523Hz (C5) → 0 to 1
    const t = Math.max(0, Math.min(1, (freq - 130) / (523 - 130)));

    // Color gradient: gold → orange → magenta → cyan
    let r, g, b;
    if (t < 0.33) {
      const s = t / 0.33;
      r = 255;
      g = Math.floor(215 - s * 130);
      b = Math.floor(0 + s * 80);
    } else if (t < 0.66) {
      const s = (t - 0.33) / 0.33;
      r = Math.floor(255 - s * 180);
      g = Math.floor(85 - s * 40);
      b = Math.floor(80 + s * 150);
    } else {
      const s = (t - 0.66) / 0.34;
      r = Math.floor(75 - s * 75);
      g = Math.floor(45 + s * 185);
      b = Math.floor(230 + s * 25);
    }

    return { r, g, b };
  }

  /** Update all particles — apply antigravity, decay life */
  update(gravityY) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Apply antigravity (upward drift)
      p.vy += gravityY * 0.3;

      p.x += p.vx;
      p.y += p.vy;

      // Air resistance
      p.vx *= 0.995;
      p.vy *= 0.995;

      // Decay life
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Render all particles to canvas */
  draw(ctx) {
    for (const p of this.particles) {
      const alpha = p.alpha * p.life;
      const size = p.size * (0.5 + p.life * 0.5);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Glow effect
      ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0.8)`;
      ctx.shadowBlur = size * 3;

      ctx.fillStyle = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
