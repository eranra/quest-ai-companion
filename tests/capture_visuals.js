const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const TEST_PORT = 8125;
const CDP_PORT = 9339;
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
      res.on('end', async () => {
        const targets = JSON.parse(raw);
        const page = targets.find(t => t.type === 'page');
        const ws = new WebSocket(page.webSocketDebuggerUrl);

        ws.onopen = async () => {
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
          ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

          await new Promise(r => setTimeout(r, 2000));

          const spaces = ['hall', 'garden', 'penthouse', 'cafe'];
          for (let i = 0; i < spaces.length; i++) {
            const sId = spaces[i];
            ws.send(JSON.stringify({
              id: 10 + i,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  (async () => {
                    const { switchSpace } = await import('./js/spaces/index.js');
                    switchSpace('${sId}');
                  })()
                `,
                awaitPromise: true
              }
            }));

            await new Promise(r => setTimeout(r, 600));

            ws.send(JSON.stringify({
              id: 100 + i,
              method: 'Page.captureScreenshot',
              params: { format: 'png' }
            }));
          }
        };

        let shotIndex = 0;
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id >= 100 && msg.result && msg.result.data) {
            const buffer = Buffer.from(msg.result.data, 'base64');
            const spaces = ['hall', 'garden', 'penthouse', 'cafe'];
            const sName = spaces[shotIndex++];
            const outPath = path.join(__dirname, `screenshot_${sName}.png`);
            fs.writeFileSync(outPath, buffer);
            console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);

            if (shotIndex === spaces.length) {
              console.log('All screenshots captured!');
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
