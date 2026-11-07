const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const TEST_PORT = 8132;
const CDP_PORT = 9346;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
    '.jpg': 'image/jpeg',
    '.png': 'image/png'
  };

  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

async function capture() {
  server.listen(TEST_PORT, async () => {
    const chrome = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--window-size=1280,720',
      '--disable-gpu',
      '--no-sandbox',
      `http://127.0.0.1:${TEST_PORT}/`
    ]);

    await new Promise(r => setTimeout(r, 2000));

    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        const targets = JSON.parse(raw);
        const page = targets.find(t => t.type === 'page');
        const ws = new WebSocket(page.webSocketDebuggerUrl);

        let callId = 10;
        const pendingResolvers = new Map();

        function sendCommand(method, params) {
          const id = ++callId;
          return new Promise(resolve => {
            pendingResolvers.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
          });
        }

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id && pendingResolvers.has(msg.id)) {
            const resolver = pendingResolvers.get(msg.id);
            pendingResolvers.delete(msg.id);
            resolver(msg.result);
          }
        };

        ws.onopen = async () => {
          await sendCommand('Runtime.enable');
          await sendCommand('Page.enable');

          await new Promise(r => setTimeout(r, 2000));

          const scenes = [
            { space: 'hall', avatar: 'maya' },
            { space: 'garden', avatar: 'alex' },
            { space: 'penthouse', avatar: 'echo' },
            { space: 'cafe', avatar: 'pip' },
            { space: 'hall', avatar: 'spark' },
            { space: 'hall', avatar: 'ollie' }
          ];

          for (const sc of scenes) {
            console.log(`Setting up scene: ${sc.space} with ${sc.avatar}...`);
            await sendCommand('Runtime.evaluate', {
              expression: `
                (async () => {
                  const { switchSpace } = await import('./js/spaces/index.js');
                  const { buildAvatar } = await import('./js/avatars/index.js');
                  const { avatarGroup } = await import('./js/scene.js');
                  
                  switchSpace('${sc.space}');
                  buildAvatar('${sc.avatar}', avatarGroup);
                  // Dismiss any speech bubble or error box so avatar is unobstructed
                  const bubble = document.getElementById('ai-response-box');
                  if (bubble) bubble.style.display = 'none';
                  await new Promise(r => setTimeout(r, 2000));
                })()
              `,
              awaitPromise: true
            });

            await new Promise(r => setTimeout(r, 2500));

            const screenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
            if (screenshot && screenshot.data) {
              const buffer = Buffer.from(screenshot.data, 'base64');
              const outPath = path.join(__dirname, `avatar_${sc.avatar}.png`);
              fs.writeFileSync(outPath, buffer);
              console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
            }
          }

          console.log('All avatar screenshots captured!');
          ws.close();
          chrome.kill();
          server.close();
          process.exit(0);
        };
      });
    });
  });
}

capture();
