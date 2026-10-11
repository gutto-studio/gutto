// CORE · 昼夜节律（v44.1 入睡/唤醒）：纯函数。
// 阈值复用 ambient.sleepThreshold（白天 60s / 夜间 23:00–05:00 15s 空闲入睡
// ——mac 壳同值，两壳性格一致）。台词层（晨/午/晚问候、晚安日报、深夜静默）
// 由 gutto-life.py daemon 负责，本层只管身子的睡与醒。
// IIFE 包裹的顶层 const 不进全局词法环境——防 classic script 跨文件重名
// （QA44 实测：WANDER 重名声明 = SyntaxError 整脚本死）。
'use strict';

(function () {
  const { sleepThreshold } = (typeof module !== 'undefined' && module.exports)
    ? require('./ambient')
    : window.GuttoCore;

  const SLEEP_ROW = 'sleep';    // 包内现成行（缺席时 renderer 跳过入睡不炸）
  const WAKE_ROW = 'stretch';   // 被拽醒：伸懒腰回神（戳醒走互动反应行）

  /** 空闲够点没？idleSeconds 自上次用户互动/散步起算。 */
  function shouldSleep({ idleSeconds = 0, hour = 12 } = {}) {
    return idleSeconds >= sleepThreshold(hour);
  }

  const RHYTHM_EXPORTS = { shouldSleep, SLEEP_ROW, WAKE_ROW };
  if (typeof module !== 'undefined' && module.exports) module.exports = RHYTHM_EXPORTS;
  else window.GuttoRhythm = RHYTHM_EXPORTS;
})();
