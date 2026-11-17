import fs from 'node:fs';

const PORT = 9333;
const TOOLS = 'file:///Users/wang/WorkBuddy/2026-11-10-12-43-25/tools/';
const scene = process.argv[2] || 'color';
const OUT = '/tmp/rec2/' + scene;

const DEMO = fs.readFileSync('/tmp/rec2/demo.js', 'utf8');

/* ---------- 场景 ---------- */
const SCENES = {};

SCENES.color = {
  url: TOOLS + 'color/index.html?seed=1',
  prep: async h => {
    /* 清掉今天的记录：让演示从「第一次记」开始，按钮才是「记下来」 */
    await h.ev("(function(){var k=key(today());delete state.data[k];save();renderToday();return 1})()");
    await h.w(300);
  },
  run: async h => {
    await h.w(800);
    await h.cap('每天点一格');
    await h.w(1000);
    await h.tap('.sw[data-i="1"]');
    await h.w(420);
    await h.cap('顺手写一句，也可以不写');
    await h.w(560);
    await h.type('#note', '今天出了太阳');
    await h.w(380);
    await h.cap('点一下就记上了');
    await h.w(460);
    await h.tap('#saveBtn');
    await h.cap('这一周就连成一条');
    await h.w(1100);
    await h.tap('#t1');
    await h.cap('哪天是什么颜色，一眼看到');
    await h.w(1600);
    await h.tap('#t2');
    await h.cap('月底自动合成一张卡', 96);
    await h.w(1500);
    await h.cap('长按就存下来了', 96);
    await h.w(1500);
    await h.cap('');
    await h.w(400);
  }
};

SCENES.empties = {
  url: TOOLS + 'empties/index.html?seed=1',
  run: async h => {
    await h.w(800);
    await h.cap('快到期的排在前面');
    await h.w(1300);
    await h.cap('点开一瓶');
    await h.w(650);
    await h.cap('');
    await h.tap('#list .it');
    await h.w(1000);
    await h.tap('#shDone');
    await h.w(900);
    await h.tap('#t1');
    await h.cap('攒成一面空瓶墙');
    await h.w(1500);
    await h.cap('用了多久、哪瓶最久');
    await h.w(1500);
    await h.tap('#t2');
    await h.cap('开封后 12 个月，从开封那天算', 90);
    await h.w(1700);
    await h.cap('');
    await h.w(400);
  }
};

SCENES.body = {
  url: TOOLS + 'body/index.html?seed=1',
  run: async h => {
    await h.w(800);
    await h.cap('记一个数就行');
    await h.w(1000);
    await h.tap('#fw');
    await h.w(180);
    await h.type('#fw', '60.2', 110);
    await h.w(280);
    await h.tap('#saveBtn');
    await h.cap('曲线自己会长出来');
    await h.w(1000);
    await h.tap('#t1');
    await h.cap('腰围单独一根线');
    await h.w(1700);
    await h.tap('#range .rg[data-r="30"]');
    await h.w(900);
    await h.tap('#t2');
    await h.cap('一天的体重说明不了什么');
    await h.w(1600);
    await h.cap('看一周的平均');
    await h.w(1400);
    await h.cap('');
    await h.w(400);
  }
};

const S = SCENES[scene];
if (!S) { console.error('unknown scene', scene); process.exit(1); }

/* ---------- CDP ---------- */
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
await send('Page.navigate', { url: S.url });
await new Promise(r => setTimeout(r, 1600));

async function ev(js) {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result && r.result.value;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 静止段补一张完整帧：screencast 只在画面变化时推帧，
   过渡结束后若不再变化，最后一张会是半透明的中间态。 */
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
  cap: async (t, lift) => {
    await ev('__capT(' + JSON.stringify(t) + ',' + (lift || 0) + ')');
    await sleep(340);
    await snap();
  },
  tap: sel => ev('__tap(' + JSON.stringify(sel) + ')'),
  type: (sel, txt, per) => ev('__type(' + JSON.stringify(sel) + ',' + JSON.stringify(txt) + ',' + (per || 88) + ')')
};

if (S.prep) await S.prep(h);

await send('Page.startScreencast', { format: 'png', maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
stable.length = 0;
const t0 = Date.now();

await S.run(h);

await send('Page.stopScreencast');
const sec = (Date.now() - t0) / 1000;

const all = frames.concat(stable).sort((a, b) => a.ts - b.ts);
fs.writeFileSync(OUT + '/frames.json', JSON.stringify(all));
const gaps = [];
for (let i = 1; i < all.length; i++) gaps.push((all[i].ts - all[i - 1].ts) * 1000);
const s = gaps.slice().sort((a, b) => a - b);
console.log(scene, 'frames', all.length, '(screencast', frames.length, '+ stable', stable.length + ')',
  'sec', sec.toFixed(2), 'fps', (all.length / sec).toFixed(1));
if (s.length) console.log('gap min', s[0].toFixed(0), 'med', s[Math.floor(s.length / 2)].toFixed(0), 'max', s[s.length - 1].toFixed(0));
ws.close();
process.exit(0);
