#!/bin/bash
# ⚰️ [RETIRED v43.4 · 2026-10-10] 已退役——本脚本驱动的是 Swift 宠 CLI
# （bin/openpets animate，二进制已入 attic）。Electron 壳下巡检：
# 设置窗 → 玩法 → 动作预览「巡检全部」（v43.5 接班），或 CLI `bin/gutto
# anim <行名>`；静态全行缩览用 python3 scripts/preview-atlas.py。
# ─────────────────────────────────────────────────────────────────────
# tour-actions.sh — 开发者巡检快捷方式（卅二轮，主人 QA「检查所有动作」）：
# 逐行动播放 20 行真实动作，每行 5s（一轮原速循环），行名打屏。
# 用法：bash scripts/tour-actions.sh [每行秒数，默认5]
# 配套：鼠标 hover 到她身上弹「动作巡检面板」（引擎 v13，2026-10-08）——
# 全 20 行动作+快捷键（1-9,0,QWERTY 行），按键/点击即切、esc 关、15s 自灭；
# 无头环境用 `bin/openpets inspect [on|off]` 远程开关同一面板。
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$DIR/bin/openpets"
DWELL="${1:-5}"

ROWS=(idle waving jumping waiting review sit yawn cheer stretch dance think angry crawl
      sleep failed running running-right running-left look-left look-right)

echo "tour: ${#ROWS[@]} rows × ${DWELL}s"
for name in "${ROWS[@]}"; do
  echo "▶ $name"
  "$CLI" animate "$name" >/dev/null 2>&1
  sleep "$DWELL"
done
echo "tour done"
