/**
 * 日期工具
 * 全部按 YYYY-MM-DD 字符串处理，内部用 UTC 毫秒做整数运算，
 * 避免本地时区 / 夏令时导致日期偏移一天。
 */
(function (global) {
  'use strict';

  var DAY = 86400000;

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function ymd(y, m, d) {
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  function parse(s) {
    var p = String(s).split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) };
  }

  function toUTC(s) {
    var p = parse(s);
    return Date.UTC(p.y, p.m - 1, p.d);
  }

  function fromUTC(ms) {
    var d = new Date(ms);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  function isValid(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s === fromUTC(toUTC(s));
  }

  function addDays(s, n) {
    return fromUTC(toUTC(s) + n * DAY);
  }

  /** a - b，单位天 */
  function diffDays(a, b) {
    return Math.round((toUTC(a) - toUTC(b)) / DAY);
  }

  function today() {
    var d = new Date();
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /** 周一为 0，周日为 6 */
  function weekday(s) {
    return (new Date(toUTC(s)).getUTCDay() + 6) % 7;
  }

  /** 归一到当月 1 号 */
  function monthOf(s) {
    var p = parse(s);
    return ymd(p.y, p.m, 1);
  }

  function addMonths(m, n) {
    var p = parse(m);
    var d = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }

  function daysInMonth(m) {
    var p = parse(m);
    return new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  }

  function monthLabel(m) {
    var p = parse(m);
    return p.y + ' 年 ' + p.m + ' 月';
  }

  function mdLabel(s) {
    var p = parse(s);
    return p.m + ' 月 ' + p.d + ' 日';
  }

  function fullLabel(s) {
    var p = parse(s);
    return p.y + ' 年 ' + p.m + ' 月 ' + p.d + ' 日';
  }

  function between(s, from, to) {
    return s >= from && s <= to;
  }

  global.D = {
    pad2: pad2,
    ymd: ymd,
    parse: parse,
    isValid: isValid,
    addDays: addDays,
    diffDays: diffDays,
    today: today,
    weekday: weekday,
    monthOf: monthOf,
    addMonths: addMonths,
    daysInMonth: daysInMonth,
    monthLabel: monthLabel,
    mdLabel: mdLabel,
    fullLabel: fullLabel,
    between: between
  };
})(window);
