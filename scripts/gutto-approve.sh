#!/bin/bash
# gutto-approve.sh — 阻塞式审批的执行器（手半边：mkdir/写/删全在这里；
# JSON 组装与轮询读在 gutto-approve.py 脑半边，Mimosa 脑手分家同款）。
#
# 队列文件即真相（~/.gutto/approvals/）：
#   queue/<id>.json     待决（Electron 审批卡 fs.watch 盯着这里）
#   decisions/<id>.json 已决（hook 的 wait 轮询这里）
# 决策写入方：Electron 审批卡 / 全局热键 / 本 CLI / 未来远程（Telegram/Feishu）。
#
# 用法：
#   gutto-approve.sh enqueue --project P --tool T [--summary S] [--source X]  → 打印 id
#   gutto-approve.sh decide <id> allow|deny [--via V]                        → 幂等写决策
#   gutto-approve.sh wait <id> [timeout秒]                                   → 阻塞等；超时自清 exit 3
#   gutto-approve.sh pending                                                  → 待决清单（旧→新）
#   gutto-approve.sh oldest                                                   → 打印最老待决 id（热键用）
#   gutto-approve.sh prune [max-age秒]                                       → 清陈旧队列
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
BRAIN="$DIR/gutto-approve.py"
GUTTO_HOME="${GUTTO_TEST_HOME:-$HOME/.gutto}"
ROOT="$GUTTO_HOME/approvals"
QDIR="$ROOT/queue"
DDIR="$ROOT/decisions"

cmd="${1:-}"
[ $# -ge 1 ] && shift

case "$cmd" in
  enqueue)
    OUT="$(python3 "$BRAIN" new "$@" 2>/dev/null)" || exit 1
    REQ_ID="$(printf '%s' "$OUT" | head -1)"
    JSON="$(printf '%s' "$OUT" | sed -n 2p)"
    [ -n "$REQ_ID" ] && [ -n "$JSON" ] || exit 1
    mkdir -p "$QDIR"
    printf '%s' "$JSON" > "$QDIR/$REQ_ID.json"
    printf '%s\n' "$REQ_ID"
    ;;
  decide)
    REQ_ID="${1:-}"; VERDICT="${2:-}"
    [ $# -ge 2 ] && shift 2
    case "$VERDICT" in allow|deny) ;; *) echo "usage: decide <id> allow|deny" >&2; exit 2 ;; esac
    # 幂等：已有决策原样吐回，不覆盖（先到先得，防双端齐射翻脸）
    if [ -f "$DDIR/$REQ_ID.json" ]; then
      cat "$DDIR/$REQ_ID.json"; echo
      exit 0
    fi
    JSON="$(python3 "$BRAIN" decision "$REQ_ID" "$VERDICT" "$@" 2>/dev/null)" || exit 1
    mkdir -p "$DDIR"
    # noclobber(O_EXCL) 原子抢锁：并发双写只有一个赢家（测试实锤过交叉写坏文件）
    if ( set -o noclobber; printf '%s' "$JSON" > "$DDIR/$REQ_ID.json" ) 2>/dev/null; then
      rm -f "$QDIR/$REQ_ID.json" 2>/dev/null
      printf '%s\n' "$JSON"
    else
      sleep 0.2   # 输家：等赢家写完，吐回既有决策（幂等语义，两端拿到同一结果）
      cat "$DDIR/$REQ_ID.json" 2>/dev/null; echo
    fi
    ;;
  wait)
    REQ_ID="${1:-}"; TIMEOUT="${2:-60}"
    python3 "$BRAIN" wait --decision "$DDIR/$REQ_ID.json" --timeout "$TIMEOUT" 2>/dev/null
    RC=$?
    [ "$RC" = 3 ] && rm -f "$QDIR/$REQ_ID.json" 2>/dev/null   # 超时自清
    exit "$RC"
    ;;
  pending)
    python3 "$BRAIN" pending --queue-dir "$QDIR" 2>/dev/null
    ;;
  oldest)
    FIRST="$(python3 "$BRAIN" pending --queue-dir "$QDIR" 2>/dev/null | head -1)"
    [ -n "$FIRST" ] && printf '%s' "$FIRST" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))'
    ;;
  prune)
    MAX_AGE="${1:-3600}"
    NOW="$(date +%s)"
    for f in "$QDIR"/*.json; do
      [ -f "$f" ] || continue
      MTIME="$(stat -f %m "$f" 2>/dev/null || echo 0)"
      AGE=$(( NOW - MTIME ))
      [ "$AGE" -gt "$MAX_AGE" ] && rm -f "$f"
    done
    ;;
  *)
    echo "usage: gutto-approve.sh enqueue|decide|wait|pending|oldest|prune ..." >&2
    exit 2
    ;;
esac
