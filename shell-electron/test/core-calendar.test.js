// 日期彩蛋看守（v44.16 C-2）：node test/core-calendar.test.js
// 验证：①specialDay 判定（周年 > 相伴里程碑 > 固定节日，坏档静默 null）
// ②FIXED/TOGETHER 引用的键与 UI 字典四表一一对应（防表和字典漂移——
// 加节日先去 core/calendar.js 登记，字典没键这里红）
// ③daysTogether 与 bond.daysTogether 同口径（UTC 日界 +1、下限 1）。
'use strict';
const calendar = require('../core/calendar');
const zh = require('../i18n/zh');
const en = require('../i18n/en');
const ja = require('../i18n/ja');
const ko = require('../i18n/ko');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 固定节日
{
  assert(calendar.specialDay('2027-01-01', '2026-06-01').key === 'special.newyear', '元旦');
  assert(calendar.specialDay('2027-02-14', '2026-06-01').key === 'special.valentine', '情人节');
  assert(calendar.specialDay('2027-10-31', '2026-06-01').key === 'special.halloween', '万圣夜');
  assert(calendar.specialDay('2027-12-24', '2026-06-01').key === 'special.christmas', '平安夜');
  assert(calendar.specialDay('2027-12-25', '2026-06-01').key === 'special.christmas', '圣诞节');
  assert(calendar.specialDay('2027-06-01', '2026-06-01') === null
    || calendar.specialDay('2027-06-01', '2026-06-01').key === 'special.anniv', '普通日（firstSeen 同月日归周年）');
  assert(calendar.specialDay('2027-03-15', '2026-06-01') === null, '寻常日 = null');
}

// 2. 周年优先 + 年数参数
{
  const a1 = calendar.specialDay('2027-06-01', '2026-06-01');
  assert(a1 && a1.key === 'special.anniv' && a1.params.years === 1, '1 周年');
  const a3 = calendar.specialDay('2029-06-01', '2026-06-01');
  assert(a3 && a3.key === 'special.anniv' && a3.params.years === 3, '3 周年');
  // 月日相同但不满一年（同年内）不触发
  assert(calendar.specialDay('2026-06-01', '2026-06-01') === null, '首日=相遇日不算周年');
}

// 3. 相伴里程碑；周年撞日时周年优先
{
  // 相伴第 100 天 = firstSeen 当天算第 1 天（差+1 口径）：6/1 + 99 = 9/8
  assert(calendar.specialDay('2026-09-08', '2026-06-01').key === 'special.days100', '相伴 100 天');
  assert(calendar.specialDay('2026-09-09', '2026-06-01') === null, '101 天不是里程碑');
  const d365 = calendar.specialDay('2027-06-01', '2026-06-01');
  assert(d365.key === 'special.anniv', '365 天撞 1 周年 → 周年优先');
}

// 4. 坏档静默（异常不炸脑）
{
  assert(calendar.specialDay('', '') === null, '空日期 = null');
  assert(calendar.specialDay('garbage', 'also-bad') === null, '坏格式 = null');
  assert(calendar.specialDay('2027-01-01', '') && calendar.specialDay('2027-01-01', '').key
    === 'special.newyear', '无 firstSeen 仍过节日');
}

// 5. daysTogether 同 bond 口径（UTC 日界差 +1、下限 1）
{
  assert(calendar.daysTogether('2026-06-01', '2026-06-01') === 1, '首日 = 1');
  assert(calendar.daysTogether('2026-06-01', '2027-06-01') === 366, '跨年（含 2 月平年）= 366');
  assert(calendar.daysTogether('bad', '2027-06-01') === 1, '坏档下限 1');
}

// 6. 键集对账：FIXED/TOGETHER/周年分支引用的每个键必须在四表都在册（防漂移；
// anniv 不在任何表里——动态键 t(sp.key) 是两道静态闸的盲区，此处显式点名，审稿 P2-4）
{
  const keys = [...new Set([...calendar.FIXED.map((f) => f[1]),
    ...calendar.TOGETHER.map((t) => t.key), 'special.anniv'])];
  const dicts = { zh, en, ja, ko };
  const missing = [];
  for (const k of keys) {
    for (const [name, dict] of Object.entries(dicts)) {
      if (!(k in dict)) missing.push(`${k}@${name}`);
    }
  }
  assert(keys.length >= 6, `彩蛋键在册（${keys.length} 个：${keys.join(',')}）`);
  assert(!missing.length, `彩蛋键四表全在${missing.length ? `，缺：${missing.join(',')}` : ''}`);
  // 插值参数对账：anniv 的 {years} 四语一致（占位符不得翻译）
  const ph = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
  assert(ph(zh['special.anniv']) === ph(en['special.anniv'])
    && ph(zh['special.anniv']) === ph(ja['special.anniv'])
    && ph(zh['special.anniv']) === ph(ko['special.anniv']), 'special.anniv 占位符四语一致');
}

process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
