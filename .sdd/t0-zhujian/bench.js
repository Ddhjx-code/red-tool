const { chromium } = require("/Users/wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core");
const BASE = "http://127.0.0.1:8765/tools/zhujian/index.html?test=1";

(async () => {
  const browser = await chromium.launch({
    channel: "chrome", headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const tDcl = Date.now() - t0;
  await page.waitForFunction("window.__zj !== undefined", null, { timeout: 15000 });
  const tInit = Date.now() - t0;
  // 懒初始化：模拟用户点击「展卷」进入展馆的时刻
  await page.evaluate("window.__zj.initNow()");
  await page.waitForFunction("window.__zjReady3d === true", null, { timeout: 15000 });
  const tReady = Date.now() - t0;
  const tAllReady = await page.evaluate("new Promise(r => { if (window.__zjAllPianReady) return r(Date.now()); var p = window.__zjPerf; var id = setInterval(() => { if (window.__zjAllPianReady) { clearInterval(id); r(Date.now()); } }, 30); })");
  await page.evaluate("document.readyState === 'complete' || new Promise(r => addEventListener('load', r))");
  const tLoad = Date.now() - t0;

  const metrics = await page.evaluate(() => {
    const p = performance.getEntriesByType("resource").map(r => ({
      name: r.name.split("/").pop(), dur: Math.round(r.duration), size: r.transferSize || r.decodedBodySize || 0
    }));
    const paint = performance.getEntriesByType("paint").map(p2 => [p2.name, Math.round(p2.startTime)]);
    return { initMs: window.__zjPerf.initMs, readyMs: window.__zjPerf.readyMs, res: p, paint, mem: (performance.memory ? { js: Math.round(performance.memory.usedJSHeapSize / 1048576), total: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null) };
  });

  const snap = (label) => page.evaluate((lbl) => {
    const p = window.__zjPerf;
    const s = window.__zj.state();
    return { lbl, stage: s.stage.stage, initMs: p.initMs, readyMs: p.readyMs, fps: p.fps.slice(), calls: p.calls, tris: p.tris, frames: p.frames };
  }, label);

  // idle（首页可见，等待后台背填结束后采样安静期帧率）
  await page.waitForTimeout(300);
  await page.waitForTimeout(2500);
  const idle = await snap("idle");
  await page.evaluate("var p=window.__zjPerf; p.fps=[]; p.lastT0=0; p.frames=0;");

  // 展卷 → browse
  await page.click("#btn-unroll");
  await page.waitForFunction("window.__zj.state().stage.stage === 'browse'", null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const browse = await snap("browse");
  await page.evaluate("var p=window.__zjPerf; p.fps=[]; p.lastT0=0; p.frames=0;");

  // 读篇
  await page.evaluate("window.__zj.selectPian(1)");
  await page.waitForTimeout(2500);
  const read = await snap("read");

  console.log(JSON.stringify({ ms: { dcl: tDcl, initAt: tInit, ready: tReady, initCost: tReady - tInit, allReady: tAllReady - t0, load: tLoad }, metrics, phases: [idle, browse, read], errors }, null, 1));
  await browser.close();
})();

// ---- 第二轮：读篇阶段深挖（LongTask + 帧间隔峰值） ----
(async () => {
  const browser = await chromium.launch({
    channel: "chrome", headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 630, height: 840 } });
  await page.addInitScript(() => {
    window.__longTasks = [];
    if (window.PerformanceObserver) {
      try {
        const po = new PerformanceObserver((list) => {
          window.__longTasks.push(...list.getEntries().map(e => ({ dur: Math.round(e.duration), start: Math.round(e.startTime) })));
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch (e) {}
    }
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://127.0.0.1:8765/tools/zhujian/index.html?test=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__zj !== undefined");
  await page.click("#btn-unroll");
  await page.waitForFunction("window.__zj.state().stage.stage === 'browse'", null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.evaluate("var p=window.__zjPerf; p.frames=0; p.fps=[]; p.lastT0=0;");
  await page.evaluate("window.__zj.selectPian(1)");
  await page.waitForTimeout(2500);
  const seg = async (label, waitMs) => {
    await page.waitForTimeout(waitMs);
    return page.evaluate((lbl) => {
      const p = window.__zjPerf;
      const out = { lbl, frames: p.frames, gapMax: Math.round(p.gapMax), gapAt: p.gapAt.toFixed(1) };
      p.frames = 0; p.gapMax = 0; p.lastT0 = 0;
      return out;
    }, label);
  };
  const r = {
    phase: await page.evaluate("window.__zj.state().stage.stage"),
    canvasSize: await page.evaluate("document.querySelector('#stage-canvas').width + 'x' + document.querySelector('#stage-canvas').height"),
    a_read_pr1p5_shadowOff: await seg("a", 2000),
    b_read_pr1p5_shadowOn: await (async () => { await page.evaluate("window.Zj3D.debugSet('shadow', true)"); return seg("b", 2000); })(),
    c_read_pr2_shadowOn: await (async () => { await page.evaluate("window.Zj3D.debugSet('pr', 2)"); return seg("c", 2000); })(),
    d_read_pr2_shadowOff: await (async () => { await page.evaluate("window.Zj3D.debugSet('shadow', false)"); return seg("d", 2000); })(),
    longTasks: await page.evaluate("window.__longTasks"),
    hidden: await page.evaluate("document.hidden"),
    errors
  };
  console.log(JSON.stringify({ readDeep: r }, null, 1));
  await browser.close();
})();
