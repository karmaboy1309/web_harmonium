/**
 * physics.js — The Antigravity Engine
 * 
 * Sets up a Matter.js world with negative gravity (antigravity).
 * Creates floating key bodies constrained on the X-axis, free on Y.
 * Handles force application for key presses and bellows interactions.
 */

import Matter from 'matter-js';

const { Engine, World, Bodies, Body, Constraint, Events, Composite } = Matter;

// ── Note definitions for our harmonium keyboard ──────────────────────
// Full two-octave range: C3 to C5
export const NOTES = [
  // Octave 3
  { note: 'C3',  freq: 130.81, isSharp: false, keyBind: 'a',  label: 'C3' },
  { note: 'C#3', freq: 138.59, isSharp: true,  keyBind: 'w',  label: 'C#3' },
  { note: 'D3',  freq: 146.83, isSharp: false, keyBind: 's',  label: 'D3' },
  { note: 'D#3', freq: 155.56, isSharp: true,  keyBind: 'e',  label: 'D#3' },
  { note: 'E3',  freq: 164.81, isSharp: false, keyBind: 'd',  label: 'E3' },
  { note: 'F3',  freq: 174.61, isSharp: false, keyBind: 'f',  label: 'F3' },
  { note: 'F#3', freq: 185.00, isSharp: true,  keyBind: 't',  label: 'F#3' },
  { note: 'G3',  freq: 196.00, isSharp: false, keyBind: 'g',  label: 'G3' },
  { note: 'G#3', freq: 207.65, isSharp: true,  keyBind: 'y',  label: 'G#3' },
  { note: 'A3',  freq: 220.00, isSharp: false, keyBind: 'h',  label: 'A3' },
  { note: 'A#3', freq: 233.08, isSharp: true,  keyBind: 'u',  label: 'A#3' },
  { note: 'B3',  freq: 246.94, isSharp: false, keyBind: 'j',  label: 'B3' },
  // Octave 4
  { note: 'C4',  freq: 261.63, isSharp: false, keyBind: 'k',  label: 'C4' },
  { note: 'C#4', freq: 277.18, isSharp: true,  keyBind: 'o',  label: 'C#4' },
  { note: 'D4',  freq: 293.66, isSharp: false, keyBind: 'l',  label: 'D4' },
  { note: 'D#4', freq: 311.13, isSharp: true,  keyBind: 'p',  label: 'D#4' },
  { note: 'E4',  freq: 329.63, isSharp: false, keyBind: ';',  label: 'E4' },
  { note: 'F4',  freq: 349.23, isSharp: false, keyBind: "'",  label: 'F4' },
  { note: 'F#4', freq: 369.99, isSharp: true,  keyBind: ']',  label: 'F#4' },
  { note: 'G4',  freq: 392.00, isSharp: false, keyBind: '\\', label: 'G4' },
  { note: 'G#4', freq: 415.30, isSharp: true,  keyBind: null, label: 'G#4' },
  { note: 'A4',  freq: 440.00, isSharp: false, keyBind: null, label: 'A4' },
  { note: 'A#4', freq: 466.16, isSharp: true,  keyBind: null, label: 'A#4' },
  { note: 'B4',  freq: 493.88, isSharp: false, keyBind: null, label: 'B4' },
  { note: 'C5',  freq: 523.25, isSharp: false, keyBind: null, label: 'C5' },
];

// ── Layout constants ─────────────────────────────────────────────────
const NATURAL_KEY_WIDTH = 40;
const NATURAL_KEY_HEIGHT = 140;
const SHARP_KEY_WIDTH = 26;
const SHARP_KEY_HEIGHT = 90;
const KEY_GAP = 3;

export class PhysicsWorld {
  constructor(canvasWidth, canvasHeight) {
    this.width = canvasWidth;
    this.height = canvasHeight;
    
    // Create engine with antigravity (negative Y = upward force)
    this.engine = Engine.create({
      gravity: { x: 0, y: -0.1, scale: 0.001 }
    });

    this.keys = [];        // Array of { body, noteData, restY, isPressed }
    this.constraints = []; // X-axis constraints

    this._buildKeyboard();
    this._buildBoundaries();
  }

  /** Build all floating key bodies */
  _buildKeyboard() {
    const naturalNotes = NOTES.filter(n => !n.isSharp);
    const totalNaturals = naturalNotes.length;
    const totalWidth = totalNaturals * (NATURAL_KEY_WIDTH + KEY_GAP) - KEY_GAP;
    // Center keyboard, but leave room for settings panel on the left
    const startX = Math.max(180, (this.width - totalWidth) / 2);
    
    // Rest position: keys float near the bottom third
    const naturalRestY = this.height * 0.62;
    const sharpRestY = naturalRestY - 32;
    
    let naturalIndex = 0;

    for (const noteData of NOTES) {
      const isSharp = noteData.isSharp;
      const w = isSharp ? SHARP_KEY_WIDTH : NATURAL_KEY_WIDTH;
      const h = isSharp ? SHARP_KEY_HEIGHT : NATURAL_KEY_HEIGHT;

      let x;
      if (!isSharp) {
        x = startX + naturalIndex * (NATURAL_KEY_WIDTH + KEY_GAP) + NATURAL_KEY_WIDTH / 2;
        naturalIndex++;
      } else {
        // Sharp keys sit between the previous natural key and the next
        x = startX + (naturalIndex - 1) * (NATURAL_KEY_WIDTH + KEY_GAP) + NATURAL_KEY_WIDTH - 2;
      }

      const restY = isSharp ? sharpRestY : naturalRestY;

      const body = Bodies.rectangle(x, restY, w, h, {
        restitution: 0.05,
        friction: 0,
        frictionAir: 0.25,    // High damping for crisp press/release
        density: isSharp ? 0.002 : 0.003,
        isStatic: false,
        label: `key-${noteData.note}`,
        chamfer: { radius: 3 },
      });

      // Lock rotation so keys stay upright
      Body.setInertia(body, Infinity);

      World.add(this.engine.world, body);

      // Constraint: very tight tether to keep keys in a straight row
      // Short length + high stiffness = keys only dip slightly on press
      const pinPoint = { x: x, y: restY - 8 };
      const constraint = Constraint.create({
        pointA: pinPoint,
        bodyB: body,
        pointB: { x: 0, y: 0 },
        stiffness: 0.95,
        damping: 0.3,
        length: 8,
        render: { visible: false }
      });
      World.add(this.engine.world, constraint);

      this.keys.push({
        body,
        noteData,
        restY,
        width: w,
        height: h,
        isPressed: false,
        pressForce: 0,       // Animated press force for visuals
        glowIntensity: 0,    // For rendering glow
      });
      this.constraints.push(constraint);
    }
  }

  /** Invisible walls to keep bodies in bounds */
  _buildBoundaries() {
    const thickness = 60;
    const walls = [
      // Floor
      Bodies.rectangle(this.width / 2, this.height + thickness / 2, this.width + 200, thickness, { isStatic: true, label: 'floor' }),
      // Ceiling
      Bodies.rectangle(this.width / 2, -thickness / 2 - 100, this.width + 200, thickness, { isStatic: true, label: 'ceiling' }),
    ];
    World.add(this.engine.world, walls);
  }

  /** Apply a downward impulse to a key (simulating a press) */
  pressKey(index) {
    const key = this.keys[index];
    if (!key) return;
    // Small force — just enough for a subtle dip, keeps keys aligned
    const forceMagnitude = key.noteData.isSharp ? 0.003 : 0.005;
    Body.applyForce(key.body, key.body.position, { x: 0, y: forceMagnitude });
    key.isPressed = true;
    key.pressForce = 1.0;
    key.glowIntensity = 1.0;
  }

  /** Release a key — let antigravity float it back */
  releaseKey(index) {
    const key = this.keys[index];
    if (!key) return;
    key.isPressed = false;
  }

  /** Update physics + decay animations */
  update(delta) {
    Engine.update(this.engine, delta);

    // Decay gravity back to base
    const baseGravity = -0.1;
    this.engine.gravity.y += (baseGravity - this.engine.gravity.y) * 0.02;

    // Decay key visual states
    for (const key of this.keys) {
      if (!key.isPressed) {
        key.pressForce *= 0.92;
        key.glowIntensity *= 0.94;
      }

      // Clamp Y positions to keep keys in visible area
      const minY = this.height * 0.2;
      const maxY = this.height * 0.85;
      if (key.body.position.y < minY) {
        Body.setPosition(key.body, { x: key.body.position.x, y: minY });
        Body.setVelocity(key.body, { x: 0, y: Math.abs(key.body.velocity.y) * 0.3 });
      }
      if (key.body.position.y > maxY) {
        Body.setPosition(key.body, { x: key.body.position.x, y: maxY });
        Body.setVelocity(key.body, { x: 0, y: -Math.abs(key.body.velocity.y) * 0.3 });
      }
    }

  }

  /** Find key index at canvas position */
  getKeyAtPosition(x, y) {
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const key = this.keys[i];
      const b = key.body;
      const hw = key.width / 2;
      const hh = key.height / 2;
      if (
        x >= b.position.x - hw &&
        x <= b.position.x + hw &&
        y >= b.position.y - hh &&
        y <= b.position.y + hh
      ) {
        return i;
      }
    }
    return -1;
  }

  /** Get the current gravity value for HUD */
  getGravity() {
    return this.engine.gravity.y;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }
}
