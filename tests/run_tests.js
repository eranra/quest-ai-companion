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

                    // Test 1: DOM Elements exist
                    assert('Top Bar exists', document.querySelector('.top-bar'));
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

                    // Test 3: Avatar Switching without crash
                    const avatarIds = ['echo', 'spark', 'pip', 'ollie', 'maya', 'alex'];
                    const { buildAvatar } = await import('./js/avatars/index.js');
                    const { avatarGroup } = await import('./js/scene.js');

                    for (const id of avatarIds) {
                      try {
                        buildAvatar(id, avatarGroup);
                        assert('Avatar build success: ' + id, avatarGroup.children.length > 0);
                      } catch (err) {
                        assert('Avatar build success: ' + id, false, err.message);
                      }
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
