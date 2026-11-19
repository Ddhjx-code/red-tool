#!/usr/bin/env node
/* 糖球转转（七关闯关版）—— 无头冒烟/回归测试（CDP 直连，不依赖 playwright / puppeteer）
 *
 * 用法：node tests/tangqiu_smoke.mjs
 * 自行拉起一个 headless Chrome（独立 user-data-dir 与端口），加载
 * tools/tangqiu/index.html?test=1，逐项断言：
 *   标题页 / 摇杆位移 / 敌人与武器 / 掉落拾取 / 升级三选一 /
 *   十一杂兵 + 七 BOSS 全部可生成 / 十种武器全部可装 /
 *   七关推进与跨关继承 / 角色与关卡解锁存档 / 分享卡出图 / 零页面异常
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

/* 某些无终端环境下 stdout 会被吞掉，需要留一份落盘日志：TQ_SMOKE_LOG=/tmp/x.log */
const LOGF = process.env.TQ_SMOKE_LOG;
if (LOGF) {
  const raw = console.log.bind(console);
  console.log = function () {
    const s = Array.prototype.map.call(arguments, (a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    try { fs.appendFileSync(LOGF, s + '\n'); } catch (e) {}
    raw.apply(null, arguments);
  };
}

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

/* 逐帧推进，遇到升级面板自动选第一张，等价于「机器人一路打下去」 */
function tick(sec, autoPick) {
  const n = Math.round(sec * 60);
  const pick = autoPick === false ? '' : 'if(TQ.snapshot().state==="up")TQ.pickUpgrade(0);';
  return ev(`(function(){for(var i=0;i<${n};i++){TQ.tick(1/60);${pick}}return TQ.snapshot();})()`);
}
const snap = () => ev('TQ.snapshot()');
const overText = () => ev('(function(){var e=document.getElementById("over");return{on:e.className,kick:document.getElementById("overKick").textContent,title:document.getElementById("overTitle").textContent,btn:document.getElementById("againBtn").textContent,hint:document.getElementById("overHint").textContent};})()');

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
  await new Promise((r) => setTimeout(r, 900));

  console.log('\n[1] 标题页与素材');
  ok(await ev('typeof window.TQ === "object"'), '测试钩子就位');
  await ev('TQ.resetSave()');
  ok(await ev('document.querySelectorAll("#skinRow .skin").length') === 4, '四个角色卡都在', await ev('document.querySelectorAll("#skinRow .skin").length'));
  ok(await ev('document.querySelectorAll("#stageRow .stage-dot").length') === 7, '七个关卡点都在', await ev('document.querySelectorAll("#stageRow .stage-dot").length'));
  const artOk = await ev('(function(){var a=document.querySelectorAll("#skinRow img.skin-doll");for(var i=0;i<a.length;i++){if(!a[i].complete||a[i].naturalWidth<10)return false;}return a.length===4;})()');
  ok(artOk, '角色立绘图片真实加载（不是几何占位）');

  console.log('\n[2] 开始闯关');
  await ev('document.getElementById("startBtn").click()');
  let s = await snap();
  ok(s && s.state === 'intro', '点开始先进关卡标题卡', s);
  ok(await ev('document.getElementById("levelCard").className.indexOf("on")>=0'), '标题卡可见');
  await tick(1.8, false);
  s = await snap();
  ok(s.state === 'play', '标题卡放完自动开打', s);
  ok(await ev('document.getElementById("levelCard").className') === 'screen', '标题卡已收起');
  ok(s.hp === 5 && s.level === 1, '初始 5 心 / Lv.1', s);
  ok(s.weapons === 1, '开局自带一把武器', s);

  console.log('\n[3] 摇杆位移');
  await ev('TQ.clearField(); TQ.joy(1,0)');
  const moved = await tick(0.5, false);
  ok(moved.px > s.px + 20, '向右推 → x 增大', { from: s.px, to: moved.px });
  await ev('TQ.joy(0,-1)');
  const moved2 = await tick(0.5, false);
  ok(moved2.py < moved.py - 20, '向上推 → y 减小', { from: moved.py, to: moved2.py });
  await ev('TQ.joy(0,0)');
  const idle1 = await snap();
  await tick(0.4, false);
  const idle2 = await snap();
  ok(Math.abs(idle2.px - idle1.px) < 0.5 && Math.abs(idle2.py - idle1.py) < 0.5, '松手后不再漂移', { idle1, idle2 });

  console.log('\n[4] 敌人与环绕武器');
  await ev('TQ.clearField()');
  await ev('TQ.spawn("pudding", TQ.snapshot().px + 52, TQ.snapshot().py)');
  ok(await ev('TQ.enemyList().length') === 1, '手动生成 1 只怪');
  const killed = await tick(0.9, false);
  ok(killed.kills >= 1, '环绕糖针自动打死贴身的怪', killed);

  console.log('\n[5] 掉落与拾取链路');
  ok(killed.xp >= 1, '掉落被吸上来换成经验', killed);
  ok(killed.drops === 0, '拾取后场上不留糖', killed);
  await ev('TQ.clearField(); TQ.spawn("jelly", 20, 20)');
  const far = await tick(0.2, false);
  ok(far.enemies >= 1, '远处生成的怪留在场上（未被误删）', far);

  console.log('\n[6] 升级三选一');
  const lv0 = (await snap()).level;
  await ev('TQ.giveXp(99)');
  s = await snap();
  ok(s.state === 'up', '经验够了自动弹面板', s);
  ok(await ev('(TQ.choices()||[]).length') === 3, '面板给三个选项');
  ok(await ev('document.querySelectorAll("#upCards .card").length') === 3, '三张卡片渲染到 DOM');
  ok(await ev('document.getElementById("upCards").innerHTML.length') > 100, '卡片有实际文案');
  for (let i = 0; i < 12; i++) {
    if ((await snap()).state !== 'up') break;
    await ev('TQ.pickUpgrade(0)');
  }
  s = await snap();
  ok(s.state === 'play', '选完回到战斗', s);
  ok(s.level > lv0, '等级提升', { before: lv0, after: s.level });
  ok((await ev('TQ.weaponList()')).length <= 4, '武器位不超过 4');

  console.log('\n[7] 十一种杂兵全部可生成');
  const MOBS = ['pudding', 'jelly', 'bat', 'cake', 'gum', 'cloud', 'choco', 'cookie', 'cap', 'berry', 'star'];
  await ev('TQ.clearField()');
  for (let i = 0; i < MOBS.length; i++) await ev(`TQ.spawn("${MOBS[i]}", ${40 + i * 28}, 160)`);
  ok(await ev('TQ.enemyList().length') === MOBS.length, '十一只都进了场', await ev('TQ.enemyList().length'));
  const alive = await tick(1.2, false);
  ok(alive.enemies >= MOBS.length - 1, '跑 1.2 秒后基本都还在（行为分支没崩）', alive);
  const kinds = await ev('(function(){var o={},l=TQ.enemyList();for(var i=0;i<l.length;i++)o[l[i].kind]=1;return Object.keys(o).sort().join(",");})()');
  ok(kinds.split(',').length >= MOBS.length - 1, '种类没有互相吞掉', kinds);

  console.log('\n[8] 七种 BOSS 全部可生成');
  const BOSSES = ['b1', 'b2', 'b3', 'b4', 'cloudK', 'capK', 'starK'];
  await ev('TQ.clearField()');
  for (const k of BOSSES) {
    await ev(`TQ.spawn("${k}", 60, 260)`);
    await tick(0.3, false);
  }
  const bossKinds = await ev('(function(){var o=[],l=TQ.enemyList();for(var i=0;i<l.length;i++)if(l[i].boss)o.push(l[i].kind);return o.join(",");})()');
  ok(bossKinds.split(',').length === BOSSES.length, '七只 BOSS 都在场', bossKinds);

  console.log('\n[9] 十种武器全部可装');
  const WEAP = ['star', 'paw', 'bow', 'bub', 'rain', 'lolli', 'jumpto', 'mint', 'honey', 'spark'];
  await ev('TQ.goLevel(3); TQ.skipIntro(); TQ.god(true); TQ.clearField();');
  for (const w of WEAP) await ev(`TQ.addWeapon("${w}")`);
  const wl = await ev('TQ.weaponList()');
  const wlIds = await ev('(function(){var o=[],l=TQ.weaponList();for(var i=0;i<l.length;i++)o.push(l[i].id);return o.join(",");})()');
  const allIn = WEAP.every((w) => wlIds.split(',').indexOf(w) >= 0);
  ok(allIn, '十把武器都进背包（主角自带的算第 11 把）', wlIds);
  for (let i = 0; i < 6; i++) await ev(`TQ.spawn("pudding", ${60 + i * 22}, 300)`);
  const fired = await tick(2.5, false);
  ok(fired.kills >= 1, '十把武器同场能打死怪（各类 kind 分支都跑通）', fired);

  console.log('\n[10] 七关推进与跨关继承');
  await ev('TQ.resetSave()');
  let cleared = 0, bossOk = true;
  for (let i = 0; i < 7; i++) {
    await ev(`TQ.goLevel(${i})`);
    await ev('TQ.skipIntro()');
    s = await snap();
    ok(s.levelIdx === i, `第 ${i + 1} 关进入正确`, s.levelIdx);
    await ev('TQ.god(true)');
    const dur = await ev('TQ.level().dur');
    const bossAt = dur - 20;
    await tick(bossAt + 0.4, true);
    s = await snap();
    if (s.boss !== true) bossOk = false;
    await ev('TQ.winNow()');
    await tick(0.6, false);
    const o = await overText();
    const isLast = i === 6;
    const wantKick = isLast ? '七关全通' : '第 ' + (i + 1) + ' 关通过';
    ok(o.on.indexOf('on') >= 0 && o.kick === wantKick, `第 ${i + 1} 关结算文案正确`, o);
    cleared++;
  }
  ok(cleared === 7, '七关都能走完结算', cleared);
  ok(bossOk, '每关 BOSS 都在剩余 20 秒时登场');
  const lastOver = await overText();
  ok(lastOver.btn === '回首页', '最后一关按钮是回首页', lastOver.btn);
  ok(/七关都过了/.test(lastOver.hint), '最后一关有通关提示', lastOver.hint);

  console.log('\n[11] 解锁与存档');
  const save = await ev('TQ.save()');
  ok(save.unlocked === 7, '七关全解锁', save.unlocked);
  ok(save.skins.length === 4, '四个角色全解锁', save.skins);
  ok(save.best.level >= 1, '最远记录已写入', save.best);
  const raw = await ev('(function(){try{return localStorage.getItem("tq2")?1:0;}catch(e){return -1;}})()');
  ok(raw === 1, '存档写进 localStorage', raw);

  console.log('\n[10b] 跨关继承（点「下一关」按钮走真实链路）');
  await ev('TQ.resetSave(); TQ.goLevel(0); TQ.skipIntro(); TQ.god(true);');
  await ev('TQ.addWeapon("bow"); TQ.addWeapon("bub"); TQ.giveXp(60);');
  for (let i = 0; i < 12; i++) { if ((await snap()).state !== 'up') break; await ev('TQ.pickUpgrade(0)'); }
  await tick(3, true);
  const beforeCarry = await snap();
  await ev('TQ.winNow()');
  await tick(0.6, false);
  await ev('document.getElementById("againBtn").click()');
  await ev('TQ.skipIntro()');
  const afterCarry = await snap();
  ok(afterCarry.levelIdx === 1, '按钮进入第 2 关', afterCarry.levelIdx);
  ok(afterCarry.level >= beforeCarry.level, '等级继承', { before: beforeCarry.level, after: afterCarry.level });
  ok(afterCarry.weapons >= beforeCarry.weapons, '武器继承', { before: beforeCarry.weapons, after: afterCarry.weapons });

  console.log('\n[12] 角色切换');
  for (const h of ['mint', 'cocoa', 'starry']) {
    await ev(`TQ.setSkin("${h}")`);
    await ev('TQ.goLevel(0); TQ.skipIntro(); TQ.god(true);');
    s = await snap();
    ok(s.skin === h, `切到 ${h} 后主角用该角色`, s.skin);
    ok(s.hp === (h === 'cocoa' ? 6 : 4), `${h} 初始血量与表一致`, s.hp);
  }
  await ev('TQ.setSkin("hero")');

  console.log('\n[13] 阵亡流程');
  await ev('TQ.resetSave(); TQ.goLevel(2); TQ.skipIntro(); TQ.setHp(1);');
  await ev('(function(){var s=TQ.snapshot();TQ.spawn("cake", s.px, s.py);})()');
  await tick(0.5, false);
  const dead = await overText();
  ok(dead.on.indexOf('on') >= 0 && /倒在/.test(dead.kick), '血量归零进阵亡结算', dead);
  ok(/第 3 关/.test(dead.kick), '阵亡文案标出关卡', dead.kick);

  console.log('\n[14] 分享卡');
  await ev('TQ.goLevel(0); TQ.skipIntro(); TQ.god(true); TQ.winNow();');
  await tick(0.5, false);
  const card = await ev('TQ.card()');
  ok(typeof card === 'string' && card.indexOf('data:image/png') === 0, '出图为 png dataURL');
  ok(card.length > 20000, '图片有内容', card.length);

  console.log('\n[15] 真实触摸摇杆（DOM 事件链路）');
  /* 曾经踩过：缺 touch-action:none → 手指一拖浏览器就发 pointercancel，
     摇杆被 end() 复位，角色纹丝不动；而 TQ.joy() 直设方向完全测不出来。
     这里另起一局，用 CDP 派发真触摸事件，覆盖 DOM → 游戏状态整段链路。 */
  await ev('TQ.goLevel(0); TQ.skipIntro();');
  await tick(0.2, false);
  const tBefore = await snap();
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 150, y: 600, radiusX: 6, radiusY: 6, force: 1, id: 1 }]
  });
  await send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 250, y: 600, radiusX: 6, radiusY: 6, force: 1, id: 1 }]
  });
  const joyOn = await ev('document.getElementById("joy").className');
  const tMoved = await tick(0.5, false);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const joyOff = await ev('document.getElementById("joy").className');
  ok(joyOn === 'on', '按住摇杆亮起（没被 pointercancel 掐掉）', joyOn);
  ok(tMoved.px > tBefore.px + 20, '真实触摸拖动 → 角色右移', { from: tBefore.px, to: tMoved.px });
  ok(joyOff === '', '抬手后摇杆复位', joyOff);

  console.log('\n[16] 异常检查');
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
