/* 3D 引擎：场景/碎片/拖拽吸附/显色/转台 */
window.Engine3D = (function () {
  var renderer = null, scene = null, camera = null;
  var group = null, ghostGroup = null;
  var pieces = [];
  var anims = [];
  var dragging = null;
  var dragPlane = new THREE.Plane();
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var canvasEl = null;
  var mode = "assemble";
  var turnYaw = 0, turnVel = 0, turnDrag = null;
  var orbit = null;
  var orbitDrag = null;
  var downPos = null;
  var dragMoved = false;
  var lastSnapDbg = null;
  var polishProgress = 0;
  var polishLast = null;
  var polishedCount = 0;
  var onPolishCb = null;
  var IDENTITY_QUAT = new THREE.Quaternion();
  var onSnapCb = null, onAllCb = null;
  var rng = mulberry32(20260815);
  var dbgCount = { downs: 0, picks: 0, moves: 0, ups: 0, snaps: 0 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function init(canvas) {
    canvasEl = canvas;
    // preserveDrawingBuffer:true 才能 toDataURL 截图（发笔记/存相册）
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    } catch (e) {
      showFatal("当前环境不支持 WebGL，无法渲染 3D");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d2b33);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    orbit = { yaw: 0, pitch: 0.12, dist: 34, target: new THREE.Vector3(0, 0.6, 0) };
    updateCamera();

    scene.add(new THREE.HemisphereLight(0xcfd8dc, 0x2a2218, 0.65));
    var key = new THREE.DirectionalLight(0xfff2dd, 1.15);
    key.position.set(6, 9, 7);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xbfd4e0, 0.4);
    fill.position.set(-7, 3, -4);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffd9a0, 0.55);
    rim.position.set(-2, 6, -8);
    scene.add(rim);

    scene.environment = makeEnv();

    group = new THREE.Group();
    scene.add(group);
    ghostGroup = new THREE.Group();
    scene.add(ghostGroup);

    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvasEl) return;
    var w = canvasEl.clientWidth || window.innerWidth;
    var h = canvasEl.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    if (!orbit) return;
    var cp = Math.cos(orbit.pitch);
    camera.position.set(
      orbit.target.x + orbit.dist * Math.sin(orbit.yaw) * cp,
      orbit.target.y + orbit.dist * Math.sin(orbit.pitch),
      orbit.target.z + orbit.dist * Math.cos(orbit.yaw) * cp
    );
    camera.lookAt(orbit.target);
  }

  function makeEnv() {
    var size = 64;
    function face(draw) {
      var cv = document.createElement("canvas");
      cv.width = cv.height = size;
      draw(cv.getContext("2d"));
      return cv;
    }
    function vgrad(g, top, bottom) {
      var gr = g.createLinearGradient(0, 0, 0, size);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bottom);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    }
    var faces = [
      face(function (g) { vgrad(g, "#cfd4da", "#4a4438"); }),
      face(function (g) { vgrad(g, "#b8bdc4", "#403a30"); }),
      face(function (g) { g.fillStyle = "#f0ece0"; g.fillRect(0, 0, size, size); }),
      face(function (g) { g.fillStyle = "#2a2620"; g.fillRect(0, 0, size, size); }),
      face(function (g) { vgrad(g, "#e8dcc0", "#5a4c38"); }),
      face(function (g) { vgrad(g, "#a8adb4", "#383228"); })
    ];
    var cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    var pmrem = new THREE.PMREMGenerator(renderer);
    var env = pmrem.fromCubemap(cube).texture;
    pmrem.dispose();
    return env;
  }

  var texLoader = new THREE.TextureLoader();
  function tex(name, srgb) {
    var t = texLoader.load("./assets/models/" + name);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.flipY = false;
    return t;
  }

  function makePBR(prefix) {
    return new THREE.MeshStandardMaterial({
      map: tex(prefix + "_base.jpg", true),
      metalnessMap: tex(prefix + "_mr.jpg"),
      roughnessMap: tex(prefix + "_mr.jpg"),
      normalMap: tex(prefix + "_norm.jpg"),
      metalness: 1.0,
      roughness: 1.0
    });
  }

  function makeBuried(prefix) {
    return new THREE.MeshStandardMaterial({
      map: tex(prefix + "_base.jpg", true),
      normalMap: tex(prefix + "_norm.jpg"),
      color: 0x8a7a62,
      metalness: 0.05,
      roughness: 0.95
    });
  }

  var ghostMat = new THREE.MeshBasicMaterial({
    color: 0xd8a24a, transparent: true, opacity: 0.07,
    depthWrite: false
  });

  // 手机上无法看 console，致命错误直接显示在页面上
  function showFatal(msg) {
    var el = document.getElementById("fatal");
    if (!el) {
      el = document.createElement("div");
      el.id = "fatal";
      el.style.cssText = "position:fixed;left:12px;right:12px;top:60px;z-index:99;" +
        "background:rgba(195,39,43,0.92);color:#fff;font-size:12px;line-height:1.5;" +
        "padding:10px 12px;border-radius:8px;word-break:break-all;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.textContent = "加载出错：" + msg;
  }

  // 从内嵌二进制构建网格（pos|nor|uv|faces），不经 GLTFLoader，避免 fetch
  function buildMesh(bytes) {
    var dv = new DataView(bytes.buffer);
    var headerLen = dv.getUint32(0, true);
    var headerStr = "";
    for (var i = 0; i < headerLen; i++) headerStr += String.fromCharCode(bytes[4 + i]);
    var header = JSON.parse(headerStr);
    var v = header.v, fc = header.f;
    var off = 4 + headerLen;
    var pos = new Float32Array(bytes.slice(off, off + v * 12).buffer); off += v * 12;
    var nor = new Float32Array(bytes.slice(off, off + v * 12).buffer); off += v * 12;
    var uv = new Float32Array(bytes.slice(off, off + v * 8).buffer); off += v * 8;
    var faces = new Uint32Array(bytes.slice(off, off + fc * 12).buffer);
    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setIndex(new THREE.BufferAttribute(faces, 1));
    return new THREE.Mesh(geom);
  }

  // files: [{glb, mat}], mats: {matKey: {pbr, buried}}
  function load(files, mats, onReady) {
    var left = files.length;
    var failed = false;
    files.forEach(function (f) {
      var key = f.glb.replace(/\.glb$/, "");
      var b64 = window.WenwuModels && window.WenwuModels[key];
      if (!b64) { if (!failed) { failed = true; showFatal("缺少模型数据 " + key); } return; }
      var mesh;
      try {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
        mesh = buildMesh(bytes);
      } catch (e) {
        if (!failed) { failed = true; showFatal("几何构建失败 " + key + " " + (e && e.message)); }
        return;
      }
      mesh.material = mats[f.mat].buried;
      mesh.userData.pbr = mats[f.mat].pbr;
      mesh.userData.locked = false;
      // 重心归中：几何平移到局部原点，mesh.position 即碎片中心 → 旋转=原地转
      mesh.geometry.computeBoundingBox();
      var c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      mesh.geometry.translate(-c.x, -c.y, -c.z);
      var rotAxis = c.lengthSq() > 0.01 ? c.clone().normalize() : new THREE.Vector3(0, 1, 0);
      mesh.userData.home = { pos: c.clone(), quat: new THREE.Quaternion() };
      mesh.userData.rotAxis = rotAxis;
      group.add(mesh);
      var ghost = mesh.clone();
      ghost.material = ghostMat;
      ghost.position.copy(c);
      ghost.quaternion.identity();
      ghostGroup.add(ghost);
      pieces.push(mesh);
      left--;
      if (left === 0) {
        scatter();
        if (onReady) onReady();
      }
    });
  }

  function scatter() {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var a = rng() * Math.PI * 2;
      var r = 1.5 + rng() * 2.0;
      var x = Math.cos(a) * r * 1.1;
      x = Math.max(-3.2, Math.min(3.2, x));
      p.position.set(x, -1.5 - rng() * 2.4, 2 + Math.sin(a) * r * 0.4);
      // 绕自身轴随机转 0-3 个 90°（点按可还原到 identity）
      var steps = Math.floor(rng() * 4);
      p.quaternion.setFromAxisAngle(p.userData.rotAxis, steps * Math.PI / 2);
      p.userData.locked = false;
    }
  }

  function setRay(x, y) {
    var rect = canvasEl.getBoundingClientRect();
    ndc.x = ((x - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
  }

  var tmpV = new THREE.Vector3();
  var ORIGIN = new THREE.Vector3(0, 0, 0);
  var camDir = new THREE.Vector3();

  var tmpBox = null;
  function pieceScreenCenter(p) {
    if (!tmpBox) tmpBox = new THREE.Box3();
    tmpBox.setFromObject(p);
    tmpBox.getCenter(tmpV);
    tmpV.project(camera);
    var rect = canvasEl.getBoundingClientRect();
    return {
      x: (tmpV.x + 1) / 2 * rect.width + rect.left,
      y: (1 - tmpV.y) / 2 * rect.height + rect.top
    };
  }

  function targetScreen() {
    tmpV.copy(ORIGIN).project(camera);
    var rect = canvasEl.getBoundingClientRect();
    return {
      x: (tmpV.x + 1) / 2 * rect.width + rect.left,
      y: (1 - tmpV.y) / 2 * rect.height + rect.top
    };
  }

  function pointerDown(x, y) {
    if (mode === "turntable") {
      turnDrag = { x: x, yaw: turnYaw };
      return;
    }
    if (mode === "polish") {
      polishLast = { x: x, y: y };
      return;
    }
    if (mode !== "assemble") return;
    dbgCount.downs++;
    setRay(x, y);
    var unlocked = pieces.filter(function (p) { return !p.userData.locked; });
    var hits = raycaster.intersectObjects(unlocked, false);
    if (hits.length > 0) dbgCount.picks++;
    if (hits.length > 0) {
      dragging = hits[0].object;
      // 拖拽平面过碎片位置、垂直相机；锚点直接跟指针（确定性、可吸附）
      camera.getWorldDirection(camDir);
      dragPlane.setFromNormalAndCoplanarPoint(camDir, dragging.position);
      downPos = { x: x, y: y };
      dragMoved = false;
      return true;
    }
    // 空白处 → 环绕视角
    orbitDrag = { x: x, y: y };
    return false;
  }

  function pointerMove(x, y) {
    if (mode === "turntable" && turnDrag) {
      var dyaw = (x - turnDrag.x) * 0.01;
      turnYaw = turnDrag.yaw + dyaw;
      turnVel = dyaw * 0.3;
      return;
    }
    if (mode === "polish" && polishLast) {
      var d = Math.hypot(x - polishLast.x, y - polishLast.y);
      polishLast = { x: x, y: y };
      if (d > 0) addPolish(d);
      return;
    }
    if (dragging) {
      if (downPos && Math.hypot(x - downPos.x, y - downPos.y) > 8) dragMoved = true;
      if (!dragMoved) return;
      dbgCount.moves++;
      setRay(x, y);
      if (raycaster.ray.intersectPlane(dragPlane, tmpV)) {
        dragging.position.copy(tmpV);
      }
      return;
    }
    if (orbitDrag && mode === "assemble") {
      var dx = x - orbitDrag.x;
      var dy = y - orbitDrag.y;
      orbit.yaw -= dx * 0.006;
      orbit.pitch += (orbitDrag.y - y) * 0.004;
      orbit.pitch = Math.max(-0.1, Math.min(0.75, orbit.pitch));
      orbitDrag = { x: x, y: y };
    }
  }

  function projectVec(v) {
    tmpV.copy(v).project(camera);
    var rect = canvasEl.getBoundingClientRect();
    return {
      x: (tmpV.x + 1) / 2 * rect.width + rect.left,
      y: (1 - tmpV.y) / 2 * rect.height + rect.top
    };
  }

  // 擦亮：摩擦距离累计进度，按进度逐片从土锈换回青铜 PBR
  function addPolish(d) {
    if (polishProgress >= 1) return;
    polishProgress = Math.min(1, polishProgress + d * 0.0016);
    var n = pieces.length;
    var target = Math.floor(polishProgress * n + 0.0001);
    while (polishedCount < target && polishedCount < n) {
      var p = pieces[polishedCount];
      if (p && p.userData.pbr) {
        p.material = p.userData.pbr;
        if (window.Sound) window.Sound.revealTick(polishedCount, n);
      }
      polishedCount++;
    }
    if (polishedCount >= n && onPolishCb) {
      var cb = onPolishCb;
      onPolishCb = null;
      setTimeout(cb, 400);
    }
  }

  function startPolish(onDone) {
    mode = "polish";
    polishProgress = 0;
    polishedCount = 0;
    polishLast = null;
    onPolishCb = onDone;
    ghostGroup.visible = false;
  }

  function polishProg() { return polishProgress; }

  // 演示模式：自动拼合 → 自动擦亮 → 回调（跳过 quiz，直接到成品）
  function startDemo(onDone) {
    mode = "assemble";
    ghostGroup.visible = true;
    pieces.forEach(function (p, i) {
      setTimeout(function () {
        p.userData.locked = true;
        anims.push({ mesh: p, t: 0, dur: 0.5, fromPos: p.position.clone(), fromQuat: p.quaternion.clone() });
        if (window.Sound) window.Sound.lock();
      }, 500 + i * 260);
    });
    var assemblyDone = 500 + pieces.length * 260 + 900;
    setTimeout(function () {
      startPolish(function () { if (onDone) onDone(); });
      var iv = setInterval(function () {
        if (polishProgress >= 1) { clearInterval(iv); return; }
        addPolish(60);
      }, 80);
    }, assemblyDone);
  }

  function meshPosScreen(p) {
    return projectVec(p.position);
  }

  function pointerUp() {
    if (mode === "turntable") { turnDrag = null; return; }
    if (mode === "polish") { polishLast = null; return; }
    orbitDrag = null;
    if (!dragging) return;
    dbgCount.ups++;
    var p = dragging;
    dragging = null;
    // 点按（未拖动）→ 原地旋转 90°
    if (!dragMoved) {
      var q = new THREE.Quaternion().setFromAxisAngle(p.userData.rotAxis, Math.PI / 2);
      p.quaternion.premultiply(q);
      if (window.Sound) window.Sound.pickup();
      return false;
    }
    // 拖拽 → 吸附判定：位置靠近归中位 且 朝向接近 identity
    var pc = projectVec(p.position);
    var tc = projectVec(p.userData.home.pos);
    var posOk = Math.hypot(pc.x - tc.x, pc.y - tc.y) < 150;
    var rotOk = p.quaternion.angleTo(IDENTITY_QUAT) < 0.4;
    lastSnapDbg = { pc: pc, tc: tc, dist: +Math.hypot(pc.x - tc.x, pc.y - tc.y).toFixed(1), posOk: posOk, rotOk: rotOk };
    if (posOk && rotOk) {
      dbgCount.snaps++;
      p.userData.locked = true;
      anims.push({ mesh: p, t: 0, dur: 0.28, fromPos: p.position.clone(), fromQuat: p.quaternion.clone() });
      if (onSnapCb) onSnapCb();
      var all = pieces.every(function (qq) { return qq.userData.locked; });
      if (all && onAllCb) setTimeout(onAllCb, 400);
      return true;
    }
    return false;
  }

  var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };

  function update(dt) {
    if (!renderer) return;
    updateCamera();
    for (var i = anims.length - 1; i >= 0; i--) {
      var a = anims[i];
      a.t += dt;
      var k = easeOutCubic(Math.min(1, a.t / a.dur));
      a.mesh.position.lerpVectors(a.fromPos, a.mesh.userData.home.pos, k);
      a.mesh.quaternion.slerpQuaternions(a.fromQuat, a.mesh.userData.home.quat, k);
      if (a.t >= a.dur) anims.splice(i, 1);
    }
    if (mode === "turntable") {
      if (!turnDrag) {
        turnVel *= 0.95;
        turnYaw += turnVel + dt * 0.25;
      }
      group.rotation.y = turnYaw;
      ghostGroup.visible = false;
    }
    renderer.render(scene, camera);
  }

  // 显色仪式：逐片换回 PBR 材质
  function reveal(onDone) {
    mode = "reveal";
    var order = pieces.slice();
    order.forEach(function (p, i) {
      setTimeout(function () {
        p.material = p.userData.pbr;
        if (window.Sound) window.Sound.revealTick(i, order.length);
        if (i === order.length - 1 && onDone) setTimeout(onDone, 500);
      }, 300 + i * 260);
    });
    ghostGroup.visible = false;
  }

  function setTurntable() {
    mode = "turntable";
    turnYaw = 0;
    turnVel = 0;
    ghostGroup.visible = false;
  }

  function setCallbacks(onSnap, onAll) {
    onSnapCb = onSnap;
    onAllCb = onAll;
  }

  function resetForReplay() {
    mode = "assemble";
    anims.length = 0;
    dragging = null;
    ghostGroup.visible = true;
    group.rotation.y = 0;
    pieces.forEach(function (p) {
      p.material = p.userData.buriedRef || p.material;
    });
    scatter();
  }

  function rememberBuried() {
    pieces.forEach(function (p) { p.userData.buriedRef = p.material; });
  }

  // 截图：渲染当前帧并导出 PNG dataURL（需 preserveDrawingBuffer）
  function captureRestored() {
    if (!renderer) return null;
    renderer.render(scene, camera);
    try {
      return canvasEl.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  // 无头测试钩子：返回碎片屏幕坐标（锚点投影，与吸附判定一致）
  function debugPieces() {
    return pieces.map(function (p) {
      var c = meshPosScreen(p);
      c.locked = p.userData.locked;
      return c;
    });
  }

  function debugTarget() {
    return targetScreen();
  }

  // 测试钩子：碎片 i 一个稳定抓取点（朝三角面片质心射线，必中面片内部）
  function debugGrab(i) {
    var p = pieces[i];
    if (!p || p.userData.locked) return null;
    p.updateMatrixWorld();
    var pos = p.geometry.attributes.position;
    var idx = p.geometry.index;
    var triCount = Math.floor((idx ? idx.count : pos.count) / 3);
    var step = Math.max(1, Math.floor(triCount / 50));
    var va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    var centroid = new THREE.Vector3();
    var dir = new THREE.Vector3();
    var rect = canvasEl.getBoundingClientRect();
    for (var t = 0; t < triCount; t += step) {
      var i0, i1, i2;
      if (idx) { i0 = idx.getX(t * 3); i1 = idx.getX(t * 3 + 1); i2 = idx.getX(t * 3 + 2); }
      else { i0 = t * 3; i1 = t * 3 + 1; i2 = t * 3 + 2; }
      va.fromBufferAttribute(pos, i0).applyMatrix4(p.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(p.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(p.matrixWorld);
      centroid.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);
      dir.copy(centroid).sub(camera.position).normalize();
      raycaster.set(camera.position, dir);
      var hits = raycaster.intersectObject(p, false);
      if (hits.length > 0) {
        var v = hits[0].point.clone().project(camera);
        var sx = (v.x + 1) / 2 * rect.width + rect.left;
        var sy = (1 - v.y) / 2 * rect.height + rect.top;
        if (sx > 2 && sx < rect.width - 2 && sy > 2 && sy < rect.height - 2) {
          return { x: sx, y: sy };
        }
      }
    }
    return null;
  }

  return {
    init: init,
    load: load,
    makePBR: makePBR,
    makeBuried: makeBuried,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp: pointerUp,
    update: update,
    reveal: reveal,
    startPolish: startPolish,
    polishProg: polishProg,
    startDemo: startDemo,
    setTurntable: setTurntable,
    setCallbacks: setCallbacks,
    resetForReplay: resetForReplay,
    rememberBuried: rememberBuried,
    captureRestored: captureRestored,
    debugPieces: debugPieces,
    debugTarget: debugTarget,
    debugGrab: debugGrab,
    debugCount: function () { return dbgCount; },
    debugOrbit: function () { return orbit ? { yaw: +orbit.yaw.toFixed(3), pitch: +orbit.pitch.toFixed(3) } : null; },
    debugHome: function (i) {
      var p = pieces[i];
      return p ? projectVec(p.userData.home.pos) : null;
    },
    debugRot: function (i) {
      var p = pieces[i];
      return p ? +p.quaternion.angleTo(IDENTITY_QUAT).toFixed(3) : null;
    },
    debugSnapDbg: function () { return lastSnapDbg; },
    debugTap: function (i) {
      var p = pieces[i];
      if (!p || p.userData.locked) return null;
      var q = new THREE.Quaternion().setFromAxisAngle(p.userData.rotAxis, Math.PI / 2);
      p.quaternion.premultiply(q);
      return +p.quaternion.angleTo(IDENTITY_QUAT).toFixed(3);
    },
    resize: resize
  };
})();
