/**
 * 周期计算与预测
 * 纯函数，不碰 DOM、不碰存储，便于单独验证。
 *
 * 原则：
 * 1. 异常周期（<15 天或 >60 天）不计入平均，但记录本身保留
 * 2. 近期周期权重更高
 * 3. 数据越少，给出的区间越宽；完全没有历史时只按用户自己填的周期估算
 * 4. 不估算排卵日与易孕期——那是医疗判断，这个工具不做
 */
(function (global) {
  'use strict';

  var D = global.D;

  var MIN_CYCLE = 15;
  var MAX_CYCLE = 60;
  var WEIGHTS = [0.5, 0.25, 0.15, 0.1];

  /** 排序并合并相邻/重叠的区间 */
  function normalize(episodes) {
    var list = [];
    var i;
    for (i = 0; i < episodes.length; i++) {
      var e = episodes[i];
      if (!e || !D.isValid(e.s)) continue;
      var end = D.isValid(e.e) && e.e >= e.s ? e.e : e.s;
      list.push({ s: e.s, e: end });
    }
    list.sort(function (a, b) {
      return a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
    });
    var out = [];
    for (i = 0; i < list.length; i++) {
      var cur = list[i];
      var prev = out.length ? out[out.length - 1] : null;
      if (prev && D.diffDays(cur.s, prev.e) <= 1) {
        if (cur.e > prev.e) prev.e = cur.e;
      } else {
        out.push({ s: cur.s, e: cur.e });
      }
    }
    return out;
  }

  function mean(arr) {
    var s = 0;
    var i;
    for (i = 0; i < arr.length; i++) s += arr[i];
    return arr.length ? s / arr.length : 0;
  }

  function weighted(gaps) {
    // gaps 按时间正序，取最近 4 个，越新权重越大
    var recent = gaps.slice(-WEIGHTS.length).reverse();
    var sum = 0;
    var wsum = 0;
    var i;
    for (i = 0; i < recent.length; i++) {
      var w = WEIGHTS[i];
      sum += recent[i] * w;
      wsum += w;
    }
    return wsum ? sum / wsum : 0;
  }

  function stdev(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    var s = 0;
    var i;
    for (i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(s / arr.length);
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  /**
   * @param {Array} rawEpisodes  [{s,e}]
   * @param {string} today       'YYYY-MM-DD'
   * @param {Object} settings    {cycleLen, periodLen}
   */
  function analyze(rawEpisodes, today, settings) {
    var cfg = settings || {};
    var declaredCycle = cfg.cycleLen || 28;
    var declaredPeriod = cfg.periodLen || 5;

    var episodes = normalize(rawEpisodes);

    var result = {
      episodes: episodes,
      count: episodes.length,
      lastStart: null,
      avgCycle: null,
      avgPeriod: declaredPeriod,
      cycleSd: 0,
      uncertainty: 3,
      confidence: 'none', // none | declared | rough | firm
      nextStart: null,
      nextEnd: null,
      state: 'empty', // empty | period | waiting | due | late
      periodDay: 0,
      daysToNext: null,
      lateDays: 0,
      gapsUsed: 0
    };

    if (!episodes.length) return result;

    var i;
    var last = episodes[episodes.length - 1];
    result.lastStart = last.s;

    // 经期长度：取最近 6 次的平均
    var durations = [];
    for (i = 0; i < episodes.length; i++) {
      durations.push(D.diffDays(episodes[i].e, episodes[i].s) + 1);
    }
    if (durations.length) {
      result.avgPeriod = Math.round(mean(durations.slice(-6)));
    }

    // 周期长度：相邻开始日之差，剔除异常
    var gaps = [];
    for (i = 1; i < episodes.length; i++) {
      var g = D.diffDays(episodes[i].s, episodes[i - 1].s);
      if (g >= MIN_CYCLE && g <= MAX_CYCLE) gaps.push(g);
    }
    result.gapsUsed = gaps.length;

    if (gaps.length) {
      result.avgCycle = Math.round(weighted(gaps));
      result.cycleSd = stdev(gaps.slice(-6));
    } else {
      result.avgCycle = declaredCycle;
    }

    if (gaps.length >= 3) {
      result.confidence = 'firm';
      result.uncertainty = clamp(Math.round(result.cycleSd), 1, 6);
    } else if (gaps.length >= 1) {
      result.confidence = 'rough';
      result.uncertainty = 4;
    } else {
      result.confidence = 'declared';
      result.uncertainty = 3;
    }

    result.nextStart = D.addDays(last.s, result.avgCycle);
    result.nextEnd = D.addDays(result.nextStart, result.avgPeriod - 1);

    // 今天处于哪一次经期内
    for (i = 0; i < episodes.length; i++) {
      if (D.between(today, episodes[i].s, episodes[i].e)) {
        result.state = 'period';
        result.periodDay = D.diffDays(today, episodes[i].s) + 1;
        return result;
      }
    }

    var toNext = D.diffDays(result.nextStart, today);
    if (toNext > 0) {
      result.state = 'waiting';
      result.daysToNext = toNext;
    } else if (toNext === 0) {
      result.state = 'due';
      result.daysToNext = 0;
    } else {
      result.lateDays = -toNext;
      result.state = result.lateDays <= result.uncertainty ? 'due' : 'late';
    }

    return result;
  }

  /** 某天是否落在预测区间内 */
  function isPredicted(day, stats) {
    if (!stats.nextStart) return false;
    return D.between(day, stats.nextStart, stats.nextEnd);
  }

  /** 某天属于哪一次记录（无则返回 null） */
  function episodeAt(day, episodes) {
    var i;
    for (i = 0; i < episodes.length; i++) {
      if (D.between(day, episodes[i].s, episodes[i].e)) return episodes[i];
    }
    return null;
  }

  global.Cycle = {
    normalize: normalize,
    analyze: analyze,
    isPredicted: isPredicted,
    episodeAt: episodeAt,
    MIN_CYCLE: MIN_CYCLE,
    MAX_CYCLE: MAX_CYCLE
  };
})(window);
