/* T0 prototype: 竹简观兵 visual proof (rolled bundle -> unroll -> flat mat w/ text) */
(function () {
  "use strict";
  var THREE = window.THREE;
  var err = document.getElementById("err");
  var canvas = document.getElementById("stage");
  var gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) { err.style.display = "flex"; return; }

  var W = innerWidth, H = innerHeight;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.REVISION && parseInt(THREE.REVISION) >= 155) renderer.useLegacyLights = true;
  if (THREE.ACESFilmicToneMapping !== undefined) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
  }

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a12);
  scene.fog = new THREE.Fog(0x070a12, 18, 34);

  var camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 60);
  window.T0REV = THREE.REVISION;

  /* ---------- helpers ---------- */
  var rand = (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  function smoother(t) { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- procedural textures ---------- */
  function makeCanvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  function bambooStripTexture(text) {
    var c = makeCanvas(1024, 64), x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#e6c189"); g.addColorStop(0.5, "#d9b37a"); g.addColorStop(1, "#c9a05f");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 64);
    for (var i = 0; i < 260; i++) { // fibers
      x.globalAlpha = 0.04 + rand() * 0.05;
      x.fillStyle = rand() < 0.5 ? "#8a6a3a" : "#f3dcae";
      x.fillRect(rand() * 1024, rand() * 64, 1, 2 + rand() * 5);
    }
    x.globalAlpha = 0.5; // 简头简尾 darker cut ends
    var eg = x.createLinearGradient(0, 0, 20, 0);
    eg.addColorStop(0, "#7a5b33"); eg.addColorStop(1, "rgba(122,91,51,0)");
    x.fillStyle = eg; x.fillRect(0, 0, 20, 64);
    var eg2 = x.createLinearGradient(1024, 0, 1004, 0);
    eg2.addColorStop(0, "#7a5b33"); eg2.addColorStop(1, "rgba(122,91,51,0)");
    x.fillStyle = eg2; x.fillRect(1004, 0, 20, 64);
    x.globalAlpha = 0.22; // 竹节
    x.fillStyle = "#8a6a3a"; x.fillRect(480, 0, 3, 64);
    x.globalAlpha = 1;
    if (text) { // ink column along strip length
      var kai = "'Kaiti SC','STKaiti','KaiTi','Noto Serif SC',serif";
      x.fillStyle = "#221a10"; x.textAlign = "center"; x.textBaseline = "middle";
      var chars = text.split("");
      for (var k = 0; k < chars.length; k++) {
        var px = 110 + k * 92;
        x.font = "700 46px " + kai;
        x.globalAlpha = 0.28; x.fillText(chars[k], px + 2, 34 + (rand() - 0.5) * 4);
        x.globalAlpha = 0.92; x.fillText(chars[k], px, 32 + (rand() - 0.5) * 3);
        x.globalAlpha = 1;
      }
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4; return t;
  }

  function bundleTexture() {
    var c = makeCanvas(512, 512), x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "#e0bd86"); g.addColorStop(0.5, "#d2a96c"); g.addColorStop(1, "#c39a5e");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.globalAlpha = 0.5; x.strokeStyle = "#7a5b33"; // strip seams around bundle
    for (var i = 0; i < 10; i++) {
      x.lineWidth = 1.2; x.beginPath(); x.moveTo(i * 51.2 + 25, 0); x.lineTo(i * 51.2 + 25, 512); x.stroke();
    }
    x.globalAlpha = 0.22; x.fillStyle = "#3c2a16"; // end of strips irregular
    for (var j = 0; j < 90; j++) { x.fillRect(rand() * 512, rand() * 512, 1.5, 1 + rand() * 4); }
    x.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(24, 1); t.anisotropy = 4; return t;
  }

  function hubTexture() {
    var c = makeCanvas(256, 256), x = c.getContext("2d");
    var g = x.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, "#4a3318"); g.addColorStop(0.55, "#8a6636"); g.addColorStop(1, "#b08a4e");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "#3a2a14"; x.lineWidth = 2;
    for (var r = 40; r < 124; r += 14) { x.beginPath(); x.arc(128, 128, r, 0, 6.2832); x.stroke(); }
    x.fillStyle = "#1d140a"; x.beginPath(); x.arc(128, 128, 12, 0, 6.2832); x.fill();
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  function woodTexture() {
    var c = makeCanvas(512, 256), x = c.getContext("2d");
    x.fillStyle = "#241610"; x.fillRect(0, 0, 512, 256);
    for (var i = 0; i < 220; i++) {
      x.globalAlpha = 0.05 + rand() * 0.08;
      x.fillStyle = rand() < 0.5 ? "#4a2f1a" : "#170e08";
      var sy = rand() * 256, len = 12 + rand() * 90;
      x.fillRect(rand() * 512, sy, len, 1);
    }
    x.globalAlpha = 0.25; x.strokeStyle = "#0f0a05"; x.lineWidth = 3; // plank joints
    x.beginPath(); x.moveTo(170, 0); x.lineTo(170, 256); x.moveTo(341, 0); x.lineTo(341, 256); x.stroke();
    x.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
  }

  /* ---------- stage ---------- */
  var tableY = 0.55;
  var plinth = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, tableY, 2.1),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85, metalness: 0.05 })
  );
  plinth.position.y = tableY / 2; plinth.receiveShadow = true; scene.add(plinth);

  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* ---------- rolled bundle ---------- */
  var bundle = new THREE.Group();
  var shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 3.4, 48),
    new THREE.MeshStandardMaterial({ map: bundleTexture(), roughness: 0.7, metalness: 0 })
  );
  shaft.rotation.z = Math.PI / 2; shaft.castShadow = true; bundle.add(shaft);
  var hubGeo = new THREE.CircleGeometry(0.29, 40);
  var hubMat = new THREE.MeshStandardMaterial({ map: hubTexture(), roughness: 0.75 });
  var hubL = new THREE.Mesh(hubGeo, hubMat); hubL.rotation.y = Math.PI / 2; hubL.position.x = -1.7; bundle.add(hubL);
  var hubR = new THREE.Mesh(hubGeo, hubMat); hubR.rotation.y = -Math.PI / 2; hubR.position.x = 1.7; bundle.add(hubR);
  var cordMat = new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.95 });
  [-1.0, 0, 1.0].forEach(function (cx) {
    var cord = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.014, 8, 40), cordMat);
    cord.rotation.y = Math.PI / 2; cord.position.x = cx; bundle.add(cord);
  });
  bundle.position.set(0, tableY + 0.3, 0);
  bundle.castShadow = true; scene.add(bundle);

  /* ---------- strips (unrolled mat) ---------- */
  var STRIP_N = 24, SPACING = 0.067;
  var PHRASES = ["孙子曰", "兵者，国之大事", "死生之地", "存亡之道", "不可不察也"];
  var strips = [];
  for (var i = 0; i < STRIP_N; i++) {
    var z0 = (i - 11.5) * SPACING;
    var text = PHRASES[i - 9] || "";
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.016, 0.062),
      new THREE.MeshStandardMaterial({ map: bambooStripTexture(text), roughness: 0.72, metalness: 0 })
    );
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { z0: z0, rotOff: rand() * 0.06 - 0.03, lift: 0.35 + rand() * 0.18 };
    scene.add(mesh); strips.push(mesh);
  }

  /* ---------- lights ---------- */
  var amb = new THREE.AmbientLight(0x111b2e, 0.4); scene.add(amb);
  var spot = new THREE.SpotLight(0xffd98a, 2.4, 30, 0.55, 0.4, 1);
  spot.position.set(4.4, 8.6, 3.6); spot.target.position.set(0, 0.7, 0.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 1; spot.shadow.camera.far = 30; spot.shadow.camera.fov = 45;
  scene.add(spot); scene.add(spot.target);
  var warm = new THREE.PointLight(0xe8b84b, 1.0, 16, 2); warm.position.set(2.6, 2.8, 2.9); scene.add(warm);
  var cool = new THREE.PointLight(0x5b7c96, 0.55, 18, 2); cool.position.set(-3.2, 2.4, -2.6); scene.add(cool);

  // 光锥
  var cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 3.4, 9.5, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cone.position.copy(spot.position).add(spot.target.position).multiplyScalar(0.5);
  cone.lookAt(spot.target.position); scene.add(cone);

  /* ---------- dust ---------- */
  var dustGeo = new THREE.BufferGeometry();
  var dN = 420, dp = new Float32Array(dN * 3), offs = new Float32Array(dN);
  for (var d = 0; d < dN; d++) {
    dp[d * 3] = (rand() - 0.5) * 11;
    dp[d * 3 + 1] = 0.2 + rand() * 4.4;
    dp[d * 3 + 2] = (rand() - 0.5) * 7;
    offs[d] = rand() * 6.2832;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffdfa0, size: 0.018, transparent: true, opacity: 0.5,
    sizeAttenuation: true, depthWrite: false
  }));
  scene.add(dust);

  /* ---------- camera presets / orbit ---------- */
  if (location.search.indexOf("dbg=text") !== -1) {
    for (var di = 0; di < STRIP_N; di++) {
      if (PHRASES[di - 9]) {
        strips[di].material = new THREE.MeshBasicMaterial({ color: 0xff2211 });
      }
    }
  }
  var presets = {
    rolled:  { eye: [4.8, 3.5, 7.2], target: [0, 0.75, 0] },
    mid:     { eye: [3.7, 2.8, 5.6], target: [0, 0.6, 0.55] },
    flat:    { eye: [3.3, 3.0, 5.2], target: [0, 0.55, 0.62] },
    closeup: { eye: [1.7, 1.5, 0.9], target: [0, 0.55, -0.02] }
  };
  var Q = new THREE.Vector3(), T = new THREE.Vector3();
  function applyPreset(name) {
    var p = presets[name];
    Q.set(p.eye[0], p.eye[1], p.eye[2]);
    T.set(p.target[0], p.target[1], p.target[2]);
    sceneState = name;
  }
  var sceneState = "rolled", unrollP = 0, spd = 0.05;
  var drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0, dist: 0 };
  function updateDrag() {
    var d = Q.clone().sub(T);
    drag.dist = d.length();
    drag.yaw = Math.atan2(d.x, d.z);
    drag.pitch = Math.asin(clamp(d.y / drag.dist, -1, 1));
  }
  updateDrag();
  canvas.addEventListener("pointerdown", function (e) { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag.on) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.yaw -= dx * 0.006; drag.pitch -= dy * 0.005;
    drag.pitch = clamp(drag.pitch, 0.08, 1.35);
    var cp = Math.cos(drag.pitch), sp = Math.sin(drag.pitch);
    Q.set(T.x + drag.dist * Math.sin(drag.yaw) * cp, T.y + drag.dist * sp, T.z + drag.dist * Math.cos(drag.yaw) * cp);
    sceneState = "free";
  });
  canvas.addEventListener("pointerup", function () { drag.on = false; updateDrag(); });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    drag.dist = clamp(drag.dist + e.deltaY * 0.008, 4.2, 15);
    var cp = Math.cos(drag.pitch), sp = Math.sin(drag.pitch);
    Q.set(T.x + drag.dist * Math.sin(drag.yaw) * cp, T.y + drag.dist * sp, T.z + drag.dist * Math.cos(drag.yaw) * cp);
    sceneState = "free";
  }, { passive: false });

  function setState(s) { if (presets[s]) applyPreset(s); }

  var qs = new URLSearchParams(location.search);
  if (presets[qs.get("s")]) applyPreset(qs.get("s"));

  /* ---------- frame loop ---------- */
  var cVec = Q.clone(), tVec = T.clone();
  function frame(now) {
    var t = now * 0.001;
    // animate strips toward current unrollP (0 rolled / 1 flat)
    for (var i = 0; i < STRIP_N; i++) {
      var m = strips[i], u = m.userData;
      var arrive = i / (STRIP_N - 1);
      var s = smoother(clamp((unrollP - arrive) / 0.28, 0, 1));
      var lift = (1 - s) * u.lift;
      m.rotation.x = (1 - s) * Math.PI / 2;
      m.position.z = lerp(0.08, u.z0, s);
      m.position.y = tableY + 0.008 + lift;
      m.position.x = u.rotOff * (1 - s) * 2.4;
    }
    // dust drift
    var posAttr = dust.geometry.attributes.position;
    for (var j = 0; j < dN; j++) {
      posAttr.array[j * 3 + 1] += Math.sin(t * 0.4 + offs[j]) * 0.00022;
      if (posAttr.array[j * 3 + 1] > 5) posAttr.array[j * 3 + 1] = 0.2;
    }
    posAttr.needsUpdate = true;
    // bundle lifts slightly at open distance
    bundle.position.y = tableY + 0.26 + Math.sin(t * 0.6) * 0.012;

    cVec.lerp(Q, spd); tVec.lerp(T, spd);
    camera.position.copy(cVec); camera.lookAt(tVec);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  window.__t0 = { setState: setState, getState: function () { return sceneState; } };
  window.__t0Ready = true;
  requestAnimationFrame(frame);
  addEventListener("resize", function () {
    W = innerWidth; H = innerHeight;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });

  /* demo: ?demo=1 plays rolled->mid->flat->closeup */
  if (qs.get("demo") === "1") {
    var seq = [["rolled", 0], ["mid", 1.2], ["flat", 3.2], ["closeup", 5.4]];
    var seg = 0;
    setTimeout(function tick() {
      if (seg < seq.length) {
        var cur = seq[seg][0], until = seq[seg][1];
        var to = seq[seg + 1];
        applyPreset(cur);
        if (to) {
          var dur = to[1] - until;
          var st = performance.now();
          (function run() {
            var p = clamp((performance.now() - st) / (dur * 1000), 0, 1);
            unrollP = (cur === "rolled" || cur === "mid") ? p : 1;
            if (p < 1) requestAnimationFrame(run);
            else { seg++; setTimeout(tick, 450); }
          })();
        }
      }
    }, 300);
  }
})();
