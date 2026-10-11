// react 六情绪通道护栏：node test/react-channel.test.js
// 验证（v44.7 A-2 断链复活）：CLI 无条件记账（activity.tsv 有 react 行——旧
// 通道从没写过的账）+ 事件文件形状（type/kind/ttl）+ 非法 kind 退 2 +
// 非数字 ttl 钳回 6 + 六 kind 全过白名单。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GUTTO = path.resolve(__dirname, '../../bin/gutto');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

function sandbox(name) {
  const home = path.join(os.tmpdir(), `gutto-rc-${name}-${process.pid}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  return home;
}

function react(home, ...args) {
  return spawnSync('/bin/bash', [GUTTO, 'react', ...args],
    { env: { ...process.env, GUTTO_TEST_HOME: home }, encoding: 'utf8', timeout: 15000 });
}

// 1. celebrate 3s：exit 0 + activity 记账 + 事件文件三字段齐
{
  const home = sandbox('ok');
  const r = react(home, 'celebrate', '3');
  const ev = JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8'));
  const act = fs.readFileSync(path.join(home, 'activity.tsv'), 'utf8');
  assert(r.status === 0, `exit 0（实际 ${r.status}）`);
  assert(ev.type === 'react' && ev.kind === 'celebrate' && ev.ttl === 3,
    `事件形状 {type:react, kind:celebrate, ttl:3}（实际 ${JSON.stringify(ev)}）`);
  assert(act.includes('\treact\t') && act.includes('celebrate'),
    `activity.tsv 有 react 行（旧通道从未记过账）`);
}

// 2. 非法 kind：usage 退 2，零副作用
{
  const home = sandbox('bad');
  const r = react(home, 'happy');
  assert(r.status === 2, `非法 kind 退 2（实际 ${r.status}）`);
  assert(!fs.existsSync(path.join(home, 'activity.tsv')), '非法 kind 零记账');
}

// 3. 非数字 ttl：钳回默认 6
{
  const home = sandbox('ttl');
  const r = react(home, 'working', 'abc');
  const ev = JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8'));
  assert(r.status === 0 && ev.ttl === 6, `ttl 非数字 → 6（实际 ${ev.ttl}）`);
}

// 4. 六 kind 全过白名单（每一个都该 exit 0 且留下事件）
{
  let allOk = true;
  for (const kind of ['celebrate', 'working', 'alert', 'resting', 'low-energy', 'charging']) {
    const home = sandbox(`six-${kind}`);
    const r = react(home, kind, '2');
    let ok = r.status === 0;
    try {
      ok = ok && JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8')).kind === kind;
    } catch (e) { ok = false; }
    if (!ok) allOk = false;
  }
  assert(allOk, '六 kind 全过（celebrate/working/alert/resting/low-energy/charging）');
}

process.exit(failed ? 1 : 0);
