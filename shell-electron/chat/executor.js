// chat 执行器（main 进程用）：spawn /bin/bash gutto-chat.sh。
// v44.7 起用户文本走 **stdin 通道**（argv 只剩脚本路径，零动态 argv）；脚本侧
// 保留 $1 契约给终端/测试，stdin 为 Electron 通道（见下方 runChat）。
// GUTTO_NO_SAY=1——回复气泡由本壳自己出，不走 bin/gutto say。
// --list-commands 清单 30s 缓存（纯本地零网络，缓存只为省进程）。
// v43.12：look/compact 的脚本执行也收进本文件——main 只管窗口与契约，
// 所有「跑仓库脚本」一个屋檐（新增脚本通道先看这里有没有同款）。
'use strict';

const { spawn } = require('child_process');

const CHAT_TIMEOUT_MS = 100000; // 脚本自身 curl 30/90s 超时，外层宽到 100s

function runChat(scriptPath, text, cb) {
  // v44.7 安全形状（Mimosa 口径）：用户文本走 stdin（数据通道），argv 只剩
  // 脚本路径——零动态 argv；脚本侧保留 $1 契约（终端/测试），stdin 为
  // Electron 通道。进 LLM 请求前脚本侧另有 json 转义一道。
  const clean = String(text || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 800);
  let out = '';
  let err = '';
  let done = false;
  const child = spawn('/bin/bash', [scriptPath], {
    env: { ...process.env, GUTTO_NO_SAY: '1' },
  });
  // v44.8.1 审稿 M-1：子进程提前退出时 stdin.write/end 抛 EPIPE 无人接=
  // uncaughtException 崩主进程。挂 error 即弃（close 已兜回调）。
  child.stdin.on('error', () => {});
  child.stdin.write(clean);
  child.stdin.end();
  const timer = setTimeout(() => {
    if (!done) child.kill('SIGKILL');
  }, CHAT_TIMEOUT_MS);
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', (e) => {
    if (done) return; done = true; clearTimeout(timer); cb(e, null, '');
  });
  child.on('close', (code) => {
    if (done) return; done = true; clearTimeout(timer);
    if (code === 0 && out.trim()) cb(null, out.trim(), err);
    else cb(new Error(`chat script exit ${code}${err ? `: ${err.trim().slice(0, 300)}` : ''}`), null, err);
  });
}

const listCache = new Map(); // scriptPath -> { at, text }

function listCommands(scriptPath, cb) {
  const hit = listCache.get(scriptPath);
  if (hit && Date.now() - hit.at < 30000) { cb(null, hit.text); return; }
  let out = '';
  const child = spawn('/bin/bash', [scriptPath, '--list-commands']);
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code === 0) {
      listCache.set(scriptPath, { at: Date.now(), text: out });
      cb(null, out);
    } else cb(new Error(`list-commands exit ${code}`), null);
  });
}

function runLook(scriptPath, topic, cb) {
  // 看屏执行器（v42.1 起）：topic 是话题参数（菜单空串/autotest 传入），
  // 先做截断消毒再进 argv——长度 40 封顶，防任何长文本拐参数位。
  let out = '';
  const child = spawn('/bin/bash', [scriptPath, String(topic || '').slice(0, 40)], {
    env: { ...process.env, GUTTO_NO_SAY: '1' },
  });
  child.stdout.on('data', (d) => { out += d; });
  child.on('error', (e) => cb && cb(String(e.message || e)));
  child.on('close', () => cb && cb(out.trim()));
}

function runCompact(scriptPath) {
  // 记忆压缩执行器：后台单飞（detached），不等结果。
  try {
    const child = spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch (e) { return false; }
}

// 审批执行器（v43.13 迁入）：动词白名单+去换行/NUL+200 字封顶的纵深消毒
// ——argv 数组+固定脚本本无 shell 语义，id/decision 来自渲染进程故再设防。
const APPROVE_VERBS = new Set(['pending', 'oldest', 'decide', 'enqueue']);
function runApprove(scriptPath, args, cb) {
  const clean = (args || []).map((a) => String(a).replace(/[\r\n\0]/g, ' ').slice(0, 200));
  if (!APPROVE_VERBS.has(clean[0])) { if (cb) cb(''); return; }
  const child = spawn('/bin/bash', [scriptPath, ...clean]);
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('error', () => cb && cb(''));
  child.on('close', () => cb && cb(out.trim()));
}

module.exports = { runChat, listCommands, runLook, runCompact, runApprove, CHAT_TIMEOUT_MS };
