#!/bin/bash
# gutto-clean.sh — 清理执行器（脑手分家的「手」半边：grill 两道确认 → 原生 trash → 账本/回执 → 气泡战报）
# 七条铁律映射（reports/2026-10-09-agent-safety-scan.md）：
#   铁律2 默认拒绝——根目录由扫描器硬拒绝闸把关，本层再逐条路径前缀复核；
#   铁律4 注解路由——v0.1 只有 trash（destructive+可恢复），永久删除不提供；
#   铁律5 清理三惯例——全程干跑直到最终确认，删除走 /usr/bin/trash（回收站可找回）；
#   铁律7 审计链——每笔进账本（TSV），完整清单落回执文件。
#
# 用法：
#   gutto-clean.sh [--root DIR] [--days N] [--dry]
#     --root  默认 ~/Downloads（换目录仅供测试，硬拒绝闸照常生效）
#     --days  老文件阈值，默认 90 天
#     --dry   只出扫描计划，不进入确认流程

set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY="$DIR/scripts/gutto_clean.py"
GUTTO="$DIR/bin/gutto"
GUTTO_HOME="$HOME/.gutto"
LEDGER="$GUTTO_HOME/ledger.tsv"
RECEIPT_DIR="$GUTTO_HOME/receipts"

ROOT="$HOME/Downloads"
DAYS=90
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --days) DAYS="$2"; shift 2 ;;
    --dry)  DRY=1; shift ;;
    *) echo "未知参数：$1（用法：gutto-clean.sh [--root DIR] [--days N] [--dry]）" >&2; exit 2 ;;
  esac
done

# ── 第一步：扫描（只读）──────────────────────────────────────────
PLAN="$(python3 "$PY" scan --root "$ROOT" --days "$DAYS")" || exit $?   # 退出码 3 = 安全闸拒绝
echo "$PLAN"

COUNT="$(python3 "$PY" paths --root "$ROOT" --days "$DAYS" | wc -l | tr -d ' ')"
[ "$COUNT" -gt 0 ] || exit 0

if [ "$DRY" = "1" ]; then
  echo "[dry] 计划清理 $COUNT 项（未执行——--dry 模式）"
  python3 "$PY" paths --root "$ROOT" --days "$DAYS" | awk -F'\t' '{printf "  %10s  %s\n", $1, $2}'
  exit 0
fi

# ── 第二步：grill 第一道——类别确认（带着事实问，不猜）──────────
BYTES="$(python3 "$PY" paths --root "$ROOT" --days "$DAYS" | awk -F'\t' '{s+=$1} END {print s+0}')"
HUMAN_BYTES="$(python3 "$PY" paths --root "$ROOT" --days "$DAYS" | awk -F'\t' '{s+=$1} END {printf "%.1fMB", s/1048576}')"
printf "把 %s 个老条目（共 %s）移入废纸篓？[y/N] " "$COUNT" "$HUMAN_BYTES"
read -r ans
case "$ans" in
  y|Y|yes|YES) ;;
  *) echo "取消了，一样没动。"; exit 0 ;;
esac

# ── 第三步：grill 第二道——最终确认（不可逆误操作的最后一闸）────
printf "最终确认：输入 yes 执行（其余任何输入取消）："
read -r ans2
[ "$ans2" = "yes" ] || { echo "取消了，一样没动。"; exit 0; }

# ── 第四步：执行（原生 trash，回收站可找回）──────────────────────
TRASH_BIN="/usr/bin/trash"
[ -x "$TRASH_BIN" ] || { echo "找不到 /usr/bin/trash，放弃执行（绝不 rm）" >&2; exit 4; }
mkdir -p "$RECEIPT_DIR" 2>/dev/null
TS="$(date +%Y%m%d-%H%M%S)"
RECEIPT="$RECEIPT_DIR/$TS.txt"
MOVED=0
FAILED=0
while IFS="$(printf '\t')" read -r size path; do
  [ -n "$path" ] || continue
  case "$path" in
    "$ROOT"/*) ;; *) echo "[guard] 跳过越界路径：$path" >&2; continue ;;
  esac
  [ -e "$path" ] || continue
  if "$TRASH_BIN" "$path" 2>/dev/null; then
    MOVED=$((MOVED + 1))
    printf '%s\t%s\t%s\t%s\n' "$(date +%s)" "trash" "$size" "$path" >> "$RECEIPT"
  else
    FAILED=$((FAILED + 1))
    printf '%s\t%s\t%s\t%s\n' "$(date +%s)" "trash-failed" "$size" "$path" >> "$RECEIPT"
  fi
done < <(python3 "$PY" paths --root "$ROOT" --days "$DAYS")

# ── 第五步：账本 + 战报 ─────────────────────────────────────────
mkdir -p "$GUTTO_HOME" 2>/dev/null
if [ -f "$RECEIPT" ]; then
  cat "$RECEIPT" >> "$LEDGER"
fi
echo "完成：移入废纸篓 $MOVED 项，失败 $FAILED 项。回执：$RECEIPT"
if [ "$MOVED" -gt 0 ]; then
  "$GUTTO" say "清理 $MOVED 项老文件，都在废纸篓躺着重来来得及 (≧▽≦)" || true
  { S="$HUMAN_BYTES"; S="${S//$'\t'/ }"; S="${S//$'\n'/ }"; printf '%s\tclean\t清理 %s 项（%s）→ 废纸篓\n' "$(date +%s)" "$MOVED" "$S" >> "$GUTTO_HOME/activity.tsv"; } 2>/dev/null || true
fi
exit 0
