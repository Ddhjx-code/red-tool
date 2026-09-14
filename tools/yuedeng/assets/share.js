/* ============================================================
   月下灯会 · 分享出口 (window.YDShare)
   内容依据 docs/specs/2026-09-13-yuedeng-design.md §6：
   分享卡 = 灯纹样 + 灯形 + 月相 + 灯会盛景；
   window.xhs.miniTool 不存在时降级（沿用漆扇 share.js 的系列做法）。

   职责边界：
   - 缩略图与分享卡只在本层生成，main.js 不做任何截图（任务约束）。
   - 灯纹样来自引擎画布 #lamp。引擎以 preserveDrawingBuffer:true 建上下文，
     故 toDataURL / drawImage 都能稳定取到上一帧内容。
   - 成品台 #lamp-result 只是一张普通 2D 画布：引擎只有一枚 WebGL 画布，
     所以成品台显示的灯由本层把快照画进去（整幅铺满 → 灯在 uv(0.5,0.46)
     处，与 #result-stage 上 --cx/--cy/--hw/--hh 驱动的骨架精确对齐）。

   确定性：零随机、零网络引用、零外部依赖。月轮、灯会、纹样全部取自
   固定表与已有画布像素；字体只取系统本地楷体，无远程字体加载。
   ============================================================ */
(function () {
  'use strict';
  // allow: SIZE_OK —— 单一画布合成模块（月轮 / 灯会 / 卡片排版 / 取源 / 端能力桥）。
  // 拆分会新增第七个模块，而 index.html 的脚本载入顺序（data → engine → scene →
  // save → share → main）是已验证锁定件、不得修改，故结构上无法拆分。
  // 与 tools/qishan/assets/share.js 的系列形态同源。

  var D = window.YDData;

  /* ---------- 卡面色值：取自 style.css :root token（逐字同值，不新增 CSS） ---------- */
  var KAITI = '"Kaiti SC","STKaiti","KaiTi",serif';
  var PAPER = '#F7EFE2';         /* --paper */
  var PAPER_DIM = 'rgba(247,239,226,0.62)';   /* --paper-dim */
  var PAPER_FAINT = 'rgba(247,239,226,0.34)'; /* --paper-faint */
  var GOLD = '#E8B84B';          /* --halo */
  var CINNABAR = '#C9483C';      /* --c-zhusha */
  var MOON = '#F2E4C4';          /* --moon */
  var MOON_DK = '#C8B795';       /* --moon-dk */
  var MOON_RIM = '#3A2E26';      /* --moon-rim */
  var CLOUD_LT = '#DCD3C2';      /* --cloud-lt */
  var CLOUD_MD = '#B6AB97';      /* --cloud-md */
  var CLOUD_DK = '#8C8272';      /* --cloud-dk */
  var HORIZON = '#0C1220';       /* --horizon */
  var NIGHT = ['#05070F', '#0A1024', '#111B36', '#17233F'];  /* --night-0..3 */
  var LAMP_SILHOUETTE = '#6A4A2A';   /* style.css .fl / .fest 的未点亮底色 */
  var LAMP_WARM = '#F5C77E';         /* --lamp-warm */

  /* 月轮八边形：与 style.css .m-halo/.m-rim/.m-disc/.m-clouds 的 clip-path 同值 */
  var OCT = [34, 0, 66, 0, 86, 14, 100, 34, 100, 66, 86, 86,
             66, 100, 34, 100, 14, 86, 0, 66, 0, 34, 14, 14];

  /* 月轮各层尺寸与月坑位置：style.css 的 228 / 212 / 198 与 .m-crater.k1..k4 */
  var MOON_SIZE = 228, RIM_SIZE = 212, DISC_SIZE = 198;
  var CRATERS = [[52, 46, 30, 24], [124, 88, 22, 20], [74, 128, 18, 16], [132, 140, 14, 12]];

  /* 云絮：style.css .m-w1/.m-w2/.m-w3（相对 198 盒子的百分比框） */
  var WISPS = [[6, 12, 36, 15], [64, 30, 32, 13], [20, 52, 46, 13]];

  /* 各档月相的 halo / 云絮不透明度（style.css .moon[data-phase="Pn"] 的同值） */
  var HALO_ALPHA = { P1: 0.58, P2: 0.44, P3: 0.34, P4: 0.24, P5: 0.14 };
  var WISP_ALPHA = { P1: [], P2: [0.78, 0, 0], P3: [0.78, 0.78, 0],
                     P4: [0.72, 0.72, 0], P5: [0.62, 0.62, 0.62] };

  var CLOSE_P = '，。！？；：、）》」』…～·,.!?;:)]}';
  var OPEN_P = '（《「『([';

  function str(v) { return v == null ? '' : String(v); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function px255(v) { return Math.round(clamp01(v) * 255); }
  function rgba(c, a) {
    return 'rgba(' + px255(c.r) + ',' + px255(c.g) + ',' + px255(c.b) + ',' + clamp01(a).toFixed(3) + ')';
  }
  function mix(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }

  function wrapText(text, per) {
    var lines = [], line = '', i, nx;
    for (i = 0; i < text.length; i++) {
      line += text.charAt(i);
      if (line.length >= per) {
        if (OPEN_P.indexOf(text.charAt(i)) >= 0) { continue; }
        nx = i + 1 < text.length ? text.charAt(i + 1) : '';
        if (nx && CLOSE_P.indexOf(nx) >= 0) { line += nx; i++; }
        lines.push(line);
        line = '';
      }
    }
    if (line) { lines.push(line); }
    return lines;
  }

  /* ============================================================
     灯纹样取源：引擎画布 #lamp
     ============================================================ */

  /* 灯在源画布里的裁剪框（含光晕余量）。常量与引擎着色器同源：
     LAMP_C.u .5 / LAMP_C.v .46 / LAMP_HW .315 / LAMP_HH .225，
     uv 的 y 向上而 drawImage 的原点在左上，故 y 需翻转。 */
  function lampCrop(src, margin) {
    var g = window.YDEngine ? window.YDEngine.geometry() : { cx: 0.5, cy: 0.46, hw: 0.315, hh: 0.225 };
    var k = margin || 1.32;
    var hw = g.hw * k, hh = g.hh * k;
    var x0 = clamp01(g.cx - hw), x1 = clamp01(g.cx + hw);
    var yTop = clamp01(1 - (g.cy + hh)), yBot = clamp01(1 - (g.cy - hh));
    var w = src.width || src.naturalWidth || 1, h = src.height || src.naturalHeight || 1;
    return { sx: x0 * w, sy: yTop * h, sw: (x1 - x0) * w, sh: (yBot - yTop) * h,
             aspect: ((x1 - x0) * w) / Math.max(1, (yBot - yTop) * h) };
  }

  /* 灯的取源优先级：活画布（刚做完的灯，同步可画）> 已解码的 Image（存档回看） */
  function lampSource(lamp) {
    if (!lamp) { return null; }
    if (lamp.src && lamp.src.width > 0) { return lamp.src; }
    if (lamp.img && lamp.img.complete && lamp.img.naturalWidth > 0) { return lamp.img; }
    return null;
  }

  /* 按裁剪框把灯画进目标矩形，保持长宽比不变形（居中于 dw×dh） */
  function drawLamp(g, lamp, cx, cy, maxW, maxH) {
    var src = lampSource(lamp);
    if (!src) { return false; }
    var crop = lampCrop(src, 1.32);
    var w = Math.min(maxW, maxH * crop.aspect);
    var h = w / crop.aspect;
    g.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh,
                cx - w / 2, cy - h / 2, w, h);
    return true;
  }

  /* ============================================================
     月轮（§4.3 复用月宴的像素月轮 + 五档云量）
     ============================================================ */
  function octPath(g, cx, cy, size) {
    var x = cx - size / 2, y = cy - size / 2, i, px, py;
    g.beginPath();
    for (i = 0; i < OCT.length; i += 2) {
      px = x + OCT[i] / 100 * size;
      py = y + OCT[i + 1] / 100 * size;
      if (i === 0) { g.moveTo(px, py); } else { g.lineTo(px, py); }
    }
    g.closePath();
  }

  function drawMoon(g, cx, cy, size, phase) {
    var code = phase.code;
    var cover = D.MOON_COVER[code] === undefined ? phase.cover : D.MOON_COVER[code];
    var k = size / MOON_SIZE;
    var disc = DISC_SIZE * k;
    var box = disc;                      /* 云絮 / 月坑的参照盒子 = 圆盘盒子 */
    var bx = cx - box / 2, by = cy - box / 2;
    var alpha = WISP_ALPHA[code] || [];
    var i, w;

    g.save();
    g.globalAlpha = HALO_ALPHA[code] === undefined ? 0.28 : HALO_ALPHA[code];
    octPath(g, cx, cy, size);
    g.fillStyle = GOLD;
    g.fill();
    g.restore();

    octPath(g, cx, cy, RIM_SIZE * k);
    g.fillStyle = MOON_RIM;
    g.fill();

    octPath(g, cx, cy, disc);
    g.fillStyle = MOON;
    g.fill();

    g.save();
    octPath(g, cx, cy, disc);
    g.clip();

    g.fillStyle = MOON_DK;
    for (i = 0; i < CRATERS.length; i++) {
      g.fillRect(bx + CRATERS[i][0] * k, by + CRATERS[i][1] * k,
                 CRATERS[i][2] * k, CRATERS[i][3] * k);
    }

    g.fillStyle = CLOUD_DK;
    for (i = 0; i < WISPS.length; i++) {
      if (!alpha[i]) { continue; }
      w = WISPS[i];
      g.save();
      g.globalAlpha = alpha[i];
      g.fillRect(bx + w[0] / 100 * box, by + w[1] / 100 * box,
                 w[2] / 100 * box, w[3] / 100 * box);
      g.restore();
    }

    /* 云带：自下往上占 --cover 的高度（.m-band 同值） */
    if (cover > 0) {
      g.fillStyle = code === 'P5' ? CLOUD_DK : CLOUD_MD;
      g.fillRect(bx, by + box * (1 - cover), box, box * cover);
      g.fillStyle = CLOUD_LT;
      g.fillRect(bx, by + box * (1 - cover), box, Math.max(1, 5 * k));
    }
    g.restore();
  }

  /* ============================================================
     灯会盛景（§9.2）：FESTIVAL_LAMPS 三层景深，零随机
     ============================================================ */
  function drawFestival(g, box, phase) {
    var warmBase = D.hexToRgb('#F5C77E');
    var moonBase = D.hexToRgb(MOON);
    var glow = phase.lampGlow;
    var i, l, tint, w, h, cx, cy, k;

    /* 天际线剪影：style.css .skyline 的 clip-path 折线（底部 64px 带子） */
    var SKY = [0, 44, 9, 44, 9, 26, 15, 14, 21, 26, 21, 40, 30, 40, 30, 22, 38, 22,
               38, 34, 47, 34, 47, 18, 55, 8, 63, 18, 63, 36, 72, 36, 72, 24, 80, 24,
               80, 38, 88, 38, 88, 28, 100, 28, 100, 100, 0, 100];
    var band = box.h * 0.125, bandY = box.y + box.h - band;
    g.beginPath();
    for (i = 0; i < SKY.length; i += 2) {
      cx = box.x + SKY[i] / 100 * box.w;
      cy = bandY + SKY[i + 1] / 100 * band;
      if (i === 0) { g.moveTo(cx, cy); } else { g.lineTo(cx, cy); }
    }
    g.closePath();
    g.fillStyle = HORIZON;
    g.fill();

    for (i = 0; i < D.FESTIVAL_LAMPS.length; i++) {
      l = D.FESTIVAL_LAMPS[i];
      tint = mix(warmBase, moonBase, clamp01(1 - l.warm));
      cx = box.x + l.x / 100 * box.w;
      cy = box.y + l.y / 100 * box.h;
      w = Math.max(4, Math.round(l.scale * D.LAMP_BASE_PX * box.scale));
      h = Math.round(w * 1.25);

      k = l.halo * glow;
      g.save();
      g.globalAlpha = l.bright;
      g.shadowColor = rgba(tint, l.layer === 'far' ? 0.34 * k : 0.58 * k);
      g.shadowBlur = (l.layer === 'near' ? 10 : 6) * k;
      g.fillStyle = LAMP_WARM;
      g.fillRect(cx - w / 2, cy - h / 2, w, h);
      g.restore();
    }
  }

  /* 星野：STARS 固定表，落在给定矩形内 */
  function drawStars(g, box) {
    var i, s;
    g.fillStyle = MOON;
    for (i = 0; i < D.STARS.length; i++) {
      s = D.STARS[i];
      g.globalAlpha = 0.55;
      g.fillRect(box.x + s[0] / 100 * box.w, box.y + s[1] / 100 * box.h,
                 s[2], s[2]);
    }
    g.globalAlpha = 1;
  }

  /* ============================================================
     900×1200 分享卡（§6：灯纹样 + 灯形 + 月相 + 灯会盛景）
     ============================================================ */
  function paintCard(lamp) {
    lamp = lamp || {};
    var c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    var g = c.getContext('2d');
    if (!g) { return ''; }
    var phase = D.phaseByCode(lamp.phase || D.PHASES[0].code);
    var shape = D.shapeById(lamp.shape || D.SHAPES[0].id);
    var place = D.placementById(lamp.placement || D.PLACEMENTS[0].id);
    var kn = lamp.knowledge || D.KNOWLEDGE[0];
    var scene = { x: 90, y: 186, w: 720, h: 504, scale: 2.6 };
    var i, lines;

    /* 夜色底 */
    var bg = g.createRadialGradient(450, 380, 60, 450, 380, 900);
    bg.addColorStop(0, '#17233F');
    bg.addColorStop(0.46, '#0A1024');
    bg.addColorStop(1, '#05070F');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    /* 金框（双道，与漆扇卡同源） */
    g.strokeStyle = GOLD;
    g.lineWidth = 5;
    g.strokeRect(28, 28, 844, 1144);
    g.strokeStyle = 'rgba(232,184,75,0.45)';
    g.lineWidth = 1.5;
    g.strokeRect(46, 46, 808, 1108);

    /* 标题 + 朱砂小印 */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '28px ' + KAITI;
    g.fillText('非遗手作坊 · 月下灯会 · 彩绘灯纹', 450, 104);
    g.save();
    g.translate(450, 148);
    g.fillStyle = CINNABAR;
    g.fillRect(-34, -18, 68, 36);
    g.fillStyle = '#FFFFFF';
    g.font = '22px ' + KAITI;
    g.textBaseline = 'middle';
    g.fillText('第十八作', 0, 1);
    g.restore();

    /* ---- 月下灯会盛景面板：月 + 星 + 天际线 + 群灯 + 用户这盏灯 ---- */
    g.save();
    g.beginPath();
    g.rect(scene.x, scene.y, scene.w, scene.h);
    g.clip();
    var sg = g.createLinearGradient(0, scene.y, 0, scene.y + scene.h);
    sg.addColorStop(0, NIGHT[0]);
    sg.addColorStop(0.34, NIGHT[1]);
    sg.addColorStop(0.68, NIGHT[2]);
    sg.addColorStop(1, NIGHT[3]);
    g.fillStyle = sg;
    g.fillRect(scene.x, scene.y, scene.w, scene.h);
    drawStars(g, scene);
    drawMoon(g, scene.x + scene.w / 2, scene.y + 112, 132, phase);
    drawFestival(g, scene, phase);
    drawLamp(g, lamp, scene.x + scene.w / 2, scene.y + scene.h * 0.50, 420, 420);
    g.restore();
    g.strokeStyle = 'rgba(232,184,75,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(scene.x, scene.y, scene.w, scene.h);

    /* ---- 灯名 / 灯形 / 月相 / 放灯手法 ---- */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER;
    g.font = '76px ' + KAITI;
    g.fillText(str(lamp.name), 450, 790);

    g.fillStyle = GOLD;
    g.font = '27px ' + KAITI;
    g.fillText(shape.name + ' · ' + place.name + '放灯 · ' + phase.name, 450, 846);

    g.fillStyle = PAPER_FAINT;
    g.font = '24px ' + KAITI;
    g.fillText(str(lamp.note), 450, 884);

    /* ---- 知识卡 ---- */
    g.fillStyle = GOLD;
    g.font = '25px ' + KAITI;
    g.textAlign = 'left';
    g.fillText('· ' + str(kn.tag), 96, 932);

    g.fillStyle = 'rgba(247,239,226,0.06)';
    g.fillRect(90, 948, 720, 140);
    g.strokeStyle = 'rgba(232,184,75,0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(90, 948, 720, 140);

    lines = wrapText(str(kn.text), 25);
    if (lines.length > 3) { lines = lines.slice(0, 3); }
    g.fillStyle = PAPER_DIM;
    g.font = '25px ' + KAITI;
    for (i = 0; i < lines.length; i++) { g.fillText(lines[i], 112, 986 + i * 38); }

    /* ---- 落款印章 ---- */
    g.save();
    g.translate(788, 1116);
    g.rotate(-6 * Math.PI / 180);
    g.fillStyle = CINNABAR;
    g.fillRect(-44, -44, 88, 88);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.strokeRect(-36, -36, 72, 72);
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '34px ' + KAITI;
    g.fillText('灯', 0, -17);
    g.fillText('成', 0, 18);
    g.restore();

    /* ---- 页脚 ---- */
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PAPER_DIM;
    g.font = '24px ' + KAITI;
    g.fillText('竹篾为骨 · 纸绢为面 · 月下透光 · 每盏灯独一无二', 430, 1158);

    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* ============================================================
     缩略图 / 成品台显示
     ============================================================ */

  /* 存档用缩略图：把灯裁剪框缩到指定宽度（save.js 落盘为 data URL）。
     源画布不可用时退回已解码的 Image；都没有则返回空串（save.js 允许空 thumb）。 */
  function thumb(lamp, width) {
    var src = lampSource(lamp);
    if (!src) { return ''; }
    var w = width || 150;
    var crop = lampCrop(src, 1.18);
    var h = Math.max(1, Math.round(w / crop.aspect));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    if (!g) { return ''; }
    g.fillStyle = '#0A1024';   /* --panel-solid：与 .work-thumb 的底色同源 */
    g.fillRect(0, 0, w, h);
    g.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* 结局主角：只取灯体与它的外溢辉光，保留源画布的 alpha。
     与 thumb 的唯一区别是不填底色 —— thumb 的 #0A1024 是为存档缩略图准备的，
     直接拿去当结局主角会在夜空上露出一块比方框更深的补丁。
     margin 取 2.2：外溢辉光是 exp(-sdc*3)，到 1.2 个灯半宽处只剩 2.7%，
     所以裁切边落在光晕已衰尽处，不会切出硬边。 */
  function lampCut(lamp, width, margin) {
    var src = lampSource(lamp);
    if (!src) { return ''; }
    var w = width || 500;
    var crop = lampCrop(src, margin || 2.2);
    var h = Math.max(1, Math.round(w / crop.aspect));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    if (!g) { return ''; }
    g.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }

  /* 成品台 #lamp-result：把快照整幅铺满画布。
     铺满 = 灯落在 uv(0.5,0.46)，与 #result-stage 的 --cx/--cy/--hw/--hh
     精确对齐，于是骨架（提梁/灯盖/灯底/流苏）与灯面严丝合缝。 */
  function show(target, lamp) {
    if (!target) { return false; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = target.clientWidth || 0, ch = target.clientHeight || 0;
    target.width = Math.max(1, Math.floor(cw * dpr));
    target.height = Math.max(1, Math.floor(ch * dpr));
    var g = target.getContext('2d');
    if (!g) { return false; }
    g.clearRect(0, 0, target.width, target.height);
    var src = lampSource(lamp);
    if (!src) { return false; }
    g.drawImage(src, 0, 0, target.width, target.height);
    return true;
  }

  /* 存档回看：thumb 是 data URL 字符串，需先解码成 Image（异步，本地解码，无网络）。
     解码完成后回调，供 main.js 画进成品台。 */
  function decode(dataUrl, done) {
    if (!dataUrl) { if (done) { done(null); } return null; }
    var img = new Image();
    img.onload = function () { if (done) { done(img); } };
    img.onerror = function () { if (done) { done(null); } };
    img.src = dataUrl;
    return img;
  }

  /* ============================================================
     端能力（沿用漆扇 share.js 的系列做法：不存在即降级，绝不报错）
     ============================================================ */
  function miniTool() { return window.xhs && window.xhs.miniTool; }

  function notify(msg) {
    if (typeof window.YDToast === 'function') { window.YDToast(msg); }
    else if (typeof window.alert === 'function') { window.alert(msg); }
  }

  /* 降级：端能力缺失时不做任何写盘动作，只提示用户截屏留存——
     分享卡本身已在页内可取（lastCard），故这是一次「页内预览」式降级。 */
  function fallback() {
    notify('当前环境暂不支持直接保存 · 分享卡已生成，可截屏留存这盏灯');
  }

  function withFile(fn) {
    var mt = miniTool();
    var lamp = window.YDShare.lastLamp;
    if (!mt || !lamp) { fallback(); return false; }
    var dataUrl = paintCard(lamp);
    if (!dataUrl) { fallback(); return false; }
    window.YDShare.lastCard = dataUrl;
    mt.writeTempFile({
      data: dataUrl,
      success: function (res) { fn(mt, res && res.filePath); },
      fail: fallback
    });
    return true;
  }

  window.YDShare = {
    /* main.js 写入：当前这盏灯（name/note/shape/placement/phase/colors/knowledge/src/img/thumb） */
    lastLamp: null,
    /* 最近一次合成的分享卡 data URL（端能力缺失时的页内留存） */
    lastCard: '',

    paintCard: paintCard,
    thumb: thumb,
    lampCut: lampCut,
    show: show,
    decode: decode,
    drawLamp: drawLamp,
    drawMoon: drawMoon,

    /* 存相册（用户主动点击触发） */
    saveAlbum: function () {
      withFile(function (mt, p) {
        mt.saveImageToPhotosAlbum({
          filePath: p,
          success: function () { notify('已保存到相册'); },
          fail: fallback
        });
      });
    },

    /* 发笔记（用户主动点击触发） */
    postNote: function () {
      var lamp = window.YDShare.lastLamp || {};
      withFile(function (mt, p) {
        mt.postNote({
          title: '我绘了一盏彩灯·' + str(lamp.name),
          content: '竹篾为骨、纸绢为面，彩绘灯纹、内置蜡烛。点亮之后光由内向外透出——' +
                   str(lamp.note) + '。月下灯会，群灯齐明。',
          tags: '#国风vibecoding #月下灯会 #中秋 #灯笼 #非遗 #国风 #中式美学 #传统文化',
          mediaInfo: { image_resources: [{ url: p }] },
          fail: fallback
        });
      });
    }
  };
})();
