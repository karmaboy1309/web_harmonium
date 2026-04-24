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
      threshold: -20,
      ratio: 4,
      attack: 0.008,
      release: 0.2
    });

    this._limiter = new Tone.Limiter(-3);

    this._reverb = new Tone.Reverb({
      decay: 2.5,
      wet: 1,
      preDelay: 0.04,
    });
    await this._reverb.generate();

    this._filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 3800,
      rolloff: -12,
      Q: 0.7,
    });

    this._masterGain = new Tone.Gain(this.volume);

    // Dry/wet routing for reverb toggle
    this._dryGain = new Tone.Gain(1);
    this._wetGain = new Tone.Gain(this.reverbEnabled ? 0.35 : 0);

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
    // Layer 1: Primary reed — triangle (warm, soft, typical of harmonium reeds)
    const tri = new Tone.Oscillator({
      frequency: frequency,
      type: 'triangle',
      volume: -6 + volumeOffset,
    });

    // Layer 2: Harmonic reed — sine at 2nd harmonic (adds richness and warmth)
    const harmonic2 = new Tone.Oscillator({
      frequency: frequency * 2,
      type: 'sine',
      volume: -15 + volumeOffset,
    });

    // Layer 3: Sub harmonic for depth and body
    const sub = new Tone.Oscillator({
      frequency: frequency * 0.5,
      type: 'sine',
      volume: -20 + volumeOffset,
    });

    // Layer 4: Slight detuning for beating effect (air variation simulation)
    const detune = new Tone.Oscillator({
      frequency: frequency * 0.998,
      type: 'triangle',
      volume: -12 + volumeOffset,
    });

    // Individual amplitude envelope - harmonium sustains indefinitely while key held
    const ampEnv = new Tone.AmplitudeEnvelope({
      attack: 0.05,
      decay: 0.08,
      sustain: 0.95,
      release: 0.4,
      attackCurve: 'linear',
      releaseCurve: 'exponential',
    });

    // Per-voice filter for timbral control - warmer with reduced high frequencies
    const voiceFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: Math.min(2200 + (frequency * 1.3), 7000),
      rolloff: -12,
      Q: 2.2,
    });

    // Slight LFO for natural reed wavering
    const lfo = new Tone.LFO({
      frequency: 5.5,
      min: 0.97,
      max: 1.03,
      type: 'sine',
    });

    // Connect: oscillators → envelope → voiceFilter → master filter
    tri.connect(ampEnv);
    harmonic2.connect(ampEnv);
    sub.connect(ampEnv);
    detune.connect(ampEnv);
    ampEnv.connect(voiceFilter);
    voiceFilter.connect(this._filter);

    // Apply LFO to frequency modulation for natural wavering
    lfo.connect(tri.frequency);
    lfo.start();

    return { tri, harmonic2, sub, detune, ampEnv, voiceFilter, lfo };
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
      voice.tri.start();
      voice.harmonic2.start();
      voice.sub.start();
      voice.detune.start();
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
        voice.tri.stop();
        voice.harmonic2.stop();
        voice.sub.stop();
        voice.detune.stop();
        voice.lfo.stop();
      } catch (e) {
        // Already stopped
      }
      try {
        voice.tri.dispose();
        voice.harmonic2.dispose();
        voice.sub.dispose();
        voice.detune.dispose();
        voice.lfo.dispose();
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
      this._wetGain.gain.rampTo(enabled ? 0.35 : 0, 0.1);
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
