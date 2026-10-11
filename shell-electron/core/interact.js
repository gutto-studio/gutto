// CORE · 互动反应（v44 摸头/戳/连戳炸毛 + v44.16 拖拽物理）：纯函数状态机。
// 与 ambient 同款纪律：零 DOM 零文件零时钟依赖，random 注入（可测）；
// IIFE 包裹防 classic script 顶层 const 跨文件重名（QA44 实测教训——
// 本文件自 v44.16 起进 renderer，五份 core 全 IIFE 纪律闭环）。
// 台词键全写死在表里（禁运行时拼接——i18n-guide §2.2）；
// 反应行只用包内现成动作行（pet.json 23 行），旧包缺行时 renderer 回退 idle 不炸。
'use strict';

(function () {
  // 反应节流：两次反应最小间隔（双击/手抖不成两连反应；streak 账照记）
  const REACTION_MIN_INTERVAL_MS = 600;
  // 连戳窗口与阈值：4 秒内戳满 4 次切炸毛池
  const FRENZY_WINDOW_S = 4;
  const FRENZY_THRESHOLD = 4;

  // [row, weight, lineKey, holdSeconds] —— 四池各权重和 1.00
  const PAT_POOL = [    // 摸头（剪影上段命中）：受用向
    ['cheer', 0.45, 'poke.pat.cozy', 4],
    ['dance', 0.30, 'poke.pat.smug', 5],
    ['waving', 0.25, 'poke.pat.loveit', 4],
  ];
  const HIT_POOL = [    // 戳身子：惊/嗔/应/喜混池
    ['jumping', 0.40, 'poke.hit.startled', 3],
    ['angry', 0.25, 'poke.hit.annoyed', 4],
    ['think', 0.20, 'poke.hit.ask', 4],
    ['cheer', 0.15, 'poke.hit.happy', 3],
  ];
  const FRENZY_POOL = [ // 连戳炸毛：只出 angry，两句台词轮换
    ['angry', 0.65, 'poke.frenzy.explode', 5],
    ['angry', 0.35, 'poke.frenzy.tax', 5],
  ];
  const SHAKE_POOL = [  // 拿起来晃（v44.9）：晕瘫/抗议/陪玩混池
    ['failed', 0.40, 'poke.shake.dizzy', 4],
    ['angry', 0.35, 'poke.shake.letgo', 4],
    ['jumping', 0.25, 'poke.shake.whee', 3],
  ];

  function weightedPick(pool, random) {
    const total = pool.reduce((s, entry) => s + entry[1], 0);
    let roll = random() * total;
    for (const entry of pool) {
      roll -= entry[1];
      if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
  }

  function poolFor(zone, frenzy) {
    if (zone === 'shake') return SHAKE_POOL;   // 晃动独立成池：不参与炸毛连击
    if (frenzy) return FRENZY_POOL;
    return zone === 'pat' ? PAT_POOL : HIT_POOL;
  }

  /**
   * 选中一次互动反应。{ zone:'pat'|'hit', streak, lastLineKey, random }。
   * streak ≥ FRENZY_THRESHOLD 走炸毛池；lastLineKey 排除连播（池空回落全池）。
   * 返回 { row, lineKey, holdSeconds }。
   */
  function pickReaction({ zone = 'hit', streak = 1, lastLineKey = null, random = Math.random } = {}) {
    const frenzy = streak >= FRENZY_THRESHOLD;
    const all = poolFor(zone, frenzy);
    const pool = all.filter((entry) => entry[2] !== lastLineKey);
    const [row, , lineKey, holdSeconds] = weightedPick(pool.length ? pool : all, random);
    return { row, lineKey, holdSeconds };
  }

  /** 窗口内连戳计数：就地剔除窗口外旧账（调用方持有时戳数组），返回剩余数。 */
  function countStreak(pokeTimesMs, nowMs) {
    const windowStart = nowMs - FRENZY_WINDOW_S * 1000;
    while (pokeTimesMs.length && pokeTimesMs[0] < windowStart) pokeTimesMs.shift();
    return pokeTimesMs.length;
  }

  // ── v44.16 拖拽物理（C-4 抛掷）：释放速度采样 + 惯性步进（纯函数可测）──
  // 甩出=松手瞬间还有速度 → 惯性滑行（水平，复用漫游 walk-step 通道与屏边钳制）
  // → 撞边反弹衰减 → 摩擦耗尽停步。垂直分量不滑（窗口单轴步进），转为落地挤压幅度。
  const FLING = {
    SAMPLE_MS: 90,    // 释放速度取样窗：mousemove 事件间隔抖动大，按时间窗折算 pt/s
    MIN_V: 220,       // pt/s——低于此=慢松手放下，不触发滑行
    MAX_V: 3000,      // 甩再狠也封顶（防一帧飞出屏外）
    FRICTION: 0.90,   // 每拍（50ms）速度保留率：指数衰减
    BOUNCE: 0.45,     // 撞屏边反弹保留率
    STOP_V: 60,       // pt/s 衰减到即停
    TICK_MS: 50,      // 步进节拍（与漫游同频，IPC 每拍一次有先例）
  };

  /** 释放速度（pt/s，带方向）：取样窗内位移和 ÷ 窗内时长。samples=[{t, dx}]。 */
  function releaseVelocity(samples, nowMs) {
    const inWin = (samples || []).filter((s) => nowMs - s.t <= FLING.SAMPLE_MS);
    const dx = inWin.reduce((a, s) => a + s.dx, 0);
    const span = inWin.length >= 2 ? nowMs - inWin[0].t : 0;
    if (span <= 0) return 0;
    const v = dx / (span / 1000);
    return Math.max(-FLING.MAX_V, Math.min(FLING.MAX_V, v));
  }

  /** 单步物理：撞边（实移 < 期望半程）反向×反弹系数，再乘摩擦；衰到 STOP_V 停。 */
  function flingStep(vx, want, moved) {
    const hitWall = Math.abs(moved) < Math.abs(want) - 0.5;
    let nv = hitWall ? -vx * FLING.BOUNCE : vx;
    nv *= FLING.FRICTION;
    if (Math.abs(nv) < FLING.STOP_V) nv = 0;
    return { vx: nv, bounce: hitWall };
  }

  // UMD 尾：Node（main 编排/测试）与浏览器双吃（与 ambient.js 同范式）
  const INTERACT_EXPORTS = {
    pickReaction, countStreak, releaseVelocity, flingStep,
    REACTION_MIN_INTERVAL_MS, FRENZY_WINDOW_S, FRENZY_THRESHOLD,
    FLING,
    POOLS: { pat: PAT_POOL, hit: HIT_POOL, frenzy: FRENZY_POOL, shake: SHAKE_POOL },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = INTERACT_EXPORTS;
  else window.GuttoInteract = INTERACT_EXPORTS;
})();
