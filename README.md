# 🥽 Quest AI Companion (WebXR / 3D Avatar)

A zero-install, in-browser 3D AI companion for the **Meta Quest 3** that brings an interactive, animated virtual avatar into your room using **Mixed Reality (Color Passthrough)** or Virtual Reality.

Featuring a **dual-engine AI architecture** and a **multi-avatar 3D gallery**:
1. **🏠 Local WebLLM Engine:** Runs directly on your device via **WebGPU**. 100% private, zero API keys, and zero cloud accounts required.
2. **☁️ Google Gemini Cloud Engine:** Connects to Google's ultra-fast **Gemini 2.5 Flash** model for complex knowledge, streaming responses, and reasoning (uses a free Google AI Studio key saved in your browser's local storage).

🔗 **Live App (GitHub Pages):** [https://eranra.github.io/quest-ai-companion/](https://eranra.github.io/quest-ai-companion/)

---

## ✨ Features

- **Zero Installation:** Runs entirely inside the native **Meta Quest Browser** on Meta Quest 3 / 3S / Pro (and desktop Chrome/Edge). No sideloading, no APKs, and no developer mode required.
- **Mixed Reality Passthrough:** Supports the WebXR `immersive-ar` standard with `local-floor` and transparent clear-alpha rendering, placing the 3D avatar directly into your physical living room.
- **🎭 Multi-Avatar 3D Gallery (New in v0.1.1):**
  - **🤖 Nova:** Sleek cyber android with glowing cyan/indigo LED eyes, audio-reactive mouth bar, and holographic pedestal ring.
  - **👑 Athena:** Obsidian armor vanguard with gold chestplate, gold halo crown, and glowing gold visor.
  - **🛸 Echo:** Adorable floating spherical drone with hovering thruster pods, expressive digital face screen, and gentle floating bob physics.
  - **🔮 Nexus:** Translucent glass holographic matrix with floating geometric core and soundwave visualizer.
  - **🧑 Alex (Ready Player Me):** Full humanoid 3D avatar with 52 ARKit facial blendshapes (`jawOpen`, `mouthOpen`, `viseme_aa`).
  - **🌐 Custom URL:** Load any public `.glb` 3D model from Ready Player Me or Sketchfab.
- **Dual AI Engine:**
  - **Local In-Browser Mode (WebLLM via WebGPU):** Downloads an optimized lightweight model (e.g., Llama 3.2 1B Instruct or Qwen 2.5 0.5B) once into browser cache, then runs offline on the device GPU.
  - **Google Gemini Cloud Mode:** Uses Gemini 2.5 Flash via REST endpoints with prompt engineering tailored for voice conversation.
- **3D Avatar & Reactive Lip-Sync:**
  - Animated head tracking (looks at your headset in VR/MR), subtle breathing sway, natural blinking, and speech-synchronized mouth visemes.
- **Voice & Audio Pipeline:**
  - Text-to-Speech via Web Speech Synthesis with natural voice selection.
  - Voice input with speech recognition and virtual keyboard integration.
- **Automatic Versioning & Live Update Engine:**
  - Embedded `APP_VERSION` tracking with `version.json` cache-busting polling.
  - Whenever a new version is pushed to GitHub, an update banner notifies you in-headset with a 1-tap cache purge and instant reload.
- **Desktop & Mobile 3D Preview:**
  - If WebXR is not active, offers OrbitControls and a holographic pedestal grid to test on your PC or phone before putting on the headset.

---

## 🚀 How to Run on Meta Quest 3

1. Put on your **Meta Quest 3** headset.
2. Open the built-in **Meta Quest Browser**.
3. Navigate to:
   ```
   https://eranra.github.io/quest-ai-companion/
   ```
4. Click **"Enter AR (Passthrough)"** on the top bar.
5. Tap the **👤 Avatar icon** to switch between Nova, Athena, Echo, Nexus, or Alex.
6. Click the microphone icon or choose one of the suggestion chips to start talking!

---

## 🛠️ Local Development & Testing

```bash
# Using Python
python -m http.server 8080

# Or using Node.js / npx
npx serve .
```

Open `http://localhost:8080` in Chrome or Edge (WebGPU enabled).

---

## 📦 Architecture & File Structure

```
quest-ai-companion/
├── .nojekyll                 # Prevents GitHub Pages from ignoring assets
├── manifest.json             # Web App / PWA manifest
├── version.json              # Version metadata for in-browser auto-updates
├── index.html                # Single-page WebXR Three.js + Multi-Avatar + WebLLM + Gemini application
└── README.md                 # Documentation
```

---

## 📄 License
MIT
