# 🎹 Zero-G Harmonium

**An antigravity web-based Indian/Western harmonium with physics simulation and generative reed synthesis.**

Play a fully functional harmonium directly in your browser — keys float in a zero-gravity environment, respond to real physics forces when pressed, and produce rich reed-like audio through layered oscillator synthesis.

## ✨ Features

- **Antigravity Physics** — Keys exist as floating bodies in a Matter.js world with negative gravity. Press a key and it dips; release it and antigravity floats it back.
- **Reed Synthesis** — 4-layer oscillator engine (Sawtooth + Square + Triangle + Buzz) mimicking the brass reed timbre of a real harmonium.
- **Particle Resonance** — Pressing keys emits colored particles. Pitch maps to color (warm golds for low notes, cool cyans for high).
- **Full Two-Octave Range** — C3 to C5, playable via keyboard or mouse.
- **Settings Panel** — Volume, Reverb toggle, Transpose (±12 semitones), Octave shift (±2), Additional Reeds (0-3).
- **Cosmic Visual Theme** — Star field, floating dust, grid lines, key glow effects, and vignette.

## 🎮 Controls

| Key | Note |
|-----|------|
| `A, S, D, F, G, H, J, K, L, ;, ', \` | Natural keys (C3 → G4) |
| `W, E, T, Y, U, O, P, ]` | Sharp keys |
| Mouse click on key | Play note |

## 🛠️ Tech Stack

- **[Tone.js](https://tonejs.github.io/)** — Audio synthesis & effects
- **[Matter.js](https://brm.io/matter-js/)** — 2D physics engine
- **[Vite](https://vitejs.dev/)** — Build tool
- **Vanilla JS + Canvas** — No frameworks, pure performance

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/web_harmonium.git
cd web_harmonium

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` and click **"Initialize Audio Engine"** to start playing!

## 📁 Project Structure

```
web_harmonium/
├── index.html          # Main HTML with canvas & settings panel
├── src/
│   ├── main.js         # Orchestrator — game loop, input handling
│   ├── physics.js      # Matter.js antigravity world & key bodies
│   ├── audio.js        # Tone.js harmonium reed synthesis
│   ├── particles.js    # Pitch-colored particle resonance system
│   ├── renderer.js     # Custom canvas renderer (starfield, keys, glow)
│   └── style.css       # Dark cosmic theme & settings panel
├── package.json
└── vite.config.js
```

## 📄 License

MIT
