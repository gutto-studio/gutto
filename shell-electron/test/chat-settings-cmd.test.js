// /settings 指令桥测试：node test/chat-settings-cmd.test.js
// 验证（v44.2 自我说明书轮）：① --list-commands 与 /help 都列 /settings
// ② /settings（含 /设置 别名、页名、乱参回落）经事件文件落正确 tab
// ③ bin/gutto settings 白名单（乱参 usage 退 2）。
// 全程 GUTTO_TEST_HOME 隔离——不碰真实 ~/.gutto（记忆/事件/操作记录）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHAT = path.resolve(__dirname, '../../scripts/gutto-chat.sh');
const CLI = path.resolve(__dirname, '../../bin/gutto');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gutto-settings-'));
const env = { ...process.env, GUTTO_TEST_HOME: tmp };
// bin/gutto 口径：GUTTO_TEST_HOME 整目录替换 ~/.gutto；settings 走专属文件
// events/settings.json（current.json 是高频共享总线，开窗类会被 pre_tool 挤兑）
function eventJSON() {
  try {
    return JSON.parse(fs.readFileSync(path.join(tmp, 'events', 'settings.json'), 'utf8'));
  } catch (e) { return null; }
}

// 1. 指令清单两处都列 /settings
{
  const list = spawnSync('/bin/bash', [CHAT, '--list-commands'], { encoding: 'utf8' });
  assert(list.status === 0 && /^\/settings\t/m.test(list.stdout), '--list-commands 列出 /settings');
  const help = spawnSync('/bin/bash', [CHAT, '/help'], { encoding: 'utf8', env });
  assert(help.status === 0 && help.stdout.includes('/settings 或 /设置'), '/help 列出 /settings');
}

// 2. /settings 指令四路：默认页 / 页名 / 别名+复合页名 / 乱参回落
function runCmd(text) {
  return spawnSync('/bin/bash', [CHAT, text], { encoding: 'utf8', env });
}
{
  const r1 = runCmd('/settings');
  assert(r1.status === 0 && r1.stdout.includes('这就开'), '/settings 正常回复');
  const e1 = eventJSON();
  assert(e1 && e1.type === 'settings' && e1.tab === 'settings', '事件落默认页 settings');

  runCmd('/settings play');
  const e2 = eventJSON();
  assert(e2 && e2.type === 'settings' && e2.tab === 'play', '/settings play 落 play');

  runCmd('/设置 records/history');
  const e3 = eventJSON();
  assert(e3 && e3.type === 'settings' && e3.tab === 'records/history', '/设置 别名+复合页名落 records/history');

  runCmd('/settings 随便写的');
  const e4 = eventJSON();
  assert(e4 && e4.tab === 'settings', '乱参回落默认页');

  const actPath = path.join(tmp, 'activity.tsv');
  const act = fs.existsSync(actPath) ? fs.readFileSync(actPath, 'utf8') : '';
  assert(act.includes('打开设置'), '操作记录落账（GUTTO_TEST_HOME，不碰真实家）');
}

// 3. CLI 直调：白名单内直通、乱参 usage 退 2
{
  const ok = spawnSync('/bin/bash', [CLI, 'settings', 'records'], { encoding: 'utf8', env });
  assert(ok.status === 0 && eventJSON().tab === 'records', 'CLI settings records 落 records');
  const bad = spawnSync('/bin/bash', [CLI, 'settings', 'bogus'], { encoding: 'utf8' });
  assert(bad.status === 2 && (bad.stderr || '').includes('usage'), 'CLI 乱参 usage 退 2');
}

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
