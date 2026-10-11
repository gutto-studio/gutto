#!/bin/bash
# agent-ask.sh — 审批双向（工作搭档型 A）：问主人一个问题，等点头。
# 机制：notify --button 的按钮本质是链接，点击即打开 --url；
#       本脚本在本机起 nc 监听，浏览器回敲 /allow 即记「允许」。
# 出口：点「允许」→ exit 0；超时/忽略 → exit 1（视为不批）。桌宠不在场 exit 1。
# 用法：agent-ask.sh "问题文本" [超时秒，默认 90]

DIR="$(cd "$(dirname "$0")/.." && pwd)"
GUTTO="$DIR/bin/gutto"   # v43.4：Swift 宠退役，走 gutto 事件桥（双路内部判定）
PORT=8799
TTL="${2:-90}"
TMPREQ="${TMPDIR:-/tmp}/gutto-ask-req.txt"

# 清掉上一发的残留监听
pkill -f "nc -l 127.0.0.1 $PORT" 2>/dev/null
rm -f "$TMPREQ"

bash "$GUTTO" ping >/dev/null 2>&1 || { echo "pet down"; exit 1; }

# 回传监听：单连接处理完继续接，直到超时；命中 /allow 落盘记号
(
  deadline=$(( $(date +%s) + TTL + 5 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,sans-serif;padding:40px"><h1>gutto 收到了</h1><p>已记录：允许。这个页面可以关掉了。</p>' \
      | nc -l 127.0.0.1 "$PORT" > "$TMPREQ" 2>/dev/null
    if grep -q "GET /allow" "$TMPREQ" 2>/dev/null; then
      echo allow > "${TMPREQ}.result"
      exit 0
    fi
  done
  echo timeout > "${TMPREQ}.result"
) &
LPID=$!

# v43.4：气泡走事件桥（review 行 + 气泡文案含「允许」链接——Electron 气泡
# 无按钮能力，链接以内文形式呈现；nc 回敲机制不变）
bash "$GUTTO" report review "要你点头" "$1 —— 点开允许：http://127.0.0.1:$PORT/allow" >/dev/null 2>&1
echo "ask sent: $1 (TTL ${TTL}s, 允许链接在气泡正文里)"

# 硬截止在父侧：nc 无连接时会无限阻塞在 accept，监听子壳自身超时不可依赖
approved=1
for i in $(seq 1 $((TTL + 8))); do
  if [ -f "${TMPREQ}.result" ] && grep -q allow "${TMPREQ}.result" 2>/dev/null; then
    approved=0
    break
  fi
  sleep 1
done
pkill -f "nc -l 127.0.0.1 $PORT" 2>/dev/null
kill "$LPID" 2>/dev/null
if [ $approved -eq 0 ]; then
  echo "APPROVED"
  exit 0
fi
echo "DENIED/TIMEOUT"
exit 1
