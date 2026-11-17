/* 录制 mtea：node rec-mtea.mjs [take]  → /tmp/rec3/mtea */
import fs from 'node:fs';

const PORT = 9333;
const URL = 'file:///Users/wang/WorkBuddy/2026-11-10-12-43-25/tools/mtea/index.html?seed=1';
const OUT = '/tmp/rec3/mtea';
const DEMO = fs.readFileSync('/Users/wang/WorkBuddy/2026-11-10-12-43-25/tools/_video/demo-mtea.js', 'utf8');

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
  throw new Error('no page target');
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

const frames = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    const w = waiting.get(m.id); waiting.delete(m.id);
    m.error ? w.rej(new Error(m.error.message)) : w.res(m.result);
    return;
  }
  if (m.method === 'Page.screencastFrame') {
    const f = m.params;
    const name = 'f' + String(frames.length).padStart(5, '0') + '.png';
    fs.writeFileSync(OUT + '/' + name, Buffer.from(f.data, 'base64'));
    frames.push({ f: name, ts: f.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  }
};
await new Promise(r => { ws.onopen = r; });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: DEMO });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: URL });
await new Promise(r => setTimeout(r, 1800));

async function ev(js) {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result && r.result.value;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const stable = [];
let snapN = 0;
async function snap() {
  const t1 = Date.now();
  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const t2 = Date.now();
  const name = 's' + String(snapN++).padStart(4, '0') + '.png';
  fs.writeFileSync(OUT + '/' + name, Buffer.from(r.data, 'base64'));
  stable.push({ f: name, ts: (t1 + t2) / 2000 });
}

const h = {
  w: async ms => { await sleep(ms); await snap(); },
  ev: ev,
  cap: async t => { await ev('__capT(' + JSON.stringify(t) + ')'); await sleep(300); await snap(); },
  tap: async sel => { await ev('__tap(' + JSON.stringify(sel) + ')'); await snap(); },
  slider: async (sel, ratio, ms) => { await ev('__slider(' + JSON.stringify(sel) + ',' + ratio + ',' + (ms || 620) + ')'); await snap(); },
  mapDrag: async (x0, y0, x1, y1, ms) => {
    await ev('__mapDrag(' + [x0, y0, x1, y1, ms || 820].join(',') + ')');
    /* 指针落点可能差一两个像素，补一次精确落位，避免出现「差 0.1」 */
    await ev('__m.set3(' + x1 + ',' + y1 + ')');
    await snap();
  }
};

await send('Page.startScreencast', { format: 'png', maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
stable.length = 0;
const t0 = Date.now();

/* ---------- 脚本 ---------- */
await h.w(600);
await h.cap('早上开店，先算要备多少料');
await h.w(1100);
await h.cap('三个滑杆 = 三款各卖多少杯');
await h.w(800);

const C1 = ['#cups .col:nth-child(1) .sl', '#cups .col:nth-child(2) .sl', '#cups .col:nth-child(3) .sl'];
await h.slider(C1[0], 120 / 240, 520);
await h.slider(C1[1], 90 / 240, 520);
await h.cap('拖到单子上的数，就是 w');
await h.slider(C1[2], 150 / 240, 520);
await h.w(200);
await h.cap('配方表不动，把 w 乘进去');
await h.w(1300);
await h.cap('一行一个：每列乘杯数，再加起来');
await h.w(1600);
await h.cap('矩阵乘向量，就是这么一叠乘加');
await h.w(2100);
await h.cap('');
await h.w(500);

await h.cap('又来一单，只有 w 变');
await h.w(1200);
await h.cap('杯数一改，w 就跟着变');
await h.w(300);
await h.slider(C1[0], 70 / 240, 480);
await h.slider(C1[1], 160 / 240, 480);
await h.slider(C1[2], 110 / 240, 480);
await h.w(1100);
await h.cap('同样的 4 次乘加，再算一遍');
await h.w(2300);
await h.cap('表格要重写 4 条式子，矩阵只换 1 行');
await h.w(1700);
await h.cap('');

await h.tap('#mainBtn');
await h.w(600);
await h.cap('菜单四款，有一款是换杯子装的');
await h.w(1400);
await h.cap('挑两张对一对');
await h.w(300);
await h.tap('#cards .card:nth-child(1)');
await h.w(360);
await h.tap('#cards .card:nth-child(4)');
await h.w(700);
await h.cap('把小的按倍数放大，看能不能对上');
await h.w(1100);
await h.slider('#ratioSl', (150 - 55) / 130, 1200);
await h.cap('四项同时归零，就是同一款');
await h.w(1500);
await h.cap('多出来那一款没有新配方：秩不够');
await h.w(1500);
await h.cap('');

await h.tap('#mainBtn');
await h.w(700);
await h.cap('隔壁一周进了多少料');
await h.w(1500);
await h.cap('拖圆点，让两行进货单都对上');
await h.w(400);
await h.mapDrag(0, 0, 150, 155, 640);
await h.w(300);
await h.mapDrag(150, 155, 200, 100, 640);
await h.w(900);
await h.cap('两条线交于一点，配方只有一个答案');
await h.w(2000);
await h.cap('');

await h.tap('#mainBtn');
await h.w(800);
await h.cap('他也上了超大杯，再对一次');
await h.w(1300);
await h.mapDrag(0, 0, 30, 180, 760);
await h.w(600);
await h.mapDrag(30, 180, 90, 140, 760);
await h.mapDrag(90, 140, 150, 100, 760);
await h.mapDrag(150, 100, 210, 60, 760);
await h.w(700);
await h.cap('两行约束其实只有一行，怎么拖都对得上');
await h.w(2000);
await h.cap('解不是没有，是有无穷多个');
await h.w(1700);
await h.cap('');

await h.tap('#mainBtn');
await h.w(1000);
await h.w(3200);

await send('Page.stopScreencast');
const sec = (Date.now() - t0) / 1000;

const all = frames.concat(stable).sort((a, b) => a.ts - b.ts);
fs.writeFileSync(OUT + '/frames.json', JSON.stringify(all));
console.log('frames', all.length, 'sec', sec.toFixed(2), 'fps', (all.length / sec).toFixed(1));
ws.close();
process.exit(0);
