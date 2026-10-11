#!/bin/bash
# gutto 通用 agent hook（形态一 · 共栖）：ZCode / Claude Code / codex 三家同吃。
# 注册方式见 scripts/install-hooks.sh。
#
# 纪律（clawd permission-reminder 同款）：
# - 只降不升（默认态）：审批事件只提醒（气泡+系统通知），输出 {} 让宿主走
#   原生权限流；
# - v42 阻塞式审批（默认关）：~/.gutto/env 里 GUTTO_APPROVAL=1 才开，且只对
#   GUTTO_HOST=claude 的注册（协议明确支持 permissionDecision）输出决策；
#   ZCode/codex 协议未验，永远 {}。等待上限 GUTTO_APPROVAL_TIMEOUT（默认 60s），
#   超时/任何异常 fail-open 回落提醒+{}——绝不挂 agent；
# - 节流：Stop 战报 30 分钟一把；审批提醒不节流（安全事件）。
#
# stdin: 各家 hook JSON 负载。argv[1]: 事件名（codex 从 stdin hook_event_name 读）。
# argv[2]: 宿主标签（zcode 的 process 钩子没法带 env 前缀，走 argv 注入）。
# GUTTO_HOST: 由注册命令串注入（claude/codex 形状带决策协议）。
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_ROOT="$(dirname "$DIR")"
GUTTO="$PKG_ROOT/bin/gutto"
NOTIFY="$DIR/macos-notify.sh"
TTS="$DIR/gutto-tts.sh"
JSONPY="$DIR/agent-hook-json.py"
APPROVE="$DIR/gutto-approve.sh"
THROTTLE="/tmp/gutto-hook-stop-throttle"
THROTTLE_SECONDS=1800
# 语音战报默认关（2026-10-10 主人 QA：音色太御姐，与甜妹人设不符——
# 音色调好元气款再默认开；要听设 GUTTO_VOICE=1）
VOICE_ON="${GUTTO_VOICE:-0}"

# v42 审批旋钮：环境变量优先，其次 ~/.gutto/env（测试沙箱走 GUTTO_TEST_HOME）
GUTTO_HOME="${GUTTO_TEST_HOME:-$HOME/.gutto}"
envval() { sed -n "s/^$1=//p" "$GUTTO_HOME/env" 2>/dev/null | tail -1; }
APPROVAL_ON="${GUTTO_APPROVAL:-$(envval GUTTO_APPROVAL)}"
APPROVAL_TIMEOUT="${GUTTO_APPROVAL_TIMEOUT:-$(envval GUTTO_APPROVAL_TIMEOUT)}"
[ -n "$APPROVAL_TIMEOUT" ] || APPROVAL_TIMEOUT=60
HOST_TAG="${GUTTO_HOST:-${2:-}}"

# round3 R-1 台词语言表：文案真源 scripts/lines/{zh,en,ja,ko}.json，语言判定与
# Electron 壳同源（GUTTO_LANG env → $GUTTO_HOME/env → zh）——本文件不再硬编码
# 任何用户可见文案（气泡标题/正文、系统通知、审批 reason、语音战报全走表）。
LINES_PY="$DIR/gutto_lines.py"
line() { python3 "$LINES_PY" "$@" 2>/dev/null; }

# v42.1 12 态事件总线：单文件 current.json（原子写），Electron 壳 fs.watch
# 消费映射行；Swift 宠走下方 animate 直呼（零引擎改动）。同类事件节流：
# pre_tool 20s 一发（agent 每个工具调用都触发，不节流=抽风）。
EVENT_FILE="$GUTTO_HOME/events/current.json"
EVENT_THROTTLE="/tmp/gutto-ev-throttle"

write_event() {  # write_event <type> [extra-key extra-val]…
  local type="$1"; shift
  local extra=""
  while [ $# -ge 2 ]; do
    extra="$extra,\"$1\":\"$2\""
    shift 2
  done
  mkdir -p "$(dirname "$EVENT_FILE")" 2>/dev/null
  printf '{"type":"%s","ts":%s%s}' "$type" "$(date +%s)" "$extra" \
    > "$EVENT_FILE.tmp.$$" 2>/dev/null && mv -f "$EVENT_FILE.tmp.$$" "$EVENT_FILE" 2>/dev/null
}

event_throttled() {  # 同 key 20s 内只过一次
  local key="$1" now age mtime
  now="$(date +%s)"
  mtime="$(stat -f %m "$EVENT_THROTTLE.$key" 2>/dev/null || echo 0)"
  age=$(( now - mtime ))
  if [ "$age" -lt 20 ]; then return 0; fi
  touch "$EVENT_THROTTLE.$key" 2>/dev/null
  return 1
}

# 事件→行映射（Swift 宠侧；Electron 侧同表在 shell-electron/main.js）
anim_for_event() {
  case "$1" in
    pre_tool)    printf 'think' ;;
    permission)  printf 'review' ;;
    stop)        printf 'waving' ;;
    notification) printf 'waiting' ;;
    *)           printf '' ;;
  esac
}

# b64field <字段> [extra] —— stdin JSON → 明文（字节安全）
# extra：field=event 时是兜底事件名；field=message 时是明文截断字符数
# 注意：返回的已是 UTF-8 明文，调用方严禁再套 b64dec 二次解码——明文被当
# base64 再解一遍，CJK 撕碎、ASCII 幸存，正是 2026-10-10 审批通知乱码事故根因。
b64field() {
  python3 "$JSONPY" "$1" ${2:+"$2"} | base64 -D
}

event="${1:-}"
payload="$(cat 2>/dev/null || true)"
[ -z "$event" ] && event="$(printf '%s' "$payload" | b64field event)"

# cwd → 项目名（b64field 已解出明文，直接取 basename）
project() {
  local name
  name="$(printf '%s' "$payload" | b64field cwd)"
  name="${name##*/}"
  printf '%s' "${name:-$(line hook.projectFallback)}"
}

stop_throttled() {
  [ -f "$THROTTLE" ] || { touch "$THROTTLE" 2>/dev/null; return 1; }
  local now age mtime
  now="$(date +%s)"
  mtime="$(stat -f %m "$THROTTLE" 2>/dev/null || echo 0)"
  age=$(( now - mtime ))
  [ "$age" -lt "$THROTTLE_SECONDS" ] && return 0
  touch "$THROTTLE" 2>/dev/null
  return 1
}

case "$event" in
  PreToolUse)
    # v42.1：不打扰纪律不变——零气泡零通知，只写事件+演行（20s 节流）。
    # 事件喂 Electron（fs.watch），animate 直呼 Swift 宠（零引擎改动）。
    if ! event_throttled pre_tool; then
      name="$(project)"
      tool="$(printf '%s' "$payload" | b64field tool_name)"
      [ -z "$tool" ] && tool="$(line hook.toolFallback)"
      write_event pre_tool project "$name" tool "$tool"
      "$GUTTO" animate "$(anim_for_event pre_tool)" --loop >/dev/null 2>&1 || true
    fi
    ;;
  Stop)
    if ! stop_throttled; then
      name="$(project)"
      write_event stop project "$name"
      "$GUTTO" animate "$(anim_for_event stop)" >/dev/null 2>&1 || true
      "$GUTTO" report done "$(line hook.stopTitle)" "$(line hook.stopBody project="$name")" >/dev/null 2>&1 || true
      # 语音战报（默认关：GUTTO_VOICE=1 开；音色调好甜妹款再翻默认；
      # 非中文档由 gutto-tts.sh 门控静默——E-4，PC TTS 是中文音色）
      [ "$VOICE_ON" = "1" ] && "$TTS" "$(line hook.stopVoice project="$name")" >/dev/null 2>&1 || true
    fi
    ;;
  PermissionRequest)
    name="$(project)"
    tool="$(printf '%s' "$payload" | b64field tool_name)"
    [ -z "$tool" ] && tool="$(line hook.toolFallback)"
    write_event permission project "$name" tool "$tool"
    "$GUTTO" animate "$(anim_for_event permission)" --loop >/dev/null 2>&1 || true
    # v42 阻塞式审批（v44.5 扩面三家）：默认关（GUTTO_APPROVAL=1 才开）。
    # 协议已验（2026-10-11）：claude/codex 同形——hookSpecificOutput.permissionDecision
    # （codex 需同步钩子，2026-04 官方文档三源交叉）；zcode 顶层 strict schema
    # {"decision","reason"}（应用包 zod 校验实锤），无决定时输出必须为空——{}
    # 撞 decision 必填校验。等待上限 GUTTO_APPROVAL_TIMEOUT（默认 60s），超时/
    # 任何异常 fail-open 回落提醒——绝不挂 agent。opencode 插件事件无决策通道，只提醒。
    case "$HOST_TAG" in claude|zcode|codex) BLOCKABLE=1 ;; *) BLOCKABLE=0 ;; esac
    if [ "$APPROVAL_ON" = "1" ] && [ "$BLOCKABLE" = "1" ]; then
      req_id="$("$APPROVE" enqueue --project "$name" --tool "$tool" --source "$HOST_TAG" 2>/dev/null)" || req_id=""
      if [ -n "$req_id" ]; then
        body="$(line hook.approvalBody project="$name" tool="$tool")"  # 一处算两处用（审稿 P2-5：省重复 python spawn）
        # 单通道（v39.1）：桌宠在场只走宠物通道
        if ! "$GUTTO" ping >/dev/null 2>&1; then
          "$NOTIFY" "$(line hook.approvalNotifyTitle)" "$body" >/dev/null 2>&1 || true
        fi
        "$GUTTO" report review "$(line hook.approvalReviewTitle)" "$body" >/dev/null 2>&1 || true
        decision="$("$APPROVE" wait "$req_id" "$APPROVAL_TIMEOUT" 2>/dev/null)"
        wait_rc=$?
        if [ "$wait_rc" = 0 ] && [ -n "$decision" ]; then
          verdict="$(printf '%s' "$decision" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("decision", ""))
except Exception:
    pass' 2>/dev/null)"
          case "$verdict" in
            allow|deny)
              if [ "$HOST_TAG" = "zcode" ]; then
                printf '{"decision":"%s","reason":"%s"}\n' "$verdict" "$(line hook.approvalReason verdict="$verdict")"
              else
                printf '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' \
                  "$verdict" "$(line hook.approvalReason verdict="$verdict")"
              fi
              exit 0
              ;;
          esac
        fi
        # 超时/坏决策 → 落到下面提醒路径再空输出（原生权限流兜底，只降不升）
      fi
    fi
    # —— 默认提醒路径（所有宿主/门控关闭/阻塞失败回落）——
    # 单通道（v39.1）：桌宠在场只走宠物（气泡+它自己的系统通知）；
    # osascript 只是桌宠不在场的备援——双通道齐射 = 每次审批弹两条气泡
    body="$(line hook.approvalBody project="$name" tool="$tool")"
    if ! "$GUTTO" ping >/dev/null 2>&1; then
      "$NOTIFY" "$(line hook.approvalRemindTitle)" "$body" >/dev/null 2>&1 || true
    fi
    "$GUTTO" report review "$(line hook.approvalReviewTitle)" "$body" >/dev/null 2>&1 || true
    [ "$VOICE_ON" = "1" ] && "$TTS" "$(line hook.approvalVoice)" >/dev/null 2>&1 || true
    ;;
  Notification)
    msg="$(printf '%s' "$payload" | b64field message 120)"
    [ -z "$msg" ] && msg="$(line hook.notifyFallback)"
    if ! event_throttled notification; then
      write_event notification project "$(project)"
      "$GUTTO" animate "$(anim_for_event notification)" --loop >/dev/null 2>&1 || true
    fi
    "$NOTIFY" "gutto" "$msg" >/dev/null 2>&1 || true
    ;;
  SessionStart)
    # v44.8 上班：只写事件（20s 节流，连开多窗不抽风），行由 Electron 壳播
    # （EVENT_ROW.start → running 朝你跑来）——不调 animate（那是 Swift 宠
    # 旧通道）也不弹气泡（下班已有一句，上班不加戏）。
    if ! event_throttled start; then
      write_event start project "$(project)"
    fi
    ;;
  *) ;;  # PostToolUse/... v1 不打扰
esac

# 审批事件输出：claude/codex 走 {}（无决定=宿主原生权限流）；zcode 的输出是
# strict schema（decision 必填）——无决定必须输出空串，{} 会被校验拒收。
if [ "$HOST_TAG" = "zcode" ] && [ "$event" = "PermissionRequest" ]; then
  exit 0
fi
# 审批事件输出 {} = 「无决定」，宿主走原生权限流（只降不升）
printf '{}\n'
exit 0
