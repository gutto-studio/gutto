#!/bin/bash
# electron-wrapper.sh — Electron 宠常驻防（v42.8 主人拍板「常驻新的」）。
# 与旧 launchd-wrapper 同款纪律：open -na 走 LaunchServices（直 exec 会被
# macOS 判后台 app 节流到 ~117ms——帧率轮血泪）；看门狗 30s 一拍；生活守护
# 伴跑（碎碎念/晚安经事件桥照样到 Electron 气泡）。
set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$DIR/shell-electron"
ELEC_APP="$SHELL_DIR/node_modules/electron/dist/Electron.app"
LIFE="$DIR/scripts/gutto-life.sh"
PGREP_PAT="dist/Electron.*--pet"
# v44.10 审稿 M-1：心跳判活兜底——壳主进程每 5s touch（v44.8.1 H-3），过期=hung。
# 进程在而心跳凉（>45s）→ 先 TERM（演退场），连两拍仍凉 → kill -9。
# 冻结壳此前对所有监控隐形（ps 照匹配、ping 照回 pong），现在可被自动救回。
# round3 R-5：认 GUTTO_TEST_HOME——bin/gutto pet_alive 走 GUTTO_HOME（认测试沙箱），
# 看门狗硬编 $HOME 会让隔离场景下两边各看各的心跳（一个判死一个判活）。
HB_FILE="${GUTTO_TEST_HOME:-$HOME/.gutto}/shell.heartbeat"
HB_STALE_S=45
hung_strikes=0

electron_alive() { ps ax -o command= | grep -E "$PGREP_PAT" | grep -v grep >/dev/null 2>&1; }

# 心跳年龄（秒）；文件缺席返回 0（未上岗/已正常退场=不算 hung，交给存活检查）
heartbeat_age() {
  [ -f "$HB_FILE" ] || { echo 0; return; }
  echo $(( $(date +%s) - $(stat -f %m "$HB_FILE" 2>/dev/null || echo "$(date +%s)") ))
}

# v43.12 治理 F：日志轮转——.launchd.log >2MB 截到末 2000 行（launchd 的
# StandardOutPath 持有写端，tail→tmp→mv 原子换文件不炸句柄）。
cap_log() {
  local f="$DIR/.launchd.log"
  [ -f "$f" ] || return 0
  local sz
  sz="$(stat -f%z "$f" 2>/dev/null || echo 0)"
  [ "$sz" -gt 2097152 ] || return 0
  tail -n 2000 "$f" > "$f.tmp.$$" 2>/dev/null && mv -f "$f.tmp.$$" "$f" || rm -f "$f.tmp.$$"
  echo "[wrapper] .launchd.log rotated (${sz}B → tail 2000)"
}

launch_electron() {
  open -na "$ELEC_APP" --args "$SHELL_DIR" \
    --pet "$DIR/assets" \
    --chat-script "$DIR/scripts/gutto-chat.sh" >/dev/null 2>&1 || true
}

echo "[wrapper] electron residency up ($(date +%H:%M:%S))"

# 生活守护伴跑（不在就拉一个）
if ! ps ax -o command= | grep "gutto-life.sh daemon" | grep -v grep >/dev/null 2>&1; then
  nohup bash "$LIFE" daemon >> "$DIR/.launchd.log" 2>&1 &
fi

launch_electron

while true; do
  sleep 30
  cap_log
  if ! electron_alive; then
    hung_strikes=0
    echo "[wrapper] electron down, reviving ($(date +%H:%M:%S))"
    launch_electron
    continue
  fi
  # v44.10 M-1：进程在而心跳凉=hung——TERM 一拍，仍凉 -9， revived 后清计数
  age="$(heartbeat_age)"
  if [ "$age" -gt "$HB_STALE_S" ]; then
    hung_strikes=$((hung_strikes + 1))
    echo "[wrapper] heartbeat stale ${age}s (strike $hung_strikes, $(date +%H:%M:%S))"
    if [ "$hung_strikes" -ge 2 ]; then
      pkill -9 -f "$PGREP_PAT" 2>/dev/null
    else
      pkill -f "$PGREP_PAT" 2>/dev/null
    fi
  else
    hung_strikes=0
  fi
done
