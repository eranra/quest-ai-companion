// Automated End-to-End Regression Test Suite for Quest AI Companion
// Tests Three.js rendering, Avatar builds, UI modals, Audio pipeline, and DOM interactions in Headless Chrome
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const TEST_PORT = 8124;
const CDP_PORT = 9338;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 1. Static Web Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(repoDir, reqPath);
  
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.glb': 'model/gltf-binary',
    '.png': 'image/png'
  };

  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Quest AI Companion Automated Test Suite');
  console.log('====================================================\n');

  server.listen(TEST_PORT, async () => {
    console.log(`[TEST SERVER] Running at http://127.0.0.1:${TEST_PORT}/`);

    const chrome = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--disable-gpu',
      '--no-sandbox',
      `http://127.0.0.1:${TEST_PORT}/`
    ]);

    await new Promise(r => setTimeout(r, 2000));

    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', async () => {
        try {
          const targets = JSON.parse(raw);
          const page = targets.find(t => t.type === 'page');
          if (!page) {
            throw new Error('No page target found in Chrome DevTools.');
          }

          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const uncaughtExceptions = [];

          ws.onopen = async () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
            ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));
            ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));

            // Allow initial scene and avatar to load
            await new Promise(r => setTimeout(r, 2500));

            // Execute in-browser test assertions
            ws.send(JSON.stringify({
              id: 100,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  (async () => {
                    const results = [];
                    function assert(name, condition, extra = '') {
                      results.push({ name, pass: !!condition, extra });
                    }
                    try {

                    // Test 1: DOM Elements exist
                    assert('Top Bar exists', document.querySelector('.top-bar'));
                    assert('Top Bar Header exists', document.querySelector('.top-bar-header'));
                    assert('Top Header Actions exist', document.querySelector('.top-header-actions'));
                    assert('Settings button pinned in header actions', document.getElementById('btn-settings').classList.contains('btn-settings-pinned'));
                    assert('Main Model Progress Bar exists', document.getElementById('model-progress-bar'));
                    assert('Main Model Progress Fill exists', document.getElementById('model-progress-fill'));
                    assert('Main Model Progress Pct exists', document.getElementById('model-progress-pct'));
                    assert('Main Model Progress Label exists', document.getElementById('model-progress-label'));
                    assert('Pipeline Stepper exists', document.getElementById('pipeline-stepper'));
                    assert('All 4 Pipeline Steps present', 
                      document.getElementById('step-listening') && 
                      document.getElementById('step-analyzing') && 
                      document.getElementById('step-ready') && 
                      document.getElementById('step-speaking')
                    );
                    assert('Voice Activity Meter exists', document.getElementById('mic-level-meter'));
                    assert('5 Meter Bars present', document.querySelectorAll('.meter-bar').length === 5);

                    // Test 2: UI Modals
                    const btnSettings = document.getElementById('btn-settings');
                    const modalSettings = document.getElementById('modal-settings');
                    btnSettings.click();
                    assert('Settings Modal opens on click', modalSettings.classList.contains('open'));

                    const btnCloseSettings = document.getElementById('btn-close-settings');
                    btnCloseSettings.click();
                    assert('Settings Modal closes', !modalSettings.classList.contains('open'));

                    const btnAvatars = document.getElementById('btn-avatars');
                    const modalAvatars = document.getElementById('modal-avatars');
                    btnAvatars.click();
                    assert('Avatars Modal opens on click', modalAvatars.classList.contains('open'));

                    const cards = document.querySelectorAll('.avatar-card');
                    assert('All 6 Avatars in Gallery', cards.length === 6, 'Found: ' + cards.length);

                    const btnCloseAvatars = document.getElementById('btn-close-avatars');
                    btnCloseAvatars.click();
                    assert('Avatars Modal closes', !modalAvatars.classList.contains('open'));

                    // Test 2B: Spaces Modal
                    const btnSpaces = document.getElementById('btn-spaces');
                    const modalSpaces = document.getElementById('modal-spaces');
                    assert('Spaces button exists in UI', !!btnSpaces);
                    assert('Spaces Modal exists in UI', !!modalSpaces);
                    btnSpaces.click();
                    assert('Spaces Modal opens on click', modalSpaces.classList.contains('open'));

                    const spaceCards = document.querySelectorAll('.space-card');
                    assert('All 4 Spaces in Gallery', spaceCards.length === 4, 'Found: ' + spaceCards.length);

                    const btnCloseSpaces = document.getElementById('btn-close-spaces');
                    btnCloseSpaces.click();
                    assert('Spaces Modal closes', !modalSpaces.classList.contains('open'));

                    // Test 3: Avatar Switching without crash
                    const avatarIds = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex'];
                    const { buildAvatar } = await import('./js/avatars/index.js');
                    const { avatarGroup, camera } = await import('./js/scene.js');

                    for (const id of avatarIds) {
                      try {
                        buildAvatar(id, avatarGroup);
                        assert('Avatar build success: ' + id, avatarGroup.children.length > 0);
                      } catch (err) {
                        assert('Avatar build success: ' + id, false, err.message);
                      }
                    }

                    // Test 3B: Spaces Switching & Dynamic Particle Simulation
                    const { switchSpace, updateCurrentSpace } = await import('./js/spaces/index.js');
                    const spaceIds = ['hall', 'garden', 'penthouse', 'cafe'];

                    for (const sId of spaceIds) {
                      try {
                        const def = switchSpace(sId);
                        assert('Space switch success: ' + sId, def && def.id === sId);
                        // Run 5 animation ticks to test particle and object updates
                        for (let t = 0; t < 5; t++) {
                          updateCurrentSpace(0.016, 1.0 + t * 0.016, avatarGroup.position, 1.0);
                        }
                        assert('Space update success: ' + sId, true);
                      } catch (err) {
                        assert('Space switch/update: ' + sId, false, err.message);
                      }
                    }

                    // Test 3C: Organic Rig Idle, Weight-Shift, and Speech Blend
                    const { animateRig, rig } = await import('./js/avatars/rig.js');
                    const THREE = await import('three');
                    try {
                      // Test idle ticks
                      animateRig(0.016, 1.0, camera, avatarGroup);
                      animateRig(0.016, 2.5, camera, avatarGroup);
                      animateRig(0.016, 4.0, camera, avatarGroup);
                      assert('Organic idle rig animation tick success', true);

                      // Test Arm Relaxation (elbows/forearms resting naturally, not wide open)
                      if (rig.leftForearm && rig.rightForearm) {
                        const lPos = new THREE.Vector3();
                        const rPos = new THREE.Vector3();
                        rig.leftForearm.getWorldPosition(lPos);
                        rig.rightForearm.getWorldPosition(rPos);
                        const armSpan = Math.abs(lPos.x - rPos.x);
                        assert('Arms relaxed near torso (span < 0.50m)', armSpan < 0.50, 'Span: ' + armSpan.toFixed(3) + 'm');
                      }
                    } catch (err) {
                      assert('Organic idle rig animation tick success', false, err.message);
                    }

                    // Test 4: Pipeline Status Transitions
                    const { setPipelineState } = await import('./js/ui/pipeline.js');
                    setPipelineState('listening');
                    assert('Pipeline step-listening activates', document.getElementById('step-listening').classList.contains('active'));

                    setPipelineState('analyzing');
                    assert('Pipeline step-analyzing activates', document.getElementById('step-analyzing').classList.contains('active'));

                    setPipelineState('speaking');
                    assert('Pipeline step-speaking activates', document.getElementById('step-speaking').classList.contains('active'));

                    setPipelineState('idle');
                    assert('Pipeline resets to idle', !document.getElementById('step-speaking').classList.contains('active'));

                    // Test 5: Speech & Dual-Mode Configuration
                    const { isSelfEcho, detectUserInterruption, speakReply, stopSpeaking } = await import('./js/audio/tts.js');
                    const { setLiveMode, startListening, stopListening } = await import('./js/audio/speech.js');
                    const { AppState } = await import('./js/state.js');

                    // 5A: Anti-Self-Echo when assistant is silent
                    stopSpeaking();
                    const echoWhenSilent = isSelfEcho("Hello companion, are you ready?");
                    assert('Anti-Self-Echo does not reject user speech when assistant is silent', echoWhenSilent === false);

                    // 5B: Multi-tier Echo Detection while speaking / cooldown
                    speakReply("The weather in Paris is sunny with twenty two degrees.");
                    assert('AEC detects exact phrase echo from spoken text', isSelfEcho("weather in Paris") === true);
                    assert('AEC detects clause echo from spoken text', isSelfEcho("sunny with twenty two degrees") === true);
                    assert('AEC rejects echo during barge-in detection', detectUserInterruption("weather in Paris").isInterruption === false);

                    // 5C: True User Interruption & Stop Commands
                    const stopResult = detectUserInterruption("stop talking please");
                    assert('Barge-in detects stop command', stopResult.isInterruption === true && stopResult.isStopCommand === true);
                    const questionResult = detectUserInterruption("what time is it in Tokyo");
                    assert('Barge-in detects novel user question', questionResult.isInterruption === true && questionResult.isStopCommand === false);

                    // 5D: Spoken History preserved after stopSpeaking()
                    stopSpeaking();
                    assert('AEC preserves spoken history in post-speech cooldown', isSelfEcho("weather in Paris") === true);
                    assert('AEC allows novel question after speech stops', isSelfEcho("tell me an interesting space fact") === false);

                    // 5E: Live Mode vs Push-to-Talk state toggling
                    setLiveMode(false);
                    assert('Regular mode sets AppState.isLiveMode = false', AppState.isLiveMode === false);
                    setLiveMode(true);
                    assert('Live mode sets AppState.isLiveMode = true', AppState.isLiveMode === true);
                    setLiveMode(false); // Reset to regular mode

                    // 5F: Local Neural Voice Models (Whisper STT & Neural TTS)
                    const whisperModule = await import('./js/audio/whisper.js');
                    const neuralTtsModule = await import('./js/audio/neural_tts.js');
                    const audioSubsystem = await import('./js/audio/index.js');

                    assert('audio/whisper.js exports initWhisper', typeof whisperModule.initWhisper === 'function');
                    assert('audio/whisper.js exports startListeningWhisper', typeof whisperModule.startListeningWhisper === 'function');
                    assert('audio/whisper.js exports stopListeningWhisper', typeof whisperModule.stopListeningWhisper === 'function');
                    assert('audio/neural_tts.js exports initNeuralTTS', typeof neuralTtsModule.initNeuralTTS === 'function');
                    assert('audio/neural_tts.js exports speakNeuralTTS', typeof neuralTtsModule.speakNeuralTTS === 'function');
                    assert('audio/neural_tts.js exports stopNeuralTTS', typeof neuralTtsModule.stopNeuralTTS === 'function');
                    assert('audio/neural_tts.js exports isNeuralTTSReady', typeof neuralTtsModule.isNeuralTTSReady === 'function');
                    assert('audio/neural_tts.js exports isNeuralTTSLoading', typeof neuralTtsModule.isNeuralTTSLoading === 'function');
                    const ttsModule = await import('./js/audio/tts.js');
                    assert('audio/tts.js exports recordSpokenText', typeof ttsModule.recordSpokenText === 'function');
                    assert('audio/index.js exports initWhisper', typeof audioSubsystem.initWhisper === 'function');
                    assert('audio/index.js exports initNeuralTTS', typeof audioSubsystem.initNeuralTTS === 'function');

                    const cfgSttEl = document.getElementById('cfg-stt-engine');
                    const cfgTtsEl = document.getElementById('cfg-tts-engine');
                    assert('Voice Input (STT) select exists in settings', !!cfgSttEl);
                    assert('Voice Output (TTS) select exists in settings', !!cfgTtsEl);

                    // Verify whisper engine prevents native speech recognition from starting
                    const nativeSpeechModule = await import('./js/audio/speech.js');
                    AppState.sttEngine = 'whisper';
                    nativeSpeechModule.startListening();
                    assert('Native SpeechRecognition does not start when Whisper STT is active', AppState.isListening === false);

                    AppState.sttEngine = 'whisper';
                    AppState.ttsEngine = 'neural';
                    AppState.save();
                    assert('AppState persists whisper and neural engines', localStorage.getItem('quest_stt_engine') === 'whisper' && localStorage.getItem('quest_tts_engine') === 'neural');
                    // Reset to native
                    AppState.sttEngine = 'native';
                    AppState.ttsEngine = 'native';
                    AppState.save();

                    // Test 6: Refactored AI Subsystem Modularization
                    const aiSubsystem = await import('./js/ai/index.js');
                    const aiForwarder = await import('./js/ai.js');
                    assert('ai/index.js exports generateAIResponse', typeof aiSubsystem.generateAIResponse === 'function');
                    assert('ai/index.js exports abortActiveGeneration', typeof aiSubsystem.abortActiveGeneration === 'function');
                    assert('ai/index.js exports initLocalWebLLM', typeof aiSubsystem.initLocalWebLLM === 'function');
                    assert('ai/index.js exports checkGeminiResponsiveness', typeof aiSubsystem.checkGeminiResponsiveness === 'function');
                    assert('ai/index.js exports checkWebGPUSupport', typeof aiSubsystem.checkWebGPUSupport === 'function');
                    assert('ai/index.js exports isQuestBrowser', typeof aiSubsystem.isQuestBrowser === 'function');
                    assert('ai/index.js exports getOfflineCompanionAnswer', typeof aiSubsystem.getOfflineCompanionAnswer === 'function');
                    assert('ai.js forwarder exports generateAIResponse', typeof aiForwarder.generateAIResponse === 'function');
                    assert('ai.js forwarder exports checkGeminiResponsiveness', typeof aiForwarder.checkGeminiResponsiveness === 'function');
                    assert('ai.js forwarder exports checkWebGPUSupport', typeof aiForwarder.checkWebGPUSupport === 'function');

                    // Test 6b: Quest 3 & Offline Fallback Answers
                    const nameAns = aiSubsystem.getOfflineCompanionAnswer('what is your name');
                    assert('getOfflineCompanionAnswer handles name query', typeof nameAns === 'string' && nameAns.includes('companion'));
                    const helloAns = aiSubsystem.getOfflineCompanionAnswer('hello');
                    assert('getOfflineCompanionAnswer handles greeting', typeof helloAns === 'string' && helloAns.includes('Hello'));
                    
                    const gpuCheck = await aiSubsystem.checkWebGPUSupport();
                    assert('checkWebGPUSupport returns support status object without throwing', typeof gpuCheck === 'object' && gpuCheck !== null && 'supported' in gpuCheck);

                    const testReply = await aiSubsystem.callLocalWebLLM('what is your name');
                    assert('callLocalWebLLM returns non-empty reply without hanging', typeof testReply === 'string' && testReply.length > 5);

                    // Test 7: Refactored Scene Subsystem Modularization & Camera Framing
                    const sceneCamera = await import('./js/scene/camera.js');
                    const sceneXR = await import('./js/scene/xr.js');
                    const sceneSubsystem = await import('./js/scene/index.js');
                    const sceneForwarder = await import('./js/scene.js');

                    assert('scene/camera.js exports createCamera', typeof sceneCamera.createCamera === 'function');
                    assert('scene/camera.js exports applyResponsiveFraming', typeof sceneCamera.applyResponsiveFraming === 'function');
                    assert('scene/xr.js exports setupXRControllers', typeof sceneXR.setupXRControllers === 'function');
                    assert('scene/xr.js exports toggleWebXR', typeof sceneXR.toggleWebXR === 'function');
                    assert('scene/xr.js exports enterVR', typeof sceneXR.enterVR === 'function');
                    assert('scene/xr.js exports enterAR', typeof sceneXR.enterAR === 'function');
                    assert('scene/xr.js exports toggleFullscreen', typeof sceneXR.toggleFullscreen === 'function');
                    assert('scene/index.js exports initScene', typeof sceneSubsystem.initScene === 'function');
                    assert('scene/index.js exports enterVR', typeof sceneSubsystem.enterVR === 'function');
                    assert('scene.js forwarder exports initScene', typeof sceneForwarder.initScene === 'function');
                    assert('scene.js forwarder exports enterVR', typeof sceneForwarder.enterVR === 'function');

                    const btnVrEl = document.getElementById('btn-vr');
                    const btnArEl = document.getElementById('btn-ar');
                    const btnFullscreenEl = document.getElementById('btn-fullscreen');
                    assert('360 VR button exists in top bar', !!btnVrEl);
                    assert('AR Passthrough button exists in top bar', !!btnArEl);
                    assert('Fullscreen button exists in top bar', !!btnFullscreenEl);

                    // Test Camera Responsive Framing calculations
                    const dummyCam = sceneCamera.createCamera();
                    const dummyControls = { target: new THREE.Vector3(), update: () => {} };
                    const dummyRenderer = { setSize: () => {} };
                    // Test portrait aspect ratio (< 0.8)
                    window.innerWidth = 400;
                    window.innerHeight = 800;
                    sceneCamera.applyResponsiveFraming(dummyCam, dummyControls, dummyRenderer);
                    assert('Portrait camera framing sets z ~ 3.1m', Math.abs(dummyCam.position.z - 3.1) < 0.05);

                    // Test landscape aspect ratio (>= 1.2)
                    window.innerWidth = 1200;
                    window.innerHeight = 600;
                    sceneCamera.applyResponsiveFraming(dummyCam, dummyControls, dummyRenderer);
                    assert('Landscape camera framing sets z ~ 2.2m', Math.abs(dummyCam.position.z - 2.2) < 0.05);

                    // Test 8: Avatar Orientation & Flip 180° Controls
                    const btnTurn = document.getElementById('btn-turn-avatar');
                    const btnModalTurn = document.getElementById('btn-modal-turn-avatar');
                    const btnModalRecenter = document.getElementById('btn-modal-recenter-cam');
                    assert('Turn Avatar 180° button exists in top bar', !!btnTurn);
                    assert('Turn Avatar 180° button exists in Avatars Modal', !!btnModalTurn);
                    assert('Re-center Camera button exists in Avatars Modal', !!btnModalRecenter);

                    const { flipAvatarOrientation } = await import('./js/scene/index.js');
                    const initialRot = avatarGroup.rotation.y;
                    flipAvatarOrientation();
                    assert('flipAvatarOrientation adds PI (180 deg) rotation', Math.abs(Math.abs(avatarGroup.rotation.y - initialRot) - Math.PI) < 0.01);
                    flipAvatarOrientation();
                    assert('flipAvatarOrientation rotates back to original', Math.abs(avatarGroup.rotation.y - initialRot) < 0.01);

                    // Test 9: WAV Audio Encoder and Cloud Multimodal Audio Pipeline
                    const { encodeWAV, blobToBase64 } = await import('./js/audio/wav.js');
                    assert('audio/wav.js exports encodeWAV', typeof encodeWAV === 'function');
                    assert('audio/wav.js exports blobToBase64', typeof blobToBase64 === 'function');

                    const dummySamples = new Float32Array([0.0, 0.5, -0.5, 0.25, -0.25]);
                    const dummyBlob = encodeWAV(dummySamples, 16000);
                    assert('encodeWAV generates valid audio/wav blob', dummyBlob instanceof Blob && dummyBlob.type === 'audio/wav');
                    assert('WAV header size is 44 + 2*samples', dummyBlob.size === 44 + dummySamples.length * 2);

                    const base64Data = await blobToBase64(dummyBlob);
                    assert('blobToBase64 returns non-empty base64 string', typeof base64Data === 'string' && base64Data.length > 20);

                    const { transcribeAudioWithGemini } = await import('./js/ai/index.js');
                    assert('ai/index.js exports transcribeAudioWithGemini', typeof transcribeAudioWithGemini === 'function');

                    // Test 10: In-VR 3D HUD Console, Controller Laser Rays, and WebXR Actions
                    const vrHUDModule = await import('./js/scene/vr_hud.js');
                    assert('scene/vr_hud.js exports initVRHUD', typeof vrHUDModule.initVRHUD === 'function');
                    assert('scene/vr_hud.js exports setVRHUDVisibility', typeof vrHUDModule.setVRHUDVisibility === 'function');
                    assert('scene/vr_hud.js exports updateVRHUDState', typeof vrHUDModule.updateVRHUDState === 'function');
                    assert('scene/vr_hud.js exports testVRHUDIntersection', typeof vrHUDModule.testVRHUDIntersection === 'function');

                    const { setXRActionCallbacks, updateVRHUDState } = await import('./js/scene/index.js');
                    assert('scene/index.js exports setXRActionCallbacks', typeof setXRActionCallbacks === 'function');
                    assert('scene/index.js exports updateVRHUDState', typeof updateVRHUDState === 'function');

                    const { cycleAvatar } = await import('./js/avatars/index.js');
                    assert('avatars/index.js exports cycleAvatar', typeof cycleAvatar === 'function');
                    const nextAvatar = cycleAvatar(1, avatarGroup);
                    assert('cycleAvatar switches to a valid avatar ID', typeof nextAvatar === 'string' && nextAvatar.length > 0);

                    const { cycleSpace } = await import('./js/spaces/index.js');
                    assert('spaces/index.js exports cycleSpace', typeof cycleSpace === 'function');
                    const nextSpace = cycleSpace(1);
                    assert('cycleSpace switches to a valid space definition', nextSpace && typeof nextSpace.name === 'string');

                    } catch (err) {
                      assert('Top-level test evaluation failed: ' + err.message + ' stack: ' + err.stack, false);
                    }
                    return results;
                  })()
                `,
                awaitPromise: true,
                returnByValue: true
              }
            }));
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.method === 'Runtime.exceptionThrown') {
              uncaughtExceptions.push(msg.params.exceptionDetails);
            }

            if (msg.id === 100) {
              const testResults = msg.result.result.value || [];
              let passed = 0;
              let failed = 0;

              console.log('📋 Test Execution Results:\n');
              testResults.forEach(t => {
                if (t.pass) {
                  passed++;
                  console.log(`  ✅ [PASS] ${t.name}`);
                } else {
                  failed++;
                  console.error(`  ❌ [FAIL] ${t.name}: ${t.extra}`);
                }
              });

              if (uncaughtExceptions.length > 0) {
                failed++;
                console.error(`\n❌ [FAIL] Encountered ${uncaughtExceptions.length} uncaught exceptions:`);
                uncaughtExceptions.forEach(e => console.error(JSON.stringify(e)));
              } else {
                console.log(`  ✅ [PASS] 0 uncaught exceptions recorded during test run`);
              }

              console.log('\n====================================================');
              console.log(`📊 Summary: ${passed} Passed, ${failed} Failed`);
              console.log('====================================================\n');

              ws.close();
              chrome.kill();
              server.close();

              if (failed > 0) {
                process.exit(1);
              } else {
                process.exit(0);
              }
            }
          };

        } catch (err) {
          console.error('Test Suite Setup Error:', err);
          chrome.kill();
          server.close();
          process.exit(1);
        }
      });
    });
  });
}

runTestSuite();
