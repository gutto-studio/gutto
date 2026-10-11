#!/bin/bash
# pet-monitor.sh — Electron 宠常驻质量采样（v42.9：30 分钟一拍，rss+footprint 落档）。
# 产出 ~/.gutto/pet-monitor.log：ts | 各进程 rss 合计MB | 主进程 footprint MB
# 结论看长期趋势（内存泄漏=持续爬升不回落）。nohup 后台跑，不占前台。
set -u
LOG="${GUTTO_TEST_HOME:-$HOME/.gutto}/pet-monitor.log"

while true; do
  PIDS="$(ps ax -o pid=,rss=,command= | grep "dist/Electron" | grep -v grep | grep -E "\-\-pet" | awk '{print $1}' | tr '\n' ' ')"
  if [ -n "$PIDS" ]; then
    RSS_MB=0
    for p in $PIDS; do
      R="$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ')"
      RSS_MB=$(( RSS_MB + ${R:-0} / 1024 ))
    done
    MAIN="$(echo $PIDS | awk '{print $1}')"
    FP="$(vmmap --summary "$MAIN" 2>/dev/null | awk '/Physical footprint:/{print $3; exit}')"
    printf '%s | rss合计 %sMB | 主进程footprint %s\n' "$(date '+%F %T')" "$RSS_MB" "${FP:-?}" >> "$LOG"
  else
    printf '%s | 不在岗\n' "$(date '+%F %T')" >> "$LOG"
  fi
  sleep 1800
done
