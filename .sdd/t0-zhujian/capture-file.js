const { chromium } = require("/Users/wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const path = require("path");
const fs = require("fs");

const URL = "file:///Users/wang/AI/workspace/red-tool/tools/zhujian/index.html";
const OUT = path.join(__dirname, "shots");

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox", "--allow-file-access-from-files"]
  });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push("console: " + m.text()); console.log("PAGE-CONSOLE:", m.text()); } });
  const check = (name, cond) => console.log((cond ? "PASS " : "FAIL ") + name);
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("window.__zj !== undefined", null, { timeout: 15000 });
  await page.waitForTimeout(800);
  check("file:// 首页标题", (await page.innerText("#view-home")).includes("竹简观兵"));
  const st0 = await page.evaluate("window.__zj.state()");
  console.log("initial stage:", JSON.stringify(st0.stage));
  await page.screenshot({ path: path.join(OUT, "zj-f1-home.png") });

  await page.click("#btn-unroll");
  await page.waitForFunction("window.__zj.state().stage.stage === 'browse'", null, { timeout: 15000 });
  console.log("browse 进入耗时已验证");
  const buf = await page.evaluate("document.querySelector('#stage-canvas').toDataURL('image/png')");
  fs.writeFileSync(path.join(OUT, "zj-f2-browse.png"), Buffer.from(buf.split(",")[1], "base64"));

  await page.evaluate("window.__zj.selectPian(1)");
  await page.waitForTimeout(1200);
  const st2 = await page.evaluate("window.__zj.state()");
  check("读篇选中1", st2.stage.selected === 1 && st2.stage.stage === "read");
  await page.screenshot({ path: path.join(OUT, "zj-f3-read.png") });

  check("零页面错误", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  console.log("FILE-CAPTURE DONE");
  await browser.close();
})();
