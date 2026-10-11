#!/bin/bash
# 一键拉起 gutto 桌宠（v43.2 起 Electron 唯一入口——Swift 壳已退役）。
# 迭代期改完素材/配置跑这个：已在跑则优雅重启（会演 exit 退场→再登场）。
#
# 启动路径优先级：
#   1) launchd agent（lab.guttolab.gutto-electron，装过 install-launchagent-electron
#      的常驻形态）→ kickstart 重启，看门狗/wrapper 全链不变
#   2) 无 agent → open -na 走 LaunchServices 直开（直 exec 会被 macOS 判后台
#      节流 ~117ms——帧率轮血泪；单实例锁防双开）
# 历史包袱勿念：bin/OpenPets-gutto.app（Swift 壳）读不了 23 行资产，已废弃。
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$DIR/shell-electron"
ELEC_APP="$SHELL_DIR/node_modules/electron/dist/Electron.app"
AGENT="gui/$(id -u)/lab.guttolab.gutto-electron"

# 优雅退场：在跑的实例收到 TERM 会先演 exit 行再退（main.js before-quit）
pkill -f "dist/Electron.*--pet" 2>/dev/null && sleep 3

if launchctl print "$AGENT" >/dev/null 2>&1; then
  echo "[run] launchd agent 在岗 → kickstart 重启"
  launchctl kickstart -k "$AGENT"
else
  echo "[run] 无 agent → LaunchServices 直开（单实例锁护航）"
  open -na "$ELEC_APP" --args "$SHELL_DIR" \
    --pet "$DIR/assets" \
    --chat-script "$DIR/scripts/gutto-chat.sh"
fi
