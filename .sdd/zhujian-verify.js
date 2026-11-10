/* 竹简观兵 node 验证（playwright-core + Chrome headless）：断言 + 产品截图 */
const { chromium } = require("/Users/wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const path = require("path");
const fs = require("fs");

const BASE = process.env.ZJ_BASE || "http://127.0.0.1:8765/tools/zhujian/index.html?test=1";
const SHOTS = process.env.ZJ_SHOTS || ".sdd/t0-zhujian/shots";
const FAILS = [];
function check(name, cond) { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) FAILS.push(name); }

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  fs.mkdirSync(SHOTS, { recursive: true });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction("window.__zj !== undefined", null, { timeout: 15000 });
  await page.waitForTimeout(500);

  check("home 标题渲染", (await page.innerText("#view-home")).includes("竹简观兵"));
  await page.screenshot({ path: path.join(SHOTS, "zj-01-home.png") });

  await page.click("#btn-unroll");
  await page.waitForFunction("window.__zj.state().stage.stage === 'browse'", null, { timeout: 15000 });
  let s = await page.evaluate("window.__zj.state()");
  check("展卷完成 → browse(13 束)", s.stage.stage === "browse");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "zj-02-browse.png") });

  await page.evaluate("window.__zj.selectPian(1)");
  await page.waitForTimeout(900);
  s = await page.evaluate("window.__zj.state()");
  check("读篇选中 1", s.stage.selected === 1 && s.stage.stage === "read");
  await page.screenshot({ path: path.join(SHOTS, "zj-03-read-pian1.png") });
  await page.evaluate("window.__zj.cycleFace(1)");
  await page.waitForTimeout(300);
  await page.evaluate("window.__zj.cycleFace(1)");
  await page.waitForTimeout(300);
  s = await page.evaluate("window.__zj.state()");
  check("三面切换 → face2", s.stage.face === 2);
  await page.screenshot({ path: path.join(SHOTS, "zj-04-read-face2.png") });

  await page.evaluate("window.__zj.openCard()");
  await page.waitForTimeout(400);
  s = await page.evaluate("window.__zj.state()");
  check("附片 → done 含 1", s.done.includes(1));
  await page.screenshot({ path: path.join(SHOTS, "zj-05-card.png") });

  await page.evaluate("window.__zj.unlockAll()");
  s = await page.evaluate("window.__zj.state()");
  check("全卷解锁", s.full === true);

  await page.click("#btn-note");
  await page.waitForTimeout(700);
  const src = (await page.getAttribute("#note-img", "src")) || "";
  const nat = await page.evaluate("(() => { const i = document.querySelector('#note-img'); return [i.naturalWidth, i.naturalHeight]; })()");
  check("手记卡 dataURL 900x1200", src.startsWith("data:image/png") && nat[0] === 900 && nat[1] === 1200);
  await page.screenshot({ path: path.join(SHOTS, "zj-06-note.png") });

  const blank = await page.evaluate("(() => { const c = document.querySelector('#stage-canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return !g; })()");
  check("WebGL 可用", blank === false);

  check("零页面错误", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await browser.close();
  console.log(FAILS.length ? "VERIFY FAIL: " + FAILS.join(", ") : "VERIFY PASS");
  process.exit(FAILS.length ? 1 : 0);
})();
