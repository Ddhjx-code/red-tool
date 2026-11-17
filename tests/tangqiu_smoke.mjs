#!/usr/bin/env node
/* 糖球转转 —— 无头冒烟/回归测试（CDP 直连，不依赖 playwright / puppeteer）
 *
 * 用法：node tests/tangqiu_smoke.mjs
 * 自行拉起一个 headless Chrome（独立 user-data-dir 与端口），加载
 * tools/tangqiu/index.html?test=1，逐项断言：
 *   启动 / 摇杆位移 / 敌人生成 / 环绕武器命中 / 掉落与拾取 /
 *   升级三选一 / 结算与称号 / 分享卡出图 / 零页面异常
 * 末行打印 SMOKE PASS 或错误清单。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAGE = path.join(ROOT, 'tools/tangqiu/index.html');
const URL_ = 'file://' + PAGE + '?test=1';
const PORT = 9411;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chromes = fs.readdirSync('/Applications').filter((n) => /chrome|chromium/i.test(n));
if (!chromes.length) { console.error('找不到 Chrome，跳过'); process.exit(2); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tq-smoke-'));
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

function tick(sec) {
  return ev(`(function(){var n=Math.round(${sec}*60);for(var i=0;i<n;i++)TQ.tick(1/60);return TQ.snapshot();})()`);
}

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
  await send('Runtime.enable');
  await send('Page.enable');
  await new Promise((r) => setTimeout(r, 500));

  console.log('\n[1] 启动');
  ok(await ev('typeof window.TQ === "object"'), '测试钩子就位');
  await ev('document.getElementById("startBtn").click()');
  let s = await ev('TQ.snapshot()');
  ok(s && s.state === 'play', '开始后进入 play', s);
  ok(s.hp === 5 && s.level === 1, '初始 5 心 / Lv.1', s);
  ok(s.weapons === 1, '开局自带一把武器', s);

  console.log('\n[2] 摇杆位移');
  await ev('TQ.clearField(); TQ.joy(1,0)');
  const moved = await tick(0.5);
  ok(moved.px > s.px + 20, '向右推 → x 增大', { from: s.px, to: moved.px });
  await ev('TQ.joy(0,-1)');
  const moved2 = await tick(0.5);
  ok(moved2.py < moved.py - 20, '向上推 → y 减小', { from: moved.py, to: moved2.py });
  await ev('TQ.joy(0,0)');
  const idle1 = await ev('TQ.snapshot()');
  await tick(0.4);
  const idle2 = await ev('TQ.snapshot()');
  ok(Math.abs(idle2.px - idle1.px) < 0.5 && Math.abs(idle2.py - idle1.py) < 0.5, '松手后不再漂移', { idle1, idle2 });

  console.log('\n[3] 敌人与环绕武器');
  await ev('TQ.clearField()');
  await ev('TQ.spawn("pudding", TQ.snapshot().px + 52, TQ.snapshot().py)');
  const before = await ev('TQ.enemyList().length');
  ok(before === 1, '手动生成 1 只怪', before);
  const killed = await tick(0.9);
  ok(killed.kills >= 1, '环绕糖针自动打死贴身的怪', killed);

  console.log('\n[4] 掉落与拾取链路');
  /* 贴身击杀 → 掉糖 → 磁吸 → 经验，一条链路验证；掉落若在拾取半径内会被立刻吸走 */
  ok(killed.xp >= 1, '掉落被吸上来换成经验', killed);
  ok(killed.drops === 0, '拾取后场上不留糖', killed);
  await ev('TQ.clearField(); TQ.spawn("jelly", 20, 20)');
  const far = await tick(0.2);
  ok(far.enemies >= 1, '远处生成的怪留在场上（未被误删）', far);

  console.log('\n[5] 升级三选一');
  const lv0 = (await ev('TQ.snapshot()')).level;
  await ev('TQ.giveXp(99)');
  s = await ev('TQ.snapshot()');
  ok(s.state === 'up', '经验够了自动弹面板', s);
  const choices = await ev('(TQ.choices()||[]).length');
  ok(choices === 3, '面板给三个选项', choices);
  const cardHtml = await ev('document.getElementById("upCards").innerHTML.length');
  ok(cardHtml > 100, '卡片渲染到 DOM', cardHtml);
  /* 一次给太多经验会连开多个面板，直到队列清空才回到战斗 */
  for (let i = 0; i < 12; i++) {
    const st = await ev('TQ.snapshot()');
    if (st.state !== 'up') break;
    await ev('TQ.pickUpgrade(0)');
  }
  s = await ev('TQ.snapshot()');
  ok(s.state === 'play', '选完回到战斗', s);
  ok(s.level > lv0, '等级提升', { before: lv0, after: s.level });
  const wl = await ev('TQ.weaponList()');
  ok(wl.length >= 1 && wl.length <= 4, '武器位不超过 4', wl);

  console.log('\n[6] BOSS 与收尾');
  await ev('TQ.setTime(159.5)');
  await tick(1.2);
  s = await ev('TQ.snapshot()');
  ok(s.boss === true, '160 秒刷出大蛋糕', s);
  await ev('TQ.setTime(179.9)');
  await tick(0.4);
  s = await ev('TQ.snapshot()');
  ok(s.state === 'over', '撑满 180 秒进入结算', s);
  await ev('TQ.end(true)');
  const title = await ev('document.getElementById("overTitle").textContent');
  ok(title === '糖球大师', '称号正确', title);
  const stats = await ev('document.getElementById("overStats").textContent');
  ok(/180\.0|179\.\d|180/.test(stats), '结算显示坚持时长', stats);

  console.log('\n[7] 分享卡');
  const card = await ev('TQ.card()');
  ok(typeof card === 'string' && card.indexOf('data:image/png') === 0, '出图为 png dataURL');
  ok(card.length > 20000, '图片有内容', card.length);

  console.log('\n[8] 异常检查');
  ok(pageErrors.length === 0, '零页面异常 / 零 console.error', pageErrors.slice(0, 3));

  console.log('\n' + (fails.length ? 'SMOKE FAIL (' + fails.length + ')\n - ' + fails.join('\n - ') : 'SMOKE PASS'));
  process.exitCode = fails.length ? 1 : 0;
}

main()
  .catch((e) => { console.error('SMOKE FAIL: ' + e.message); process.exitCode = 1; })
  .finally(() => {
    try { ws && ws.close(); } catch (e) {}
    try { child.kill('SIGKILL'); } catch (e) {}
  });
