/**
 * 本地存储
 * 数据只存在当前设备：优先用容器 Storage（9.46+，加密写入），否则退回浏览器存储。
 * 不接云存储、不上报、不采集任何与记录无关的信息。
 */
(function (global) {
  'use strict';

  var KEY = 'yueli.record.v1';
  var SCHEMA = 1;

  function blank() {
    return {
      v: SCHEMA,
      episodes: [],
      settings: { cycleLen: 28, periodLen: 5, privacy: false }
    };
  }

  function miniTool() {
    return global.xhs && global.xhs.miniTool;
  }

  /** 统一 回调 / Promise 两种形态，先注册回调，再看返回值是不是 Promise */
  function invoke(name, args, ok, fail) {
    var m = miniTool();
    if (!m || typeof m[name] !== 'function') {
      fail(new Error('unsupported'));
      return;
    }
    var settled = false;
    var params = {};
    var k;
    for (k in args) {
      if (Object.prototype.hasOwnProperty.call(args, k)) params[k] = args[k];
    }
    params.success = function (res) {
      if (settled) return;
      settled = true;
      ok(res || {});
    };
    params.fail = function (err) {
      if (settled) return;
      settled = true;
      fail(err || new Error('fail'));
    };
    var ret;
    try {
      ret = m[name](params);
    } catch (e) {
      if (!settled) {
        settled = true;
        fail(e);
      }
      return;
    }
    if (ret && typeof ret.then === 'function') {
      ret.then(function (res) {
        if (settled) return;
        settled = true;
        ok(res || {});
      }, function (err) {
        if (settled) return;
        settled = true;
        fail(err || new Error('fail'));
      });
    }
  }

  function parseJSON(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /** 结构迁移与脏数据清理 */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var d = raw;

    if (!Array.isArray(d.episodes)) d.episodes = [];
    var list = [];
    var i;
    for (i = 0; i < d.episodes.length; i++) {
      var e = d.episodes[i];
      if (!e || !global.D.isValid(e.s)) continue;
      var end = global.D.isValid(e.e) && e.e >= e.s ? e.e : e.s;
      list.push({ s: e.s, e: end });
    }
    d.episodes = list;

    if (!d.settings || typeof d.settings !== 'object') d.settings = {};
    if (typeof d.settings.cycleLen !== 'number' || !isFinite(d.settings.cycleLen)) {
      d.settings.cycleLen = 28;
    }
    if (typeof d.settings.periodLen !== 'number' || !isFinite(d.settings.periodLen)) {
      d.settings.periodLen = 5;
    }
    if (typeof d.settings.privacy !== 'boolean') d.settings.privacy = false;

    d.v = SCHEMA;
    return d;
  }

  function readLocal(cb) {
    var raw = null;
    try {
      raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
    } catch (e) {
      raw = null;
    }
    cb(migrate(parseJSON(raw)));
  }

  function writeLocal(data, cb) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
      cb(true);
    } catch (e) {
      cb(false);
    }
  }

  function load(cb) {
    if (!miniTool()) {
      readLocal(cb);
      return;
    }
    invoke('getStorage', { key: KEY, encrypt: true }, function (res) {
      cb(migrate(parseJSON(res.data)));
    }, function () {
      // 兼容未加密写入的历史数据
      invoke('getStorage', { key: KEY }, function (res) {
        cb(migrate(parseJSON(res.data)));
      }, function () {
        readLocal(cb);
      });
    });
  }

  function save(data, cb) {
    var text;
    try {
      text = JSON.stringify(data);
    } catch (e) {
      cb(false);
      return;
    }
    if (!miniTool()) {
      writeLocal(data, cb);
      return;
    }
    invoke('setStorage', { key: KEY, data: text, encrypt: true }, function () {
      cb(true);
    }, function () {
      invoke('setStorage', { key: KEY, data: text }, function () {
        cb(true);
      }, function () {
        writeLocal(data, cb);
      });
    });
  }

  function clear(cb) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      try {
        if (global.localStorage) global.localStorage.removeItem(KEY);
      } catch (e) {
        /* 忽略 */
      }
      cb();
    }
    if (!miniTool()) {
      finish();
      return;
    }
    invoke('removeStorage', { key: KEY }, finish, function () {
      invoke('clearStorage', {}, finish, finish);
    });
  }

  global.Store = {
    blank: blank,
    load: load,
    save: save,
    clear: clear,
    KEY: KEY
  };
})(window);
