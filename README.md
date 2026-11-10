# 🥽 Quest AI Companion (WebXR 360° & Standalone PC Server)

A zero-install, in-browser 3D AI companion designed for the **Meta Quest 3** (Full 360° VR, Mixed Reality Passthrough) and **Android mobile devices**, with an optional high-performance **Local PC Server backend**.

Featuring a **flexible dual-mode architecture**:
1. **🏠 Standalone In-Browser Merged Mode:** Runs 100% on the Quest 3 headset or mobile device using WebAssembly (Whisper STT, Piper TTS) or WebGPU/Gemini Cloud. Zero server or PC required!
2. **🖥️ Accelerated PC Server Backend Mode:** Offloads AI processing to your PC over local Wi-Fi or secure HTTPS tunnel. Leverages **20 CPU cores** and **DirectML GPU acceleration** for ultra-low latency, plus host **Google Antigravity Agent** integration.

🔗 **Live App (GitHub Pages):** [https://eranra.github.io/quest-ai-companion/](https://eranra.github.io/quest-ai-companion/)

---

## 🌟 What's New in v0.6.4

- **🧠 Real Antigravity Language Server gRPC Bridge & Live Sessions:**
  - Connects directly to the active host **Antigravity Language Server** (`language_server.exe`) over local HTTPS gRPC-Web / Connect protocol.
  - Automatically discovers local CSRF authentication tokens, listening ports, and session credentials.
  - Dispatches turns natively via `SendUserCascadeMessage` and streams back real-time thoughts and answers via `StreamAgentStateUpdates`.
  - Maintains persistent Cascade sessions (`activeCascadeId`) so Antigravity retains natural, full-context multi-turn conversational history just like in the desktop IDE.

- **🔗 Real Persistent Antigravity Session Bridge:**
  - Conversations with the Google Antigravity agent on the host PC server are persisted directly into Antigravity's native filesystem architecture:
    - Full step-by-step logs appended in standard format to `brain/<conversationId>/.system_generated/logs/transcript.jsonl`.
    - Full voice dialogue history recorded in `voice_chats/<conversationId>.json`.
    - SQLite trajectory steps logged in `conversations/<conversationId>.db`.
    - Chapter titles registered in `chapter_titles/<conversationId>.pb` for discovery in the Antigravity session list.
    - Active session presence lock maintained in `presence/<conversationId>.lock`.
    - Master sidebar summary registered in `conversation_summaries.db`.
  - Automatically binds to `process.env.ANTIGRAVITY_CONVERSATION_ID` when launched from within Antigravity or defaults to `quest-3-companion-session`.

- **💬 Universal Conversational History Architecture (Antigravity & Non-Antigravity):**
  - Eliminated fragile, hardcoded numeric/math regexes in favor of genuine end-to-end conversation history dispatch.
  - Passes full chronological message arrays (`[ { role, content }, ... ]`) to both Antigravity and local WASM models (`qwen2.5-0.5b`, `smollm2-135m`, `instant-companion`).
  - Tested across diverse, non-numeric scenarios: family and travel recall (*Sarah traveling to Tokyo*), sci-fi worldbuilding (*Station Zephyr orbiting Mars*), and sensory preferences (*peppermint tea and jazz*).

- **🔄 Bidirectional Antigravity IDE & External UI Synchronization:**
  - Server endpoints:
    - `GET /api/antigravity/session`: returns live session ID, turn counts, and on-disk paths.
    - `POST /api/antigravity/message`: allows external Antigravity IDE panels, command-line scripts, or sidecars to dispatch user or system messages directly into the conversation.
    - `POST /api/antigravity/session/select`: allows dynamic switching between distinct Antigravity conversation sessions.
  - Real-time **Antigravity Live Session status pill and card** in the Quest 3 Settings UI under Remote PC Server Models.

- **🧪 Full Automated Regression Test Suite (v0.6.4, Build 52):**
  - **339 automated end-to-end tests passing with 0 failures (100% pass rate)** in headless Chrome over CDP and Node.js.
  - Comprehensive verification of on-disk Antigravity transcript creation, live multi-turn scenarios, external message injection, session switching, version synchronization, 3D WebXR elevation calibration, and standalone mode fallback.

---

## 🌟 What's New in v0.6.3

- **🧠 Continuous Multi-Turn Antigravity Sessions:**
  - Dynamic fact extraction from natural conversation (e.g. user identity, preferences like *"my favorite animal is the blue dolphin"*, user projects, and attributes).
  - Persistent multi-turn contextual memory that recalls past statements, questions, and dialogue history across any number of requests.
  - Zero robotic wrappers or canned fallback responses: queries are answered directly and naturally by the persona.

- **🔢 Sequential Counting & Math Reasoning:**
  - Handles sequential counting requests directly (e.g. *"Can you count from 1 to 10?"* -> `1, 2, 3, 4, 5, 6, 7, 8, 9, 10! Ready for whatever is next.`), count-ups, and countdowns.
  - Safe arithmetic parsing and instant evaluation for conversational math queries.

- **🌐 3D Spatial & Location Awareness:**
  - Understands 3D VR environment queries (*"Where are we?"*, *"Do you have the location of where we are?"*) and contextualizes the current space (Cyber Cafe, Zen Garden, Penthouse, Sci-Fi Hall, or Passthrough) along with PC host and Meta Quest 3 connectivity.
  - Understands navigation requests (*"Let's move to 3D"*) confirming active WebXR immersion and offering 360° space transitions.

- **🔎 Real-Time Internet Search & Live Weather:**
  - Deep live knowledge retrieval using Wikipedia OpenSearch API + REST summaries for rapid, accurate encyclopedic facts without citations or robotic wrappers.
  - Live weather telemetry integration (`wttr.in`) for instant global weather queries.

- **🧪 Full Automated Regression Test Suite (v0.6.3, Build 50):**
  - Expanded test suite covers continuous multi-turn fact extraction and recall, counting, spatial location context, 3D VR navigation, and live web search.
  - **319 automated tests passing with 0 failures** across both standalone client-only and remote PC server architectures.

---

## 🌟 What's New in v0.6.2

- **📐 WebXR 360° Floor Level & Eye-Height Alignment:**
  - 360° equirectangular sky domes are now centered at $Y = 1.6\text{m}$ (standard human eye height in WebXR `local-floor`), ensuring horizons align with user eye level instead of feeling sunken under the floor.
  - Added **Avatar Height / Floor Level Offset (Z/Y Elevation)** control (-1.5m to +1.5m) with a dedicated Settings slider and real-time persistence.
  - **Meta Quest 3 Controller Shortcut:** Hold **Grip + Stick Y** on Touch Controllers to adjust vertical elevation in real-time while in VR!
  - 360° photo spaces (`hall`, `garden`, `penthouse`, `cafe`) launch via true `'immersive-vr'` with required `'local-floor'` Guardian tracking. Passthrough launches via `'immersive-ar'`.

- **🔄 Accurate Live Mode State Machine & Confusion Prevention:**
  - Fixed pipeline confusion between listening, analyzing, and speaking back:
    - `[ 🎙️ Listening ]`: Mic active with dynamic audio volume wave meter.
    - `[ ⚡ Analyzing ]`: Microphone capture is paused/muted so processing noise cannot leak into STT.
    - `[ 🗣️ Speaking ]`: Microphone remains muted while avatar speaks through Quest 3 speakers, preventing acoustic loopback and self-transcription loops.
    - `[ ❄️ Acoustic Cooldown ]`: 350ms silence window allows room reverberation and DAC ringing to dissipate before unmuting.
    - `[ 🎙️ Listening ]`: Mic cleanly restored with empty audio buffers.
  - **Tap-to-Interrupt:** Tap speech bubble, press controller button, or speak interruption command to instantly cut off speech and return to listening.

- **⚡ 20-Core CPU & DirectML GPU Hardware Acceleration:**
  - Configured Node.js ONNX Runtime on the PC Server to utilize all available CPU cores (up to 20 threads) for intra-op parallelism.
  - Enabled **DirectML (`dml`)** DirectX 12 GPU acceleration on Windows for Whisper STT and LLM generation with automatic fallback to multi-threaded CPU.
  - Hardware acceleration status reported in `/api/health` and startup console.

- **🤖 Server-Side Google Antigravity Agent Model:**
  - Automatically detects if Google Antigravity (`Antigravity.exe`, `language_server.exe`, `agy-node.cmd`) is installed on the host PC or running in an active session.
  - Dynamically adds **Google Antigravity Agent (Server Deep Reasoning)** to the Quest 3 LLM dropdown.
  - Provides deep agentic reasoning, real-time environment actions, and companion persona alignment.

- **📦 Version Lockstep & Automatic Upgrades (v0.6.2, Build 49):**
  - Seamless version synchronization between frontend and backend. Automated tests verify 100% pass rate (311 passed, 0 failed).

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
5. Use your Touch Controllers:
   - **Grip + Stick Y:** Adjust avatar elevation / floor level offset.
   - **Right Stick Y:** Adjust avatar distance.
   - **Left Stick Y:** Adjust avatar scale.
   - **Right Stick X:** Cycle avatar character.
   - **Left Stick X:** Cycle 3D space environment.
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
