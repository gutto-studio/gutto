// start 上班通道护栏：node test/start-channel.test.js
// 验证（v44.8）：①SessionStart 写事件文件 {type:start, project} ②20s 节流
// （同 key 二连发第二发不重写）③输出 {} 不回话（非阻塞，行由壳侧 EVENT_ROW
// 播）④install-hooks zcode merge 落 SessionStart 注册（process/3000ms/无宿主标签）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '../../scripts/agent-hook.sh');
const INSTALLER = path.resolve(__dirname, '../../scripts/install-hooks.py');
// 节流闸是全局 /tmp 文件（按 key=start，与沙箱无关）：测试自清闸防上一轮残留
const THROTTLE_FILE = '/tmp/gutto-ev-throttle.start';
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

function sandbox(name) {
  const home = path.join(os.tmpdir(), `gutto-stc-${name}-${process.pid}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  return home;
}

function startHook(home, payload, freshGate = true) {
  if (freshGate) fs.rmSync(THROTTLE_FILE, { force: true });
  return spawnSync('/bin/bash', [HOOK, 'SessionStart'],
    { env: { ...process.env, GUTTO_TEST_HOME: home, GUTTO_SFX: '0' },
      input: payload, encoding: 'utf8', timeout: 15000 });
}

const PAYLOAD = JSON.stringify({ session_id: 't', cwd: '/tmp/p' });

// 1. 首发过闸：事件文件 {type:start, project:p} + exit 0 + 输出 {}（不回话）
{
  const home = sandbox('ok');
  const r = startHook(home, PAYLOAD);
  const ev = JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8'));
  assert(r.status === 0, `exit 0（实际 ${r.status}）`);
  assert(ev.type === 'start' && ev.project === 'p',
    `事件形状 {type:start, project:p}（实际 ${JSON.stringify(ev)}）`);
  assert((r.stdout || '').trim() === '{}', '输出 {}（上班不回话，不阻塞宿主）');
}

// 2. 节流：20s 内二连发，第二发不重写事件文件（mtime 不动）
{
  const home = sandbox('th');
  startHook(home, PAYLOAD);
  const f = path.join(home, 'events/current.json');
  const m1 = fs.statSync(f).mtimeMs;
  const r2 = startHook(home, PAYLOAD, false);
  const m2 = fs.statSync(f).mtimeMs;
  assert(r2.status === 0 && m1 === m2, '20s 内二连发 → 第二发节流不重写（mtime 不动）');
}

// 3. 清闸后新沙箱照写：项目名取 cwd basename（换项目名也对）
{
  const home = sandbox('fresh');
  const r = startHook(home, JSON.stringify({ session_id: 't', cwd: '/tmp/other-proj' }));
  const ev = JSON.parse(fs.readFileSync(path.join(home, 'events/current.json'), 'utf8'));
  assert(r.status === 0 && ev.type === 'start' && ev.project === 'other-proj',
    `清闸后照写 {type:start, project:other-proj}（实际 ${JSON.stringify(ev)}）`);
}

// 4. 注册侧：zcode merge 落 SessionStart（process 钩子 / timeoutMs 3000 /
//    argv 只带事件名不带宿主标签——非阻塞，对照 PermissionRequest 的 zcode 标签）
{
  const r = spawnSync('python3', [INSTALLER, 'zcode', HOOK],
    { input: '{"hooks":{"events":{}}}', encoding: 'utf8', timeout: 15000 });
  let h = null;
  try {
    const cfg = JSON.parse(r.stdout);
    const entry = (cfg.hooks.events.SessionStart || [])
      .find((e) => JSON.stringify(e).includes('agent-hook.sh'));
    h = entry && entry.hooks && entry.hooks[0];
  } catch (e) { /* 解析失败=h=null，走 FAIL 分支 */ }
  assert(r.status === 0 && !!h && h.type === 'process' && h.timeoutMs === 3000
    && h.args.length === 2 && h.args[1] === 'SessionStart' && !h.args.includes('zcode'),
    'zcode 注册形状 process + timeoutMs 3000 + argv 仅事件名（无宿主标签）');
}

process.exit(failed ? 1 : 0);
