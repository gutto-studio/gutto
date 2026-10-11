#!/bin/bash
# ⚰️ [RETIRED v43.4 · 2026-10-10] 本脚本已退役——Swift 宠全线废弃，常驻驻留
# 由 scripts/electron-wrapper.sh（launchd lab.guttolab.gutto-electron）接任。
# 仅供考古；勿安装/勿运行（其 launchd agent lab.guttolab.gutto-pet 已退役）。
# Swift 遗产大件统一封存于 ~/work/gutto/pet-trial-swift-attic/。
# ─────────────────────────────────────────────────────────────────────
# launchd-wrapper.sh — 桌宠驻留包装（LaunchAgent 的入口进程）：
# 拉宠物宿主 + 常驻生活守护 + **宠物看门狗**（2026-10-02 第十轮加：
# 引擎崩溃后 30s 内自动回魂——KeepAlive 只盯本 wrapper，wrapper 原先只在
# 启动时拉一次宠物，宠物一崩就永久失踪，throw 测试当场实锤）。
# 宿主 stderr 不丢弃：引擎诊断日志（GUTTO_FRAME_DBG 等）进 .launchd.log。
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$DIR/bin/openpets"

"$DIR/scripts/run.sh" 2>&1 &
"$DIR/scripts/gutto-life.sh" daemon 2>&1 &

while true; do
  sleep 30
  if ! "$CLI" ping >/dev/null 2>&1; then
    echo "[wrapper] pet down, reviving ($(date +%H:%M:%S))"
    "$DIR/scripts/run.sh" 2>&1 &
  fi
done
