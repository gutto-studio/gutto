// CORE bond 羁绊单测：node test/core-bond.test.js
// 验证：等级边界 / 每日封顶与防刷 / 炸毛零分 / 跨日清账 / 回访 streak 三态 /
// 小剧场门槛与池归属 / 台词键 zh/en 双字典在册。
'use strict';
const {
  LEVELS, POINTS, DAILY_CAP, MOMENTS,
  levelFor, addPoints, visitToday, daysTogether, momentChance, pickMoment,
} = require('../core/bond');
const zh = require('../i18n/zh');
const en = require('../i18n/en');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 等级边界（0/99→lv1；100/299→lv2；300/699→lv3；700+→lv4 满级 next=null）
assert(levelFor(0).lv === 1 && levelFor(99).lv === 1, '0-99 = lv1');
assert(levelFor(100).lv === 2 && levelFor(299).lv === 2, '100-299 = lv2');
assert(levelFor(300).lv === 3 && levelFor(699).lv === 3, '300-699 = lv3');
assert(levelFor(700).lv === 4 && levelFor(9999).lv === 4, '700+ = lv4');
assert(levelFor(700).next === null && levelFor(700).toNext === null, 'lv4 满级无下一档');
assert(levelFor(250).toNext === 300 - 250, 'toNext = 下一档门槛差');
{
  let ascending = true;
  for (let i = 1; i < LEVELS.length; i += 1) if (LEVELS[i].at <= LEVELS[i - 1].at) ascending = false;
  assert(ascending && LEVELS[0].at === 0, '等级门槛升序且首档 0');
}

// 2. 防刷：每类每日封顶（pat 2分/次 封 40 → 第 21 次起零入账）
{
  const st = { points: 0, day: '2026-10-10', today: {}, streak: 0, lastSeen: '' };
  let total = 0;
  for (let i = 0; i < 25; i += 1) total += addPoints(st, 'pat', '2026-10-10').gained;
  assert(total === DAILY_CAP.pat && st.points === 40, `pat 封顶 40（25 次实得 ${total}）`);
  assert(addPoints(st, 'frenzy', '2026-10-10').gained === 0, '炸毛零分（生气不是爱）');
  assert(addPoints(st, 'hug', '2026-10-10').gained === 0, '未知类零分');
}

// 3. 跨日清账：昨天封顶今天满血
{
  const st = { points: 40, day: '2026-10-09', today: { pat: 40 }, streak: 1, lastSeen: '2026-10-09' };
  const r = addPoints(st, 'pat', '2026-10-10');
  assert(r.gained === POINTS.pat && st.today.pat === POINTS.pat, '跨日当日账清零重新计');
  assert(st.points === 42, '累计分只涨不掉');
}

// 4. 回访 streak 三态：同日幂等 / 昨日续 / 断档重起
{
  const st = { points: 0, day: '', today: {}, streak: 3, lastSeen: '2026-10-10' };
  assert(visitToday(st, '2026-10-10', '2026-10-09').isNew === false && st.streak === 3, '同日重复幂等');
  st.lastSeen = '2026-10-09';
  assert(visitToday(st, '2026-10-10', '2026-10-09').streak === 4, '昨日来过 → 3+1=4');
  st.lastSeen = '2026-10-01';
  assert(visitToday(st, '2026-10-10', '2026-10-09').streak === 1, '断档 → 重起 1');
}

// 4b. 相伴总天数（v44.8 成长史）：首日即 1 / 跨月跨年对日历 / 坏档下限 1
assert(daysTogether('2026-10-11', '2026-10-11') === 1, '首日 = 1');
assert(daysTogether('2026-09-30', '2026-10-02') === 3, '跨月（9-30 → 10-02 = 3 天）');
assert(daysTogether('2025-12-31', '2026-01-01') === 2, '跨年（12-31 → 01-01 = 2 天）');
assert(daysTogether('2026-01-01', '2026-12-31') === 365, '整年 365（2026 平年）');
assert(daysTogether('', '2026-10-11') === 1 && daysTogether('坏档', '2026-10-11') === 1,
  '坏档/缺档 → 下限 1');
assert(daysTogether('2026-10-12', '2026-10-11') === 1, '时钟倒流 → 钳回 1（只涨不掉）');

// 5. 小剧场：lv1 不触发；概率阶梯；池归属（lv2 只 dance，lv3 加 cheer，lv4 含专属台词）
assert(momentChance(1) === 0, 'lv1 概率 0（不触发）');
assert(momentChance(2) === 0.05 && momentChance(3) === 0.07 && momentChance(4) === 0.10,
  '概率阶梯 0.05/0.07/0.10');
assert(pickMoment(1) === null, 'lv1 抽不到小剧场');
{
  let ok = true;
  for (let i = 0; i < 300; i += 1) {
    const m2 = pickMoment(2, Math.random);
    const m3 = pickMoment(3, Math.random);
    const m4 = pickMoment(4, Math.random);
    if (m2.row !== 'dance') ok = false;
    if (m3.row !== 'dance' && m3.row !== 'cheer') ok = false;
    if (m4.lineKey !== 'bond.moment.soulIdle' && m4.lineKey !== 'bond.moment.soulTogether'
      && !MOMENTS.dance.concat(MOMENTS.cheer).some((e) => e[1] === m4.lineKey)) ok = false;
  }
  assert(ok, '300 抽池归属零越界');
}

// 6. 台词键 zh/en 双字典在册（等级名/解锁/小剧场/升级/连访——漏翻当天炸）
{
  const keys = ['bond.levelup', 'bond.streak', 'bond.stat.streak', 'bond.stat.together',
    'bond.stat.progress', 'bond.stat.maxed'];
  for (const l of LEVELS) {
    keys.push(l.nameKey);
    if (l.unlock) keys.push(`bond.unlock.${l.unlock}`);
  }
  for (const pool of Object.values(MOMENTS)) for (const [, lineKey] of pool) keys.push(lineKey);
  const missing = [];
  for (const k of keys) {
    if (!(k in zh)) missing.push(`zh:${k}`);
    if (!(k in en)) missing.push(`en:${k}`);
  }
  assert(missing.length === 0, `bond 键 ${keys.length} 条全在字典${missing.length ? `，缺：${missing.join(',')}` : ''}`);
}

// 7. 升级路径积分速算：一天自然玩法（40 pat+20 poke+60 chat+20 look+6 visit
//   +30 feed=176）能到 lv2（100），约两天亲近（300）——曲线不肝不氪
//   （v44.17 C-3 加 feed 类别：30 计入单日上限，曲线结论不变）
{
  const dayMax = Object.keys(DAILY_CAP).reduce((s, k) => s + DAILY_CAP[k], 0);
  assert(dayMax === 176 && dayMax >= 100, `单日满打满算 ${dayMax} 分（够升 lv2）`);
}

// 8. feed 类别（v44.17 C-3 投喂）：3 分/次、日封顶 30、封顶后 gained=0
{
  const st = { points: 0, day: '2026-10-11', today: {}, streak: 0, lastSeen: '' };
  let total = 0;
  for (let i = 0; i < 20; i += 1) total += addPoints(st, 'feed', '2026-10-11').gained;
  assert(total === DAILY_CAP.feed && st.points === 30, `feed 封顶 30（20 次实得 ${total}）`);
  assert(addPoints(st, 'feed', '2026-10-11').gained === 0, '触顶后 gained=0（投喂演「吃撑了」的依据）');
  assert(addPoints(st, 'feed', '2026-10-12').gained === 3, '跨日重新可吃');
}

process.exit(failed ? 1 : 0);
