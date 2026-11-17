/* 内容数据静态校验：跑在 node 里，不需要浏览器。
   用途：换一期教程时先跑这个，避免 sim 状态机跳空、need 项写错这类问题。 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '../data/lesson-cdrive.js');
const code = fs.readFileSync(file, 'utf8');
const ctx = { window: {} };
ctx.window.DJL_LESSONS = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const L = ctx.LESSON;

const errs = [];
const warns = [];
const ok = [];

if (!L) {
  console.error('LESSON 未定义');
  process.exit(1);
}
if (!L.steps || !L.steps.length) errs.push('steps 为空');

const kinds = {};
const ids = new Set();

L.steps.forEach((s, i) => {
  const tag = `#${i + 1}`;
  kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  if (s.id) {
    if (ids.has(s.id)) errs.push(`${tag} id 重复: ${s.id}`);
    ids.add(s.id);
  }
  if (!s.title) errs.push(`${tag} 缺 title`);
  if (!['read', 'sim', 'choose', 'end'].includes(s.kind)) {
    errs.push(`${tag} kind 未知: ${s.kind}`);
    return;
  }

  if (s.kind === 'read') {
    if (!s.body) warns.push(`${tag} read 无正文`);
    if (s.figure === 'split' && (!s.split || !s.split.length)) {
      errs.push(`${tag} figure=split 但没给 split 数据`);
    }
  }

  if (s.kind === 'choose') {
    const good = (s.options || []).filter((o) => o.ok);
    if (good.length !== 1) errs.push(`${tag} 正确选项应为 1 个，实际 ${good.length}`);
    (s.options || []).forEach((o, j) => {
      if (!o.label) errs.push(`${tag} 选项 ${j} 缺 label`);
      if (!o.why) errs.push(`${tag} 选项 ${j} 缺 why`);
    });
  }

  if (s.kind === 'sim') {
    const sim = s.sim || {};
    const states = sim.states || {};
    const keys = Object.keys(states);
    if (!keys.length) {
      errs.push(`${tag} sim 没有 states`);
      return;
    }
    if (!states[sim.start]) errs.push(`${tag} sim.start 指向不存在的 state: ${sim.start}`);

    // 可达性
    const seen = new Set([sim.start]);
    const queue = [sim.start];
    while (queue.length) {
      const k = queue.shift();
      const st = states[k];
      if (!st) continue;
      (st.rows || []).forEach((r) => {
        const nxt = r.go || r.longpress;
        if (nxt) {
          if (!states[nxt]) {
            errs.push(`${tag} state「${k}」的行「${r.id || r.label}」跳到不存在的 ${nxt}`);
          } else if (!seen.has(nxt)) {
            seen.add(nxt);
            queue.push(nxt);
          }
        }
      });
    }
    keys.forEach((k) => {
      if (!seen.has(k)) warns.push(`${tag} state「${k}」不可达`);
    });

    // 终点
    let terminal = 0;
    keys.forEach((k) => {
      const st = states[k];
      if (st.done || st.multi) terminal++;
      (st.rows || []).forEach((r) => {
        if (r.done) terminal++;
      });
    });
    if (!terminal) errs.push(`${tag} sim 没有任何完成标记（done / multi）`);

    // 多选
    keys.forEach((k) => {
      const st = states[k];
      if (!st.multi) return;
      if (!st.need || !st.need.length) {
        errs.push(`${tag} state「${k}」multi 但没给 need`);
        return;
      }
      const want = (st.rows || []).filter((r) => r.want).map((r) => r.id);
      st.need.forEach((n) => {
        const row = (st.rows || []).find((r) => r.id === n);
        if (!row) errs.push(`${tag} need 项「${n}」不在 rows 里`);
        else if (!row.want) errs.push(`${tag} need 项「${n}」没标 want:true`);
      });
      want.forEach((w) => {
        if (!st.need.includes(w)) warns.push(`${tag} 行「${w}」标了 want 但不在 need 里`);
      });
      if ((st.rows || []).filter((r) => r.want).length === (st.rows || []).length) {
        warns.push(`${tag} state「${k}」全部行都是 want，没有干扰项`);
      }
    });

    // 长按目标
    keys.forEach((k) => {
      (states[k].rows || []).forEach((r) => {
        if (r.longpress && !states[r.longpress]) {
          errs.push(`${tag} 长按目标不存在: ${r.longpress}`);
        }
        if (r.longpress && !r.tip) warns.push(`${tag} 长按行「${r.label}」缺 tip`);
      });
    });
  }

  if (s.kind === 'end' && (!s.recap || !s.recap.length)) {
    errs.push(`${tag} end 缺 recap`);
  }
});

const simSteps = L.steps.filter((s) => s.kind === 'sim').length;
const chooseSteps = L.steps.filter((s) => s.kind === 'choose').length;

ok.push(`步骤 ${L.steps.length} 条：sim ${simSteps} / choose ${chooseSteps} / read ${kinds.read || 0} / end ${kinds.end || 1}`);
ok.push(`可交互步骤占比 ${Math.round(((simSteps + chooseSteps) / L.steps.length) * 100)}%`);

ok.forEach((m) => console.log('  ' + m));
if (warns.length) {
  console.log('\n提示：');
  warns.forEach((w) => console.log('  · ' + w));
}
if (errs.length) {
  console.log('\n错误：');
  errs.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('\n校验通过');
