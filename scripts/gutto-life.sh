#!/bin/bash
# gutto-life.sh — gutto 的日子·执行器：拉台账、跑脑子一拍，把 SAY 指令发给桌宠。
# 分工：联网(curl 台账)与碰进程(openpets-cli)都在本文件；gutto-life.py 是纯决策脑。
# 纪律：hub 挂了静默降级；桌宠不在场静默跳过；notify 失败不重试不阻塞。
#
# 用法：
#   gutto-life.sh daemon                      # 常驻（60s 一拍，配合 nohup 上岗）
#   gutto-life.sh tick [--now HH:MM] [--dry]  # 跑一拍（测试用）

DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$DIR/bin/openpets"
HUB="http://127.0.0.1:8787"
KEY=$(grep -m1 '^ACCESS_TOKEN=' "${CONTENT_HUB_ENV:-$HOME/work/content-hub/.env}" 2>/dev/null | cut -d= -f2-)

run_actions() {
  while IFS= read -r line; do
    # SAY|动画|标题|正文[|TTL秒]（v42：晚安日报带长 TTL；缺省 8 同旧）
    IFS='|' read -r op anim title text ttl <<< "$line"
    [ "$op" = "SAY" ] || continue
    ttl="${ttl:-8}"
    if "$CLI" ping >/dev/null 2>&1; then
      if [ -n "$anim" ]; then
        "$CLI" animate "$anim" --loop >/dev/null 2>&1
      fi
      if "$CLI" notify --title "$title" --status done --text "$text" --ttl "$ttl" >/dev/null 2>&1; then
        echo "[$(date +%H:%M:%S)] said: $text"
      else
        echo "[run] notify failed: $text"
      fi
    elif ps ax -o command= | grep -E "dist/Electron.*--pet" | grep -v grep >/dev/null 2>&1; then
      # v42.8 桥：Swift 不在场、Electron 常驻在 → 事件文件出气泡（碎碎念/晚安不断流）
      # A-1（v44.17）：带 src:life 标记——壳侧只对生活脑来源挂语音（agent 的
      # say/report 不念，bin/gutto 写的 say 无此标记）
      EV="$HOME/.gutto/events/current.json"
      s="$title：$text"
      s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"
      mkdir -p "$(dirname "$EV")" 2>/dev/null
      printf '{"type":"say","ts":%s,"src":"life","text":"%s"}' "$(date +%s)" "$s" > "$EV.tmp.$$" 2>/dev/null \
        && mv -f "$EV.tmp.$$" "$EV" 2>/dev/null
      echo "[$(date +%H:%M:%S)] said(bridge): $text"
    else
      echo "[run] pet down, skip: $text"
    fi
  done
}

beat() {  # 一拍 = 拉台账 → 脑子决策 → 执行动作
  local ledger
  ledger=$(mktemp "${TMPDIR:-/tmp}/gutto-ledger.XXXXXX")
  Q=""
  [ -n "$KEY" ] && Q="&key=$KEY"
  # limit=100（API 上限实测 100，200 直接空表）：旧→新排，50 会被忙日吃光
  curl -s --connect-timeout 1 --max-time 4 \
    "$HUB/api/journal/recent?hours=24&limit=100$Q" -o "$ledger" || true
  python3 "$DIR/scripts/gutto-life.py" --tick --ledger-file "$ledger" "$@" | run_actions
  rm -f "$ledger"
}

case "$1" in
  tick)
    shift
    beat "$@"
    ;;
  daemon)
    echo "gutto-life daemon up ($(date +%H:%M:%S))"
    while true; do
      beat
      sleep 60
    done
    ;;
  *)
    echo "usage: $0 daemon | tick [--now HH:MM] [--dry]" >&2
    exit 1
    ;;
esac
