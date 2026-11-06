# 🥽 Quest AI Companion (WebXR & Mobile 3D Avatar)

A zero-install, in-browser 3D AI companion designed for the **Meta Quest 3** (Mixed Reality & VR) and **Android mobile phones** (vertical portrait and horizontal landscape).

Featuring a **dual-engine AI architecture** and a **multi-avatar 3D gallery**:
1. **🏠 Local WebLLM Engine:** Runs directly on your device via **WebGPU**. 100% private, zero API keys, and zero cloud accounts required.
2. **☁️ Google Gemini Cloud Engine:** Connects to Google's ultra-fast **Gemini 2.5 Flash** model for complex knowledge, streaming responses, and reasoning (uses a free Google AI Studio key saved in your browser's local storage).

🔗 **Live App (GitHub Pages):** [https://eranra.github.io/quest-ai-companion/](https://eranra.github.io/quest-ai-companion/)

---

## ✨ Features

- **⚡ Gemini Live Hands-Free Continuous Mode with Barge-In (New in v0.1.5):**
  - **Always-Listening Mode:** Speak naturally without pressing any buttons. The app automatically detects speech turns and silence pauses, sends queries to the AI, and speaks the reply back.
  - **Barge-In Speech Interruption:** If you start speaking while the avatar is talking, the avatar immediately stops speaking mid-sentence, aborts AI generation, and shifts instantly to attentive listening mode (just like Gemini Live).
- **🕹️ Meta Quest 3 Touch Controller Manipulation (New in v0.1.5):**
  - **Right Controller Thumbstick:** Push forward/pull backward to move the 3D avatar closer or further away in 3D/VR space (0.6m to 4.0m distance).
  - **Left Controller Thumbstick:** Push up/down to scale the avatar size larger or smaller (0.3x to 2.5x).
  - Also available via mobile & desktop touch sliders inside Settings.
- **📱 Android Phone & Meta Quest 3 Optimized:**
  - **Vertical / Portrait Mode:** Automatically zooms and frames the 3D avatar between the top bar and bottom input dock with safe-area insets.
  - **Horizontal / Landscape Mode:** Re-positions the speech bubble and compacts the UI so the avatar remains fully visible and unobstructed.
  - **Virtual Keyboard Resizing:** Connects to `visualViewport` so opening the mobile keyboard keeps the input bar cleanly docked.
  - **Touch Orbit & Pan:** Smooth single-finger orbit rotation around the avatar with touch-action isolation.
- **Mixed Reality Passthrough:** Supports the WebXR `immersive-ar` standard with `local-floor` and transparent clear-alpha rendering on Meta Quest 3 (and ARCore on supported Android devices).
- **🎭 Multi-Avatar 3D Gallery (Procedural Full-Body Character Rigs):**
  - **🛸 Echo:** Adorable floating spherical drone with hovering thruster pods, expressive digital face screen, and gentle floating bob physics.
  - **⚡ Spark:** Futuristic robotic assistant with sleek orbital antennas, dual shoulder turbine pods, digital visor face, and levitating energy core.
  - **🧸 Pip:** Full-dimensional cartoon hero character with stylized eyes, articulated mouth/jaw, full-length body, rounded limbs, expressive hands, and sneakers.
  - **🐸 Ollie:** Friendly full-dimensional cartoon companion with wide animated eyes, playful antennae, cozy hoodie, articulated arms and legs.
  - **👩 Maya:** Full-body realistic female humanoid avatar with articulated head, expressive eyes, sculpted hair, fitted top, slacks, and conversational gesturing arms.
  - **👨 Alex:** Full-body realistic male humanoid avatar with articulated jaw, styled hair, jacket, denim pants, sneakers, and lively gesturing limbs.
- **🕺 Dynamic Full-Body Animated Body Language:**
  - **👂 Attentive Listening Mode:** When the microphone is active and you speak, the avatar's entire body transitions into an active listening posture — head tilts, attentive leaning, hand touching chin, eyes wide and focused, lips closed in anticipation, and weight-shifted stance.
  - **🗣️ Expressive Speaking Mode:** When replying, the avatar comes to life — realistic jaw and lip sync, brows raising for emphasis, animated eye tracking, rhythmic conversational arm and hand gesticulations, and natural cadence head nods.
- **Dual AI Engine:**
  - **🏠 Local In-Browser Mode (Default - Qwen 2.5 via WebGPU):** Runs 100% locally and privately on your device GPU using **Qwen 2.5 0.5B Instruct** (or 1.5B). Features a live download/compilation progress bar showing GPU memory loading and clear ready state. Zero API keys, zero cloud dependencies.
  - **☁️ Google Gemini Cloud Mode:** Connects to ultra-fast **Gemini 2.5 Flash** with real-time responsiveness testing and online/offline status indication.
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
