// CORE rhythm 昼夜入睡单测：node test/core-rhythm.test.js
// 验证：shouldSleep 阈值边界（白天 60s / 夜间 23-5 点 15s，mac 壳同值）/
// 行常量在包清单（sleep/stretch 缺行=renderer 跳过，表不许写错）。
'use strict';
const { shouldSleep, SLEEP_ROW, WAKE_ROW } = require('../core/rhythm');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 白天阈值 60s（hour 5-22）：59.9 不睡 / 60 睡；边界时点 5:00 起白天、22:59 仍白天
assert(!shouldSleep({ idleSeconds: 59.9, hour: 14 }), '白天 59.9s 不睡');
assert(shouldSleep({ idleSeconds: 60, hour: 14 }), '白天 60s 入睡');
assert(!shouldSleep({ idleSeconds: 15, hour: 5 }), '05:00 已是白天（15s 不睡）');
assert(!shouldSleep({ idleSeconds: 15, hour: 22 }), '22:59 仍白天（15s 不睡）');

// 2. 夜间阈值 15s（hour >=23 或 <5，与 gutto-life daemon SLEEP_FROM/TO=23/5 同窗）
assert(!shouldSleep({ idleSeconds: 14.9, hour: 23 }), '23:00 起 14.9s 不睡');
assert(shouldSleep({ idleSeconds: 15, hour: 23 }), '23:00 起 15s 入睡');
assert(shouldSleep({ idleSeconds: 15, hour: 0 }), '00:00 15s 入睡');
assert(shouldSleep({ idleSeconds: 15, hour: 4 }), '04:59 15s 入睡');

// 3. 行常量在包 23 行清单内（缺行时 renderer 跳过入睡/懒腰，不炸）
{
  const ROWS = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting',
    'running', 'review', 'sleep', 'yawn', 'cheer', 'stretch', 'sit', 'look-left', 'look-right',
    'dance', 'think', 'angry', 'crawl', 'entrance', 'exit', 'first-greeting'];
  assert(ROWS.includes(SLEEP_ROW), `SLEEP_ROW=${SLEEP_ROW} 在包清单`);
  assert(ROWS.includes(WAKE_ROW), `WAKE_ROW=${WAKE_ROW} 在包清单`);
}

// 4. 缺省参数安全（hour 缺省正午=白天档）
assert(!shouldSleep({ idleSeconds: 30 }), '缺省 hour=12 走白天档（30s 不睡）');
assert(shouldSleep({ idleSeconds: 60 }), '缺省 hour=12 60s 入睡');

process.exit(failed ? 1 : 0);
