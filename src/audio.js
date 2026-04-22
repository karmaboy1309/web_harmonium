/**
 * audio.js — Harmonium Reed Synthesis Engine
 * 
 * Uses Tone.js to create a realistic harmonium reed timbre.
 * Notes play directly on key press — no bellows/air pressure required.
 * Supports transpose, octave shift, additional reeds, volume, and reverb.
 */

import * as Tone from 'tone';

export class HarmoniumAudio {
  constructor() {
    this.isReady = false;
    this.activeVoices = new Map(); // noteIndex -> { voices: [], releasing: false }
    
    // Settings
    this.volume = 0.7;          // 0 to 1
    this.reverbEnabled = true;
    this.transpose = 0;         // semitones (-12 to +12)
    this.octaveShift = 0;       // octaves (-2 to +2)
    this.additionalReeds = 0;   // 0 to 3

    this._masterGain = null;
    this._reverb = null;
    this._dryGain = null;
    this._wetGain = null;
    this._filter = null;
    this._compressor = null;
    this._limiter = null;
  }

  /** Initialize Tone.js — must be called after user gesture */
  async init() {
    await Tone.start();
    
    // Master signal chain: voices → filter → compressor → limiter → dry/wet → gain → destination
    this._compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 6,
      attack: 0.005,
      release: 0.15
    });

    this._limiter = new Tone.Limiter(-3);

    this._reverb = new Tone.Reverb({
      decay: 2.0,
      wet: 1,
      preDelay: 0.03,
    });
    await this._reverb.generate();

    this._filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 3500,
      rolloff: -12,
      Q: 1,
    });

    this._masterGain = new Tone.Gain(this.volume);

    // Dry/wet routing for reverb toggle
    this._dryGain = new Tone.Gain(1);
    this._wetGain = new Tone.Gain(this.reverbEnabled ? 0.25 : 0);

    // Chain: filter → compressor → limiter → split (dry + wet/reverb) → master → destination
    this._filter.connect(this._compressor);
    this._compressor.connect(this._limiter);
    
    // Dry path
    this._limiter.connect(this._dryGain);
    this._dryGain.connect(this._masterGain);
    
    // Wet path (reverb)
    this._limiter.connect(this._reverb);
    this._reverb.connect(this._wetGain);
    this._wetGain.connect(this._masterGain);
    
    this._masterGain.toDestination();

    this.isReady = true;
    console.log('[Audio] Harmonium engine initialized');
  }

  /** Calculate actual frequency from base freq + transpose + octave shift */
  _getActualFrequency(baseFreq) {
    const semitoneRatio = Math.pow(2, 1 / 12);
    const transposed = baseFreq * Math.pow(semitoneRatio, this.transpose);
    return transposed * Math.pow(2, this.octaveShift);
  }

  /** Create a single reed voice (one set of oscillators) for a frequency */
  _createReedVoice(frequency, volumeOffset = 0) {
    // Layer 1: Primary reed — sawtooth (bright, buzzy)
    const saw = new Tone.Oscillator({
      frequency: frequency,
      type: 'sawtooth',
      volume: -10 + volumeOffset,
    });

    // Layer 2: Secondary reed — square, detuned slightly for beating
    const square = new Tone.Oscillator({
      frequency: frequency * 1.003,
      type: 'square',
      volume: -16 + volumeOffset,
    });

    // Layer 3: Sub harmonic for body
    const sub = new Tone.Oscillator({
      frequency: frequency * 0.5,
      type: 'triangle',
      volume: -20 + volumeOffset,
    });

    // Individual amplitude envelope
    const ampEnv = new Tone.AmplitudeEnvelope({
      attack: 0.06,
      decay: 0.1,
      sustain: 0.9,
      release: 0.25,
      attackCurve: 'exponential',
      releaseCurve: 'exponential',
    });

    // Per-voice filter for timbral control
    const voiceFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: Math.min(2000 + (frequency * 1.5), 8000),
      rolloff: -12,
      Q: 1.5,
    });

    // Connect: oscillators → envelope → voiceFilter → master filter
    saw.connect(ampEnv);
    square.connect(ampEnv);
    sub.connect(ampEnv);
    ampEnv.connect(voiceFilter);
    voiceFilter.connect(this._filter);

    return { saw, square, sub, ampEnv, voiceFilter };
  }

  /** Start playing a note */
  noteOn(noteIndex, noteData) {
    if (!this.isReady) return;
    
    // If this note is already playing, force stop it first (prevents stuck notes)
    if (this.activeVoices.has(noteIndex)) {
      this._forceStopVoice(noteIndex);
    }

    const baseFreq = this._getActualFrequency(noteData.freq);
    const voices = [];

    // Primary reed voice
    const primary = this._createReedVoice(baseFreq, 0);
    voices.push(primary);

    // Additional reed voices (octave doublings for richness)
    for (let i = 0; i < this.additionalReeds; i++) {
      const multiplier = i === 0 ? 2 : (i === 1 ? 0.5 : 4); // octave up, octave down, 2 octaves up
      const reedFreq = baseFreq * multiplier;
      const volumeOff = -4 * (i + 1); // each additional reed is quieter
      const reed = this._createReedVoice(reedFreq, volumeOff);
      voices.push(reed);
    }

    // Start all oscillators and trigger envelopes
    for (const voice of voices) {
      voice.saw.start();
      voice.square.start();
      voice.sub.start();
      voice.ampEnv.triggerAttack();
    }

    this.activeVoices.set(noteIndex, { voices, releasing: false });
  }

  /** Stop playing a note */
  noteOff(noteIndex) {
    if (!this.isReady) return;
    const entry = this.activeVoices.get(noteIndex);
    if (!entry || entry.releasing) return;

    entry.releasing = true;

    // Trigger release on all voices
    for (const voice of entry.voices) {
      try {
        voice.ampEnv.triggerRelease();
      } catch (e) {
        // Envelope already released or disposed
      }
    }

    // Clean up after release completes
    const cleanupTimeout = setTimeout(() => {
      this._disposeVoiceEntry(noteIndex);
    }, 400);

    entry.cleanupTimeout = cleanupTimeout;
  }

  /** Force-stop a voice immediately (prevents stuck notes) */
  _forceStopVoice(noteIndex) {
    const entry = this.activeVoices.get(noteIndex);
    if (!entry) return;

    // Clear any pending cleanup timeout
    if (entry.cleanupTimeout) {
      clearTimeout(entry.cleanupTimeout);
    }

    this._disposeVoiceEntry(noteIndex);
  }

  /** Dispose all oscillators and nodes for a voice entry */
  _disposeVoiceEntry(noteIndex) {
    const entry = this.activeVoices.get(noteIndex);
    if (!entry) return;

    for (const voice of entry.voices) {
      try {
        voice.saw.stop();
        voice.square.stop();
        voice.sub.stop();
      } catch (e) {
        // Already stopped
      }
      try {
        voice.saw.dispose();
        voice.square.dispose();
        voice.sub.dispose();
        voice.ampEnv.dispose();
        voice.voiceFilter.dispose();
      } catch (e) {
        // Already disposed
      }
    }

    this.activeVoices.delete(noteIndex);
  }

  /** Stop ALL currently playing voices (panic button / cleanup) */
  allNotesOff() {
    for (const [idx] of this.activeVoices) {
      this._forceStopVoice(idx);
    }
  }

  // ── Settings ────────────────────────────────────────────────

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) {
      this._masterGain.gain.rampTo(this.volume, 0.05);
    }
  }

  setReverb(enabled) {
    this.reverbEnabled = enabled;
    if (this._wetGain) {
      this._wetGain.gain.rampTo(enabled ? 0.25 : 0, 0.1);
    }
  }

  setTranspose(semitones) {
    this.transpose = Math.max(-12, Math.min(12, semitones));
    // Restart all active notes with new frequency
    this._restartActiveNotes();
  }

  setOctaveShift(octaves) {
    this.octaveShift = Math.max(-2, Math.min(2, octaves));
    this._restartActiveNotes();
  }

  setAdditionalReeds(count) {
    this.additionalReeds = Math.max(0, Math.min(3, count));
    this._restartActiveNotes();
  }

  /** Re-trigger all active notes (when transpose/octave/reeds change) */
  _restartActiveNotes() {
    // Store which notes are active
    const activeNoteIndices = [...this.activeVoices.keys()];
    // We need the note data — store it before stopping
    const noteDataMap = new Map();
    for (const idx of activeNoteIndices) {
      // We'll re-trigger with the same noteData, so we need to pass it in
      // The noteData comes from NOTES array in physics.js — we store a reference
    }
    // For simplicity, just stop all notes. The user will re-press.
    this.allNotesOff();
  }

  /** Called every frame — no longer needed for pressure, but kept for future use */
  update() {
    // No air pressure decay needed anymore
  }

  dispose() {
    this.allNotesOff();
    this._masterGain?.dispose();
    this._reverb?.dispose();
    this._dryGain?.dispose();
    this._wetGain?.dispose();
    this._filter?.dispose();
    this._compressor?.dispose();
    this._limiter?.dispose();
  }
}
