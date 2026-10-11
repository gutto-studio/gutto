// alive 心跳判活护栏：node test/alive-heartbeat.test.js
// 验证（v44.8.1 审稿 H-2/H-3）：①无心跳=ping 判死退 1（判活不再看环境进程表
// ——测试密闭的根基）②新鲜心跳=pong 退 0 ③过期心跳(60s)=判死 ④判死不影响
// 事件桥无条件写（react 在无壳沙箱照落 events/current.json——旧 pet_alive 门
// 让同一条测试有壳绿/无壳红，审稿环境实红过）。
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
  const home = path.join(os.tmpdir(), `gutto-ahb-${name}-${process.pid}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  return home;
}

function gutto(home, ...args) {
  return spawnSync('/bin/bash', [GUTTO, ...args],
    { env: { ...process.env, GUTTO_TEST_HOME: home }, encoding: 'utf8', timeout: 15000 });
}

// 1. 无心跳 → ping 退 1（沙箱无壳=明确判死）
{
  const home = sandbox('dead');
  const r = gutto(home, 'ping');
  assert(r.status === 1, `无心跳 ping 退 1（实际 ${r.status}）`);
}

// 2. 新鲜心跳 → pong 退 0
{
  const home = sandbox('alive');
  fs.writeFileSync(path.join(home, 'shell.heartbeat'), String(Date.now()), 'utf8');
  const r = gutto(home, 'ping');
  assert(r.status === 0 && (r.stdout || '').includes('pong'),
    `新鲜心跳 ping 退 0 + pong（实际 ${r.status} / ${(r.stdout || '').trim()}）`);
}

// 3. 过期心跳（mtime 拨回 60s 前）→ 判死（kill -9 场景的 30s 过期兜底）
{
  const home = sandbox('stale');
  const hb = path.join(home, 'shell.heartbeat');
  fs.writeFileSync(hb, '0', 'utf8');
  const past = new Date(Date.now() - 60 * 1000);
  fs.utimesSync(hb, past, past);
  const r = gutto(home, 'ping');
  assert(r.status === 1, `过期心跳(60s) ping 退 1（实际 ${r.status}）`);
}

// 4. 判死不影响事件桥：无心跳沙箱里 react 照写事件文件（无条件写）
{
  const home = sandbox('bridge');
  const r = gutto(home, 'react', 'celebrate', '3');
  const ev = JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8'));
  assert(r.status === 0 && ev.type === 'react' && ev.kind === 'celebrate',
    `无壳沙箱 react 照写 {type:react, kind:celebrate}（实际 ${JSON.stringify(ev)}）`);
}

process.exit(failed ? 1 : 0);
