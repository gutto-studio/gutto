// 统一测试入口（v43.12 治理 H）：一条命令跑全部测试。
// 用法：npm test（CI 与本地共用同一入口；node 经 PATH 解析，npm script 必有）。
// 实现：子进程逐文件跑（测试文件自带 process.exit——进程内 require 会在
// 第一个文件就断流，实测假绿教训）；任一非零=整体非零。
// 形状说明：全字面量参数是刻意的（安全闸不认变量进 argv），新增测试照抄一段。
'use strict';
const { spawnSync } = require('child_process');
const OPTS = { cwd: __dirname + '/..', stdio: 'inherit' };
let failed = 0;

function judge(file, r) {
  if (r.status !== 0) { failed += 1; console.error(`   ${file} exit ${r.status}`); }
}

console.log('\n== test/shell-parse.test.js');
judge('test/shell-parse.test.js', spawnSync('node', ['test/shell-parse.test.js'], OPTS));
console.log('\n== test/i18n.test.js');
judge('test/i18n.test.js', spawnSync('node', ['test/i18n.test.js'], OPTS));
console.log('\n== test/core-ambient.test.js');
judge('test/core-ambient.test.js', spawnSync('node', ['test/core-ambient.test.js'], OPTS));
console.log('\n== test/gutto-card.test.js');
judge('test/gutto-card.test.js', spawnSync('node', ['test/gutto-card.test.js'], OPTS));
console.log('\n== test/no-raw-color.test.js');
judge('test/no-raw-color.test.js', spawnSync('node', ['test/no-raw-color.test.js'], OPTS));
// v44 互动+漫游（core/interact.js）与 v44.1 昼夜（core/rhythm.js）——本窗落地
console.log('\n== test/core-interact.test.js');
judge('test/core-interact.test.js', spawnSync('node', ['test/core-interact.test.js'], OPTS));
console.log('\n== test/core-rhythm.test.js');
judge('test/core-rhythm.test.js', spawnSync('node', ['test/core-rhythm.test.js'], OPTS));
// v44.2 /settings 指令桥（事件文件 + 白名单，GUTTO_TEST_HOME 隔离）
console.log('\n== test/chat-settings-cmd.test.js');
judge('test/chat-settings-cmd.test.js', spawnSync('node', ['test/chat-settings-cmd.test.js'], OPTS));
// v44.3 羁绊（core/bond.js）
console.log('\n== test/core-bond.test.js');
judge('test/core-bond.test.js', spawnSync('node', ['test/core-bond.test.js'], OPTS));
// v44.5 阻塞式审批扩面（zcode 顶层 decision / codex 同 claude 形状）
console.log('\n== test/approval-block.test.js');
judge('test/approval-block.test.js', spawnSync('node', ['test/approval-block.test.js'], OPTS));
// v44.7 react 六情绪通道复活（CLI 记账 + 事件桥）
console.log('\n== test/react-channel.test.js');
judge('test/react-channel.test.js', spawnSync('node', ['test/react-channel.test.js'], OPTS));
// v44.8 上班通道（SessionStart 事件桥 + 20s 节流 + zcode 注册形状）
console.log('\n== test/start-channel.test.js');
judge('test/start-channel.test.js', spawnSync('node', ['test/start-channel.test.js'], OPTS));
// v44.8.1 审稿收口（心跳判活 + 事件桥无条件写=测试密闭）
console.log('\n== test/alive-heartbeat.test.js');
judge('test/alive-heartbeat.test.js', spawnSync('node', ['test/alive-heartbeat.test.js'], OPTS));
// round3 R-1/E-1/E-3 收口（台词语言表四表镜像 + 解析器实跑 + 裸 CJK 扫描）
console.log('\n== test/lines-i18n.test.js');
judge('test/lines-i18n.test.js', spawnSync('node', ['test/lines-i18n.test.js'], OPTS));
// v44.16 C-2 日期彩蛋（判定纯函数 + special 键四表对账）
console.log('\n== test/core-calendar.test.js');
judge('test/core-calendar.test.js', spawnSync('node', ['test/core-calendar.test.js'], OPTS));

if (failed) {
  console.error(`\n${failed}/15 个测试文件失败`);
  process.exit(1);
}
console.log('\n全部 15 个测试文件通过');
