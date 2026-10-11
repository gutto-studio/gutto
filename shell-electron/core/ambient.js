// CORE · ambient 行为轮换（SPEC 的参考实现第一块）
// 从 mac 壳 PetHostController.swift 1:1 平移（2026-10-10）。
// 两壳共享同一份节律参数与选择逻辑——她两边的性格必须一模一样。
//
// 设计纪律：
// - 纯函数状态机：零 DOM 零文件零时钟依赖，random/now 注入（可测）；
// - 节律 v3（README 廿四轮，主人 QA「像多动症」拍板）：安静是常态，动作是事件。
'use strict';

// [animation, weight, durationSeconds] —— 权重合计 1.00
const AMBIENT_BEHAVIORS = [
  ['idle', 0.40, [30, 70]],
  ['waiting', 0.06, [10, 18]],
  ['review', 0.06, [10, 18]],
  ['sit', 0.08, [20, 45]],
  ['think', 0.05, [15, 30]],
  ['yawn', 0.04, [8, 15]],
  ['stretch', 0.03, [8, 15]],
  // 大动作池（合计 0.15）：一次演完，几分钟后再见
  ['waving', 0.05, [5, 9]],
  ['jumping', 0.02, [5, 9]],
  ['cheer', 0.02, [5, 9]],
  ['dance', 0.03, [6, 12]],
  ['angry', 0.015, [5, 10]],
  ['crawl', 0.015, [6, 12]],
];

// 大动作行：抽到即进入冷却，冷却期只从安静池抽（连播/高频是「抽搐感」主源）
const HIGH_ENERGY = new Set(['waving', 'jumping', 'cheer', 'dance', 'angry', 'crawl']);
const HIGH_ENERGY_COOLDOWN_S = [75, 165];

class AmbientScheduler {
  constructor({ random = Math.random, now = () => Date.now() / 1000 } = {}) {
    this.random = random;
    this.now = now;
    this.last = null;
    this.cooldownUntil = 0;
  }

  /** 加权抽取一行（排除上一次的行）。 */
  _weightedPick(pool) {
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let roll = this.random() * total;
    for (const entry of pool) {
      roll -= entry[1];
      if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
  }

  /**
   * 选中下一行为。返回 { animation, holdSeconds, highEnergy, cooldownSeconds|null }。
   * 有冷却在身时只从安静池抽；抽到大动作即重置冷却（返回 cooldownSeconds）。
   */
  pick() {
    const t = this.now();
    const cooling = t < this.cooldownUntil;
    const pool = AMBIENT_BEHAVIORS.filter(
      ([name]) => name !== this.last && (!cooling || !HIGH_ENERGY.has(name))
    );
    const fallbackPool = AMBIENT_BEHAVIORS.filter(([name]) => !cooling || !HIGH_ENERGY.has(name));
    const chosen = this._weightedPick(pool.length ? pool : fallbackPool);
    const [animation, , dur] = chosen;
    const holdSeconds = dur[0] + this.random() * (dur[1] - dur[0]);

    let cooldownSeconds = null;
    if (HIGH_ENERGY.has(animation)) {
      cooldownSeconds =
        HIGH_ENERGY_COOLDOWN_S[0] +
        this.random() * (HIGH_ENERGY_COOLDOWN_S[1] - HIGH_ENERGY_COOLDOWN_S[0]);
      this.cooldownUntil = t + cooldownSeconds;
    }
    this.last = animation;
    return { animation, holdSeconds, highEnergy: HIGH_ENERGY.has(animation), cooldownSeconds };
  }
}

// 睡眠状态机阈值（mac 壳同值）：空闲 ≥60s（夜间 23:00–05:00 为 15s）入睡
const SLEEP_THRESHOLD_S = { day: 60, night: 15 };
function sleepThreshold(hour) {
  return hour >= 23 || hour < 5 ? SLEEP_THRESHOLD_S.night : SLEEP_THRESHOLD_S.day;
}

// 漫游节律（mac 壳 PetWanderMotion/PetHostController 同值）：40-80s 触发一次、
// 冷却 90-180s、步速 190pt/s、最小步幅 160pt
const WANDER = {
  triggerEveryS: [40, 80],
  cooldownS: [90, 180],
  pointsPerSecond: 190,
  minimumStride: 160,
  edgeMargin: 40,
};

// UMD 尾：Node（mac 壳桥接/测试）与浏览器（Electron renderer）双吃
const CORE_EXPORTS = { AmbientScheduler, AMBIENT_BEHAVIORS, HIGH_ENERGY, WANDER, sleepThreshold };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CORE_EXPORTS;
} else {
  window.GuttoCore = CORE_EXPORTS;
}
