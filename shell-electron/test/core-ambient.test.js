// CORE ambient 轮换单测：node test/core-ambient.test.js
// 验证：权重和 / 排除上一次 / 冷却纪律 / 驻留区间 / 睡眠阈值。
'use strict';
const { AmbientScheduler, AMBIENT_BEHAVIORS, HIGH_ENERGY, sleepThreshold } = require('../core/ambient');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 权重表保真：合计 0.87 与 Swift 引擎原表一致（Swift 抽选按池和归一，
//    roll ∈ [0, total)，行为等价归一化——平移不改值）
const total = AMBIENT_BEHAVIORS.reduce((s, [, w]) => s + w, 0);
assert(Math.abs(total - 0.87) < 1e-9, `权重合计 = 0.87（Swift 原表，实际 ${total}）`);
// 抽选按池和归一：全表可被抽中（无空窗）。时钟随驻留推进（否则大动作
// 冷却在同步循环里永不解封——真机上冷却靠真实时间流逝）
{
  const seen = new Set();
  let t = 1000;
  const sched = new AmbientScheduler({ random: Math.random, now: () => t });
  for (let i = 0; i < 4000; i += 1) {
    const r = sched.pick();
    seen.add(r.animation);
    t += r.holdSeconds; // 模拟驻留时间流逝
  }
  assert(seen.size === AMBIENT_BEHAVIORS.length, `13 行全部可抽中（实际 ${seen.size}）`);
}

// 2. 确定性 random 注入下行为可复现
let s = new AmbientScheduler({ random: () => 0.42 });
const a = s.pick();
const b = new AmbientScheduler({ random: () => 0.42 }).pick();
assert(a.animation === b.animation && Math.abs(a.holdSeconds - b.holdSeconds) < 1e-9,
  '同 seed 注入下选择可复现');

// 3. 不连播同一行（mac 壳同纪律）
s = new AmbientScheduler({ random: Math.random });
let noRepeat = true;
let last = null;
for (let i = 0; i < 500; i += 1) {
  const r = s.pick();
  if (r.animation === last) noRepeat = false;
  last = r.animation;
}
assert(noRepeat, '500 抽内零连播');

// 4. 大动作冷却：抽到大动作 → cooldownUntil 生效，冷却期内只出安静行
s = new AmbientScheduler({ random: () => 0.001 }); // 低 roll 偏向表头（idle 安静）
let sawHigh = false;
let cooldownRespected = true;
let nowT = 1000;
const clock = { now: () => nowT };
s = new AmbientScheduler({ random: Math.random, now: clock.now });
for (let i = 0; i < 4000 && !sawHigh; i += 1) {
  const r = s.pick();
  if (r.highEnergy) {
    sawHigh = true;
    assert(r.cooldownSeconds >= 75 && r.cooldownSeconds <= 165,
      `冷却区间 75-165s（实际 ${r.cooldownSeconds.toFixed(1)}）`);
    nowT += r.cooldownSeconds - 1; // 冷却末 1s 前
    for (let k = 0; k < 50; k += 1) {
      const q = s.pick();
      if (HIGH_ENERGY.has(q.animation)) cooldownRespected = false;
    }
  }
}
assert(sawHigh, '4000 抽内必有大动作出现');
assert(cooldownRespected, '冷却期内零大动作');

// 5. 驻留都在各自区间
s = new AmbientScheduler({ random: Math.random });
let holdsOk = true;
for (let i = 0; i < 2000; i += 1) {
  const r = s.pick();
  const def = AMBIENT_BEHAVIORS.find(([n]) => n === r.animation);
  if (r.holdSeconds < def[2][0] || r.holdSeconds > def[2][1]) holdsOk = false;
}
assert(holdsOk, '2000 抽驻留全在行区间内');

// 6. 睡眠阈值分档（Swift isNight = hour>=23 || hour<5）
assert(sleepThreshold(14) === 60 && sleepThreshold(23) === 15 && sleepThreshold(3) === 15,
  '睡眠阈值：白天 60s / 夜间(23-5) 15s');

process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
