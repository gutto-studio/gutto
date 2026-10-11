// 阻塞式审批扩面单测：node test/approval-block.test.js
// 验证（v44.5 三家真拦）：zcode 顶层 strict decision / claude·codex hookSpecificOutput
// 形状 / 无决定时 zcode 输出必须为空（{} 撞必填校验）/ 超时 fail-open /
// camelCase toolName（zcode 信封）字段提取 / 队列 source 标签。
// 沙箱：GUTTO_TEST_HOME=/tmp/gutto-apb-*（字面量路径，安全闸口径）。
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '../../scripts/agent-hook.sh');
const APPROVE = path.resolve(__dirname, '../../scripts/gutto-approve.sh');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

function sandboxHome(name) {
  const home = path.join(os.tmpdir(), `gutto-apb-${name}-${process.pid}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, 'approvals', 'queue'), { recursive: true });
  return home;
}

/** 跑一发 PermissionRequest 钩子；verdict 非空=入队后 0.3s 下决策。 */
function runHook({ caseName, host, viaArgv, verdict, timeoutSec, payload, approvalOn = true }) {
  return new Promise((resolve) => {
    const home = sandboxHome(caseName);
    const args = [HOOK, 'PermissionRequest'];
    if (viaArgv) args.push(host);
    const env = {
      ...process.env,
      GUTTO_TEST_HOME: home,
      GUTTO_APPROVAL: approvalOn ? '1' : '0',
      GUTTO_SFX: '0',
    };
    if (!viaArgv && host) env.GUTTO_HOST = host;
    if (timeoutSec) env.GUTTO_APPROVAL_TIMEOUT = String(timeoutSec);
    const child = spawn('/bin/bash', args, { env });
    let out = '';
    let queued = null;               // decide 前抓的请求文件（decide 会摘走队列）
    child.stdout.on('data', (d) => { out += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    const qdir = path.join(home, 'approvals', 'queue');
    // 轮询队列拿 id（入队=hook 已进等待段）
    const poll = setInterval(() => {
      let id = '';
      try {
        const f = fs.readdirSync(qdir).find((x) => x.endsWith('.json'));
        if (f) {
          id = f.replace(/\.json$/, '');
          if (!queued) {
            try { queued = JSON.parse(fs.readFileSync(path.join(qdir, f), 'utf8')); } catch (e) { /* 半写：下一拍再抓 */ }
          }
        }
      } catch (e) { /* 目录还没建=未入队 */ }
      if (id && verdict) {
        clearInterval(poll);
        spawnSync('/bin/bash', [APPROVE, 'decide', id, verdict, '--via', 'test'],
          { env: { ...process.env, GUTTO_TEST_HOME: home } });
      } else if (id && !verdict) {
        clearInterval(poll);   // 无决策场景：超时路径自己走
      }
    }, 100);
    child.on('exit', (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      resolve({ code, out: out.trim(), home, queued });
    });
    child.stdin.end(payload);
  });
}

const PAYLOAD = JSON.stringify({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', cwd: '/tmp/apb-proj' });
const PAYLOAD_ZCODE = JSON.stringify({ hookEventName: 'PermissionRequest', toolName: 'Bash', cwd: '/tmp/apb-proj' });

(async () => {
  // 1. zcode + allow：顶层 strict decision（camelCase 信封也要解出 toolName）
  {
    const r = await runHook({ caseName: 'zallow', host: 'zcode', viaArgv: true, verdict: 'allow', payload: PAYLOAD_ZCODE });
    const j = JSON.parse(r.out);
    assert(j.decision === 'allow' && typeof j.reason === 'string',
      `zcode allow → 顶层 {"decision":"allow"}（实际 ${r.out.slice(0, 60)}）`);
  }
  // 2. zcode + deny
  {
    const r = await runHook({ caseName: 'zdeny', host: 'zcode', viaArgv: true, verdict: 'deny', payload: PAYLOAD });
    const j = JSON.parse(r.out);
    assert(j.decision === 'deny', `zcode deny → decision=deny（实际 ${r.out.slice(0, 60)}）`);
  }
  // 3. zcode 审批关：不走阻塞路径，直接空输出退出（提醒路径照走，不挂）
  {
    const r = await runHook({ caseName: 'zoff', host: 'zcode', viaArgv: true, verdict: null, approvalOn: false, payload: PAYLOAD });
    assert(r.code === 0 && r.out === '', `zcode 审批关 → 空输出 exit 0（code ${r.code}, out "${r.out.slice(0, 40)}"）`);
  }
  // 3b. zcode 超时 fail-open：空输出不挂 agent
  {
    const r = await runHook({ caseName: 'ztimeout', host: 'zcode', viaArgv: true, verdict: null, timeoutSec: 1, payload: PAYLOAD });
    assert(r.code === 0 && r.out === '', `zcode 超时 → 空输出 exit 0（code ${r.code}, out "${r.out.slice(0, 40)}"）`);
  }
  // 4. codex + allow：hookSpecificOutput 同 claude 形状（env 前缀注入）
  {
    const r = await runHook({ caseName: 'callow', host: 'codex', viaArgv: false, verdict: 'allow', payload: PAYLOAD });
    const j = JSON.parse(r.out);
    assert(j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision === 'allow',
      `codex allow → hookSpecificOutput.permissionDecision（实际 ${r.out.slice(0, 70)}）`);
  }
  // 5. claude + deny（既有行为回归）
  {
    const r = await runHook({ caseName: 'cdeny', host: 'claude', viaArgv: false, verdict: 'deny', payload: PAYLOAD });
    const j = JSON.parse(r.out);
    assert(j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision === 'deny',
      'claude deny 回归不破');
  }
  // 6. 队列请求侧标签跟着宿主走（source/tool 在请求文件，decide 前抓取）
  {
    const r = await runHook({ caseName: 'src', host: 'zcode', viaArgv: true, verdict: 'deny', payload: PAYLOAD });
    assert(r.queued && r.queued.source === 'zcode', `队列 source=zcode（实际 ${r.queued && r.queued.source}）`);
    assert(r.queued && r.queued.tool === 'Bash', `tool 提取不空（实际 ${r.queued && r.queued.tool}）`);
  }
  process.exit(failed ? 1 : 0);
})();
