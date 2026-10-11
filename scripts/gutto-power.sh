#!/bin/bash
# gutto-power.sh — 桌宠电源管理（v42.8 起：Electron 为常驻，Swift 已下岗）。
# bin/gutto 的 up/down/status/autostart 子命令都落在这。
#
# 用法：
#   gutto-power.sh up        开工（launchd 拉 Electron 防线：open -na 防节流+看门狗）
#   gutto-power.sh down      下班（bootout Electron 防+收进程；Swift 残留一并兜底）
#   gutto-power.sh status    Electron 在岗/内存/launchd 态 + Swift 残留检查
#   gutto-power.sh autostart on|off   登录自启开关（off 顺带下班）
set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$DIR/bin/openpets"
PLIST="$DIR/scripts/lab.guttolab.gutto-electron.plist"
LABEL="lab.guttolab.gutto-electron"
OLD_LABEL="lab.guttolab.gutto-pet"
UID_N="$(id -u)"
SWIFT_PAT="OpenPets-gutto.app/Contents/MacOS/openpets run"

swift_pid() { ps ax -o pid=,command= | grep "$SWIFT_PAT" | grep -v grep | awk '{print $1}' | head -1; }
elec_pids() { ps ax -o pid=,command= | grep -E "dist/Electron" | grep -v grep | grep -E "\-\-pet" | awk '{print $1}'; }

loaded() { launchctl print "gui/$UID_N/$LABEL" >/dev/null 2>&1; }

do_up() {
  if ! loaded; then
    launchctl bootstrap "gui/$UID_N" "$PLIST" 2>/dev/null || true
  fi
  launchctl kickstart "gui/$UID_N/$LABEL" 2>/dev/null || true
  local pids=""
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    pids="$(elec_pids)"
    [ -n "$pids" ] && break
    sleep 1
  done
  # 看门狗是 30s 一拍：等不到就自己拉（open -na 只在无实例时用，防重复）
  if [ -z "$(elec_pids)" ]; then
    open -na "$DIR/shell-electron/node_modules/electron/dist/Electron.app" --args \
      "$DIR/shell-electron" --pet "$DIR/assets" --chat-script "$DIR/scripts/gutto-chat.sh" \
      >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8; do
      pids="$(elec_pids)"
      [ -n "$pids" ] && break
      sleep 1
    done
  fi
  pids="$(elec_pids)"
  if [ -n "${pids}" ]; then
    echo "✓ 上工啦（Electron 常驻，pid ${pids}）"
    return 0
  fi
  echo "! 没起来，看 .launchd.log"
  return 1
}

do_down() {
  launchctl bootout "gui/$UID_N/$LABEL" 2>/dev/null
  for p in $(elec_pids); do kill "$p" 2>/dev/null; done
  sleep 1
  for p in $(elec_pids); do kill -9 "$p" 2>/dev/null; done
  # Swift 残留兜底（常驻切换期保险）
  local sp; sp="$(swift_pid)"
  [ -n "$sp" ] && { "$CLI" stop >/dev/null 2>&1; sleep 1; sp="$(swift_pid)"; [ -n "$sp" ] && kill -9 "$sp" 2>/dev/null; }
  echo "✓ 下班啦"
}

do_status() {
  local el; el="$(elec_pids | tr '\n' ' ')"
  if [ -n "${el}" ]; then
    local first; first="$(elec_pids | head -1)"
    local rss
    rss="$(ps -o rss= -p "$first" 2>/dev/null | tr -d ' ')"
    echo "Electron 宠：在岗 pid ${el}（主进程 rss $(( ${rss:-0} / 1024 ))MB，多进程另计）"
  else
    echo "Electron 宠：不在岗"
  fi
  local sp; sp="$(swift_pid)"
  [ -n "$sp" ] && echo "Swift 宠：⚠ 残留在岗 pid ${sp}（gutto down 可收）" || echo "Swift 宠：已下岗（常驻切换完成）"
  if loaded; then
    echo "登录自启：开（launchd ${LABEL}）"
  else
    echo "登录自启：关"
  fi
}

do_autostart() {
  case "${1:-}" in
    on)
      do_up
      echo "✓ 登录自启已开"
      ;;
    off)
      do_down
      echo "✓ 登录自启已关"
      ;;
    *)
      echo "usage: gutto-power.sh autostart on|off" >&2
      exit 2
      ;;
  esac
}

case "${1:-}" in
  up)        do_up ;;
  down)      do_down ;;
  status)    do_status ;;
  autostart) shift; do_autostart "$@" ;;
  *)         echo "usage: gutto-power.sh up|down|status|autostart on|off" >&2; exit 2 ;;
esac
