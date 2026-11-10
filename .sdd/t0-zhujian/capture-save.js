const { chromium } = require("/Users/wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const path = require("path");
const fs = require("fs");

const BASE = "http://127.0.0.1:8765/.sdd/t0-zhujian/index.html";
const OUT = path.join(__dirname, "shots");
const STATES = ["rolled", "mid", "flat", "closeup"];
const DBG_STATES = ["flat", "closeup"];

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push("console: " + m.text()); console.log("PAGE-CONSOLE:", m.text()); } });
  page.on("response", (r) => { if (r.status() >= 400) errors.push("HTTP " + r.status() + " " + r.url()); });
  for (const s of STATES) {
    await page.goto(BASE + "?s=" + s, { waitUntil: "load" });
    await page.waitForFunction("window.__t0Ready === true", null, { timeout: 15000 });
    const rev = await page.evaluate("window.T0REV");
    const webgl = await page.evaluate("!!window.__t0 && !!document.querySelector('canvas')");
    await page.waitForTimeout(1000);
    const file = path.join(OUT, s + ".png");
    await page.screenshot({ path: file });
    console.log(s + ".png  (three r" + rev + ", webgl=" + webgl + ")");
  }
  for (const s of DBG_STATES) {
    await page.goto(BASE + "?s=" + s + "&dbg=text", { waitUntil: "load" });
    await page.waitForFunction("window.__t0Ready === true", null, { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, s + "-text.png") });
    console.log(s + "-text.png  (dbg red-strip locator)");
  }
  // ---- 竹简观兵 产品验证（沿用同一服务器/浏览器）----
  errors.length = 0; // T0 页面的 favicon 404 与本产品无关，单独统计
  const FAILS = [];
  const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) FAILS.push(name); };
  const saveBuf = async (name) => {
    const u = await page.evaluate("document.querySelector('#stage-canvas').toDataURL('image/png')");
    fs.writeFileSync(path.join(OUT, name), Buffer.from(u.split(",")[1], "base64"));
  };
  const ZJ = (fs.existsSync(".sdd/tmp-zj-zip/index.html") ? "http://127.0.0.1:8765/.sdd/tmp-zj-zip/index.html?test=1" : "http://127.0.0.1:8765/tools/zhujian/index.html?test=1");
  await page.goto(ZJ, { waitUntil: "load" });
  await page.waitForFunction("window.__zj !== undefined", null, { timeout: 15000 });
  await page.waitForTimeout(500);
  check("home 标题渲染", (await page.innerText("#view-home")).includes("竹简观兵"));
  await page.screenshot({ path: path.join(OUT, "zj-01-home.png") });

  await page.click("#btn-unroll");
  await page.waitForFunction("window.__zj.state().stage.stage === 'browse'", null, { timeout: 15000 });
  let s = await page.evaluate("window.__zj.state()");
  check("展卷完成 browse(13束)", s.stage.stage === "browse");
  await page.waitForTimeout(900);
  await saveBuf("zj-02-browse.png"); // 浏览态：CDP 合成坏帧，用帧缓冲

  await page.evaluate("window.__zj.selectPian(1)");
  await page.waitForTimeout(1200);
  s = await page.evaluate("window.__zj.state()");
  check("读篇选中1 read", s.stage.selected === 1 && s.stage.stage === "read");
  await page.screenshot({ path: path.join(OUT, "zj-03-read-pian1.png") }); // 读篇态：CDP 可靠

  await page.evaluate("window.__zj.cycleFace(1)");
  await page.waitForTimeout(250);
  await page.evaluate("window.__zj.cycleFace(1)");
  await page.waitForTimeout(250);
  s = await page.evaluate("window.__zj.state()");
  check("三面切到 face2", s.stage.face === 2);
  await page.screenshot({ path: path.join(OUT, "zj-04-read-face2.png") });
  await page.evaluate("window.__zj.openCard()");
  await page.waitForTimeout(400);
  s = await page.evaluate("window.__zj.state()");
  check("附片 → done 含1", s.done.includes(1));
  await page.screenshot({ path: path.join(OUT, "zj-05-card.png") });

  await page.click("#btn-close-card");
  await page.waitForTimeout(300);
  await page.evaluate("window.__zj.unlockAll()");
  s = await page.evaluate("window.__zj.state()");
  check("全卷解锁", s.full === true);

  await page.click("#btn-note");
  await page.waitForTimeout(700);
  const src = (await page.getAttribute("#note-img", "src")) || "";
  const nat = await page.evaluate("(() => { const i = document.querySelector('#note-img'); return [i.naturalWidth, i.naturalHeight]; })()");
  check("手记卡 900x1200 dataURL", src.startsWith("data:image/png") && nat[0] === 900 && nat[1] === 1200);
  await page.screenshot({ path: path.join(OUT, "zj-06-note.png") });

  check("零页面错误", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  console.log(FAILS.length ? "ZHJ VERIFY FAIL: " + FAILS.join(", ") : "ZHJ VERIFY PASS");
  await browser.close();
})();