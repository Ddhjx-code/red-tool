import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const scene = process.argv[2];
const label = process.argv[3] || scene;
const OUT = process.argv[4] || ('/tmp/rec2/' + scene);
const DEST = '/Users/wang/WorkBuddy/2026-11-10-12-43-25/docs/video/' + label + '.mp4';

const frames = JSON.parse(fs.readFileSync(OUT + '/frames.json', 'utf8'));
const md5 = p => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');

/* 1. 合并相邻内容相同的帧 */
const seq = [];
for (const fr of frames) {
  const p = OUT + '/' + fr.f;
  const h = md5(p);
  if (seq.length && seq[seq.length - 1].h === h) continue;
  seq.push({ p, ts: fr.ts, h });
}

/* 2. 每帧时长 = 下一帧时间戳 - 本帧时间戳 */
const TAIL = 0.14;
for (let i = 0; i < seq.length; i++) {
  const next = i + 1 < seq.length ? seq[i + 1].ts : seq[i].ts + TAIL;
  seq[i].dur = Math.max(0.01, next - seq[i].ts);
}
const total = seq.reduce((a, b) => a + b.dur, 0);

/* 3. concat 清单 */
const list = seq.map(s => "file '" + s.p + "'\nduration " + s.dur.toFixed(4)).join('\n');
const lastLine = "\nfile '" + seq[seq.length - 1].p + "'\n";
const listPath = OUT + '/list.txt';
fs.writeFileSync(listPath, list + lastLine);

/* 4. 合成：886×1920，等比放大后补底，首尾淡入淡出 */
const fo = Math.max(0, total - 0.55);
const vf = [
  'scale=886:-2:flags=lanczos',
  'pad=886:1920:0:(1920-ih)/2:color=0xF6F3EE',
  'fade=t=in:st=0:d=0.35',
  'fade=t=out:st=' + fo.toFixed(3) + ':d=0.5',
  'format=yuv420p'
].join(',');

fs.mkdirSync(DEST.substring(0, DEST.lastIndexOf('/')), { recursive: true });
execFileSync('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'concat', '-safe', '0', '-i', listPath,
  '-vf', vf, '-r', '30',
  '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
  '-movflags', '+faststart',
  DEST
], { stdio: 'inherit' });

const st = fs.statSync(DEST);
console.log(scene, '->', DEST);
console.log('frames', frames.length, '-> kept', seq.length, '| dur', total.toFixed(2) + 's', '| size', (st.size / 1048576).toFixed(2) + 'MB');
