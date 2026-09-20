(function () {
  var W = 414;
  var H = 736;
  var GROUND = H - 130;
  var FW = 289;
  var FH = 546;

  var GRAV = 1500;
  var SPEED = 260;
  var JUMP = -620;

  var ATK_TIME = 0.20;
  var ATK_CD = 0.26;
  var ATK_W = 132;
  var ATK_H = 128;
  var HITSTOP = 70;
  var COMBO_WIN = 1.8;
  var PICK_SCORE = 10;

  var FOE_HP = 2;
  var FOE_SPEED = 72;
  var FOE_KNOCK = 260;
  var FOE_SPAWN_GAP = 118;

  var PLAYER_HP = 4;
  var INV_TIME = 1.5;

  // Parry is the only source of true damage negation, so its budget is the balance
  // beam: window / cooldown caps invulnerability uptime at 0.20/0.55 ~ 36%.
  var PARRY_WIN = 0.20;
  var PARRY_CD = 0.45;
  var PARRY_HIT_CD = 0.55;

  var SWEEP_CD = 2.6;
  var SWEEP_R = 132;
  var LAUNCH_CD = 3.6;
  var LAUNCH_DMG = 2;
  var ULT_COST = 100;
  var ULT_LOCK = 0.6;

  var BULLET_SPEED = 210;
  var FIRE_CD = 2.4;
  var BULLET_R = 7;
  var RANGED_KEEP = 150;

  var CHARGE_HIT = 5;
  var CHARGE_PARRY = 26;
  var CHARGE_KILL = 8;
  var CHARGE_PICK = 4;

  // Read the real sheet size from the cache rather than a hand-kept table: a foe is
  // scaled to a target height and stood on the sheet's bottom edge, so a stale size
  // constant sinks it through the floor line (foe/foe2 differed by 12px).
  function texSize(key) {
    var it = game.cache.getImage(key);
    var im = (it && it.data) ? it.data : it;
    if (!im || !im.width) { return { w: 281, h: 281 }; }
    return { w: im.width, h: im.height };
  }

  // One row per kind; every kind branch reads this, so a new foe is a row not a
  // seven-site edit. hgt is the rendered height in px (art resolution independent);
  // ground=false hovers; shadow is drawn width; loud raises the music level.
  var FOE_DEF = {
    walk:   { img: "foe-walk",   hgt: 116, hp: FOE_HP, speed: FOE_SPEED, ground: true,  shadow: 50 },
    fly:    { img: "foe-fly",    hgt: 96,  hp: 1,      speed: 96,        ground: false, shadow: 34 },
    elite:  { img: "foe-elite",  hgt: 162, hp: 6,      speed: 38,        ground: true,  shadow: 78, loud: true, dash: true },
    ranged: { img: "foe-ranged", hgt: 126, hp: 2,      speed: 58,        ground: true,  shadow: 50, keep: RANGED_KEEP },
    shield: { img: "foe-shield", hgt: 148, hp: 4,      speed: 46,        ground: true,  shadow: 64, guard: true },
    boss:   { img: "boss-menshen", hgt: 250, hp: 20,   speed: 34,        ground: true,  shadow: 120, loud: true, dash: true, boss: true }
  };

  // Each boss has its own sheet now, so identity comes from the art rather than a tint
  // (canvas rendering cannot tint a bitmap). color still drives the aura ring and the
  // HP-bar accent; hgt is the rendered height in px, independent of art resolution.
  var BOSS_DEF = [
    { name: "门神", img: "boss-menshen", color: 0xff4a2a,
      hgt: 250, hp: 14, speed: 34, atks: ["slam"] },
    { name: "灯妖", img: "boss-lantern", color: 0xffd45e,
      hgt: 252, hp: 20, speed: 40, atks: ["slam", "volley"] },
    { name: "狮王", img: "boss-lionking", color: 0x9fe0ff,
      hgt: 264, hp: 26, speed: 46, atks: ["slam", "volley", "summon"] },
    { name: "水鬼", img: "boss-waterghost", color: 0x7fe0a0,
      hgt: 258, hp: 26, speed: 42, atks: ["volley", "summon", "slam"] },
    { name: "灯魔", img: "boss-lanternlord", color: 0xc7a6ff,
      hgt: 278, hp: 34, speed: 50, atks: ["slam", "volley", "summon"] }
  ];

  var STORY = [
    "年关将至。村口晦气不散，锣鼓都哑了。",
    "老匠人捧出沉睡的狮头，蘸了朱砂——",
    "一点左眼，二点右眼，三点天庭。",
    "「醒。」",
    "采遍五门之青，把福气带回村里。"
  ];

  // bg reuses the three shipped backdrops on a %3 cycle; hazard names the gate's
  // mechanic and is null when the deck is a straight fight.
  var GATES = [
    { name: "村口", waves: 2, bg: 0x16283c, sky: 0x0e1a28, hazard: null, floor: "ground-road" },
    { name: "街市", waves: 3, bg: 0x241f36, sky: 0x171226, hazard: "lantern", floor: "ground-road" },
    { name: "高台", waves: 4, bg: 0x2a1d2e, sky: 0x1d1220, hazard: "bamboo", floor: "ground-road" },
    { name: "水巷", waves: 4, bg: 0x122a2e, sky: 0x0b1a1d, hazard: "puddle", floor: "ground-water" },
    { name: "灯山", waves: 5, bg: 0x2e1a1a, sky: 0x1d0f0f, hazard: "bamboo", floor: "ground-road" }
  ];

  var ACHS = [
    { id: "first", name: "開光初醒", desc: "击倒第一只晦气" },
    { id: "combo10", name: "一氣呵成", desc: "达成 ×10 连击" },
    { id: "airhit", name: "凌空一撲", desc: "在空中扑中飞怪" },
    { id: "nohit", name: "片塵不沾", desc: "一整阵未受伤" },
    { id: "pick30", name: "采青滿載", desc: "单局采青 30 次" },
    { id: "rich", name: "鑼鼓喧天", desc: "单局得分超过 2000" },
    { id: "parry5", name: "金獅攔門", desc: "单局弹反 5 次" },
    { id: "ult", name: "采青爆發", desc: "施放一次采青必杀" },
    { id: "boss", name: "驅邪鎮煞", desc: "击倒一名门神" },
    { id: "clear", name: "五門皆淨", desc: "通关全部五门" }
  ];

  var game;
  var lion;
  var physY = 0;
  var motion = null;

  // lion.y = physY + curve bob. Keep these separate: the physics step clamps lion.y
  // to GROUND, so folding the bob back into lion.y lets it accumulate into the jump.
  // Measured: the sprite is 98.9% opaque, so 0.30 already yields a 162px lion (22%
  // of 736). Raising it also needs the ATK box and enemy spacing re-checked.
  var LION_SCALE = 0.30;
  // Rendered half-width of the lion; foes hold this far out so the two sprites stop
  // edge to edge instead of walking into each other's centre.
  var LION_HALF = 289 * LION_SCALE * 0.5;
  // Far edge of the floor plane. The floor starts this far ABOVE the walk line so it
  // visibly recedes behind the characters' feet; starting it at GROUND instead makes the
  // backdrop and the floor merge into one wall-like band.
  var FLOOR_TOP = GROUND - 60;
  var BOB_GAIN = 2.5;    // curve unit is a fraction of body height
  var LEAN_GAIN = 2.5;   // x the curve's degrees
  var SQ_GAIN = 2.2;     // x the curve's torso-compression factor
  var DEG = Math.PI / 180;

  // Phaser CE wraps on whitespace and Chinese has none, so its wordWrapWidth is inert
  // for CJK -- this is what actually wraps. Breaks after punctuation when it can.
  function wrapCJK(s, per) {
    var lines = [], cur = "";
    for (var i = 0; i < s.length; i++) {
      cur += s.charAt(i);
      if (cur.length >= per || "。，、！？；：".indexOf(s.charAt(i)) >= 0) {
        lines.push(cur);
        cur = "";
      }
    }
    if (cur) { lines.push(cur); }
    return lines.join("\n");
  }

  function sampleMotion(name, t, key) {
    if (!motion || !motion.segments) { return 0; }
    var s = motion.segments[name];
    if (!s || !s.n || !s[key]) { return 0; }
    var idx = Math.floor(t * (s.fps || motion.fps)) % s.n;
    var v = s[key][idx < 0 ? idx + s.n : idx];
    // Keep non-finite out of lion.y: NaN there hides the player with no error.
    return (typeof v === "number" && isFinite(v)) ? v : 0;
  }
  var foeG;
  var greenG;
  var popG;
  var flashG;
  var bgPen;
  var bgImg;
  var bgFloor;
  var shadPen;
  var bgDark;
  var keyAtk;
  var ctlG;
  var ctlPanel;
  var ctlHit = [];
  var touchBtn = {};
  var jumpBuf = 0;
  var bulletG;
  var fxG;
  var ctlFxG;
  var bossBarG;
  var overlayPen;
  var hazardG;
  var bossAuraG;
  var txtBoss;
  var txtBossTag;
  var bullets = [];
  var hazards = [];
  var hazT = 0;

  var phase = "story";
  var storyI = 0;
  var wrapT = 0;
  var gate = 0;
  var wave = 0;
  var waveClearT = 0;
  var waveHurt = 0;
  var playT = 0;

  var facing = 1;
  var vx = 0;
  var vy = 0;
  var onGround = true;
  var atkT = 0;
  var atkCd = 0;
  var landT = 0;
  var combo = 0;
  var comboT = 0;
  var hitstopT = 0;
  var invT = 0;
  var hp = PLAYER_HP;
  var score = 0;
  var kills = 0;
  var picks = 0;
  var maxCombo = 0;
  var airHits = 0;

  var parryT = 0;
  var parryCd = 0;
  var parryWhiffed = false;
  var parryHits = 0;
  var sweepCd = 0;
  var launchCd = 0;
  var ultCharge = 0;
  var ultLock = 0;
  var ultUsed = 0;
  var bossKills = 0;
  var hurtT = 0;

  var got = {};

  var txtHp;
  var txtScore;
  var txtCombo;
  var txtWave;
  var veil;
  var bigText;
  var subText;
  var hudBg;
  var dlgG;
  var skipText;
  var hintText;
  var toastText;
  var endGroup;
  var cardCv;
  var cardShown = false;
  var ctaText;

  var probe = { engine: "phaser-ce", ver: Phaser.VERSION, renderer: null };
  window.__probe = probe;

  game = new Phaser.Game(W, H, Phaser.CANVAS, "g", {
    preload: function () {
      game.load.spritesheet("lion", "./assets/img/lion-walk.webp", FW, FH);
      game.load.image("foe-walk", "./assets/img/foe-walk.webp");
      game.load.image("foe-fly", "./assets/img/foe-fly.webp");
      game.load.image("foe-elite", "./assets/img/foe-elite.webp");
      game.load.image("foe-ranged", "./assets/img/foe-ranged.webp");
      game.load.image("foe-shield", "./assets/img/foe-shield.webp");
      game.load.image("boss-menshen", "./assets/img/boss-menshen.webp");
      game.load.image("boss-lantern", "./assets/img/boss-lantern.webp");
      game.load.image("boss-lionking", "./assets/img/boss-lionking.webp");
      game.load.image("boss-waterghost", "./assets/img/boss-waterghost.webp");
      game.load.image("boss-lanternlord", "./assets/img/boss-lanternlord.webp");
      game.load.image("icon-parry", "./assets/img/icon-parry.webp");
      game.load.image("icon-sweep", "./assets/img/icon-sweep.webp");
      game.load.image("icon-launch", "./assets/img/icon-launch.webp");
      game.load.image("icon-ult", "./assets/img/icon-ult.webp");
      game.load.image("fx-slash", "./assets/img/fx-slash.webp");
      game.load.image("fx-hit", "./assets/img/fx-hit.webp");
      game.load.image("fx-parry", "./assets/img/fx-parry.webp");
      game.load.image("fx-sweep", "./assets/img/fx-sweep.webp");
      game.load.image("fx-launch", "./assets/img/fx-launch.webp");
      game.load.image("fx-burst", "./assets/img/fx-burst.webp");
      game.load.image("fx-spark", "./assets/img/fx-spark.webp");
      game.load.image("pick-green", "./assets/img/pick-green.webp");
      game.load.image("ground-road", "./assets/img/ground-road.webp");
      game.load.image("ground-water", "./assets/img/ground-water.webp");
      game.load.image("bg0", "./assets/img/bg-village.webp");
      game.load.image("bg1", "./assets/img/bg-market.webp");
      game.load.image("bg2", "./assets/img/bg-stage.webp");
    },
    create: function () {
      game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
      game.scale.pageAlignHorizontally = true;
      game.scale.pageAlignVertically = true;
      game.scale.refresh();
      probe.renderer = game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas";
      game.stage.backgroundColor = "#0b1420";

      bgImg = game.add.image(0, 0, "bg0");
      bgImg.anchor.setTo(0, 0);
      bgImg.scale.setTo(0.5);
      bgFloor = game.add.image(0, FLOOR_TOP, "ground-road");
      bgFloor.anchor.setTo(0, 0);
      bgPen = game.add.graphics(0, 0);
      bgDark = game.add.graphics(0, 0);
      var bi;
      // Ramped, not one flat rect: a flat rect leaves a hard 1px seam across the street.
      // Kept shallow so the backdrop still reads as a lit street rather than a void that
      // matches the floor in tone.
      for (bi = 0; bi < 9; bi++) {
        bgDark.beginFill(0x05080d, 0.02 + (bi / 8) * 0.24);
        bgDark.drawRect(0, FLOOR_TOP - 90 + bi * 10, W, 11);
        bgDark.endFill();
      }
      shadPen = game.add.graphics(0, 0);
      hazardG = game.add.graphics(0, 0);
      bossAuraG = game.add.graphics(0, 0);
      greenG = game.add.group();
      flashG = game.add.group();
      foeG = game.add.group();
      bulletG = game.add.group();
      popG = game.add.group();

      lion = game.add.sprite(W * 0.22, GROUND, "lion");
      lion.anchor.setTo(0.5, 1);
      lion.scale.setTo(LION_SCALE);
      lion.animations.add("walk", [0, 1, 2, 3], 9, true);
      lion.animations.add("idle", [0, 3], 3, true);
      lion.animations.play("idle");
      motion = window.LION_MOTION || null;
      physY = GROUND;
      overlayPen = game.add.graphics(0, 0);

      hudBg = game.add.graphics(0, 0);
      hudBg.beginFill(0x05080d, 0.45);
      hudBg.drawRect(0, 0, W, 62);
      hudBg.endFill();
      hudBg.beginFill(0xc9a227, 0.35);
      hudBg.drawRect(0, 62, W, 2);
      hudBg.endFill();

      txtHp = game.add.text(18, 11, "", { font: "bold 21px sans-serif", fill: "#ff6a4a" });
      txtScore = game.add.text(18, 39, "", { font: "14px sans-serif", fill: "#d8c9a6" });
      // Top-centre, not top-right: WeChat's capsule owns the top-right corner.
      txtWave = game.add.text(W * 0.5, 15, "", {
        font: "bold 17px sans-serif", fill: "#cfe3f5", align: "center"
      });
      txtWave.anchor.setTo(0.5, 0);
      txtCombo = game.add.text(W * 0.5, 108, "", { font: "bold 42px sans-serif", fill: "#ff8a3d" });
      txtCombo.anchor.setTo(0.5, 0);
      txtCombo.visible = false;
      txtBoss = game.add.text(W * 0.5, 86, "", {
        font: "bold 14px sans-serif", fill: "#ffb37a", align: "center"
      });
      txtBoss.anchor.setTo(0.5, 0);
      txtBoss.visible = false;
      txtBossTag = game.add.text(0, 0, "", {
        font: "bold 16px serif", fill: "#ffe9b0", align: "center"
      });
      txtBossTag.anchor.setTo(0.5, 1);
      txtBossTag.visible = false;

      hintText = game.add.text(W * 0.44, H - 152,
        "◀▶ 移动　▲ 跳　打 攻击\n擋 弹反　掃 扫堂　衝 挑空　青 大招", {
          font: "13px sans-serif", fill: "#ffe9b0", align: "center",
          backgroundColor: "rgba(5,8,13,0.7)"
        });
      hintText.anchor.setTo(0.5, 0.5);
      hintText.visible = false;

      veil = game.add.graphics(0, 0);
      veil.beginFill(0x05080d, 0.62);
      veil.drawRect(0, 0, W, H);
      veil.endFill();
      veil.visible = false;

      dlgG = game.add.graphics(0, 0);
      dlgG.beginFill(0x0a1420, 0.9);
      dlgG.drawRect(24, H - 214, W - 48, 168);
      dlgG.endFill();
      dlgG.lineStyle(2, 0xc9a227, 0.5);
      dlgG.drawRect(24, H - 214, W - 48, 168);
      dlgG.endFill();
      dlgG.beginFill(0xc9a227, 0.5);
      dlgG.drawRect(24, H - 214, W - 48, 3);
      dlgG.endFill();
      dlgG.visible = false;

      skipText = game.add.text(44, H - 196, "跳过 ›", {
        font: "13px sans-serif", fill: "#7f9bb5"
      });
      skipText.visible = false;

      bigText = game.add.text(W * 0.5, H - 152, "", {
        font: "bold 25px serif", fill: "#ffe9b0", align: "center",
        wordWrap: true, wordWrapWidth: W - 96
      });
      bigText.anchor.setTo(0.5, 0.5);
      bigText.visible = false;
      subText = game.add.text(W - 46, H - 66, "", {
        font: "14px sans-serif", fill: "#8fa8bf", align: "right"
      });
      subText.anchor.setTo(1, 0.5);
      subText.visible = false;
      toastText = game.add.text(W * 0.5, 148, "", { font: "bold 19px sans-serif", fill: "#b9e07a" });
      toastText.anchor.setTo(0.5, 0.5);
      toastText.visible = false;

      endGroup = game.add.group();
      cardCv = document.createElement("canvas");

      keyAtk = game.input.keyboard.addKey(32);
      keyAtk.onDown.add(function () { tap(); });
      var keyJump = game.input.keyboard.addKey(Phaser.Keyboard.UP);
      keyJump.onDown.add(function () { if (phase === "play") { jumpBuf = 0.15; } });
      game.input.keyboard.addKey(Phaser.Keyboard.K).onDown.add(tryParry);
      game.input.keyboard.addKey(Phaser.Keyboard.ONE).onDown.add(trySweep);
      game.input.keyboard.addKey(Phaser.Keyboard.TWO).onDown.add(tryLaunch);
      game.input.keyboard.addKey(Phaser.Keyboard.THREE).onDown.add(tryUlt);

      game.input.addPointer();
      game.input.addPointer();
      // Backing for the right-hand cluster: without it the floating buttons read as
      // part of the scene and cut across the background/floor split.
      // Backs the four skill buttons only. It stops above the jump button so that button
      // stays in the bottom control row, and it must stay opaque enough to be read over a
      // boss sprite (a boss is ~220px wide on a 414px screen, so it reaches under here).
      ctlPanel = game.add.graphics(0, 0);
      ctlPanel.beginFill(0x08131f, 0.90);
      ctlPanel.drawRect(W - 100, 350, 94, 296);
      ctlPanel.endFill();
      ctlPanel.lineStyle(2, 0x6fb0d8, 0.65);
      ctlPanel.drawRect(W - 100, 350, 94, 296);
      ctlG = game.add.group();
      // The three original buttons keep their exact coordinates: the motion smoke
      // test drives them by canvas point. New actions stack up the right edge.
      ctlHit = [
        { id: "L", x: 60, y: H - 60, r: 38, label: "◀" },
        { id: "R", x: 150, y: H - 60, r: 38, label: "▶" },
        { id: "A", x: 266, y: H - 60, r: 38, label: "打" },
        { id: "J", x: W - 62, y: H - 60, r: 38, label: "▲" },
        { id: "P", x: W - 58, y: 594, r: 30, label: "擋", icon: "icon-parry", cdMax: PARRY_CD,
          cdGet: function () { return parryCd; }, tint: 0x9fe0ff },
        { id: "S1", x: W - 58, y: 526, r: 30, label: "掃", icon: "icon-sweep", cdMax: SWEEP_CD,
          cdGet: function () { return sweepCd; }, tint: 0xffd06a },
        { id: "S2", x: W - 58, y: 458, r: 30, label: "衝", icon: "icon-launch", cdMax: LAUNCH_CD,
          cdGet: function () { return launchCd; }, tint: 0xc7a6ff },
        { id: "U", x: W - 58, y: 390, r: 30, label: "青", icon: "icon-ult", charge: true,
          tint: 0xff8a3d }
      ];
      for (var ci = 0; ci < ctlHit.length; ci++) {
        var cb = ctlHit[ci];
        var cg = game.add.graphics(0, 0);
        cg.beginFill(0x16304a, 0.72);
        cg.lineStyle(3, cb.tint || 0xa8d8f6, 0.9);
        cg.drawCircle(cb.x, cb.y, cb.r);
        cg.endFill();
        ctlG.add(cg);
        if (cb.icon) {
          var ico = game.add.image(cb.x, cb.y, cb.icon);
          ico.anchor.setTo(0.5, 0.5);
          var its = texSize(cb.icon);
          ico.scale.setTo((cb.r * 1.55) / Math.max(its.w, its.h));
          ctlG.add(ico);
        } else {
          var ct = game.add.text(cb.x, cb.y, cb.label, {
            font: "bold " + Math.round(cb.r * 0.72) + "px sans-serif",
            fill: "#eaf6ff", align: "center"
          });
          ct.anchor.setTo(0.5, 0.5);
          ctlG.add(ct);
        }
      }
      ctlG.visible = false;
      ctlFxG = game.add.graphics(0, 0);
      fxG = game.add.group();
      bossBarG = game.add.graphics(0, 0);

      game.input.onDown.add(function (p) {
        probe.downs = (probe.downs || 0) + 1;
        probe.lastPt = (p ? [Math.round(p.x), Math.round(p.y)] : null);
        if (window.WHAudio2) {
          window.WHAudio2.unlock();
          window.WHAudio2.musicStart();
        }
        if (hitSkip(p)) { storyI = STORY.length; showStory(); return; }
        var hit = phase === "play" ? hitCtl(p) : null;
        // A fast tap sets and clears touchBtn inside one frame, so buffer the jump.
        if (hit) {
          touchBtn[p.id] = hit;
          if (hit === "J") { jumpBuf = 0.15; }
          else if (hit === "A") { attack(); }
          else if (hit === "P") { tryParry(); }
          else if (hit === "S1") { trySweep(); }
          else if (hit === "S2") { tryLaunch(); }
          else if (hit === "U") { tryUlt(); }
        } else { tap(); }
      });
      game.input.onUp.add(function (p) { delete touchBtn[p.id]; });

      refreshHud();
      drawDeck();
      showStory();
      window.__ready = true;
    },
    update: function () {
      probe.frames = (probe.frames || 0) + 1;
      var dt = Math.min(game.time.elapsedMS / 1000, 0.05);
      probe.dt = dt;
      probe.phase = phase;
      probe.gate = gate;
      probe.wave = wave;
      probe.score = score;
      probe.kills = kills;
      probe.picks = picks;
      probe.maxCombo = maxCombo;
      probe.achs = Object.keys(got);
      probe.foes = foeG.countLiving();
      probe.greens = greenG.countLiving();
      probe.foeKind = [];
      foeG.forEachAlive(function (f) {
        probe.foeKind.push(f.data ? f.data.kind : "?");
      });
      probe.lion = [Math.round(lion.x), Math.round(lion.y)];
      probe.hp = hp;
      probe.storyVisible = bigText.visible;
      probe.storyText = bigText.text;
      probe.touchBtn = JSON.stringify(touchBtn);
      probe.jumpBuf = jumpBuf;
      probe.onGround = onGround;
      probe.physY = Math.round(physY);
      probe.ground = GROUND;
      probe.parryT = parryT;
      probe.parryCd = parryCd;
      probe.parryHits = parryHits;
      probe.sweepCd = sweepCd;
      probe.launchCd = launchCd;
      probe.ultCharge = Math.round(ultCharge);
      probe.ultReady = ultCharge >= ULT_COST;
      probe.ultUsed = ultUsed;
      probe.bullets = bullets.length;
      // gate reaches GATES.length once the last deck clears, before phase flips to end.
      probe.hazard = GATES[gate] ? GATES[gate].hazard : null;
      probe.bossKills = bossKills;
      probe.bossHp = null;
      foeG.forEachAlive(function (f) { if (f.data && f.data.isBoss) { probe.bossHp = f.data.hp; } });

      if (window.WHAudio2 && window.WHAudio2.musicOn()) {
        var lv = 0;
        if (phase === "play") {
          lv = 1;
          foeG.forEachAlive(function (f) { if (f.data && FOE_DEF[f.data.kind].loud) { lv = 2; } });
        }
        window.WHAudio2.musicSet(lv);
        probe.musicLvl = lv;
        probe.musicTicks = window.WHAudio2.musicTicks();
      }
      ctlG.visible = (phase === "play");
      ctlPanel.visible = (phase === "play");
      ctlFxG.visible = (phase === "play");
      drawCtl();
      drawBossBar();
      if (phase !== "play") { hazardG.clear(); bossAuraG.clear(); }
      if (phase === "story") { stepStory(dt); return; }
      if (phase === "wrap") { stepWrap(dt); return; }
      if (phase === "end") { return; }

      stepPlay(dt);
    }
  });

  function hitCtl(p) {
    for (var i = 0; i < ctlHit.length; i++) {
      var b = ctlHit[i], dx = p.x - b.x, dy = p.y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) { return b.id; }
    }
    return null;
  }

  function held(id) {
    for (var k in touchBtn) { if (touchBtn[k] === id) { return true; } }
    return false;
  }

  function hitSkip(p) {
    if (phase !== "story" || !skipText.visible) { return false; }
    var b = skipText.getBounds();
    return p.x >= b.x - 10 && p.x <= b.right + 10 &&
           p.y >= b.y - 10 && p.y <= b.bottom + 10;
  }

  function showHint() {
    hintText.visible = true;
    hintText.alpha = 1;
    game.add.tween(hintText).to({ alpha: 0 }, 700, Phaser.Easing.Quadratic.In, true, 1500)
      .onComplete.add(function () { hintText.visible = false; });
  }

  function tap() {
    if (phase === "story") { storyI += 1; showStory(); return; }
    if (phase === "wrap") { goNext(); return; }
    if (phase === "play") { attack(); return; }
    if (phase === "end") { showCard(); return; }
  }

  function veilOn(on) {
    veil.visible = on;
    bigText.visible = on;
    subText.visible = on;
    dlgG.visible = on;
  }

  function showStory() {
    if (storyI >= STORY.length) {
      phase = "play";
      veilOn(false);
      skipText.visible = false;
      startRun();
      showHint();
      return;
    }
    veilOn(true);
    skipText.visible = true;
    bigText.text = wrapCJK(STORY[storyI], 11);
    subText.text = "轻触继续 · " + (storyI + 1) + " / " + STORY.length;
    if (window.WHAudio2) { window.WHAudio2.sfx("page"); }
  }

  function stepStory() { }

  function startRun() {
    gate = 0;
    wave = 0;
    score = 0;
    kills = 0;
    picks = 0;
    maxCombo = 0;
    airHits = 0;
    got = {};
    hp = PLAYER_HP;
    playT = 0;
    parryT = 0;
    parryCd = 0;
    parryHits = 0;
    sweepCd = 0;
    launchCd = 0;
    ultCharge = 0;
    ultLock = 0;
    ultUsed = 0;
    bossKills = 0;
    hurtT = 0;
    clearBullets();
    lion.x = W * 0.22;
    lion.y = GROUND;
    physY = GROUND;
    vy = 0;
    drawDeck();
    spawnWave();
  }

  function drawDeck() {
    var g = GATES[gate];
    bgImg.loadTexture("bg" + (gate % 3));
    bgFloor.loadTexture(g.floor);
    var ft = texSize(g.floor);
    bgFloor.scale.setTo(W / ft.w, (H - FLOOR_TOP) / ft.h);
    hazardG.clear();
    buildHazards();
    bgPen.clear();
    // Translucent, not opaque: the floor plate supplies the surface, this only tints
    // it toward the deck's palette.
    bgPen.beginFill(g.bg, 0.12);
    bgPen.drawRect(0, FLOOR_TOP, W, H - FLOOR_TOP);
    bgPen.endFill();
    // The backdrop photo already contains a street, so the near floor has to be a clear
    // brightness step above it or the two bands merge and neither reads as ground.
    bgPen.beginFill(0xcfe3f5, 0.13);
    bgPen.drawRect(0, FLOOR_TOP + 8, W, GROUND - FLOOR_TOP - 8);
    bgPen.endFill();
    bgPen.beginFill(0x05080d, 0.34);
    bgPen.drawRect(0, FLOOR_TOP, W, 8);
    bgPen.endFill();
    var i;
    var band = (H - GROUND) / 8;
    for (i = 0; i < 8; i++) {
      bgPen.beginFill(0x05080d, 0.26 + (i / 7) * 0.42);
      bgPen.drawRect(0, GROUND + i * band, W, band + 1);
      bgPen.endFill();
    }
    bgPen.lineStyle(3, 0xffcf8a, 0.55);
    bgPen.moveTo(0, FLOOR_TOP);
    bgPen.lineTo(W, FLOOR_TOP);
    bgPen.lineStyle(4, 0xffe9b0, 0.92);
    bgPen.moveTo(0, GROUND);
    bgPen.lineTo(W, GROUND);
  }

  function refreshHud() {
    var s = "";
    var i;
    if (phase === "story") {
      txtHp.text = "";
      txtScore.text = "";
      txtWave.text = "";
      return;
    }
    for (i = 0; i < hp; i++) { s += "♥ "; }
    txtHp.text = s;
    txtScore.text = "采青 " + picks + " · 击倒 " + kills + " · " + score + " 分";
    txtWave.text = GATES[gate].name + " · 第 " + (wave + 1) + " 阵";
  }

  function toast(name, desc) {
    toastText.text = "★ " + name + "　" + desc;
    toastText.visible = true;
    toastText.alpha = 1;
    game.add.tween(toastText).to({ alpha: 0 }, 2600, Phaser.Easing.Quadratic.In, true, 700)
      .onComplete.add(function () { toastText.visible = false; });
  }

  function unlock(id) {
    if (got[id]) { return false; }
    var a = null;
    var i;
    for (i = 0; i < ACHS.length; i++) { if (ACHS[i].id === id) { a = ACHS[i]; } }
    if (!a) { return false; }
    got[id] = true;
    toast(a.name, a.desc);
    if (window.WHAudio2) { window.WHAudio2.sfx("ach"); }
    return true;
  }

  function addCharge(n) {
    if (ultCharge >= ULT_COST) { return; }
    ultCharge = Math.min(ULT_COST, ultCharge + n);
    if (ultCharge >= ULT_COST) {
      popText("必杀就绪", lion.x, lion.y - 132, "#ff8a3d");
      if (window.WHAudio2) { window.WHAudio2.sfx("ach"); }
    }
  }

  function fxNew() {
    var g = game.add.graphics(0, 0);
    fxG.add(g);
    return g;
  }

  function fadeOut(g, dur) {
    game.add.tween(g).to({ alpha: 0 }, dur, Phaser.Easing.Quadratic.Out, true)
      .onComplete.add(function () { g.destroy(); });
  }

  // One-shot bitmap effect: grows and fades. flip mirrors x so a directional effect
  // (slash/launch) points the same way the lion does.
  function fxSprite(key, x, y, scale, dur, flip, dy) {
    var s = game.add.image(x, y, key);
    s.anchor.setTo(0.5, 0.5);
    s.scale.setTo(flip ? -scale : scale, scale);
    fxG.add(s);
    var to = { alpha: 0 };
    if (dy) { to.y = y + dy; }
    game.add.tween(s).to(to, dur, Phaser.Easing.Quadratic.Out, true)
      .onComplete.add(function () { s.destroy(); });
    var grow = scale * 1.28;
    game.add.tween(s.scale).to({ x: flip ? -grow : grow, y: grow }, dur,
                     Phaser.Easing.Quadratic.Out, true);
    return s;
  }

  function ringFx(x, y, r0, r1, color, dur, lw) {
    var g = fxNew();
    g.lineStyle(lw || 4, color, 1);
    g.drawCircle(0, 0, r1);
    g.x = x;
    g.y = y;
    g.scale.setTo(r0 / r1);
    game.add.tween(g.scale).to({ x: 1, y: 1 }, dur, Phaser.Easing.Quadratic.Out, true);
    fadeOut(g, dur);
  }

  function burstFx(x, y, color, n, dist) {
    var g = fxNew();
    g.lineStyle(3, color, 0.95);
    var i;
    for (i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var r1 = dist * (0.55 + 0.45 * (i % 2));
      g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    }
    g.x = x;
    g.y = y;
    g.scale.setTo(0.35);
    game.add.tween(g.scale).to({ x: 1, y: 1 }, 320, Phaser.Easing.Cubic.Out, true);
    fadeOut(g, 340);
  }

  function shockFx(x, y, w, color) {
    var g = fxNew();
    g.lineStyle(3, color, 0.9);
    g.drawEllipse(0, 0, w, w * 0.30);
    g.x = x;
    g.y = y;
    g.scale.setTo(0.25);
    game.add.tween(g.scale).to({ x: 1, y: 1 }, 440, Phaser.Easing.Cubic.Out, true);
    fadeOut(g, 480);
  }

  function screenFlash(color, alpha, dur) {
    var g = fxNew();
    g.beginFill(color, alpha);
    g.drawRect(0, 0, W, H);
    g.endFill();
    fadeOut(g, dur);
  }

  function guardFx(x, y) {
    var g = fxNew();
    g.lineStyle(4, 0xcfe3f5, 0.95);
    g.drawCircle(0, 0, 30);
    g.x = x;
    g.y = y;
    g.scale.setTo(1.25);
    game.add.tween(g.scale).to({ x: 1, y: 1 }, 200, Phaser.Easing.Quadratic.Out, true);
    fadeOut(g, 240);
    popText("叮!", x, y - 40, "#cfe3f5");
  }

  function breakGuard(f, silent) {
    if (!f.data.guard) { return; }
    f.data.guard = false;
    f.data.guardFlash = 0.40;
    ringFx(f.x, f.y - 20, 18, 92, 0xcfe3f5, 320, 5);
    burstFx(f.x, f.y - 20, 0x9fe0ff, 8, 60);
    if (!silent) { popText("破防!", f.x, f.y - 62, "#9fe0ff"); }
    if (window.WHAudio2) { window.WHAudio2.sfx("guard"); }
  }

  function strikeFoe(f, dmg, label, pierce) {
    if (f.data.isBoss) { dmg = Math.max(1, dmg); }
    if (f.data.guard && !pierce) {
      f.data.guardFlash = 0.22;
      guardFx(f.x, f.y - 20);
      return 0;
    }
    f.data.hp -= dmg;
    impactFlash(f.x, f.y - 18);
    popText(label ? (label + " -" + dmg) : ("-" + dmg), f.x, f.y - 46, label ? "#ffe9b0" : "#ffffff");
    addCharge(CHARGE_HIT);
    score += 4 * dmg;
    if (f.data.kind === "fly" && !onGround) { airHits += 1; unlock("airhit"); }
    if (f.data.hp <= 0) { killFoe(f); }
    return dmg;
  }

  function tryParry() {
    if (phase !== "play" || parryCd > 0) { return; }
    parryT = PARRY_WIN;
    parryCd = PARRY_CD;
    parryWhiffed = false;
    fxSprite("fx-parry", lion.x, lion.y - 46, 0.34, 260, false, 0);
    ringFx(lion.x, lion.y - 46, 14, 76, 0x9fe0ff, 260, 4);
    if (window.WHAudio2) { window.WHAudio2.sfx("parry"); }
    probe.parries = (probe.parries || 0) + 1;
  }

  function parrySuccess(foe, bx, by) {
    parryT = 0;
    parryCd = Math.max(parryCd, PARRY_HIT_CD);
    parryHits += 1;
    if (parryHits >= 5) { unlock("parry5"); }
    addCharge(CHARGE_PARRY);
    score += 30;
    hitstopT = 110;
    game.camera.shake(0.012, 140);
    fxSprite("fx-parry", lion.x, lion.y - 46, 0.62, 300, false, 0);
    fxSprite("fx-hit", bx, by, 0.36, 260, false, 0);
    ringFx(lion.x, lion.y - 46, 20, 122, 0xffffff, 300, 5);
    screenFlash(0xffffff, 0.34, 180);
    popText("弹反!", lion.x, lion.y - 112, "#9fe0ff");
    if (foe && foe.data) {
      foe.data.hitT = 0.55;
      foe.data.knock = (foe.x >= lion.x ? 1 : -1) * 360;
      strikeFoe(foe, 1, "反", true);
    }
    if (window.WHAudio2) { window.WHAudio2.sfx("hit"); }
    refreshHud();
  }

  function damagePlayer(foe, bx, by) {
    if (parryT > 0) { parrySuccess(foe, bx, by); return true; }
    hurtPlayer();
    return false;
  }

  function trySweep() {
    if (phase !== "play" || sweepCd > 0) { return; }
    sweepCd = SWEEP_CD;
    fxSprite("fx-sweep", lion.x, GROUND + 8, 0.95, 380, false, 0);
    shockFx(lion.x, GROUND + 2, SWEEP_R * 2.2, 0xffd06a);
    burstFx(lion.x, lion.y - 34, 0xffe9b0, 10, 72);
    var hit = 0;
    foeG.forEachAlive(function (f) {
      var dx = f.x - lion.x;
      var dy = f.y - lion.y;
      if (dx * dx + dy * dy > SWEEP_R * SWEEP_R) { return; }
      f.data.hitT = 0.26;
      f.data.knock = (dx >= 0 ? 1 : -1) * 330;
      if (!f.data.isBoss) { f.data.vy = -190; }
      if (strikeFoe(f, 2, "扫堂") > 0) { hit += 1; }
    });
    if (hit > 0) {
      hitstopT = HITSTOP;
      game.camera.shake(0.010, 110);
      bump(hit);
      if (window.WHAudio2) { window.WHAudio2.sfx("hit"); }
    }
    if (window.WHAudio2) { window.WHAudio2.sfx("sweep"); }
    probe.sweeps = (probe.sweeps || 0) + 1;
  }

  function tryLaunch() {
    if (phase !== "play" || launchCd > 0) { return; }
    launchCd = LAUNCH_CD;
    var lx = lion.x + facing * 40;
    fxSprite("fx-launch", lx, lion.y - 74, 0.50, 380, facing < 0, -46);
    burstFx(lx, GROUND - 30, 0xc7a6ff, 8, 84);
    var hit = 0;
    foeG.forEachAlive(function (f) {
      var dx = f.x - lion.x;
      if (Math.abs(dx) > 160 || dx * facing < -40) { return; }
      if (f.data.guard) { breakGuard(f); }
      f.data.hitT = 0.32;
      f.data.knock = (dx >= 0 ? 1 : -1) * 70;
      if (!f.data.isBoss) {
        f.data.vy = -560;
        f.data.launchT = Math.max(f.data.launchT || 0, 1.0);
      }
      if (strikeFoe(f, LAUNCH_DMG, "冲天", true) > 0) { hit += 1; }
    });
    if (hit > 0) {
      hitstopT = HITSTOP;
      game.camera.shake(0.012, 120);
      bump(hit);
      if (window.WHAudio2) { window.WHAudio2.sfx("hit"); }
    }
    if (window.WHAudio2) { window.WHAudio2.sfx("launch"); }
    probe.launches = (probe.launches || 0) + 1;
  }

  function tryUlt() {
    if (phase !== "play") { return; }
    if (ultCharge < ULT_COST) {
      popText("蓄力 " + Math.round(ultCharge) + "%", lion.x, lion.y - 124, "#8fa8bf");
      if (window.WHAudio2) { window.WHAudio2.sfx("whiff"); }
      return;
    }
    if (ultLock > 0) { return; }
    ultCharge = 0;
    ultLock = ULT_LOCK;
    ultUsed += 1;
    unlock("ult");
    var tint = [0xff8a3d, 0xffe9b0, 0xffffff];
    var i;
    for (i = 0; i < 3; i++) {
      ringFx(lion.x, lion.y - 50, 30, 260 + i * 90, tint[i], 420 + i * 90, 6 - i);
    }
    fxSprite("fx-burst", lion.x, lion.y - 50, 0.95, 440, false, 0);
    shockFx(lion.x, GROUND + 2, W * 2.6, 0xff8a3d);
    screenFlash(0xffe9b0, 0.55, 300);
    var hit = 0;
    foeG.forEachAlive(function (f) {
      if (f.data.guard) { breakGuard(f, true); }
      f.data.hitT = 0.40;
      f.data.knock = (f.x >= lion.x ? 1 : -1) * 420;
      if (!f.data.isBoss) {
        f.data.vy = -300;
        f.data.launchT = Math.max(f.data.launchT || 0, 0.7);
      }
      if (strikeFoe(f, f.data.isBoss ? 6 : 4, "必杀", true) > 0) { hit += 1; }
    });
    hitstopT = 140;
    game.camera.shake(0.030, 320);
    if (window.WHAudio2) { window.WHAudio2.sfx("ult"); }
    if (hit > 0) { bump(hit); }
    probe.ults = (probe.ults || 0) + 1;
  }

  function attack() {
    if (atkT > 0 || atkCd > 0) { return; }
    atkT = ATK_TIME;
    atkCd = ATK_CD;
    var best = null;
    var bd = 1e9;
    foeG.forEachAlive(function (f) {
      var d = Math.abs(f.x - lion.x);
      if (d < bd) { bd = d; best = f; }
    });
    if (best) { facing = (best.x >= lion.x) ? 1 : -1; }
    attackSlash();
    if (window.WHAudio2) { window.WHAudio2.sfx("swing"); }
    probe.attacks = (probe.attacks || 0) + 1;
  }

  function attackSlash() {
    fxSprite("fx-slash", lion.x + facing * 52, lion.y - ATK_H * 0.45,
             0.42, 260, facing < 0, 0);
  }

  function sweepAttack() {
    var hx = facing > 0 ? lion.x + 10 : lion.x - ATK_W - 10;
    var box = new Phaser.Rectangle(hx, lion.y - ATK_H - 6, ATK_W, ATK_H);
    var hit = 0;
    foeG.forEachAlive(function (f) {
      if (f.data.hitT > 0) { return; }
      var fb = new Phaser.Rectangle(f.x - 42 * f.data.kr, f.y - 44 * f.data.kr,
                                    84 * f.data.kr, 88 * f.data.kr);
      if (!box.intersects(fb)) { return; }
      f.data.hitT = 0.22;
      f.angle = facing * 17;
      f.data.knock = facing * FOE_KNOCK;
      f.data.vy = f.data.isBoss ? 0 : -190;
      if (strikeFoe(f, 1) > 0) { hit += 1; }
    });
    if (hit > 0) {
      hitstopT = HITSTOP;
      game.camera.shake(0.008, 80);
      bump(hit);
      if (window.WHAudio2) { window.WHAudio2.sfx("hit"); }
      probe.lastHits = hit;
    }
  }

  function drawShadows() {
    shadPen.clear();
    var lift = Math.max(0, GROUND - physY);
    var la = Math.max(0.16, 0.48 - lift / 800);
    var lw = Math.max(26, 60 - lift / 16);
    shadPen.beginFill(0x05080d, la);
    shadPen.drawEllipse(lion.x, GROUND + 4, lw, lw * 0.22);
    shadPen.endFill();
    foeG.forEachAlive(function (f) {
      var def = FOE_DEF[f.data.kind];
      var h = Math.max(0, GROUND - 8 - f.y);
      var a = def.ground ? 0.40 : Math.max(0.08, 0.24 - h / 1400);
      shadPen.beginFill(0x05080d, a);
      shadPen.drawEllipse(f.x, GROUND + 4, def.shadow, def.shadow * 0.20);
      shadPen.endFill();
    });
    greenG.forEachAlive(function (g) {
      shadPen.beginFill(0x05080d, 0.20);
      shadPen.drawEllipse(g.x, GROUND + 4, 26, 6);
      shadPen.endFill();
    });
  }

  function impactFlash(x, y) {
    fxSprite("fx-hit", x, y, 0.26, 240, false, 0);
  }

  function bump(n) {
    combo += n;
    comboT = COMBO_WIN;
    if (combo > maxCombo) { maxCombo = combo; }
    if (combo >= 10) { unlock("combo10"); }
    if (combo > 1) {
      txtCombo.text = "×" + combo + " 连!";
      txtCombo.visible = true;
      txtCombo.scale.setTo(1.35);
    }
  }

  function killFoe(f) {
    var cx = f.x;
    var cy = f.y - 18;
    var isBoss = !!f.data.isBoss;
    f.destroy();
    kills += 1;
    unlock("first");
    addCharge(CHARGE_KILL);
    if (window.WHAudio2) { window.WHAudio2.sfx(isBoss ? "boss" : "kill"); }
    if (isBoss) {
      bossKills += 1;
      unlock("boss");
      score += 300;
      screenFlash(0xffe9b0, 0.50, 380);
      shockFx(cx, GROUND + 2, W * 2.2, 0xff8a3d);
      ringFx(cx, cy, 30, 300, 0xffd45e, 520, 7);
      game.camera.shake(0.030, 420);
      popText("门神已倒!", W * 0.5, GROUND - 210, "#ffd45e");
      dropGreen(cx - 34, cy, 3);
    } else {
      dropGreen(cx, cy, 1);
      popText("击倒!", cx, cy - 40, "#ffd98a");
    }
    refreshHud();
  }

  function dropGreen(x, y, n) {
    var i;
    var sc = 46 / texSize("pick-green").h;
    for (i = 0; i < n; i++) {
      var g = greenG.create(x + i * 34, y - i * 12, "pick-green");
      g.anchor.setTo(0.5, 0.5);
      g.scale.setTo(sc);
      g.data = { vy: -330 - i * 30, t: 0 };
    }
  }

  function addFoe(kind, fx) {
    if (fx > W - 40) { fx = 40 + (fx % 120); }
    var def = FOE_DEF[kind];
    var bd = kind === "boss" ? BOSS_DEF[Math.min(gate, BOSS_DEF.length - 1)] : null;
    var img = bd ? bd.img : def.img;
    var tex = texSize(img);
    var hgt = bd ? bd.hgt : def.hgt;
    var fscale = hgt / tex.h;
    // Foes are centre-anchored, the lion is bottom-anchored at GROUND. floor is the
    // centre y that lands this sheet's bottom edge on GROUND, so the physics clamp
    // in stepFoes must use it too -- clamping to a fixed y sinks every ground foe.
    var floor = GROUND - hgt / 2;
    var fy = def.ground ? floor : GROUND - 120;
    var f = foeG.create(fx, fy, img);
    f.anchor.setTo(0.5, 0.5);
    f.scale.setTo(fscale);
    f.data = {
      kind: kind, hitT: 0, knock: 0, vy: 0, ph: fx * 0.03, launchT: 0,
      chg: def.dash ? 1.2 : 0, wind: 0, dash: 0, guardFlash: 0,
      hp: bd ? bd.hp : def.hp, speed: bd ? bd.speed : def.speed,
      scale: fscale, kr: hgt / 116, w: tex.w * fscale, h: hgt,
      floor: floor, guard: !!def.guard, base: def.ground ? floor : GROUND - 120
    };
    if (def.keep) { f.data.fireCd = FIRE_CD * 0.6; }
    if (bd) {
      f.data.isBoss = true;
      f.data.bossName = bd.name;
      f.data.color = bd.color;
      f.data.maxHp = bd.hp;
      f.data.atks = bd.atks;
      f.data.atkIdx = 0;
      f.data.stage = 1;
      f.data.atkCd = 1.8;
      f.data.chg = 0;
    }
    impactFlash(fx, def.ground ? GROUND - 40 : GROUND - 150);
    return f;
  }

  function spawnWave() {
    wave += 1;
    waveHurt = 0;
    var last = wave >= GATES[gate].waves;
    var comp = [];
    var w;
    if (last) {
      comp.push("boss");
      comp.push("walk");
      if (gate >= 1) { comp.push("fly"); }
    } else {
      if (wave % 3 === 0) { comp.push("elite"); }
      var walk = Math.min(1 + Math.floor(wave / 2), 3);
      for (w = 0; w < walk; w++) { comp.push("walk"); }
      if (wave >= 2) { comp.push("fly"); }
      if (wave >= 3 && gate >= 1) { comp.push("ranged"); }
      if (wave >= 3 && gate >= 2) { comp.push("shield"); }
      if (wave >= 4) { comp.push("fly"); }
    }
    var i;
    for (i = 0; i < comp.length; i++) {
      var sx = comp[i] === "boss" ? W - 130 : lion.x + FOE_SPAWN_GAP + i * 54;
      addFoe(comp[i], sx);
    }
    if (last) {
      popText("门神现世", W * 0.5, GROUND - 236, "#ff8a3d");
      if (window.WHAudio2) { window.WHAudio2.sfx("boss"); }
    }
    refreshHud();
  }

  function stepPlay(dt) {
    playT += dt;
    if (invT > 0) {
      invT -= dt;
      lion.alpha = (Math.floor(invT * 20) % 2) ? 0.35 : 1;
    } else if (lion.alpha !== 1) {
      lion.alpha = 1;
    }

    var left = game.input.keyboard.isDown(Phaser.Keyboard.LEFT) || held("L");
    var right = game.input.keyboard.isDown(Phaser.Keyboard.RIGHT) || held("R");
    var up = game.input.keyboard.isDown(Phaser.Keyboard.UP) || held("J");
    var dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (held("A")) { attack(); }

    vx = dir * SPEED * puddleSlow();
    if (dir !== 0) { facing = dir; }
    if (jumpBuf > 0) { jumpBuf -= dt; }
    if ((up || jumpBuf > 0) && onGround) { vy = JUMP; onGround = false; jumpBuf = 0; }

    if (atkCd > 0) { atkCd -= dt; }
    if (sweepCd > 0) { sweepCd -= dt; }
    if (launchCd > 0) { launchCd -= dt; }
    if (ultLock > 0) { ultLock -= dt; }
    if (parryCd > 0) { parryCd -= dt; }
    if (parryT > 0) {
      parryT -= dt;
      if (parryT <= 0 && !parryWhiffed) {
        parryWhiffed = true;
        if (window.WHAudio2) { window.WHAudio2.sfx("whiff"); }
      }
    }
    if (atkT > 0) {
      atkT -= dt;
      vx = facing * 330;
    }
    var ak = atkT > 0 ? (atkT / ATK_TIME) : 0;

    var wasAir = !onGround;
    vy += GRAV * dt;
    lion.x += vx * dt;
    physY += vy * dt;
    if (physY >= GROUND) {
      if (wasAir && vy > 260) {
        landT = 0.16;
        shockFx(lion.x, GROUND + 2, 96, 0xffcf8a);
      }
      physY = GROUND;
      vy = 0;
      onGround = true;
    } else { onGround = false; }
    lion.x = Phaser.Math.clamp(lion.x, 34, W - 34);

    if (landT > 0) { landT -= dt; }
    if (hurtT > 0) { hurtT -= dt; }
    var moving = Math.abs(dir) > 0;
    var mseg = atkT > 0 ? "pounce" : (onGround && moving ? "walk" : "idle");
    var mBob = sampleMotion(mseg, playT, "bob");
    var mLean = sampleMotion(mseg, playT, "lean");
    var mSquash = sampleMotion(mseg, playT, "squash");
    var landSq = landT > 0 ? (landT / 0.16) * 0.20 : 0;
    var sq = Math.max(mSquash * SQ_GAIN, landSq);
    var stretch = onGround ? 0 : (vy < 0 ? 0.14 : -0.06);
    var hurtSq = hurtT > 0 ? 0.16 : 0;
    var guardSq = parryT > 0 ? 0.10 : 0;
    lion.scale.setTo(facing * LION_SCALE * (1.16 - 0.16 * ak) * (1 + sq * 0.85 - guardSq),
                     LION_SCALE * (0.85 + 0.15 * ak) * (1 - sq + stretch + hurtSq));
    lion.rotation = facing * mLean * LEAN_GAIN * DEG;
    lion.y = physY + mBob * BOB_GAIN * FH * LION_SCALE;
    lion.animations.play(atkT > 0 || Math.abs(dir) > 0 ? "walk" : "idle");
    probe.mseg = mseg;
    probe.mBob = mBob;
    probe.mLean = mLean;

    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) { combo = 0; txtCombo.visible = false; }
    }

    if (hitstopT > 0) {
      hitstopT -= dt * 1000;
      probe.hitstops = (probe.hitstops || 0) + 1;
      return;
    }

    if (atkT > 0) { sweepAttack(); }
    stepFoes(dt);
    stepBullets(dt);
    stepGreens(dt);
    stepHazards(dt);
    drawShadows();
    drawOverlay();

    if (score >= 2000) { unlock("rich"); }
    if (picks >= 30) { unlock("pick30"); }

    if (foeG.countLiving() === 0) {
      if (waveClearT <= 0) {
        waveClearT = 1.5;
        if (waveHurt === 0) { unlock("nohit"); }
        popText("清场!", W * 0.5, GROUND - 176, "#ffd98a");
        if (wave < GATES[gate].waves) {
          popText("第 " + (wave + 1) + " 阵", W * 0.5, GROUND - 232, "#8fd6ff");
        }
        if (window.WHAudio2) { window.WHAudio2.sfx("clear"); }
      } else {
        waveClearT -= dt;
        if (waveClearT <= 0) {
          if (wave < GATES[gate].waves) { spawnWave(); }
          else { nextGate(); }
        }
      }
    }
  }

  function nextGate() {
    gate += 1;
    wave = 0;
    waveClearT = 0;
    if (gate >= GATES.length) { finish(); return; }
    clearBullets();
    hazards = [];
    hazardG.clear();
    parryT = 0;
    phase = "wrap";
    wrapT = 0;
    veilOn(true);
    bigText.text = GATES[gate - 1].name + " · 已净";
    subText.text = "狮头转向「" + GATES[gate].name + "」——轻触继续";
    if (window.WHAudio2) { window.WHAudio2.sfx("gate"); }
  }

  function stepWrap(dt) {
    wrapT += dt;
  }

  function goNext() {
    if (wrapT < 0.35) { return; }
    phase = "play";
    veilOn(false);
    drawDeck();
    clearBullets();
    parryT = 0;
    parryCd = 0;
    hurtT = 0;
    lion.x = W * 0.22;
    lion.y = GROUND;
    physY = GROUND;
    vy = 0;
    hp = PLAYER_HP;
    invT = 1.0;
    refreshHud();
    spawnWave();
  }

  function stepFoes(dt) {
    foeG.forEachAlive(function (f) {
      var def = FOE_DEF[f.data.kind];
      var flash = 0;
      if (f.data.hitT > 0) { f.data.hitT -= dt; flash = 1; }
      if (f.data.guardFlash > 0) { f.data.guardFlash -= dt; }

      if (f.data.launchT > 0) {
        f.data.launchT -= dt;
        f.data.vy += GRAV * dt;
        f.y += f.data.vy * dt;
        if (f.y >= f.data.floor) { f.y = f.data.floor; f.data.vy = 0; }
        // Rebase a launched hoverer so it climbs back from the floor instead of snapping.
        if (f.data.launchT <= 0 && !def.ground) { f.data.base = f.y; }
      } else if (def.ground) {
        f.data.vy += GRAV * dt;
        f.y += f.data.vy * dt;
        if (f.y >= f.data.floor) { f.y = f.data.floor; f.data.vy = 0; }
      } else {
        f.data.ph += dt * 2.2;
        var dive = Math.max(0, 1 - Math.abs(f.x - lion.x) / 150);
        f.data.base += ((GROUND - 120 + dive * 74) - f.data.base) * Math.min(1, dt * 3);
        f.y = f.data.base + Math.sin(f.data.ph) * 12;
        f.data.vy = 0;
      }

      var spd = f.data.speed;
      if (def.boss) {
        spd = stepBoss(f, dt);
      } else if (def.keep) {
        spd = stepRanged(f, dt, spd);
      } else if (def.dash) {
        if (f.data.wind > 0) {
          f.data.wind -= dt;
          spd = 0;
          if (f.data.wind <= 0) {
            f.data.dash = 0.45;
            impactFlash(f.x, f.y - 20);
            game.camera.shake(0.010, 120);
            if (window.WHAudio2) { window.WHAudio2.sfx("gate"); }
          }
        } else if (f.data.dash > 0) {
          f.data.dash -= dt;
          spd = f.data.speed * 7;
        } else {
          f.data.chg -= dt;
          if (f.data.chg <= 0) {
            f.data.wind = 0.55;
            f.data.chg = 3.4;
            probe.eliteWinds = (probe.eliteWinds || 0) + 1;
          }
        }
      }

      var stand = LION_HALF + f.data.w * 0.5;
      if (Math.abs(f.data.knock) > 1) {
        f.x += f.data.knock * dt;
        f.data.knock *= 0.86;
      } else if (f.data.hitT <= 0 && spd !== 0) {
        var d = lion.x - f.x;
        var toward = (d > 0 ? 1 : -1) * spd;
        if (toward < 0 || Math.abs(d) > stand) { f.x += toward * dt; }
      }
      f.x = Phaser.Math.clamp(f.x, 26, W - 26);

      f.angle *= 0.84;
      if (Math.abs(f.angle) < 0.4) { f.angle = 0; }
      if (f.data.wind > 0) {
        var wp = 0.5 + 0.5 * Math.sin(playT * 30);
        shadPen.beginFill(0xff4a2a, 0.30 + 0.30 * wp);
        shadPen.drawEllipse(f.x, GROUND + 4, 150 - 30 * wp, 34);
        shadPen.endFill();
      }
      var sc = f.data.scale * (flash ? 1.30 : (f.data.wind > 0 ? 1.18 : 1));
      f.scale.setTo((lion.x > f.x ? 1 : -1) * sc, sc);
      f.alpha = flash ? 0.45 : 1;

      if (invT <= 0 && Math.abs(f.x - lion.x) < stand + 8 &&
          Math.abs(f.y - (lion.y - 30)) < 50 * f.data.kr) {
        damagePlayer(f, f.x, f.y);
      }
    });
  }

  function stepRanged(f, dt, spd) {
    var d = lion.x - f.x;
    var ad = Math.abs(d);
    if (ad < RANGED_KEEP - 20) { return -spd; }
    if (ad > RANGED_KEEP + 30) { return spd; }
    f.data.fireCd -= dt;
    if (f.data.fireCd <= 0) {
      f.data.fireCd = FIRE_CD;
      spawnBullet(f.x, f.y - 26, lion.x, lion.y - 40, BULLET_SPEED, 0x8fd6ff, 0);
      if (window.WHAudio2) { window.WHAudio2.sfx("shoot"); }
      probe.shots = (probe.shots || 0) + 1;
    }
    return 0;
  }

  function stepBoss(f, dt) {
    var d = f.data;
    var hpFrac = d.hp / d.maxHp;
    var stage = hpFrac > 0.66 ? 1 : (hpFrac > 0.33 ? 2 : 3);
    if (stage > d.stage) {
      d.stage = stage;
      d.wind = 0;
      d.dash = 0;
      d.atkCd = 0.7;
      ringFx(f.x, f.y - 40, 40, 232, 0xff4a2a, 420, 6);
      screenFlash(0xff4a2a, 0.22, 220);
      popText(d.bossName + " 第" + stage + "阶", f.x, f.y - 130, "#ff8a3d");
      if (window.WHAudio2) { window.WHAudio2.sfx("boss"); }
      game.camera.shake(0.018, 240);
    }
    if (d.wind > 0) {
      d.wind -= dt;
      if (d.wind <= 0) { resolveBossWind(f); }
      return 0;
    }
    if (d.dash > 0) {
      d.dash -= dt;
      return d.speed * (4 + d.stage);
    }
    d.atkCd -= dt;
    if (d.atkCd <= 0) { beginBossWind(f); return 0; }
    return d.speed * (1 + (d.stage - 1) * 0.30);
  }

  function beginBossWind(f) {
    var d = f.data;
    d.pending = d.atks[d.atkIdx % d.atks.length];
    d.atkIdx += 1;
    d.wind = d.pending === "slam" ? 0.55 : (d.pending === "volley" ? 0.42 : 0.30);
    probe.bossWinds = (probe.bossWinds || 0) + 1;
  }

  function resolveBossWind(f) {
    var d = f.data;
    if (d.pending === "slam") {
      d.dash = 0.5;
      impactFlash(f.x, f.y - 20);
      shockFx(f.x, GROUND + 2, 260, 0xff4a2a);
      game.camera.shake(0.014, 160);
      if (window.WHAudio2) { window.WHAudio2.sfx("hit"); }
      if (Math.abs(f.x - lion.x) < 130 && onGround) {
        damagePlayer(f, lion.x, GROUND - 30);
      }
    } else if (d.pending === "volley") {
      var n = 3 + d.stage;
      var i;
      for (i = 0; i < n; i++) {
        spawnBullet(f.x, f.y - 30, lion.x, lion.y - 40,
                    BULLET_SPEED * (1 + d.stage * 0.06), 0xff8a3d,
                    (i - (n - 1) / 2) * 0.16);
      }
      if (window.WHAudio2) { window.WHAudio2.sfx("shoot"); }
    } else {
      var k = d.stage >= 3 ? 2 : 1;
      var j;
      for (j = 0; j < k; j++) {
        addFoe((j + d.atkIdx) % 2 === 0 ? "walk" : "fly", lion.x + 150 + j * 54);
      }
      if (window.WHAudio2) { window.WHAudio2.sfx("summon"); }
    }
    d.atkCd = [0, 2.8, 2.1, 1.5][d.stage];
  }

  function spawnBullet(x, y, tx, ty, speed, color, spread) {
    var ang = Math.atan2(ty - y, tx - x) + (spread || 0);
    var ca = Math.cos(ang);
    var sa = Math.sin(ang);
    var g = game.add.graphics(0, 0);
    g.beginFill(color, 0.55);
    g.moveTo(0, 0);
    g.lineTo(-ca * 24 + sa * 6, -sa * 24 - ca * 6);
    g.lineTo(-ca * 24 - sa * 6, -sa * 24 + ca * 6);
    g.lineTo(0, 0);
    g.endFill();
    g.beginFill(color, 1);
    g.drawCircle(0, 0, BULLET_R);
    g.endFill();
    g.beginFill(0xffffff, 0.85);
    g.drawCircle(0, 0, BULLET_R * 0.42);
    g.endFill();
    g.x = x;
    g.y = y;
    bulletG.add(g);
    bullets.push({ g: g, vx: ca * speed, vy: sa * speed, x: x, y: y, t: 0 });
  }

  function clearBullets() {
    var i;
    for (i = 0; i < bullets.length; i++) { bullets[i].g.destroy(); }
    bullets = [];
  }

  function stepBullets(dt) {
    var i;
    for (i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.x = b.x;
      b.g.y = b.y;
      var dead = b.t > 4 || b.x < -30 || b.x > W + 30 || b.y < -40 || b.y > H + 30;
      if (!dead && invT <= 0) {
        var dx = b.x - lion.x;
        var dy = b.y - (lion.y - 40);
        if (dx * dx + dy * dy < 26 * 26) {
          damagePlayer(null, b.x, b.y);
          dead = true;
        }
      }
      if (dead) {
        b.g.destroy();
        bullets.splice(i, 1);
      }
    }
  }

  function buildHazards() {
    hazards = [];
    hazT = 0;
    var h = GATES[gate].hazard;
    if (h === "lantern") {
      // Long rope, small swing: a short one would arc far above the lion's hit line.
      hazards.push({ type: "swing", x: W * 0.32, y: 64, len: 510, amp: 0.20, ph: 0 });
      hazards.push({ type: "swing", x: W * 0.70, y: 64, len: 505, amp: 0.24, ph: 2.1 });
    } else if (h === "bamboo") {
      hazards.push({ type: "pend", x: W * 0.50, y: GROUND - 176, len: 152, amp: 1.00, ph: 0, w: 12 });
      hazards.push({ type: "pend", x: W * 0.22, y: GROUND - 150, len: 122, amp: 0.80, ph: 2.6, w: 10 });
    } else if (h === "puddle") {
      hazards.push({ type: "puddle", x: W * 0.30, w: 116 });
      hazards.push({ type: "puddle", x: W * 0.68, w: 96 });
    }
  }

  function stepHazards(dt) {
    hazardG.clear();
    if (hazards.length === 0) { return; }
    hazT += dt;
    var i;
    for (i = 0; i < hazards.length; i++) {
      var hz = hazards[i];
      if (hz.type === "puddle") {
        hazardG.beginFill(0x6fd0e0, 0.18);
        hazardG.drawEllipse(hz.x, GROUND + 8, hz.w, 16);
        hazardG.endFill();
        hazardG.lineStyle(1, 0x9fe0ff, 0.30);
        hazardG.drawEllipse(hz.x, GROUND + 8, hz.w, 16);
        continue;
      }
      var ang = hz.amp * Math.sin(hazT * (hz.type === "pend" ? 1.5 : 0.9) + hz.ph);
      hz.bx = hz.x + Math.sin(ang) * hz.len;
      hz.by = hz.y + Math.cos(ang) * hz.len;
      hazardG.lineStyle(hz.w || 3, 0x8a6a4a, 0.9);
      hazardG.moveTo(hz.x, hz.y);
      hazardG.lineTo(hz.bx, hz.by);
      if (hz.type === "swing") {
        hazardG.beginFill(0xff8a3d, 0.9);
        hazardG.drawCircle(hz.bx, hz.by, 20);
        hazardG.endFill();
        hazardG.beginFill(0xffe9b0, 0.5);
        hazardG.drawCircle(hz.bx, hz.by, 9);
        hazardG.endFill();
      } else {
        hazardG.lineStyle(hz.w, 0xd8b46a, 0.85);
        hazardG.moveTo(hz.bx - 34, hz.by);
        hazardG.lineTo(hz.bx + 34, hz.by);
      }
      if (invT <= 0) {
        var ddx = hz.bx - lion.x;
        var ddy = hz.by - (lion.y - 40);
        if (ddx * ddx + ddy * ddy < 1600) { damagePlayer(null, hz.bx, hz.by); }
      }
    }
  }

  function puddleSlow() {
    var i;
    for (i = 0; i < hazards.length; i++) {
      if (hazards[i].type === "puddle" &&
          Math.abs(lion.x - hazards[i].x) < hazards[i].w * 0.5) { return 0.55; }
    }
    return 1;
  }

  function drawOverlay() {
    overlayPen.clear();
    // The boss halo lives on the layer behind the foes: drawn on top it reads as a ring
    // pasted over the sprite and chops the silhouette up.
    bossAuraG.clear();
    if (parryT > 0) {
      var pf = 1 - parryT / PARRY_WIN;
      overlayPen.lineStyle(4, 0x9fe0ff, 0.85 - 0.5 * pf);
      overlayPen.drawCircle(lion.x, lion.y - 46, 44 + 22 * pf);
      overlayPen.lineStyle(2, 0xffffff, 0.55 - 0.4 * pf);
      overlayPen.drawCircle(lion.x, lion.y - 46, 62 + 14 * pf);
    }
    foeG.forEachAlive(function (f) {
      if (f.data.guard) {
        overlayPen.lineStyle(3, 0xcfe3f5, 0.75);
        overlayPen.drawCircle(f.x, f.y, f.data.w * 0.48);
        overlayPen.lineStyle(1, 0x9fe0ff, 0.35);
        overlayPen.drawCircle(f.x, f.y, f.data.w * 0.54);
      }
      if (f.data.guardFlash > 0) {
        overlayPen.lineStyle(4, 0xffffff, Math.min(1, f.data.guardFlash * 2.2));
        overlayPen.drawCircle(f.x, f.y, f.data.w * 0.60);
      }
      if (f.data.isBoss) {
        var col = f.data.color;
        var bh = f.data.h;
        var pulse = 0.5 + 0.5 * Math.sin(playT * 6);
        bossAuraG.lineStyle(6, col, 0.30 + 0.26 * pulse);
        bossAuraG.drawCircle(f.x, f.y, bh * 0.60 + 8 * pulse);
        if (f.data.wind > 0) {
          bossAuraG.lineStyle(7, 0xffe9b0, 0.80);
          bossAuraG.drawCircle(f.x, f.y, bh * 0.64 - 8 * pulse);
        }
      }
    });
  }

  function drawBossBar() {
    bossBarG.clear();
    var b = null;
    foeG.forEachAlive(function (f) { if (f.data && f.data.isBoss) { b = f; } });
    if (!b || phase !== "play") {
      txtBoss.visible = false;
      txtBossTag.visible = false;
      return;
    }
    var bw = W - 72;
    var bx = 36;
    var by = 70;
    bossBarG.beginFill(0x05080d, 0.72);
    bossBarG.drawRect(bx, by, bw, 12);
    bossBarG.endFill();
    bossBarG.beginFill(0xff4a2a, 0.95);
    bossBarG.drawRect(bx + 1, by + 1, (bw - 2) * Math.max(0, b.data.hp / b.data.maxHp), 10);
    bossBarG.endFill();
    bossBarG.lineStyle(1, 0xc9a227, 0.85);
    bossBarG.drawRect(bx, by, bw, 12);
    txtBoss.text = b.data.bossName + " · 第 " + b.data.stage + " 阶　" +
      Math.max(0, b.data.hp) + " / " + b.data.maxHp;
    txtBoss.visible = true;
    txtBossTag.text = b.data.bossName;
    txtBossTag.x = Phaser.Math.clamp(b.x, 56, W - 56);
    txtBossTag.y = b.y - b.data.h * 0.5 - b.data.h * 0.07;
    txtBossTag.visible = true;
  }

  function drawCtl() {
    ctlFxG.clear();
    if (phase !== "play") { return; }
    var a0 = -Math.PI / 2;
    var i;
    for (i = 0; i < ctlHit.length; i++) {
      var b = ctlHit[i];
      if (b.charge) {
        var cf = ultCharge / ULT_COST;
        ctlFxG.lineStyle(4, cf >= 1 ? 0xffd45e : 0xff8a3d, cf >= 1 ? 1 : 0.8);
        ctlFxG.arc(b.x, b.y, b.r - 4, a0, a0 + cf * Math.PI * 2, false);
        if (cf < 1) {
          ctlFxG.beginFill(0x05080d, 0.55);
          ctlFxG.moveTo(b.x, b.y);
          ctlFxG.arc(b.x, b.y, b.r - 1, a0 + cf * Math.PI * 2, a0 + Math.PI * 2, false);
          ctlFxG.lineTo(b.x, b.y);
          ctlFxG.endFill();
        }
        continue;
      }
      var rem = b.cdGet ? b.cdGet() : 0;
      if (rem > 0 && b.cdMax) {
        var frac = Math.min(1, rem / b.cdMax);
        ctlFxG.beginFill(0x05080d, 0.68);
        ctlFxG.moveTo(b.x, b.y);
        ctlFxG.arc(b.x, b.y, b.r - 1, a0, a0 + frac * Math.PI * 2, false);
        ctlFxG.lineTo(b.x, b.y);
        ctlFxG.endFill();
      }
    }
  }

  function hurtPlayer() {
    hp -= 1;
    waveHurt += 1;
    invT = INV_TIME;
    hurtT = 0.22;
    hitstopT = 90;
    combo = 0;
    txtCombo.visible = false;
    // No vertical launch here: it overwrote an in-progress jump and left the player
    // permanently airborne, off the enemies' ground line. Knockback/hitstop/shake suffice.
    lion.x += (lion.x < W * 0.5 ? -1 : 1) * 30;
    foeG.forEachAlive(function (f) {
      var d = f.x - lion.x;
      f.data.knock = (d >= 0 ? 1 : -1) * 300;
      f.data.vy = -230;
      f.data.hitT = 0.30;
    });
    game.camera.shake(0.022, 240);
    impactFlash(lion.x, lion.y - 60);
    popText("受伤", lion.x, lion.y - 96, "#ff6a4a");
    if (window.WHAudio2) { window.WHAudio2.sfx("hurt"); }
    probe.hurts = (probe.hurts || 0) + 1;
    refreshHud();
    if (hp <= 0) { downed(); }
  }

  function downed() {
    hp = PLAYER_HP;
    invT = 2.0;
    combo = 0;
    hurtT = 0;
    parryT = 0;
    clearBullets();
    lion.x = W * 0.22;
    lion.y = GROUND;
    physY = GROUND;
    vy = 0;
    refreshHud();
    popText("再起", W * 0.5, GROUND - 160, "#ff6a4a");
    if (window.WHAudio2) { window.WHAudio2.sfx("down"); }
  }

  function stepGreens(dt) {
    greenG.forEachAlive(function (g) {
      g.data.t += dt;
      g.data.vy += GRAV * 0.55 * dt;
      g.y += g.data.vy * dt;
      if (g.y >= GROUND - 16) { g.y = GROUND - 16; g.data.vy = 0; }
      g.angle += 120 * dt;

      if (Math.abs(g.x - lion.x) < 40 && Math.abs(g.y - (lion.y - 34)) < 70) {
        var gain = PICK_SCORE * Math.max(1, combo);
        picks += 1;
        score += gain;
        addCharge(CHARGE_PICK);
        popText("+" + gain, g.x, g.y - 20, "#b9e07a");
        fxSprite("fx-spark", g.x, g.y, 0.42, 300, false, -22);
        if (window.WHAudio2) { window.WHAudio2.sfx("pick"); }
        g.destroy();
        refreshHud();
      } else if (g.data.t > 14) {
        g.destroy();
      }
    });
  }

  function popText(s, x, y, color) {
    var t = game.add.text(x, y, s, { font: "bold 22px sans-serif", fill: color });
    t.anchor.setTo(0.5, 0.5);
    popG.add(t);
    game.add.tween(t).to({ y: y - 50, alpha: 0 }, 720, Phaser.Easing.Quadratic.Out, true)
      .onComplete.add(function () { t.destroy(); });
  }

  function rank() {
    var s = 0;
    if (score >= 2800) { s += 2; } else if (score >= 1700) { s += 1; }
    if (playT <= 210) { s += 1; }
    if (maxCombo >= 12) { s += 1; }
    if (Object.keys(got).length >= 7) { s += 1; }
    if (s >= 4) { return "S"; }
    if (s >= 2) { return "A"; }
    return "B";
  }

  function showCard() {
    if (cardShown || !cardCv) { return; }
    var url = paintCard();
    if (!url) { return; }
    cardShown = true;
    game.load.image("sharecard", url);
    game.load.onLoadComplete.addOnce(function () {
      // Hide the result panel first: the card is taller than its centring gap and clipped the title.
      endGroup.forEach(function (c) { c.visible = false; });
      var img = game.add.image(W * 0.5, H * 0.5 - 40, "sharecard");
      img.anchor.setTo(0.5, 0.5);
      img.scale.setTo(Math.min((W - 76) / img.width, (H - 380) / img.height));
      endGroup.add(img);
      if (ctaText) {
        ctaText.text = "长按图片 · 保存分享";
        ctaText.visible = true;
      }
    });
    game.load.start();
  }

  function finish() {
    phase = "end";
    unlock("clear");
    clearBullets();
    hazards = [];
    hazardG.clear();
    parryT = 0;
    foeG.forEachAlive(function (f) { f.destroy(); });
    greenG.forEachAlive(function (g) { g.destroy(); });
    veilOn(true);
    dlgG.visible = false;
    skipText.visible = false;
    bigText.visible = false;
    subText.visible = false;

    endGroup.removeAll(true);
    cardShown = false;

    var panel = game.add.graphics(0, 0);
    panel.beginFill(0x0a1420, 0.92);
    panel.drawRect(30, 96, W - 60, 500);
    panel.endFill();
    panel.lineStyle(2, 0xc9a227, 0.55);
    panel.drawRect(30, 96, W - 60, 500);
    panel.endFill();
    panel.beginFill(0xc9a227, 0.6);
    panel.drawRect(30, 96, W - 60, 3);
    panel.endFill();
    endGroup.add(panel);

    var r = rank();
    var title = game.add.text(W * 0.5, 142, "吐青送福", {
      font: "bold 34px serif", fill: "#ffe9b0", align: "center"
    });
    title.anchor.setTo(0.5, 0.5);
    endGroup.add(title);

    var wrapLine = game.add.text(W * 0.5, 190, "锣鼓重新响起来了。", {
      font: "15px sans-serif", fill: "#8fa8bf", align: "center"
    });
    wrapLine.anchor.setTo(0.5, 0.5);
    endGroup.add(wrapLine);

    var rankT = game.add.text(W * 0.5, 258, "评级 " + r, {
      font: "bold 42px serif", align: "center",
      fill: r === "S" ? "#ffd45e" : (r === "A" ? "#e8d3a0" : "#cfe0ef")
    });
    rankT.anchor.setTo(0.5, 0.5);
    endGroup.add(rankT);

    var stats = game.add.text(W * 0.5, 330,
      "五门皆净 · 采青 " + picks + " · 击倒 " + kills + "\n" +
      "得分 " + score + " · 最高连击 ×" + maxCombo + "\n" +
      "用时 " + Math.round(playT) + " 秒 · 弹反 " + parryHits + " · 门神 " + bossKills,
      { font: "14px sans-serif", fill: "#cfe0ef", align: "center", lineSpacing: 5 });
    stats.anchor.setTo(0.5, 0.5);
    endGroup.add(stats);

    var half = Math.ceil(ACHS.length / 2);
    var colA = [];
    var colB = [];
    var i;
    for (i = 0; i < ACHS.length; i++) {
      var mark = (got[ACHS[i].id] ? "★ " : "☆ ") + ACHS[i].name;
      if (i < half) { colA.push(mark); } else { colB.push(mark); }
    }
    var achA = game.add.text(40, 402, colA.join("\n"), {
      font: "12px sans-serif", fill: "#9fb6cc", lineSpacing: 5
    });
    achA.anchor.setTo(0, 0);
    endGroup.add(achA);
    var achB = game.add.text(W * 0.5 + 14, 402, colB.join("\n"), {
      font: "12px sans-serif", fill: "#9fb6cc", lineSpacing: 5
    });
    achB.anchor.setTo(0, 0);
    endGroup.add(achB);

    ctaText = game.add.text(W * 0.5, 552, "轻触 · 生成分享卡", {
      font: "bold 15px sans-serif", fill: "#0b1420", align: "center",
      backgroundColor: "#ffd45e"
    });
    ctaText.anchor.setTo(0.5, 0.5);
    ctaText.padding.setTo(16, 9);
    endGroup.add(ctaText);

    if (window.WHAudio2) {
      window.WHAudio2.sfx("win");
      window.WHAudio2.musicStop();
    }
    probe.rank = r;
    probe.finished = true;
  }

  function paintCard() {
    var c = cardCv;
    c.width = 750;
    c.height = 1000;
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, 1000);
    g.addColorStop(0, "#12202f");
    g.addColorStop(1, "#05080d");
    x.fillStyle = g;
    x.fillRect(0, 0, 750, 1000);
    x.strokeStyle = "#7a3a20";
    x.lineWidth = 4;
    x.strokeRect(28, 28, 694, 944);
    x.textAlign = "center";
    x.fillStyle = "#ffe9b0";
    x.font = "bold 66px serif";
    x.fillText("醒 狮 采 青", 375, 156);
    x.fillStyle = "#ff8a3d";
    x.font = "26px sans-serif";
    x.fillText("大坑舞狮 · 非遗 醒狮", 375, 206);
    x.fillStyle = "#ffd98a";
    x.font = "bold 132px serif";
    x.fillText(rank(), 375, 420);
    x.fillStyle = "#cfe0ef";
    x.font = "30px sans-serif";
    x.fillText("采青 " + picks + "　击倒 " + kills + "　最高连击 ×" + maxCombo, 375, 510);
    x.fillText("得分 " + score + "　弹反 " + parryHits + "　用时 " + Math.round(playT) + " 秒", 375, 562);
    x.strokeStyle = "#7a3a20";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(140, 612);
    x.lineTo(610, 612);
    x.stroke();
    x.font = "21px sans-serif";
    var i;
    var half = Math.ceil(ACHS.length / 2);
    for (i = 0; i < ACHS.length; i++) {
      var on = got[ACHS[i].id];
      x.fillStyle = on ? "#b9e07a" : "#4a5a68";
      x.fillText((on ? "★ " : "☆ ") + ACHS[i].name + "　" + ACHS[i].desc,
                 i < half ? 195 : 555, 672 + (i < half ? i : i - half) * 42);
    }
    x.fillStyle = "#8fa8bf";
    x.font = "22px sans-serif";
    x.fillText("年关已过 · 福气随狮入户", 375, 940);
    return c.toDataURL("image/png");
  }

  window.__wh2 = {
    card: function () { return paintCard(); },
    achievements: function () { return ACHS; },
    got: function () { return Object.keys(got); },
    rank: rank,
    finish: finish,
    tap: tap,
    parry: tryParry,
    skill1: trySweep,
    skill2: tryLaunch,
    ult: tryUlt,
    charge: function () { return Math.round(ultCharge); },
    setCharge: function (n) { ultCharge = Math.max(0, Math.min(ULT_COST, n)); return ultCharge; },
    spawnElite: function () { return addFoe("elite", lion.x + 170); },
    spawnFly: function () { return addFoe("fly", lion.x + 150); },
    spawnRanged: function () { return addFoe("ranged", lion.x + 150); },
    spawnShield: function () { return addFoe("shield", lion.x + 150); },
    spawnBoss: function () { return addFoe("boss", W - 130); },
    gotoGate: function (n) {
      if (phase === "end") { return -1; }
      phase = "play";
      veilOn(false);
      skipText.visible = false;
      gate = Math.max(0, Math.min(GATES.length - 1, n));
      wave = 0;
      waveClearT = 0;
      clearBullets();
      foeG.forEachAlive(function (f) { f.destroy(); });
      greenG.forEachAlive(function (g) { g.destroy(); });
      drawDeck();
      spawnWave();
      refreshHud();
      return gate;
    },
    hazards: function () { return hazards; },
    state: function () {
      return {
        phase: phase, gate: gate, wave: wave, hp: hp,
        parryT: parryT, parryCd: parryCd, ultCharge: Math.round(ultCharge),
        sweepCd: sweepCd, launchCd: launchCd, bullets: bullets.length,
        foes: foeG.countLiving(), bossHp: probe.bossHp
      };
    },
    phase: function () { return phase; }
  };
})();
