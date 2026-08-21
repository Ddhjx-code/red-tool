(function () {
  var D = window.HFData;
  var $ = function (id) { return document.getElementById(id); };
  var sel = { hair: "h0", top: "t0", skirt: "s0", shoe: "shoe_xiuhua", bg: "bg_yuanlin" };
  var curCat = "hair";

  function showView(name) {
    var views = document.querySelectorAll(".view"), i;
    for (i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].id === "view-" + name);
    }
  }

  function render() {
    $("bg-img").src = D.bgImg(sel.bg);
    $("char-img").src = D.comboImg(sel.hair, sel.top, sel.skirt, sel.shoe);
  }

  function renderOptions() {
    var box = $("options");
    box.textContent = "";
    var list = curCat === "hair" ? D.HAIR : curCat === "top" ? D.TOP : curCat === "skirt" ? D.SKIRT : curCat === "shoe" ? D.SHOE : D.BG;
    var key = curCat === "bg" ? "bg" : curCat;
    list.forEach(function (item) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opt" + (sel[key] === item.id ? " is-on" : "");
      b.textContent = item.name;
      b.addEventListener("click", function () {
        sel[key] = item.id;
        render();
        renderOptions();
      });
      box.appendChild(b);
    });
  }

  var tabs = $("tabs").querySelectorAll(".tab"), i;
  for (i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
      curCat = this.getAttribute("data-cat");
      var j;
      for (j = 0; j < tabs.length; j++) tabs[j].classList.toggle("is-on", tabs[j] === this);
      renderOptions();
    });
  }

  function renderIntro() {
    var box = $("intro-list");
    box.textContent = "";
    var picks = [
      { cat: "hair", label: "发髻" },
      { cat: "top", label: "上衣" },
      { cat: "skirt", label: "下裙" },
      { cat: "shoe", label: "鞋" }
    ];
    picks.forEach(function (p) {
      var item = D.find(p.cat, sel[p.cat]);
      var card = document.createElement("div");
      card.className = "intro-item";
      var tag = document.createElement("span");
      tag.className = "intro-tag";
      tag.textContent = p.label + " · " + item.name;
      var know = document.createElement("p");
      know.className = "intro-know";
      know.textContent = item.know;
      card.appendChild(tag);
      card.appendChild(know);
      box.appendChild(card);
    });
  }

  $("btn-start").addEventListener("click", function () {
    showView("dress");
    render();
    renderOptions();
  });
  $("btn-home").addEventListener("click", function () { showView("home"); });
  $("btn-next").addEventListener("click", function () {
    renderIntro();
    showView("intro");
  });
  $("btn-back-dress").addEventListener("click", function () { showView("dress"); });

  function miniTool() { return window.xhs && window.xhs.miniTool; }
  function fallback() { alert("当前环境暂不支持直接保存，请截图保存哦"); }

  function seedRng(str) {
    var h = 1779033703 ^ str.length, i;
    for (i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return function () {
      h = Math.imul(h ^ h >>> 16, 2246822507);
      h = Math.imul(h ^ h >>> 13, 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function drawPetal(g, x, y, r, rot, a) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = "rgba(246,196,205," + a + ")";
    g.beginPath();
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.9, -r * 0.4, r * 0.7, r * 0.7, 0, r);
    g.bezierCurveTo(-r * 0.7, r * 0.7, -r * 0.9, -r * 0.4, 0, -r);
    g.fill();
    g.fillStyle = "rgba(224,140,158," + (a * 0.45).toFixed(3) + ")";
    g.beginPath();
    g.ellipse(0, r * 0.25, r * 0.26, r * 0.48, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function paintShare() {
    var W = 900, H = 1200;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    var bg = $("bg-img");
    var ch = $("char-img");
    var scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    var bw = bg.naturalWidth * scale, bh = bg.naturalHeight * scale;
    g.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);

    var cs = Math.min(W / ch.naturalWidth, (H * 0.86) / ch.naturalHeight);
    var cw = ch.naturalWidth * cs, chh = ch.naturalHeight * cs;
    var cx = (W - cw) / 2, cy = H - chh - 16;

    g.save();
    g.translate(W / 2, H - 22);
    g.scale(1, 0.16);
    var sg = g.createRadialGradient(0, 0, 0, 0, 0, cw * 0.36);
    sg.addColorStop(0, "rgba(35,40,58,0.32)");
    sg.addColorStop(1, "rgba(35,40,58,0)");
    g.fillStyle = sg;
    g.beginPath(); g.arc(0, 0, cw * 0.36, 0, Math.PI * 2); g.fill();
    g.restore();

    g.drawImage(ch, cx, cy, cw, chh);

    var vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.34, W / 2, H * 0.5, H * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(20,25,40,0.24)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    var rnd = seedRng(sel.hair + sel.top + sel.skirt + sel.shoe + sel.bg);
    var i, x, y, r;
    for (i = 0; i < 26; i++) {
      var edge = rnd() < 0.72;
      x = edge ? (rnd() < 0.5 ? rnd() * W * 0.3 : W - rnd() * W * 0.3) : rnd() * W;
      y = rnd() * H * 0.92;
      r = 7 + rnd() * 15;
      drawPetal(g, x, y, r, rnd() * Math.PI * 2, (0.22 + rnd() * 0.4).toFixed(3));
    }
    g.save();
    g.shadowColor = "rgba(230,180,34,0.9)";
    g.shadowBlur = 6;
    for (i = 0; i < 16; i++) {
      x = rnd() * W;
      y = rnd() * H * 0.5;
      r = 1.2 + rnd() * 2.4;
      g.fillStyle = "rgba(240,200,80," + (0.3 + rnd() * 0.5).toFixed(3) + ")";
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    var title = "霓裳羽衣", tx = W - 76, ty = 96;
    g.save();
    g.shadowColor = "rgba(255,255,255,0.7)";
    g.shadowBlur = 8;
    g.font = "56px 'Kaiti SC', 'STKaiti', 'KaiTi', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#425066";
    for (i = 0; i < title.length; i++) g.fillText(title[i], tx, ty + i * 66);
    g.restore();
    var sx = tx - 26, sy = ty + 4 * 66 - 20;
    g.fillStyle = "#C3272B";
    g.beginPath();
    if (g.roundRect) g.roundRect(sx, sy, 52, 52, 8); else g.rect(sx, sy, 52, 52);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "22px 'Kaiti SC', 'STKaiti', 'KaiTi', serif";
    g.fillText("汉", sx + 26, sy + 17);
    g.fillText("服", sx + 26, sy + 39);

    var names = [
      D.find("hair", sel.hair).name,
      D.find("top", sel.top).name,
      D.find("skirt", sel.skirt).name,
      D.find("shoe", sel.shoe).name
    ];
    var lg = g.createLinearGradient(0, H - 130, 0, H);
    lg.addColorStop(0, "rgba(25,30,46,0)");
    lg.addColorStop(1, "rgba(25,30,46,0.55)");
    g.fillStyle = lg;
    g.fillRect(0, H - 130, W, 130);
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.font = "27px 'Kaiti SC', 'STKaiti', 'KaiTi', serif";
    g.fillText(names.join(" · "), W / 2, H - 64);
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.font = "17px 'Kaiti SC', 'STKaiti', 'KaiTi', serif";
    g.fillText("非遗手作坊 · 衣冠上国，礼仪之邦", W / 2, H - 30);

    return c.toDataURL("image/png");
  }

  function sharePayload() {
    return {
      title: "我妆点了一身汉服",
      content: "选发髻、配上衣、搭下裙、择一双鞋，在「霓裳羽衣」里妆点一身汉服。衣冠上国，礼仪之邦。",
      tags: "#国风vibecoding #汉服 #国风 #中式美学 #传统文化"
    };
  }

  function doShare(kind) {
    var mt = miniTool();
    var dataUrl = $("result-img").src;
    if (!dataUrl) { fallback(); return; }
    if (!mt) { fallback(); return; }
    var payload = sharePayload();
    var data = dataUrl;
    mt.writeTempFile({
      data: data,
      success: function (res) {
        if (kind === "album") {
          mt.saveImageToPhotosAlbum({
            filePath: res.filePath,
            success: function () { alert("已保存到相册"); },
            fail: function () { fallback(); }
          });
        } else {
          mt.postNote({
            title: payload.title,
            content: payload.content,
            tags: payload.tags,
            mediaInfo: { image_resources: [{ url: res.filePath }] },
            fail: function () { fallback(); }
          });
        }
      },
      fail: function () { fallback(); }
    });
  }

  $("btn-generate").addEventListener("click", function () {
    var dataUrl;
    try { dataUrl = paintShare(); } catch (e) { fallback(); return; }
    $("result-img").src = dataUrl;
    var wrap = document.querySelector(".result-card-wrap");
    wrap.classList.remove("pop");
    void wrap.offsetWidth;
    wrap.classList.add("pop");
    showView("result");
  });
  $("btn-save-album").addEventListener("click", function () { doShare("album"); });
  $("btn-post-note").addEventListener("click", function () { doShare("note"); });
  $("btn-back-intro").addEventListener("click", function () { showView("home"); });

  render();
})();
