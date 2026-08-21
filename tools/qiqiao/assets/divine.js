(function () {
  var D = window.QQData;
  var S = {
    phase: "home", t: 0, waterP: 0, calmT: 0, calmValue: 0,
    needleY: 0, moonlight: 0.5, revealP: 0, result: null,
    rng: null, lastShadowId: "", holding: false
  };
  var cb = {};
  var testMode = /[?&]test=1/.test(location.search);
  var dropP = 0, dropWait = -1;
  var DROP_TIME = 0.5, DROP_DELAY = 0.4;

  function emit(n, a) { if (cb[n]) cb[n](a); }

  function weightedIndex(weights, total) {
    var r = S.rng.next() * total, i;
    for (i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  function unlockedMap() {
    var m = {}, sv = null, i;
    if (window.QQSave) { try { sv = window.QQSave.load(); } catch (e) { sv = null; } }
    if (sv && sv.codex) { for (i = 0; i < sv.codex.length; i++) m[sv.codex[i]] = true; }
    return m;
  }

  function pickShadow() {
    var list = D.SHADOWS, weights = [], total = 0, i, w, idx;
    var unlocked = unlockedMap();
    for (i = 0; i < list.length; i++) {
      w = list[i].luck === "zhuo" ? D.ZHUO_WEIGHT : D.JI_WEIGHT;
      if (!unlocked[list[i].id]) w *= D.UNLOCK_BOOST;
      weights.push(w);
      total += w;
    }
    idx = weightedIndex(weights, total);
    if (list[idx].id === S.lastShadowId) {
      total -= weights[idx];
      weights[idx] = 0;
      if (total > 0) idx = weightedIndex(weights, total);
    }
    return list[idx];
  }

  function pickAspect() {
    return D.ASPECTS[Math.floor(S.rng.next() * D.ASPECTS.length)];
  }

  function pickGrade(calmValue) {
    var skew = [0.9, 0.5, 0, -0.4, -0.9];
    var k = (calmValue - 50) / 50;
    var weights = [], total = 0, i, w;
    for (i = 0; i < D.GRADES.length; i++) {
      w = D.GRADES[i].weightBase * (1 + k * skew[i]);
      if (w < 0.001) w = 0.001;
      weights.push(w);
      total += w;
    }
    return D.GRADES[weightedIndex(weights, total)];
  }

  function computeResult() {
    if (!S.rng) S.rng = window.QQRng(testMode ? 20260819 : (Date.now() >>> 0));
    var shadow = pickShadow();
    var aspect = pickAspect();
    var grade = pickGrade(S.calmValue);
    var runs = 0, o;
    if (window.QQSave) { try { runs = window.QQSave.load().runs; } catch (e) { runs = 0; } }
    var result = {
      shadow: shadow, shadowId: shadow.id,
      aspect: aspect, aspectId: aspect.id,
      grade: grade, gradeId: grade.id,
      calmValue: S.calmValue,
      knowIdx: runs % D.FACTS.length
    };
    if (window.QQSave) {
      try {
        window.QQSave.unlock(shadow.id);
        o = window.QQSave.load();
        o.runs += 1;
        o.lastShadow = shadow.id;
        window.QQSave.save(o);
      } catch (e) {}
    }
    S.lastShadowId = shadow.id;
    return result;
  }

  function start() {
    S.rng = window.QQRng(testMode ? 20260819 : (Date.now() >>> 0));
    S.phase = "water";
    S.t = 0; S.waterP = 0; S.calmT = 0; S.calmValue = 0;
    S.needleY = 0; S.moonlight = 0.5; S.revealP = 0;
    S.result = null; S.holding = false;
    dropP = 0; dropWait = -1;
    emit("start");
  }

  function update(dt) {
    S.t += dt;
    if (S.phase === "water") {
      if (S.holding) {
        S.waterP += dt / D.FILL_TIME;
        if (S.waterP >= 1) {
          S.waterP = 1;
          S.phase = "calm";
          S.calmT = 0;
          if (window.QQScene) window.QQScene.ripple(1);
          emit("filled");
        }
      }
    } else if (S.phase === "calm") {
      S.calmT += dt;
    } else if (S.phase === "drop") {
      if (dropWait >= 0) {
        dropWait -= dt;
        if (dropWait <= 0) { S.phase = "reveal"; S.revealP = 0; S.result = computeResult(); }
      } else {
        dropP += dt / DROP_TIME;
        if (dropP >= 1) {
          dropP = 1;
          S.needleY = 1;
          if (window.QQScene) window.QQScene.ripple(1.5);
          emit("dropped");
          dropWait = DROP_DELAY;
        } else {
          S.needleY = dropP * dropP;
        }
      }
    } else if (S.phase === "reveal") {
      S.revealP += dt / D.REVEAL_TIME;
      if (S.revealP >= 1) {
        S.revealP = 1;
        S.moonlight = 1;
        S.phase = "result";
        if (!S.result) { S.result = computeResult(); }
        emit("revealed");
        emit("result", S.result);
      } else {
        S.moonlight = 0.5 + 0.5 * S.revealP;
      }
    }
  }

  function holdWater(on) { S.holding = !!on; }

  function releaseCalm() {
    if (S.phase !== "calm") return;
    var phasePos = (S.calmT % D.CALM_CYCLE) / D.CALM_CYCLE;
    var dev = Math.abs(phasePos - 1);
    S.calmValue = Math.round(Math.max(0, 100 - dev * 220));
    S.phase = "drop";
    S.needleY = 0;
    dropP = 0; dropWait = -1;
    emit("calmed");
  }

  function dropNeedle() { if (S.phase === "calm") releaseCalm(); }

  function snapshot() {
    var o = {
      phase: S.phase, t: S.t, waterP: S.waterP, calmT: S.calmT,
      calmValue: S.calmValue, needleY: S.needleY, moonlight: S.moonlight,
      revealP: S.revealP, lastShadowId: S.lastShadowId, holding: S.holding,
      result: null
    };
    if (S.result) {
      o.result = {
        shadowId: S.result.shadowId, aspectId: S.result.aspectId,
        gradeId: S.result.gradeId, calmValue: S.result.calmValue,
        knowIdx: S.result.knowIdx
      };
    }
    return o;
  }

  window.QQDivine = {
    start: start,
    update: update,
    holdWater: holdWater,
    releaseCalm: releaseCalm,
    dropNeedle: dropNeedle,
    snapshot: snapshot,
    setCallback: function (n, fn) { cb[n] = fn; },
    emit: emit
  };

  window.__game = {
    snapshot: snapshot,
    start: start,
    holdWater: holdWater,
    releaseCalm: releaseCalm,
    dropNeedle: dropNeedle,
    setCalm: function (v) { S.calmValue = v; },
    forcePhase: function (p) { S.phase = p; },
    unlockAll: function () {
      if (window.QQSave) {
        var o = window.QQSave.load();
        o.codex = window.QQData.SHADOWS.map(function (s) { return s.id; });
        window.QQSave.save(o);
      }
    },
    save: function () { return window.QQSave ? window.QQSave.load() : null; }
  };
})();
