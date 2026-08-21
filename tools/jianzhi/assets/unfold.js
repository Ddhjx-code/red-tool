window.UnfoldEngine = (function () {
  const LIFT_MS = 430;
  const FLIP_MS = 620;
  const GAP_MS = 210;
  const SETTLE_MS = 540;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  // 每种折法的展开剧本（角度单位：度）。
  // 每个 stage: flap=[from,to) 的副本沿 hinge 线翻开，落位后可见份数变为 after。
  // 四折/八折 = 对折家族（对称翻倍）；六折 = 对折+折三折（卷片+直径大翻）；
  // 五折 = 对折+折五折（逐片卷开+直径大翻）。
  const PLANS = {
    four: [
      { flap: [0, 1], hinge: 45, after: 2 },
      { flap: [0, 2], hinge: 135, after: 4 }
    ],
    eight: [
      { flap: [0, 1], hinge: 22.5, after: 2 },
      { flap: [0, 2], hinge: 67.5, after: 4 },
      { flap: [0, 4], hinge: 157.5, after: 8 }
    ],
    six: [
      { flap: [0, 1], hinge: 15, after: 2 },
      { flap: [0, 2], hinge: 45, after: 4 },
      { flap: [2, 4], hinge: 105, after: 6 },
      { flap: [0, 6], hinge: 165, after: 12 }
    ],
    five: [
      { flap: [0, 1], hinge: 18, after: 2 },
      { flap: [1, 2], hinge: 54, after: 3 },
      { flap: [2, 3], hinge: 90, after: 4 },
      { flap: [3, 4], hinge: 126, after: 5 },
      { flap: [0, 5], hinge: 162, after: 10 }
    ]
  };

  class Engine {
    constructor(paper) {
      this.paper = paper;
      this.running = false;
      this.doneCalled = false;
      this.skipped = false;
    }

    start(layout, onDone) {
      this.layout = layout;
      this.onDone = onDone;
      this.t0 = performance.now();
      this.running = true;
      this.doneCalled = false;
      this.skipped = false;
      this.flap = document.createElement("canvas");
      this.flapCtx = this.flap.getContext("2d");
      this.flapForStage = -1;
      this.buildTimeline();
    }

    buildTimeline() {
      const plan = PLANS[this.paper.fold.key];
      const stages = [];
      let t = LIFT_MS + 140;
      let before = 1;
      for (let i = 0; i < plan.length; i++) {
        const p = plan[i];
        stages.push({
          type: "flip",
          from: p.flap[0],
          to: p.flap[1],
          hinge: (p.hinge * Math.PI) / 180,
          before: before,
          after: p.after,
          start: t,
          dur: FLIP_MS,
          si: i
        });
        before = p.after;
        t += FLIP_MS + GAP_MS;
      }
      stages.push({ type: "settle", start: t, dur: SETTLE_MS });
      this.stages = stages;
      this.total = t + SETTLE_MS;
    }

    skip() {
      this.skipped = true;
    }

    render(ctx, W, H, now) {
      let elapsed = now - this.t0;
      if (this.skipped) elapsed = this.total;

      const L = this.layout;
      const lp = clamp01(elapsed / LIFT_MS);
      const le = easeInOutCubic(lp);
      const cx = L.fromCx + (L.cx - L.fromCx) * le;
      const cy = L.fromCy + (L.cy - L.fromCy) * le;
      let r = L.fromR + (L.r - L.fromR) * le;

      let visible = 1;
      let flap = null;
      let settle = 0;

      for (let si = 0; si < this.stages.length; si++) {
        const st = this.stages[si];
        if (st.type === "flip") {
          if (elapsed >= st.start + st.dur) {
            visible = st.after;
          } else if (elapsed >= st.start) {
            visible = st.before;
            flap = {
              from: st.from,
              to: st.to,
              hinge: st.hinge,
              p: clamp01((elapsed - st.start) / st.dur),
              si: si
            };
          }
        } else if (st.type === "settle") {
          if (elapsed >= st.start) {
            settle = clamp01((elapsed - st.start) / st.dur);
          }
        }
      }

      r *= 1 + 0.05 * Math.sin(Math.PI * settle);

      this.paper.renderCopies(ctx, cx, cy, r, { to: visible });
      if (flap) this.renderFlap(ctx, W, H, cx, cy, r, flap);

      if (elapsed >= this.total && !this.doneCalled) {
        this.doneCalled = true;
        this.running = false;
        if (this.onDone) this.onDone();
      }
    }

    renderFlap(ctx, W, H, cx, cy, r, flap) {
      if (this.flap.width !== Math.ceil(W) || this.flap.height !== Math.ceil(H)) {
        this.flap.width = Math.ceil(W);
        this.flap.height = Math.ceil(H);
      }
      if (this.flapForStage !== flap.si) {
        const fc = this.flapCtx;
        fc.clearRect(0, 0, W, H);
        this.paper.renderCopies(fc, cx, cy, r, { from: flap.from, to: flap.to });
        this.flapForStage = flap.si;
      }
      const psi = easeInOutCubic(flap.p) * Math.PI;
      let c = Math.cos(psi);
      if (Math.abs(c) < 0.002) c = c < 0 ? -0.002 : 0.002;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(flap.hinge);
      ctx.scale(c, 1);
      ctx.rotate(-flap.hinge);
      ctx.globalAlpha = 0.88 + 0.12 * Math.abs(c);
      ctx.drawImage(this.flap, -cx, -cy);
      ctx.restore();
    }
  }

  return { Engine };
})();
