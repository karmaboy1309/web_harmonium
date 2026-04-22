/**
 * renderer.js — Custom Canvas Renderer
 * 
 * Renders the harmonium with a premium cosmic aesthetic:
 * - Deep space background with floating dust
 * - Glowing keys with press/glow animations
 * - Grid lines and atmospheric effects
 */

export class HarmoniumRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;

    // Background star field
    this.stars = [];
    this._generateStars(120);

    // Ambient floating dust
    this.dust = [];
    this._generateDust(60);
  }

  _generateStars(count) {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.3 + Math.random() * 1.2,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  _generateDust(count) {
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 1.5,
        speedX: (Math.random() - 0.5) * 0.0002,
        speedY: -0.0001 - Math.random() * 0.0003, // float up
        alpha: 0.1 + Math.random() * 0.2,
      });
    }
  }

  resize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  /** Main render frame */
  render(physicsWorld, particleSystem) {
    this.time += 0.016;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // ── Background ────────────────────────────────────────
    this._drawBackground(ctx, w, h);

    // ── Grid lines ────────────────────────────────────────
    this._drawGrid(ctx, w, h);

    // ── Particles (behind keys) ───────────────────────────
    particleSystem.draw(ctx);

    // ── Keys ──────────────────────────────────────────────
    this._drawKeys(ctx, physicsWorld);

    // ── Vignette ──────────────────────────────────────────
    this._drawVignette(ctx, w, h);
  }

  _drawBackground(ctx, w, h) {
    // Deep gradient
    const grad = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.8);
    grad.addColorStop(0, '#0e0e22');
    grad.addColorStop(0.5, '#0a0a18');
    grad.addColorStop(1, '#06060e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (const star of this.stars) {
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(this.time * star.twinkleSpeed + star.twinkleOffset));
      ctx.globalAlpha = twinkle * 0.6;
      ctx.fillStyle = '#e8e8f0';
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dust
    for (const d of this.dust) {
      d.x += d.speedX;
      d.y += d.speedY;
      if (d.y < 0) d.y = 1;
      if (d.x < 0) d.x = 1;
      if (d.x > 1) d.x = 0;

      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#a0a0c0';
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, d.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  _drawGrid(ctx, w, h) {
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#4060ff';
    ctx.lineWidth = 0.5;

    const spacing = 50;
    const offsetY = (this.time * 10) % spacing;

    // Horizontal lines — moving upward (antigravity visual)
    for (let y = -spacing + offsetY; y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical lines
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  _drawKeys(ctx, physicsWorld) {
    // Draw natural keys first, then sharps on top
    const naturals = physicsWorld.keys.filter(k => !k.noteData.isSharp);
    const sharps = physicsWorld.keys.filter(k => k.noteData.isSharp);

    for (const key of [...naturals, ...sharps]) {
      this._drawSingleKey(ctx, key);
    }

    // Draw keyboard labels BELOW all keys (after keys so they're always visible)
    for (const key of [...naturals, ...sharps]) {
      this._drawKeyLabel(ctx, key);
    }
  }

  _drawSingleKey(ctx, key) {
    const { body, noteData, width, height, isPressed, pressForce, glowIntensity } = key;
    const x = body.position.x;
    const y = body.position.y;
    const hw = width / 2;
    const hh = height / 2;

    ctx.save();

    // ── Glow aura ──
    if (glowIntensity > 0.01) {
      const glowColor = noteData.isSharp
        ? `rgba(255, 0, 229, ${glowIntensity * 0.4})`
        : `rgba(0, 229, 255, ${glowIntensity * 0.35})`;

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15 + glowIntensity * 25;
    }

    // ── Key body ──
    const cornerRadius = 4;
    ctx.beginPath();
    ctx.roundRect(x - hw, y - hh, width, height, cornerRadius);

    if (noteData.isSharp) {
      // Sharp keys: dark with gradient
      const grad = ctx.createLinearGradient(x - hw, y - hh, x - hw, y + hh);
      const pressBlend = pressForce * 0.6;
      grad.addColorStop(0, `rgba(${40 + pressBlend * 100}, ${15 + pressBlend * 10}, ${50 + pressBlend * 120}, 0.95)`);
      grad.addColorStop(0.5, `rgba(${25 + pressBlend * 80}, ${10 + pressBlend * 5}, ${35 + pressBlend * 100}, 0.95)`);
      grad.addColorStop(1, `rgba(${15 + pressBlend * 60}, ${5}, ${20 + pressBlend * 80}, 0.95)`);
      ctx.fillStyle = grad;
    } else {
      // Natural keys: light with subtle gradient
      const grad = ctx.createLinearGradient(x - hw, y - hh, x - hw, y + hh);
      const pressBlend = pressForce * 0.5;
      grad.addColorStop(0, `rgba(${220 - pressBlend * 60}, ${225 - pressBlend * 80}, ${235 - pressBlend * 100}, 0.95)`);
      grad.addColorStop(0.5, `rgba(${200 - pressBlend * 60}, ${205 - pressBlend * 80}, ${218 - pressBlend * 100}, 0.92)`);
      grad.addColorStop(1, `rgba(${180 - pressBlend * 60}, ${185 - pressBlend * 80}, ${200 - pressBlend * 100}, 0.90)`);
      ctx.fillStyle = grad;
    }

    ctx.fill();

    // ── Border ──
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = noteData.isSharp
      ? `rgba(255, 0, 229, ${0.15 + glowIntensity * 0.5})`
      : `rgba(0, 229, 255, ${0.1 + glowIntensity * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Note name on the key ──
    ctx.fillStyle = noteData.isSharp
      ? `rgba(255, 200, 255, ${0.6 + glowIntensity * 0.4})`
      : `rgba(30, 30, 50, ${0.5 + glowIntensity * 0.4})`;
    ctx.font = `600 ${noteData.isSharp ? 9 : 12}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(noteData.label, x, y + hh - 18);

    // ── Press indicator line at top ──
    if (pressForce > 0.05) {
      ctx.fillStyle = noteData.isSharp
        ? `rgba(255, 0, 229, ${pressForce * 0.8})`
        : `rgba(0, 229, 255, ${pressForce * 0.8})`;
      ctx.fillRect(x - hw + 4, y - hh + 2, (width - 8) * pressForce, 2);
    }

    ctx.restore();
  }

  /** Draw keyboard keybind label BELOW each key */
  _drawKeyLabel(ctx, key) {
    const { body, noteData, width, height, glowIntensity } = key;
    if (!noteData.keyBind) return;

    const x = body.position.x;
    const y = body.position.y;
    const hh = height / 2;
    const labelY = y + hh + (noteData.isSharp ? 14 : 18);
    const labelText = noteData.keyBind.toUpperCase();

    ctx.save();

    // Background pill for the label
    const pillW = noteData.isSharp ? 18 : 22;
    const pillH = 16;
    const isActive = glowIntensity > 0.3;

    ctx.beginPath();
    ctx.roundRect(x - pillW / 2, labelY - pillH / 2, pillW, pillH, 3);
    
    if (noteData.isSharp) {
      ctx.fillStyle = isActive
        ? `rgba(255, 0, 229, 0.25)`
        : `rgba(255, 0, 229, 0.08)`;
    } else {
      ctx.fillStyle = isActive
        ? `rgba(0, 229, 255, 0.2)`
        : `rgba(0, 229, 255, 0.06)`;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = noteData.isSharp
      ? `rgba(255, 0, 229, ${0.15 + glowIntensity * 0.4})`
      : `rgba(0, 229, 255, ${0.1 + glowIntensity * 0.3})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Label text
    ctx.fillStyle = noteData.isSharp
      ? `rgba(255, 180, 255, ${0.5 + glowIntensity * 0.5})`
      : `rgba(0, 200, 230, ${0.45 + glowIntensity * 0.5})`;
    ctx.font = `500 ${noteData.isSharp ? 8 : 9}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, labelY);

    ctx.restore();
  }

  _drawVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}
