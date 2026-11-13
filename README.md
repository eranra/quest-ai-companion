# 🥽 Quest AI Companion (WebXR 360° & Standalone PC Server)

A zero-install, in-browser 3D AI companion designed for the **Meta Quest 3** (Full 360° VR, Mixed Reality Passthrough) and **Android mobile devices**, with an optional high-performance **Local PC Server backend**.

Featuring a **flexible dual-mode architecture**:
1. **🏠 Standalone In-Browser Merged Mode:** Runs 100% on the Quest 3 headset or mobile device using WebAssembly (Whisper STT, Piper TTS) or WebGPU/Gemini Cloud. Zero server or PC required!
2. **🖥️ Accelerated PC Server Backend Mode:** Offloads AI processing to your PC over local Wi-Fi or secure HTTPS tunnel. Leverages **20 CPU cores** and **DirectML GPU acceleration** for ultra-low latency, plus host **Google Antigravity Agent** integration.

🔗 **Live App (GitHub Pages):** [https://eranra.github.io/quest-ai-companion/](https://eranra.github.io/quest-ai-companion/)

---

## ✨ Core Features

- **🌐 5 Immersive 3D Spaces:**
  - 🏛️ **Grand Study Hall:** Warm hardwood floor, high academic forum architecture, floating sunbeam dust motes, and distant birds.
  - 🍃 **Zen Garden:** Raked gravel courtyard, stone stepping paths, bamboo water fountain, and falling cherry blossom petals.
  - 🌆 **City Penthouse:** Polished dark marble floors, skyline city panorama, and atmospheric urban lighting.
  - ☕ **Cyberpunk Cafe:** Parquet wood flooring, atmospheric neon lights, and cozy lounge ambiance.
  - 🥽 **Real Room Passthrough:** Full-color Mixed Reality passthrough on Meta Quest 3, placing the avatar in your physical room.

- **🎭 Multi-Avatar 3D Gallery:**
  - 👩 **Maya (Female Humanoid):** Expressive limbs, styled hair, conversational gesturing.
  - 👨 **Alex (Male Humanoid):** Conversational body language, denim jacket, casual footwear.
  - 🛸 **Echo:** Hovering spherical drone with digital facial screen and thrusters.
  - ⚡ **Spark:** Robotic assistant with pulsing visor and dual turbines.
  - 🧸 **Pip:** Articulated 3D cartoon hero.
  - 🐸 **Ollie:** Friendly animated hoodie companion.

- **🎙️ Speech & Neural Audio Pipeline:**
  - **STT Models:** Whisper Tiny (39M), Whisper Base (74M), Whisper Small (244M), or native browser STT.
  - **TTS Voices:** Piper Neural TTS WASM (Amy, Ryan, Lessac, Kathleen, Danny).
  - **LLM Options:** Instant Companion (0ms), SmolLM2 135M, SmolLM2 360M, Qwen 2.5 0.5B, Antigravity Agent, or Gemini Cloud.

---

## 🚀 How to Run

### Mode A: Standalone on Meta Quest 3 (Zero PC Required)
1. Put on your **Meta Quest 3** headset.
2. Open **Meta Quest Browser**.
3. Navigate to:
   ```
   https://eranra.github.io/quest-ai-companion/
   ```
4. Click **"360° VR"** on the top bar to step into full VR immersion!
5. Use your Touch Controllers or On-Screen Toolbar:
   - **Left Stick:** Direct avatar locomotion in scene (walk forward, backward, left, right).
   - **Grip + Left Stick Y:** Adjust avatar scale.
   - **Right Stick Y:** Adjust avatar distance.
   - **Grip + Right Stick Y:** Adjust avatar elevation / floor level offset.
   - **In-VR 3D Console & On-Screen Toolbar:** Trigger expressive gestures (👋 Wave, 🕺 Dance, 🤸 Balance, 🙌 Cheer, 🙇 Bow, 🤔 Think, 👏 Clap, 🦘 Jump, 🎲 Freestyle Mode).
   - **Button A / X:** Push-to-Talk / Mic toggle.
   - **Button B / Y:** Exit VR back to 2D browser window.

### Mode B: Connected to Local PC Server (Accelerated WASM / Antigravity)
1. On your PC, start the standalone server:
   ```powershell
   cd C:\Users\eranr\.gemini\antigravity\scratch\quest-ai-companion
   node server/server.js
   ```
2. Start an HTTPS tunnel (Meta Quest Browser requires HTTPS for WebXR & mic):
   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8080
   ```
3. Copy the generated `https://xxxx.trycloudflare.com` URL.
4. On Quest 3 in `https://eranra.github.io/quest-ai-companion/`:
   - Open **⚙️ Settings**.
   - Under **AI Engine**, select **Local PC Server (LAN / Wi-Fi)**.
   - Paste your tunnel URL and click **Test Connection**.
   - Select your preferred STT, LLM, and Voice models from the dynamically loaded server catalog!

---

## 🛠️ Automated Testing

Run the full end-to-end regression test suite (verifies WebXR, 3D rigger, spaces, audio state machines, and client-server communication):
```powershell
node tests/run_tests.js
```

---

## 📄 License
MIT
