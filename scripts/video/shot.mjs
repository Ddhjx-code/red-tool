/* 通用截图：node shot.mjs <url> <out> [w] [h] [jsBefore] */
import fs from 'node:fs';
const PORT = 9333;
const [url, out, W, H, js] = process.argv.slice(2);
const w = +(W || 390), h = +(H || 844);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      const p = list.find(x => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('no target');
}

const ws = new WebSocket(await target());
let id = 0;
const waiting = new Map();
function send(method, params) {
  const mid = ++id;
  return new Promise((res, rej) => {
    waiting.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
}
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    const wa = waiting.get(m.id); waiting.delete(m.id);
    m.error ? wa.rej(new Error(m.error.message)) : wa.res(m.result);
  }
};
await new Promise(r => { ws.onopen = r; });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url });
await new Promise(r => setTimeout(r, 1500));
async function ev(x) {
  const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) console.error('EVAL ERR', r.exceptionDetails.text, r.exceptionDetails.exception && r.exceptionDetails.exception.description);
  return r.result && r.result.value;
}
if (js) {
  const v = await ev(js);
  if (v !== undefined && v !== null) console.log('eval:', JSON.stringify(v));
  await new Promise(r => setTimeout(r, 700));
}
const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
console.log('ok', out);
ws.close();
process.exit(0);
