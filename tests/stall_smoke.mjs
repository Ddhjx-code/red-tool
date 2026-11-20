#!/usr/bin/env node
/* 小摊记 —— 无头冒烟 + 四屏截图（CDP 直连，不依赖 playwright / puppeteer）
 *
 * 用法：node tests/stall_smoke.mjs
 * 产出：/tmp/stall-1-intro.png … /tmp/stall-4-result.png
 * 末行打印 SMOKE PASS 或错误清单。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAGE = path.join(ROOT, 'tools/stall/index.html');
const URL_ = 'file://' + PAGE;
const PORT = 9423;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.STALL_SHOT_DIR || '/tmp';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stall-smoke-'));
const child = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  'about:blank'
], { stdio: 'ignore' });

const fails = [];
function ok(cond, name, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { fails.push(name + (extra ? ' → ' + JSON.stringify(extra) : '')); console.log('  ✗ ' + name + (extra ? ' → ' + JSON.stringify(extra) : '')); }
}

async function waitVersion() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let ws, msgId = 0;
const pending = new Map();
const pageErrors = [];

function send(method, params) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error('页面内异常：' + (r.result.exceptionDetails.text || '') + ' @ ' + expr.slice(0, 60));
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const p = path.join(OUT, 'stall-' + name + '.png');
  fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
  console.log('  · 截图 ' + p);
}

const scene = () => ev('(function(){var l=document.querySelectorAll(".scene");for(var i=0;i<l.length;i++){if(l[i].className.indexOf("on")>=0)return l[i].id;}return null;})()');

async function main() {
  if (!(await waitVersion())) throw new Error('Chrome 调试端口未就绪');

  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?` + encodeURIComponent(URL_), { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      pageErrors.push((d.exception && d.exception.description) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      pageErrors.push('console.error: ' + m.params.args.map((a) => a.value || a.description).join(' '));
    }
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Runtime.enable');
  await send('Page.enable');
  await wait(900);

  console.log('\n[1] 封面');
  ok((await scene()) === 's-intro', '停在封面', await scene());
  ok(await ev('document.querySelectorAll("#introArt svg").length') === 1, '封面插画已绘制');
  ok(await ev('document.querySelectorAll(".rule-row").length') === 3, '三条玩法说明在位');
  await shot('1-intro');

  console.log('\n[2] 进货');
  await ev('document.querySelector("[data-act=Start]").click()');
  await wait(260);
  ok((await scene()) === 's-buy', '进入进货', await scene());
  let rows = await ev('document.querySelectorAll("#buyList .row").length');
  ok(rows >= 4, '货品行 ≥4（初始 4 种）', rows);
  ok(await ev('document.querySelectorAll("#buyList .ic svg").length') >= 4, '每种货都有图标');
  ok(await ev('document.getElementById("dayBrief").textContent.length') > 6, '今日行情已生成', await ev('document.getElementById("dayBrief").textContent'));

  const cash0 = await ev('Number(document.getElementById("cashLeft").textContent)');
  ok(cash0 === 100, '初始本钱 100', cash0);

  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=fan]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=fan]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=sachet]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=candy]").click()');
  await wait(120);
  const cash1 = await ev('Number(document.getElementById("cashLeft").textContent)');
  ok(cash1 === 100 - 24 * 2 - 10 - 5, '扣款正确（48+10+5）', cash1);
  const qty = await ev('(function(){var a=document.querySelectorAll("#buyList .step-v");var s=0;for(var i=0;i<a.length;i++)s+=Number(a[i].textContent);return s;})()');
  ok(qty === 4, '购物车 4 件', qty);
  await shot('2-buy');

  console.log('\n[3] 定价');
  await ev('document.querySelector("[data-act=ToPrice]").click()');
  await wait(200);
  ok((await scene()) === 's-price', '进入定价', await scene());
  const prow = await ev('document.querySelectorAll("#priceList .row").length');
  ok(prow === 3, '只为已进的 3 种货开价', prow);
  const pcost = await ev('Number(document.getElementById("costLeft").textContent)');
  ok(pcost === 63, '本钱合计 63', pcost);
  await ev('document.querySelector("[data-act=\'Pr+\'][data-id=fan]").click()');
  await wait(120);
  await shot('3-price');

  console.log('\n[4] 开市与结算');
  await ev('document.querySelector("[data-act=Open]").click()');
  await wait(2600);
  ok((await scene()) === 's-market', '进入开市', await scene());
  const come = await ev('Number(document.getElementById("mkCome").textContent)');
  ok(come >= 2, '已有客来', come);
  ok(await ev('document.querySelectorAll("#feed .ev").length') >= 1, '事件流有记录');
  await shot('4-market');

  await ev('document.querySelector("[data-act=Skip]").click()');
  await wait(500);
  ok((await scene()) === 's-result', '进入结算', await scene());
  const profit = await ev('document.getElementById("rsProfit").textContent');
  ok(/^[+-]?\d+$/.test(profit), '净利是数字', profit);
  ok(await ev('document.querySelectorAll("#rsStars span, #rsStars s").length') === 5, '五颗星占位齐全');
  ok(await ev('document.getElementById("rsComment").textContent.length') > 6, '有评语');
  ok(await ev('Number(document.getElementById("hudRound").textContent)') === 2, '局数 +1');
  await shot('5-result');

  console.log('\n[5] 存档与再来一摊');
  ok(await ev('!!(window.localStorage.getItem("stall_save_v1"))'), '存档已写入');
  await ev('document.querySelector("[data-act=Again]").click()');
  await wait(300);
  ok((await scene()) === 's-buy', '再来一摊回到进货', await scene());
  ok(await ev('Number(document.getElementById("cashLeft").textContent)') === 100, '本钱重置为 100');

  console.log('\n[6] 页面异常');
  ok(pageErrors.length === 0, '零页面异常', pageErrors.slice(0, 3));

  console.log('');
  if (fails.length) { console.log('SMOKE FAIL / ' + fails.length); fails.forEach((f) => console.log('  - ' + f)); }
  else console.log('SMOKE PASS');
}

main()
  .catch((e) => { console.error('SMOKE FAIL', e && e.message); process.exitCode = 1; })
  .finally(() => { try { child.kill(); } catch (e) {} });
