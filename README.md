# 🥽 Quest AI Companion (WebXR & Mobile 3D Avatar)

A zero-install, in-browser 3D AI companion designed for the **Meta Quest 3** (Mixed Reality & VR) and **Android mobile phones** (vertical portrait and horizontal landscape).

Featuring a **dual-engine AI architecture** and a **multi-avatar 3D gallery**:
1. **🏠 Local WebLLM Engine:** Runs directly on your device via **WebGPU**. 100% private, zero API keys, and zero cloud accounts required.
2. **☁️ Google Gemini Cloud Engine:** Connects to Google's ultra-fast **Gemini 2.5 Flash** model for complex knowledge, streaming responses, and reasoning (uses a free Google AI Studio key saved in your browser's local storage).

🔗 **Live App (GitHub Pages):** [https://eranra.github.io/quest-ai-companion/](https://eranra.github.io/quest-ai-companion/)

---

## ✨ Features

- **📱 Android Phone & Meta Quest 3 Optimized (New in v0.1.2):**
  - **Vertical / Portrait Mode:** Automatically zooms and frames the 3D avatar between the top bar and bottom input dock with safe-area insets.
  - **Horizontal / Landscape Mode:** Re-positions the speech bubble and compacts the UI so the avatar remains fully visible and unobstructed.
  - **Virtual Keyboard Resizing:** Connects to `visualViewport` so opening the mobile keyboard keeps the input bar cleanly docked.
  - **Touch Orbit & Pan:** Smooth single-finger orbit rotation around the avatar with touch-action isolation.
- **Mixed Reality Passthrough:** Supports the WebXR `immersive-ar` standard with `local-floor` and transparent clear-alpha rendering on Meta Quest 3 (and ARCore on supported Android devices).
- **🎭 Multi-Avatar 3D Gallery:**
  - **🤖 Nova:** Sleek cyber android with glowing cyan/indigo LED eyes, audio-reactive mouth bar, and holographic pedestal ring.
  - **👑 Athena:** Obsidian armor vanguard with gold chestplate, gold halo crown, and glowing gold visor.
  - **🛸 Echo:** Adorable floating spherical drone with hovering thruster pods, expressive digital face screen, and gentle floating bob physics.
  - **🔮 Nexus:** Translucent glass holographic matrix with floating geometric core and soundwave visualizer.
  - **🧑 Alex (Ready Player Me):** Full humanoid 3D avatar with 52 ARKit facial blendshapes (`jawOpen`, `mouthOpen`, `viseme_aa`).
  - **🌐 Custom URL:** Load any public `.glb` 3D model from Ready Player Me or Sketchfab.
- **Dual AI Engine:**
  - **Local In-Browser Mode (WebLLM via WebGPU):** Downloads an optimized lightweight model once into browser cache, then runs offline on the device GPU.
  - **Google Gemini Cloud Mode:** Uses Gemini 2.5 Flash via REST endpoints with prompt engineering tailored for voice conversation.
- **3D Avatar & Reactive Lip-Sync:**
  - Animated head tracking, subtle breathing sway, natural blinking, and speech-synchronized mouth visemes.
- **Voice & Audio Pipeline:**
  - Native microphone speech recognition on Android Chrome and Meta Quest.
  - Text-to-Speech via Web Speech Synthesis.
- **Automatic Versioning & Live Update Engine:**
  - Embedded `APP_VERSION` tracking with `version.json` cache-busting polling.
  - When you push to GitHub, in-headset and mobile users get a 1-tap cache purge and instant reload.

---

## 🚀 How to Run

### On Android Phone (Chrome / Samsung Internet)
1. Open Chrome on your phone.
2. Go to:
   ```
   https://eranra.github.io/quest-ai-companion/
   ```
3. Rotate between **Portrait** and **Landscape** — the 3D avatar and camera will automatically adapt to your screen!
4. Tap the **🎤 Mic button** to speak via Android's voice recognition.

### On Meta Quest 3
1. Put on your **Meta Quest 3** headset.
2. Open the built-in **Meta Quest Browser**.
3. Go to the same URL and click **"AR"** on the top bar to step into full-color passthrough!

---

## 🛠️ Local Development & Testing

```bash
# Using Python
python -m http.server 8080

# Or using Node.js / npx
npx serve .
```

---

## 📄 License
MIT
