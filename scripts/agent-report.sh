#!/bin/bash
# agent-report.sh — gutto 桌宠 = agent 的身体（工作搭档型 A）
# 把 agent 的干活状态报到桌宠。v43.4：Swift 宠退役，全线走 bin/gutto
# 事件桥（Swift socket 在场则 CLI notify，否则 Electron 气泡+动作行——
# 桥内已自带双路判定）。纪律：桌宠不在场静默跳过；永远 exit 0 绝不阻塞
# 调用方（Stop 钩子可直接挂）。
#
# 用法：
#   agent-report.sh <running|done|failed|waiting> "标题" ["正文"]   # 手动，必报
#   agent-report.sh --auto                                          # Stop 钩子用：
#     本会话动过工（记工旗标）且距上次自动报 ≥30min 才报「收工讨赏」，否则静默
#
# 动画映射（引擎侧）：running→running  done→cheer/冷却 waving  failed→failed
#   waiting→waiting  review→歪头。

DIR="$(cd "$(dirname "$0")/.." && pwd)"
GUTTO="$DIR/bin/gutto"
STATE="$DIR/.agent-report.state"
THROTTLE=1800  # 自动报节流：30 分钟

if [ "$1" = "--auto" ]; then
  flag="${TMPDIR:-/tmp}/zcode-worked-${CLAUDE_SESSION_ID:-unknown}.flag"
  [ -f "$flag" ] || exit 0          # 没动过工=纯聊天，不打扰
  rm -f "$flag"
  now=$(date +%s); last=$(cat "$STATE" 2>/dev/null || echo 0)
  [ $((now - last)) -lt $THROTTLE ] && exit 0
  echo "$now" > "$STATE" 2>/dev/null
  status="done"; title="收工讨赏"; text="这轮的活干完了。夸我，现在，立刻。"
else
  status="$1"; title="$2"; text="${3:-}"
  [ -n "$status" ] || { echo "usage: $0 <running|done|failed|waiting|review> TITLE [TEXT] | --auto" >&2; exit 0; }
fi

case "$status" in
  running|done|failed|waiting|review) ;;   # 合法状态，动画由桥/引擎映射决定
  *) exit 0 ;;
esac

# v43.4：桌宠不在场（两路都死）静默跳过——gutto report 内部也兜底，双保险
bash "$GUTTO" ping >/dev/null 2>&1 || exit 0
bash "$GUTTO" report "$status" "$title" "$text" >/dev/null 2>&1
exit 0
