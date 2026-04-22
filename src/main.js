/**
 * main.js — Zero-G Harmonium Orchestrator
 * 
 * Binds physics, audio, particles, and rendering into a unified loop.
 * Handles all input (keyboard + mouse) and manages the game loop.
 * No bellows/air pressure — notes play directly on key press.
 */

import './style.css';
import { PhysicsWorld, NOTES } from './physics.js';
import { HarmoniumAudio } from './audio.js';
import { ParticleSystem } from './particles.js';
import { HarmoniumRenderer } from './renderer.js';

// ── State ─────────────────────────────────────────────────────
let physics = null;
let audio = null;
let particles = null;
let renderer = null;
let isRunning = false;
let lastTime = 0;

// Input state
const pressedKeys = new Set();
const pressedNotes = new Set();
let mouseDownNoteIndex = -1;

// Transpose note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Key binding map: keyboard key → note index
const keyBindMap = new Map();
NOTES.forEach((note, index) => {
  if (note.keyBind) {
    keyBindMap.set(note.keyBind.toLowerCase(), index);
  }
});

// ── DOM refs ──────────────────────────────────────────────────
const canvas = document.getElementById('harmonium-canvas');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const gravityValue = document.getElementById('gravity-value');

// Settings refs
const volumeSlider = document.getElementById('volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const reverbToggle = document.getElementById('reverb-toggle');
const transposeDown = document.getElementById('transpose-down');
const transposeUp = document.getElementById('transpose-up');
const transposeDisplay = document.getElementById('transpose-display');
const octaveDown = document.getElementById('octave-down');
const octaveUp = document.getElementById('octave-up');
const octaveDisplay = document.getElementById('octave-display');
const reedsDown = document.getElementById('reeds-down');
const reedsUp = document.getElementById('reeds-up');
const reedsDisplay = document.getElementById('reeds-display');

// ── Initialize ────────────────────────────────────────────────
function init() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  physics = new PhysicsWorld(w, h);
  audio = new HarmoniumAudio();
  particles = new ParticleSystem();
  renderer = new HarmoniumRenderer(canvas);
  renderer.resize(w, h);

  // Event listeners
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseUp);

  // Touch support
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });

  // Start button
  startBtn.addEventListener('click', onStart);

  // Settings controls
  setupSettingsControls();
}

async function onStart() {
  await audio.init();
  startOverlay.classList.add('hidden');
  isRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ── Game Loop ─────────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!isRunning) return;

  const delta = Math.min(timestamp - lastTime, 33); // cap at ~30fps minimum
  lastTime = timestamp;

  // Update systems
  physics.update(delta);
  audio.update();
  particles.update(physics.getGravity());

  // Emit particles for pressed notes (use constant intensity since no air pressure)
  for (const noteIndex of pressedNotes) {
    const key = physics.keys[noteIndex];
    if (key) {
      particles.emit(
        key.body.position.x,
        key.body.position.y - key.height / 2,
        key.noteData.freq,
        0.6 // constant particle intensity
      );
    }
  }

  // Render (no air pressure parameter)
  renderer.render(physics, particles);

  // Update HUD
  updateHUD();

  requestAnimationFrame(gameLoop);
}

// ── HUD Updates ───────────────────────────────────────────────
function updateHUD() {
  const grav = physics.getGravity();
  gravityValue.textContent = grav.toFixed(2);
}

// ── Settings Controls ─────────────────────────────────────────
function setupSettingsControls() {
  // Volume slider
  volumeSlider.addEventListener('input', () => {
    const val = parseInt(volumeSlider.value);
    volumeDisplay.textContent = val + '%';
    audio.setVolume(val / 100);
  });

  // Reverb toggle
  reverbToggle.addEventListener('click', () => {
    const isActive = reverbToggle.classList.toggle('active');
    reverbToggle.textContent = isActive ? 'ON' : 'OFF';
    audio.setReverb(isActive);
  });

  // Transpose
  transposeDown.addEventListener('click', () => {
    audio.setTranspose(audio.transpose - 1);
    updateTransposeDisplay();
  });
  transposeUp.addEventListener('click', () => {
    audio.setTranspose(audio.transpose + 1);
    updateTransposeDisplay();
  });

  // Octave
  octaveDown.addEventListener('click', () => {
    audio.setOctaveShift(audio.octaveShift - 1);
    octaveDisplay.textContent = audio.octaveShift;
  });
  octaveUp.addEventListener('click', () => {
    audio.setOctaveShift(audio.octaveShift + 1);
    octaveDisplay.textContent = audio.octaveShift;
  });

  // Additional Reeds
  reedsDown.addEventListener('click', () => {
    audio.setAdditionalReeds(audio.additionalReeds - 1);
    reedsDisplay.textContent = audio.additionalReeds;
  });
  reedsUp.addEventListener('click', () => {
    audio.setAdditionalReeds(audio.additionalReeds + 1);
    reedsDisplay.textContent = audio.additionalReeds;
  });
}

function updateTransposeDisplay() {
  // Show the transpose as a note name: 0=C, 1=C#, 2=D, etc.
  const idx = ((audio.transpose % 12) + 12) % 12;
  transposeDisplay.textContent = NOTE_NAMES[idx];
}

// ── Input: Keyboard ───────────────────────────────────────────
function onKeyDown(e) {
  if (!isRunning) return;
  const key = e.key.toLowerCase();

  // Prevent repeat
  if (pressedKeys.has(key)) return;
  pressedKeys.add(key);

  // Note keys
  const noteIndex = keyBindMap.get(key);
  if (noteIndex !== undefined) {
    e.preventDefault();
    triggerNoteOn(noteIndex);
  }
}

function onKeyUp(e) {
  const key = e.key.toLowerCase();
  pressedKeys.delete(key);

  const noteIndex = keyBindMap.get(key);
  if (noteIndex !== undefined) {
    triggerNoteOff(noteIndex);
  }

  // Remove active hint
  const hintEl = document.querySelector(`.key-hint[data-key="${key}"]`);
  if (hintEl) hintEl.classList.remove('active');
}

// ── Input: Mouse ──────────────────────────────────────────────
function onMouseDown(e) {
  if (!isRunning) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check keys (sharps checked first due to overlap — getKeyAtPosition iterates backwards)
  const noteIndex = physics.getKeyAtPosition(x, y);
  if (noteIndex >= 0) {
    mouseDownNoteIndex = noteIndex;
    triggerNoteOn(noteIndex);
  }
}

function onMouseUp() {
  if (mouseDownNoteIndex >= 0) {
    triggerNoteOff(mouseDownNoteIndex);
    mouseDownNoteIndex = -1;
  }
}

function onMouseMove(e) {
  if (!isRunning) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const overKey = physics.getKeyAtPosition(x, y) >= 0;
  canvas.style.cursor = overKey ? 'pointer' : 'default';
}

// ── Input: Touch ──────────────────────────────────────────────
function onTouchStart(e) {
  if (!isRunning) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  
  for (const touch of e.changedTouches) {
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const noteIndex = physics.getKeyAtPosition(x, y);
    if (noteIndex >= 0) {
      triggerNoteOn(noteIndex);
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  // Release all currently pressed notes
  for (const noteIndex of [...pressedNotes]) {
    triggerNoteOff(noteIndex);
  }
}

// ── Note trigger helpers ──────────────────────────────────────
function triggerNoteOn(noteIndex) {
  if (pressedNotes.has(noteIndex)) return;
  pressedNotes.add(noteIndex);

  const noteData = NOTES[noteIndex];
  physics.pressKey(noteIndex);
  audio.noteOn(noteIndex, noteData);

  // Initial particle burst
  const key = physics.keys[noteIndex];
  particles.emit(
    key.body.position.x,
    key.body.position.y - key.height / 2,
    noteData.freq,
    0.7
  );
}

function triggerNoteOff(noteIndex) {
  pressedNotes.delete(noteIndex);

  physics.releaseKey(noteIndex);
  audio.noteOff(noteIndex);
}

// ── Resize ────────────────────────────────────────────────────
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
  physics.resize(w, h);
}

// ── Boot ──────────────────────────────────────────────────────
init();
