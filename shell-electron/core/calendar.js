// CORE · 日期彩蛋（v44.16 C-2）：周年 / 相伴里程碑 / 固定节日的判定。
// 与 bond 同款纪律：纯函数零 IO 零时钟（日期串由调用方注入，本地时区口径）；
// IIFE 包裹防 classic script 顶层 const 跨文件重名（QA44 实测教训）。
// 台词键 special.* 与 UI 字典四表一一对应——test/core-calendar.test.js 看守对账，
// 加节日先来这登记，字典没键测试会红。
'use strict';

(function () {
  /** YYYY-MM-DD → {y, md:'MM-DD'}；坏档返回 null（彩蛋静默跳过，异常不炸脑）。 */
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? { y: +m[1], md: `${m[2]}-${m[3]}` } : null;
  }

  /** 相伴总天数（与 bond.daysTogether 同口径：UTC 日界做差 +1，下限 1）。
   *  自带实现——core 模块平级互不依赖（ambient/interact/bond/rhythm 同款）。 */
  function daysTogether(firstSeenStr, todayStr) {
    const utc = (s) => { const p = parseDate(s); return p ? Date.UTC(p.y, +p.md.slice(0, 2) - 1, +p.md.slice(3)) : NaN; };
    const a = utc(firstSeenStr);
    const b = utc(todayStr);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  // 固定节日（MM-DD → special.* 键）；同日多节取先登记的（valentine 与 02-14 唯一）
  const FIXED = [
    ['01-01', 'special.newyear'],
    ['02-14', 'special.valentine'],
    ['10-31', 'special.halloween'],
    ['12-24', 'special.christmas'],
    ['12-25', 'special.christmas'],
  ];

  // 相伴里程碑（相伴第 N 天 → 键）——与周年撞日时周年优先（365≠366 天然错开）
  const TOGETHER = [
    { at: 100, key: 'special.days100' },
    { at: 365, key: 'special.days365' },
  ];

  /**
   * 今天有什么彩蛋。{ key, params } | null。
   * 优先级：相遇周年 > 相伴里程碑 > 固定节日（一年一次的比年年过的优先）。
   * 已知边界（登记接受，主人 2026-10-11 审阅口径）：02-29 相遇的周年在平年
   * 触发不到（月日不重合），要等下一个闰年——补折 02-28 的复杂度不值，
   * 且该用户仍有 100/365 天里程碑兜底。
   */
  function specialDay(todayStr, firstSeenStr) {
    const today = parseDate(todayStr);
    if (!today) return null;
    const first = parseDate(firstSeenStr);
    if (first) {
      if (first.md === today.md) {
        const years = today.y - first.y;
        if (years >= 1) return { key: 'special.anniv', params: { years } };
      }
      const days = daysTogether(firstSeenStr, todayStr);
      for (const m of TOGETHER) {
        if (days === m.at) return { key: m.key };
      }
    }
    for (const [md, key] of FIXED) {
      if (md === today.md) return { key };
    }
    return null;
  }

  const CALENDAR_EXPORTS = { specialDay, daysTogether, FIXED, TOGETHER };
  if (typeof module !== 'undefined' && module.exports) module.exports = CALENDAR_EXPORTS;
  else window.GuttoCalendar = CALENDAR_EXPORTS;
})();
