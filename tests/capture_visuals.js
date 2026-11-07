const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const TEST_PORT = 8131;
const CDP_PORT = 9345;
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

        ws.onopen = async () => {
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
          ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

          await new Promise(r => setTimeout(r, 2000));

          const scenes = [
            { space: 'hall', avatar: 'maya' },
            { space: 'garden', avatar: 'alex' },
            { space: 'penthouse', avatar: 'echo' },
            { space: 'cafe', avatar: 'pip' }
          ];

          for (let i = 0; i < scenes.length; i++) {
            const sc = scenes[i];
            ws.send(JSON.stringify({
              id: 10 + i,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  (async () => {
                    const { switchSpace } = await import('./js/spaces/index.js');
                    const { buildAvatar } = await import('./js/avatars/index.js');
                    const { avatarGroup } = await import('./js/scene.js');
                    
                    switchSpace('${sc.space}');
                    buildAvatar('${sc.avatar}', avatarGroup);
                    await new Promise(r => setTimeout(r, 1200));
                  })()
                `,
                awaitPromise: true
              }
            }));

            await new Promise(r => setTimeout(r, 1500));

            ws.send(JSON.stringify({
              id: 100 + i,
              method: 'Page.captureScreenshot',
              params: { format: 'png' }
            }));
          }
        };

        let shotIndex = 0;
        const scenes = [
          { space: 'hall', avatar: 'maya' },
          { space: 'garden', avatar: 'alex' },
          { space: 'penthouse', avatar: 'echo' },
          { space: 'cafe', avatar: 'pip' }
        ];

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id >= 100 && msg.result && msg.result.data) {
            const buffer = Buffer.from(msg.result.data, 'base64');
            const sc = scenes[shotIndex++];
            const outPath = path.join(__dirname, `v023_${sc.space}_${sc.avatar}.png`);
            fs.writeFileSync(outPath, buffer);
            console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);

            if (shotIndex === scenes.length) {
              console.log('All 4 visual screenshots captured successfully!');
              ws.close();
              chrome.kill();
              server.close();
              process.exit(0);
            }
          }
        };
      });
    });
  });
}

capture();
