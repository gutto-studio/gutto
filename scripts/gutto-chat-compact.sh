#!/bin/bash
# gutto-chat-compact.sh — 记忆压缩「手」半边（执行器）：锁、网络、落盘全在这。
# 脑在 gutto-chat-compact.py（纯转换零网络零写盘，install-hooks 脑手分家同款）。
#
# 管线：python build（旧账→摘要请求 payload）→ curl LLM → python apply（提卡消毒）
#   → 本脚本落盘（summary 卡 + compact.state 压缩点）
# 纪律：
# - fail-open：任何失败静默 exit 0——压缩挂了只影响卡片新鲜度，绝不挂聊天
# - 中文串全程 base64 过 bash（bash 3.2 多字节吃字节，家规）；bash 只碰 ASCII 数字
# - mkdir 锁 + 180s 陈旧回收，防并发摘要互踩
# 用法：gutto-chat-compact.sh   （由 gutto-chat.sh nohup 后台调；也可手动跑）
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
PY="$DIR/gutto-chat-compact.py"
HOME_DIR="${GUTTO_TEST_HOME:-$HOME/.gutto}"
LOCK="$HOME_DIR/compact.lock"
PROTECTED=16   # 最近 16 条（8 轮）永远原文在窗口里，不进摘要

mkdir -p "$HOME_DIR" 2>/dev/null
if ! mkdir "$LOCK" 2>/dev/null; then
  mtime="$(stat -f %m "$LOCK" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  age=$(( now - mtime ))
  if [ "$age" -lt 180 ]; then exit 0; fi
  rmdir "$LOCK" 2>/dev/null
  mkdir "$LOCK" 2>/dev/null || exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

MEMORY="$HOME_DIR/chat-memory.tsv"
STATE="$HOME_DIR/chat-memory-compact.state"
SUMMARY="$HOME_DIR/chat-memory-summary.md"
[ -f "$MEMORY" ] || exit 0

total="$(wc -l < "$MEMORY" | tr -d ' ')"
case "$total" in ''|*[!0-9]*) exit 0 ;; esac
upto="$(cat "$STATE" 2>/dev/null || printf 0)"
case "$upto" in ''|*[!0-9]*) upto=0 ;; esac
[ "$upto" -le "$total" ] || upto=$total
# v40 新局语义：/clear 起点之前的旧账永不进卡（本章只装本章的事）
fresh="$(cat "$HOME_DIR/chat-memory-fresh.state" 2>/dev/null || printf 0)"
case "$fresh" in ''|*[!0-9]*) fresh=0 ;; esac
[ "$fresh" -gt "$upto" ] && upto=$fresh
end=$(( total - PROTECTED ))
[ "$end" -gt "$upto" ] || exit 0

# 配置（ASCII 值，与 gutto-chat.sh 同款读法）
BASEURL="https://api.deepseek.com"
MODEL="deepseek-chat"
KEY=""
[ -f "$HOME_DIR/env" ] && . "$HOME_DIR/env"
BASEURL="${GUTTO_LLM_BASEURL:-$BASEURL}"
MODEL="${GUTTO_LLM_MODEL:-$MODEL}"
KEY="${GUTTO_LLM_KEY:-}"
[ -n "$KEY" ] && CURL_AUTH=(-H "Authorization: Bearer $KEY") || CURL_AUTH=()

PAYLOAD_B64="$(python3 "$PY" build --memory "$MEMORY" --state "$STATE" \
  --summary "$SUMMARY" --model "$MODEL" --end "$end")" || exit 0
[ -n "$PAYLOAD_B64" ] || exit 0

# v39.3（review 修复）：base64 直通管道喂 curl（-d @-）——中文 JSON 全程
# 不进 bash 变量（bash 3.2 多字节纪律；此前 PAYLOAD=...$(base64 -D) 只是
# 透传无切片，风险未兑现，但闸门判过界，如今结构上根除）
RESP="$(printf '%s' "$PAYLOAD_B64" | base64 -D | curl -sS --max-time 90 \
  "$BASEURL/chat/completions" \
  ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} -H "Content-Type: application/json" \
  -d @- 2>/dev/null)" || exit 0

CARD_B64="$(printf '%s' "$RESP" | python3 "$PY" apply)" || exit 0
[ -n "$CARD_B64" ] || exit 0

printf '%s' "$CARD_B64" | base64 -D > "$SUMMARY.tmp" 2>/dev/null || exit 0
[ -s "$SUMMARY.tmp" ] || { rm -f "$SUMMARY.tmp" 2>/dev/null; exit 0; }
mv "$SUMMARY.tmp" "$SUMMARY"
printf '%s' "$end" > "$STATE"
printf 'gutto-compact: archived up to line %s, memory card updated\n' "$end"
exit 0
