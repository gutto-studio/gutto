// CORE interact 互动反应单测：node test/core-interact.test.js
// 验证：四池（摸/戳/炸毛/晃动）台词键 zh/en 双字典都在（漏翻当天炸）/ 权重和=1 /
// 炸毛阈值 / 台词不连播 / streak 窗口剪枝 / 节流常量纪律（600ms、4s/4 次）。
'use strict';
const {
  pickReaction, countStreak,
  REACTION_MIN_INTERVAL_MS, FRENZY_WINDOW_S, FRENZY_THRESHOLD, POOLS,
} = require('../core/interact');
const zh = require('../i18n/zh');
const en = require('../i18n/en');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 台词键双字典同批（i18n-guide 键一致：表里每个键 zh/en 都必须有）
{
  const missing = [];
  for (const pool of Object.values(POOLS)) {
    for (const [, , key] of pool) {
      if (!(key in zh)) missing.push(`zh:${key}`);
      if (!(key in en)) missing.push(`en:${key}`);
    }
  }
  assert(missing.length === 0, `台词键 zh/en 全在字典${missing.length ? `，缺：${missing.join(',')}` : ''}`);
}

// 2. 三池权重各和 = 1.00
for (const [name, pool] of Object.entries(POOLS)) {
  const total = pool.reduce((s, e) => s + e[1], 0);
  assert(Math.abs(total - 1) < 1e-9, `${name} 池权重和=1.00（实际 ${total}）`);
}

// 3. 反应行全部是包内动作行（23 行清单的子集——缺行 renderer 回退 idle，表不许写错）
{
  const ROWS = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting',
    'running', 'review', 'sleep', 'yawn', 'cheer', 'stretch', 'sit', 'look-left', 'look-right',
    'dance', 'think', 'angry', 'crawl', 'entrance', 'exit', 'first-greeting'];
  const bad = [];
  for (const pool of Object.values(POOLS)) {
    for (const [row] of pool) if (!ROWS.includes(row)) bad.push(row);
  }
  assert(bad.length === 0, `反应行全在包清单内${bad.length ? `，越界：${bad.join(',')}` : ''}`);
}

// 4. 分区正确：pat 池不出 angry，hit 池不出 PAT 台词
{
  let ok = true;
  for (let i = 0; i < 200; i += 1) {
    const pat = pickReaction({ zone: 'pat', random: Math.random });
    if (pat.lineKey.startsWith('poke.frenzy') || pat.lineKey.startsWith('poke.hit')) ok = false;
    const hit = pickReaction({ zone: 'hit', streak: 1, random: Math.random });
    if (hit.lineKey.startsWith('poke.pat')) ok = false;
  }
  assert(ok, '200 抽分区零串池');
}

// 4b. shake 分区（v44.9）：晃动池只出 shake 台词 + failed/angry/jumping 三行
{
  const SHAKE_ROWS = new Set(['failed', 'angry', 'jumping']);
  let ok = true;
  for (let i = 0; i < 200; i += 1) {
    const r = pickReaction({ zone: 'shake', random: Math.random });
    if (!r.lineKey.startsWith('poke.shake') || !SHAKE_ROWS.has(r.row)) ok = false;
  }
  assert(ok, '200 抽 shake 池零串池');
}

// 5. 炸毛阈值：streak=4 起只出 angry 行
{
  let allAngry = true;
  for (let i = 0; i < 100; i += 1) {
    const r = pickReaction({ zone: 'hit', streak: FRENZY_THRESHOLD, random: Math.random });
    if (r.row !== 'angry') allAngry = false;
  }
  const below = pickReaction({ zone: 'hit', streak: FRENZY_THRESHOLD - 1, random: () => 0.99 });
  assert(allAngry, `streak>=${FRENZY_THRESHOLD} 全出 angry`);
  assert(below.row !== 'angry' || below.lineKey.startsWith('poke.hit'),
    `streak=${FRENZY_THRESHOLD - 1} 仍走 hit 池（炸毛不提前）`);
}

// 6. 台词不连播：lastLineKey 排除后池内抽不到它（炸毛双句池空回落除外）
{
  let repeated = false;
  for (let i = 0; i < 100; i += 1) {
    const first = pickReaction({ zone: 'pat', random: Math.random });
    const second = pickReaction({ zone: 'pat', lastLineKey: first.lineKey, random: Math.random });
    if (second.lineKey === first.lineKey && POOLS.pat.length > 1) repeated = true;
  }
  assert(!repeated, 'lastLineKey 命中时 100 抽零连播');
}

// 7. streak 窗口剪枝：4s 外旧账剔除、窗口内计数正确
{
  const now = 10000;
  assert(countStreak([1000, 2000, 3000], now) === 0, '全部超窗=0');
  assert(countStreak([5900, 6100, 7000, 9000, 9400, 9999], now) === 5,
    '5900 出窗剔除、6100（3.9s 前）在内，计 5');
  const times = [100, 200, 300];
  countStreak(times, 4300);   // 就地剪枝：窗口起点 300，100/200 出窗被 shift
  assert(times.length === 1 && times[0] === 300, '旧账就地剪掉');
}

// 8. 常量纪律（与注释/规范复述同数：600ms 节流、4s 窗、4 次阈值）
assert(REACTION_MIN_INTERVAL_MS === 600, `节流 600ms（实际 ${REACTION_MIN_INTERVAL_MS}）`);
assert(FRENZY_WINDOW_S === 4 && FRENZY_THRESHOLD === 4, '炸毛窗口 4s / 阈值 4 次');

// ── v44.16 C-4 拖拽物理：释放速度采样 + 惯性步进 ─────────────────────
const { releaseVelocity, flingStep, FLING } = require('../core/interact');

// 9. 释放速度：时间窗折算、封顶、样本不足为 0
{
  const now = 1000;
  // 90ms 窗内 66px / 60ms → 1100 pt/s
  assert(releaseVelocity([{ t: 940, dx: 20 }, { t: 970, dx: 22 }, { t: 1000, dx: 24 }], now)
    === 1100, '窗内位移/时长折算 pt/s');
  // 出窗样本不参与（窗 90ms：t=800 已出窗）；窗内 10px / 50ms = 200 pt/s
  assert(releaseVelocity([{ t: 800, dx: 500 }, { t: 950, dx: 5 }, { t: 1000, dx: 5 }], now)
    === 200, '出窗旧样本剔除');
  assert(releaseVelocity([{ t: 1000, dx: 999 }], now) === 0, '单样本（无时长）= 0');
  assert(releaseVelocity([], now) === 0, '空样本 = 0');
  // 甩上天也封顶 MAX_V
  assert(releaseVelocity([{ t: 910, dx: -400 }, { t: 1000, dx: -400 }], now)
    === -FLING.MAX_V, '负向封顶 MAX_V');
}

// 10. 步进物理：摩擦衰减、撞边反弹、衰到即停
{
  const { vx } = flingStep(1000, 50, 50);            // 正常步：×0.90
  assert(Math.abs(vx - 900) < 1e-9, `摩擦保留率 0.90（实际 ${vx}）`);
  const wall = flingStep(1000, 50, 0);               // 撞边（实移 0）：反向×0.45 再×0.90
  assert(Math.abs(wall.vx - (-(1000 * FLING.BOUNCE) * FLING.FRICTION)) < 1e-9
    && wall.bounce === true, '撞边反向反弹');
  assert(flingStep(50, 2.5, 2.5).vx === 0, `衰到 STOP_V(${FLING.STOP_V}) 以下即停`);
  assert(flingStep(-300, -15, 0).bounce === true, '负向滑行撞边同样反弹');
}

process.exit(failed ? 1 : 0);
