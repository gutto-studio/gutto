// CORE · 羁绊（v44.2 好感度系统）：纯函数，零 IO 零时钟（日期串由调用方注入）。
// 设计纪律（留存理论 yukaichou：宠物是对别人的承诺）：
// - 好感度只涨不掉——不惩罚缺席，连续相伴天数才是义务感的正反馈；
// - 每类每日封顶（防挂机刷分：戳一千下不等于爱一千分）；
// - 升级解锁「稀有小剧场」——低频惊喜，不进 ambient 常规池（安静是常态不被打破）。
// IIFE 包裹防 classic script 顶层 const 跨文件重名（QA44 实测教训）。
'use strict';

(function () {
  // 等级曲线（at=累计分门槛）：升到该级解锁 unlock 对应小剧场
  const LEVELS = [
    { lv: 1, at: 0, nameKey: 'bond.lv.first', unlock: null },
    { lv: 2, at: 100, nameKey: 'bond.lv.friendly', unlock: 'dance' },
    { lv: 3, at: 300, nameKey: 'bond.lv.close', unlock: 'cheer' },
    { lv: 4, at: 700, nameKey: 'bond.lv.soul', unlock: 'words' },
  ];

  // 每动作积分与每日封顶（封顶=该类当日最多累计分）
  // feed（v44.17 C-3 投喂）：3 分/次、日封顶 30（10 次吃到顶——投喂是心意不是刷分器）
  const POINTS = { pat: 2, poke: 1, frenzy: 0, chat: 4, look: 2, visit: 6, feed: 3 };
  const DAILY_CAP = { pat: 40, poke: 20, chat: 60, look: 20, visit: 6, feed: 30 };

  /** 累计分 → 等级档（含下一档进度信息）。 */
  function levelFor(points) {
    let hit = LEVELS[0];
    for (const l of LEVELS) if (points >= l.at) hit = l;
    const idx = LEVELS.indexOf(hit);
    const next = idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;
    return {
      lv: hit.lv, nameKey: hit.nameKey, unlock: hit.unlock, at: hit.at,
      next: next ? { lv: next.lv, at: next.at } : null,
      toNext: next ? next.at - points : null,
    };
  }

  /** 就地记账（state 为 bond.json 解出的对象）：跨日先清当日账，再按封顶入账。
   *  返回 { gained, points }——gained=0 表示触顶/无效类，调用方可不打扰。 */
  function addPoints(state, kind, todayStr) {
    if (state.day !== todayStr) { state.day = todayStr; state.today = {}; }
    const per = POINTS[kind];
    const cap = DAILY_CAP[kind];
    if (!per || cap === undefined) return { gained: 0, points: state.points };
    const used = state.today[kind] || 0;
    const gained = Math.max(0, Math.min(per, cap - used));
    state.today[kind] = used + gained;
    state.points += gained;
    return { gained, points: state.points };
  }

  /** 回访对账：同日重复调用幂等；昨日来过→streak+1；断档→重起 1。就地更新 state。 */
  function visitToday(state, todayStr, yesterdayStr) {
    if (state.lastSeen === todayStr) return { streak: state.streak || 1, isNew: false };
    state.streak = state.lastSeen === yesterdayStr ? (state.streak || 0) + 1 : 1;
    state.lastSeen = todayStr;
    return { streak: state.streak, isNew: true };
  }

  /** 相伴总天数（v44.8 成长史）：today-firstSeen+1，首日即 1；坏档/时钟倒流
   *  下限 1——「她记得但你要看得见」，只涨不掉是羁绊的口径。UTC 日界做差
   *  （两侧同口径，差值与时区无关）。 */
  function daysTogether(firstSeenStr, todayStr) {
    const parse = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    };
    const a = parse(firstSeenStr);
    const b = parse(todayStr);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  // 稀有小剧场池：lv2 起解锁（[row, lineKey]）——台词键全显式列出禁拼接
  const MOMENTS = {
    dance: [
      ['dance', 'bond.moment.twirl'],
      ['dance', 'bond.moment.hum'],
    ],
    cheer: [
      ['cheer', 'bond.moment.proud'],
      ['cheer', 'bond.moment.gift'],
    ],
    words: [
      ['dance', 'bond.moment.soulIdle'],
      ['cheer', 'bond.moment.soulTogether'],
    ],
  };

  /** 每 5 分钟一查的触发概率（lv1=0 不触发；期望频率 ≈1 次/小时~1 次/50 分钟）。 */
  function momentChance(lv) {
    if (lv >= 4) return 0.10;
    if (lv >= 3) return 0.07;
    if (lv >= 2) return 0.05;
    return 0;
  }

  /** 按等级抽一个小剧场：池=已解锁各档并联；lv<2 返回 null。 */
  function pickMoment(lv, random = Math.random) {
    if (lv < 2) return null;
    const pools = [];
    for (const l of LEVELS) {
      if (l.lv <= lv && l.unlock) pools.push(...MOMENTS[l.unlock]);
    }
    const pick = pools[Math.floor(random() * pools.length)];
    return pick ? { row: pick[0], lineKey: pick[1] } : null;
  }

  const BOND_EXPORTS = {
    LEVELS, POINTS, DAILY_CAP, MOMENTS,
    levelFor, addPoints, visitToday, daysTogether, momentChance, pickMoment,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BOND_EXPORTS;
  else window.GuttoBond = BOND_EXPORTS;
})();
