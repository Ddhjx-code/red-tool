window.Paper = (function () {
  const SIZE = 1024;
  const HALF = SIZE / 2;
  const R_OFF = HALF - 12;

  class PaperModel {
    constructor(fold) {
      this.fold = fold;
      this.wedgeRad = (fold.wedge * Math.PI) / 180;
      this.off = document.createElement("canvas");
      this.off.width = SIZE;
      this.off.height = SIZE;
      this.octx = this.off.getContext("2d");
      this.tintCache = {};
      this.version = 0;
      this.dirty = true;
      this.reset();
    }

    reset() {
      const c = this.octx;
      c.clearRect(0, 0, SIZE, SIZE);
      c.save();
      this.sectorPath(c);
      c.clip();
      const g = c.createRadialGradient(HALF, HALF, R_OFF * 0.08, HALF, HALF, R_OFF);
      g.addColorStop(0, "#fdfaf2");
      g.addColorStop(0.82, "#f8f2e4");
      g.addColorStop(1, "#efe6d2");
      c.fillStyle = g;
      c.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 1500; i++) {
        const a = Math.random() * this.wedgeRad - this.wedgeRad / 2;
        const r = Math.sqrt(Math.random()) * R_OFF;
        const x = HALF + Math.sin(a) * r;
        const y = HALF - Math.cos(a) * r;
        c.fillStyle = Math.random() < 0.5 ? "rgba(122,102,72,0.05)" : "rgba(255,255,255,0.07)";
        c.fillRect(x, y, 1.7, 1.7);
      }
      c.restore();
      this.bump();
    }

    bump() {
      this.version++;
      this.dirty = true;
    }

    sectorPath(c) {
      c.beginPath();
      c.moveTo(HALF, HALF);
      c.arc(HALF, HALF, R_OFF, -Math.PI / 2 - this.wedgeRad / 2, -Math.PI / 2 + this.wedgeRad / 2);
      c.closePath();
    }

    cutAt(ox, oy, r) {
      const c = this.octx;
      c.save();
      this.sectorPath(c);
      c.clip();
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      c.arc(ox, oy, r, 0, Math.PI * 2);
      c.fill();
      c.restore();
      this.bump();
    }

    cutLine(x1, y1, x2, y2, r) {
      const d = Math.hypot(x2 - x1, y2 - y1);
      const step = Math.max(r * 0.35, 2);
      const n = Math.max(1, Math.ceil(d / step));
      for (let i = 0; i <= n; i++) {
        this.cutAt(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, r);
      }
    }

    cutPoly(pts) {
      const c = this.octx;
      c.save();
      this.sectorPath(c);
      c.clip();
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fill();
      c.restore();
      this.bump();
    }

    renderCopies(ctx, cx, cy, radius, opts) {
      opts = opts || {};
      const from = opts.from || 0;
      const to = opts.to !== undefined ? opts.to : this.fold.copies;
      const src = opts.source || this.off;
      const k = radius / R_OFF;
      const s = SIZE * k;
      for (let i = from; i < to; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        if (opts.angleFor) {
          ctx.rotate(opts.angleFor(i));
        } else {
          ctx.rotate(i * this.wedgeRad);
        }
        if (i % 2 === 1) ctx.scale(-1, 1);
        if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
        ctx.drawImage(src, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }

    tinted(color) {
      const entry = this.tintCache[color];
      if (entry && entry.v === this.version) return entry.canvas;
      const t = (entry && entry.canvas) || document.createElement("canvas");
      t.width = SIZE;
      t.height = SIZE;
      const c = t.getContext("2d");
      c.clearRect(0, 0, SIZE, SIZE);
      c.globalCompositeOperation = "source-over";
      c.drawImage(this.off, 0, 0);
      c.globalCompositeOperation = "source-in";
      c.fillStyle = color;
      c.fillRect(0, 0, SIZE, SIZE);
      this.tintCache[color] = { canvas: t, v: this.version };
      return t;
    }

    normToOff(p) {
      return [HALF + p[0] * R_OFF, HALF - p[1] * R_OFF];
    }
  }

  return { PaperModel, SIZE, HALF, R_OFF };
})();
