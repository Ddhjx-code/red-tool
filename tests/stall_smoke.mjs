#!/usr/bin/env node
/* 小摊记 v2 —— 无头冒烟 + 五屏截图（CDP 直连，不依赖 playwright / puppeteer）
 *
 * 用法：node tests/stall_smoke.mjs
 * 产出：/tmp/stall-1-intro.png … /tmp/stall-5-result.png
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
const infos = [];
function ok(cond, name, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { fails.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
function info(name) { infos.push(name); console.log('  · ' + name); }

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
    throw new Error('页面内异常：' + (r.result.exceptionDetails.text || '') + ' @ ' + expr.slice(0, 70));
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
  await wait(1200);

  console.log('\n[1] 美术层与封面');
  ok((await scene()) === 's-intro', '停在封面', await scene());
  ok(await ev('!!(window.StallArt && window.StallArt.init)'), '美术引擎已加载');
  const painted = await ev(`(function(){
    var c=document.getElementById('cv');
    if(!c||!c.width) return -1;
    var g=c.getContext('2d');
    var d=g.getImageData(0,0,Math.min(60,c.width),Math.min(60,c.height)).data;
    var n=0; for(var i=3;i<d.length;i+=4){ if(d[i]>0) n++; }
    return n;
  })()`);
  ok(painted > 0, 'Canvas 已绘制（非空白）', painted);
  ok(await ev('document.querySelectorAll(".rule-row").length') === 3, '三条玩法说明在位');
  ok(await ev('getComputedStyle(document.getElementById("cv")).zIndex') === '0', '画布在底层');
  await shot('1-intro');

  console.log('\n[2] 进货');
  await ev('document.querySelector("[data-act=Start]").click()');
  await wait(500);
  ok((await scene()) === 's-buy', '进入进货', await scene());
  const rows = await ev('document.querySelectorAll("#buyList .row").length');
  ok(rows >= 4, '货品行 ≥4（初始 4 种）', rows);
  ok(await ev('document.querySelectorAll("#buyList .ic svg").length') >= 4, '每种货都有剪纸图标');
  ok(await ev('document.getElementById("dayBrief").textContent.length') > 6, '今日行情已生成',
    await ev('document.getElementById("dayBrief").textContent'));

  const cash0 = await ev('Number(document.getElementById("cashLeft").textContent)');
  ok(cash0 === 100, '初始本钱 100', cash0);

  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=fan]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=fan]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=sachet]").click()');
  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=candy]").click()');
  await wait(150);
  const cash1 = await ev('Number(document.getElementById("cashLeft").textContent)');
  ok(cash1 === 100 - 24 * 2 - 10 - 5, '扣款正确（48+10+5）', cash1);
  await shot('2-buy');

  console.log('\n[3] 定价与招牌');
  await ev('document.querySelector("[data-act=ToPrice]").click()');
  await wait(300);
  ok((await scene()) === 's-price', '进入定价', await scene());
  ok(await ev('document.querySelectorAll("#priceList .row").length') === 3, '只为已进的 3 种货开价');
  ok(await ev('Number(document.getElementById("costLeft").textContent)') === 63, '本钱合计 63');
  ok(await ev('document.querySelectorAll(".chip").length') === 3, '三种招徕手段');
  await ev('document.querySelector("[data-act=Sign][data-id=\'1\']").click()');
  await wait(200);
  ok(await ev('document.querySelector(".chip.on") && document.querySelector(".chip.on").getAttribute("data-id")') === '1',
    '招牌切换生效');
  await ev('document.querySelector("[data-act=Sign][data-id=\'0\']").click()');
  await wait(150);
  /* 把折扇拉到最高价，制造还价机会 */
  for (let i = 0; i < 30; i++) {
    const enabled = await ev('!!document.querySelector("[data-act=\'Pr+\'][data-id=fan]:not([disabled])")');
    if (!enabled) break;
    await ev('document.querySelector("[data-act=\'Pr+\'][data-id=fan]").click()');
  }
  await wait(150);
  await shot('3-price');

  console.log('\n[4] 开市');
  await ev('document.querySelector("[data-act=Open]").click()');
  await wait(700);
  ok((await scene()) === 's-market', '进入开市', await scene());
  ok(await ev('document.querySelector("#bubble").className.indexOf("on") >= 0'), '吆喝气泡弹出');
  await wait(3000);
  const come = await ev('Number(document.getElementById("mkCome").textContent)');
  ok(come >= 1, '已有客来', come);
  ok(await ev('document.querySelectorAll("#feed .ev").length') >= 1, '事件流有记录');
  await shot('4-market');

  /* 还价：轮询等它出现，出现就点「让了」 */
  let haggled = false;
  for (let i = 0; i < 90; i++) {
    const has = await ev('!!document.querySelector(".ev.talk")');
    if (has) {
      ok(true, '触发了还价选择');
      await shot('4b-haggle');
      await ev('document.querySelector("[data-act=Deal]").click()');
      await wait(400);
      haggled = true;
      break;
    }
    if ((await scene()) !== 's-market') break;
    await wait(150);
  }
  if (!haggled) info('本局未触发还价（随机，不算失败）');

  await ev('document.querySelector("[data-act=Skip]").click()');
  await wait(700);

  console.log('\n[5] 结算');
  ok((await scene()) === 's-result', '进入结算', await scene());
  const profit = await ev('document.getElementById("rsProfit").textContent');
  ok(/^[+-]?\d+$/.test(profit), '净利是数字', profit);
  ok(await ev('document.querySelectorAll("#rsStars span, #rsStars s").length') === 5, '五颗星占位齐全');
  ok(await ev('document.getElementById("rsComment").textContent.length') > 6, '有评语');
  const verse = await ev('document.getElementById("rsCouplet").textContent');
  ok(verse && verse.length > 6, '题词已填（AI 或本地降级）', verse);
  ok(await ev('document.getElementById("rsCard").className.indexOf("stamped") >= 0'), '印章已盖');
  ok(await ev('Number(document.getElementById("hudRound").textContent)') === 2, '局数 +1');
  await shot('5-result');

  console.log('\n[6] 存档与再来一摊');
  ok(await ev('!!(window.localStorage.getItem("stall_save_v2"))'), '存档已写入 v2');
  await ev('document.querySelector("[data-act=Again]").click()');
  await wait(400);
  ok((await scene()) === 's-intro', '再来一摊回到封面', await scene());
  await ev('document.querySelector("[data-act=Start]").click()');
  await wait(400);
  ok((await scene()) === 's-buy', '再开一摊进入进货', await scene());
  ok(await ev('Number(document.getElementById("cashLeft").textContent)') === 100, '本钱重置为 100');

  console.log('\n[7] AI 链路（注入桩，验证结构化采纳与坏返回降级）');
  await ev(`window.xhs = { AI: { createModel: function(){
    return { generateText: function(opt){
      var sys = opt.messages[0].content;
      var body;
      if (sys.indexOf('账簿') >= 0) body = '{"title":"小有盈余","line":"钱袋沉了些，走路也稳了些。"}';
      else if (sys.indexOf('吆喝') >= 0) body = '{"call":"新蒸的糖，甜得很呐"}';
      else body = '{"weather":"晴","hot":"fan","gossip":"东头说书先生今日开嗓"}';
      return Promise.resolve({ choices: [{ message: { content: body } }] });
    } };
  } } }; 1`);
  await ev('document.querySelector("[data-act=Start]").click()');
  await wait(700);
  const brief = await ev('document.getElementById("dayBrief").textContent');
  ok(brief.indexOf('东头说书先生今日开嗓') >= 0, 'AI 街谈被解析并采纳', brief);
  ok(brief.indexOf('今日俏') >= 0, '本地字段未被 AI 覆盖（hot 仍有效）');

  await ev('document.querySelector("[data-act=\'Buy+\'][data-id=fan]").click()');
  await wait(120);
  await ev('document.querySelector("[data-act=ToPrice]").click()');
  await wait(200);
  await ev('document.querySelector("[data-act=Open]").click()');
  await wait(900);
  const bub = await ev('document.getElementById("bubble").textContent');
  ok(bub.indexOf('新蒸的糖') >= 0, 'AI 吆喝进入摊上气泡', bub);
  await wait(1500);
  await ev('document.querySelector("[data-act=Skip]").click()');
  await wait(700);
  const verse2 = await ev('document.getElementById("rsCouplet").textContent');
  ok(verse2.indexOf('钱袋沉了些') >= 0, 'AI 题词进入收摊卡', verse2);

  /* 坏返回：必须整段降级，不能渲染半成品 */
  await ev(`window.xhs.AI.createModel = function(){
    return { generateText: function(){ return Promise.resolve({ choices: [{ message: { content: '抱歉，这个我不能写。' } }] }); } };
  }; 1`);
  await ev('document.querySelector("[data-act=Again]").click()');
  await wait(300);
  await ev('document.querySelector("[data-act=Start]").click()');
  await wait(700);
  const brief2 = await ev('document.getElementById("dayBrief").textContent');
  ok(brief2.length > 6 && brief2.indexOf('东头说书先生') < 0, '坏 JSON 整段降级到本地行情', brief2);
  ok(brief2.indexOf('抱歉') < 0, '降级后不残留模型原文');

  console.log('\n[8] 页面异常');
  ok(pageErrors.length === 0, '零页面异常', pageErrors.slice(0, 3));

  console.log('');
  if (infos.length) console.log('INFO ' + infos.length + ' 条');
  if (fails.length) { console.log('SMOKE FAIL / ' + fails.length); fails.forEach((f) => console.log('  - ' + f)); }
  else console.log('SMOKE PASS');
}

main()
  .catch((e) => { console.error('SMOKE FAIL', e && e.message); process.exitCode = 1; })
  .finally(() => { try { child.kill(); } catch (e) {} });
