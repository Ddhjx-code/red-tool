const { chromium } = require("/Users/wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 } });
  const logs = [];
  page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push("console " + m.type() + ": " + m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => logs.push("requestfailed: " + r.url().slice(0, 160) + " -> " + (r.failure() || {}).errorText));
  await page.goto("file:///Users/wang/AI/workspace/red-tool/tools/zhujian/index.html", { waitUntil: "load", timeout: 20000 }).catch(e => logs.push("goto: " + e.message));
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ hasZj: !!window.__zj, state: window.__zj ? window.__zj.state() : null, body: document.body.innerText.slice(0, 150) }));
  console.log("STATE:", JSON.stringify(st));
  console.log("LOGS:", JSON.stringify(logs, null, 1));
  await browser.close();
})();
