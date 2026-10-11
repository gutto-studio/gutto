#!/bin/bash
# ⚰️ [RETIRED v43.4 · 2026-10-10] 已退役——本脚本安装的是旧 Swift 宠 agent
# （lab.guttolab.gutto-pet）。现行常驻= lab.guttolab.gutto-electron（隔壁窗口
# 的 scripts/electron-wrapper.sh + ~/Library/LaunchAgents 或 scripts/ 下 plist）。
# 勿运行（会把退役的 Swift agent 装回来=双 agent！）。
# ─────────────────────────────────────────────────────────────────────
# install-launchagent.sh — 安装/刷新用户级 LaunchAgent（lab.guttolab.gutto-pet）
# 效果：登录自启 + 进程崩了自动拉起（KeepAlive）。卸载：launchctl bootout + 删 plist。
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$DIR/scripts/lab.guttolab.gutto-pet.plist"
PLIST_DST="$HOME/Library/LaunchAgents/lab.guttolab.gutto-pet.plist"
LABEL="lab.guttolab.gutto-pet"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
cp "$PLIST_SRC" "$PLIST_DST" || exit 1
if launchctl bootstrap "gui/$(id -u)" "$PLIST_DST" 2>/dev/null; then
  echo "installed: $PLIST_DST"
else
  echo "bootstrap failed（可能已加载，试 kickstart 刷新）" >&2
fi
sleep 2
launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | grep -E "state =|pid =" | head -3
