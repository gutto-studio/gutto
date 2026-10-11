#!/bin/bash
# gutto hooks 安装器 · 执行器：家目录路径、存在性检查、落盘全在本文件。
# 决策（merge 逻辑）在 install-hooks.py（stdin→stdout 纯转换，零文件 IO）。
#
# 用法：install-hooks.sh <zcode|claude|codex|opencode|all> [--uninstall]
# 纪律：
# - 只增不毁：merge 语义（python 层），现有 hooks 一律保留；落盘前备份原文件
#   到 /tmp/gutto-hooks-backup/（带时间戳，出错可回）；
# - 现有显式关闭不覆盖（python 层以 __GUTTO_SKIP__ 信号拒绝）；
# - 幂等：merge 前 purge 旧 marker 条目，重装不重复。
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_ROOT="$(dirname "$DIR")"
HOOK_SH="$DIR/agent-hook.sh"
PY="$DIR/install-hooks.py"
OC_PLUGIN="$PKG_ROOT/integrations/opencode-plugin"
BACKUP="/tmp/gutto-hooks-backup"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

say() { printf '  %s\n' "$*"; }

# merge_file <家> <原路径> <缺省JSON> [额外argv...]
# 原文件 → python merge → 原子落盘（备份先行）；缺文件视为 {}
merge_file() {
  local label="$1" src="$2" default="$3"; shift 3
  if [ ! -f "$src" ]; then
    printf '%s' "$default" | python3 "$PY" "$label" "$HOOK_SH" "$@" > "$src.gutto-new" || { rm -f "$src.gutto-new"; say "! $label merge 失败"; return 1; }
  else
    mkdir -p "$BACKUP" && cp "$src" "$BACKUP/$(date +%s)-$(basename "$src")" 2>/dev/null
    python3 "$PY" "$label" "$HOOK_SH" "$@" < "$src" > "$src.gutto-new" || { rm -f "$src.gutto-new"; say "! $label merge 失败（原文件未动）"; return 1; }
  fi
  mv "$src.gutto-new" "$src"
  chmod 0644 "$src" 2>/dev/null || true
}

uninstall_file() {
  # 卸载 = 从现配置剔除 marker 条目。python 层 purge 需要专门路径——
  # v1 简化：提示手动或用备份恢复（备份在 $BACKUP）。
  say "卸载：请从配置中移除含 agent-hook.sh / opencode-plugin 的条目"
  say "（本轮安装的备份都在 $BACKUP/，可直接回滚）"
}

do_zcode() {
  [ -d "$HOME/.zcode" ] || { say "- 未找到 ~/.zcode，跳过"; return 0; }
  local cfg="$HOME/.zcode/cli/config.json"
  mkdir -p "$(dirname "$cfg")"
  [ -f "$cfg" ] || printf '{}' > "$cfg"
  merge_file zcode "$cfg" '{}' && say "✓ ZCode：PermissionRequest → 审批提醒（Stop 沿用既有接线）"
}

do_claude() {
  [ -d "$HOME/.claude" ] || { say "- 未找到 ~/.claude，跳过"; return 0; }
  local cfg="$HOME/.claude/settings.json"
  merge_file claude "$cfg" '{}' && say "✓ Claude Code：Notification + Stop → 提醒/收工战报"
}

do_codex() {
  [ -d "$CODEX_HOME" ] || { say "- 未找到 ~/.codex，跳过"; return 0; }
  local hj="$CODEX_HOME/hooks.json" ct="$CODEX_HOME/config.toml"
  [ -f "$hj" ] || printf '{}' > "$hj"
  merge_file codex-hooks "$hj" '{}' && say "✓ codex：Stop + PermissionRequest 注册"
  if [ -f "$ct" ]; then
    cp "$ct" "$BACKUP/$(date +%s)-config.toml" 2>/dev/null
    python3 "$PY" codex-toml < "$ct" > "$ct.gutto-new" && mv "$ct.gutto-new" "$ct" && say "✓ codex：[features] hooks = true"
  else
    printf '[features]\nhooks = true\n' > "$ct" && say "✓ codex：config.toml 新建（hooks = true）"
  fi
  say "! 信任门：需在 codex TUI 里跑一次 /hooks 人工确认后才激活"
}

do_opencode() {
  local cfgdir="$HOME/.config/opencode"
  [ -d "$cfgdir" ] || { say "- 未找到 ~/.config/opencode，跳过"; return 0; }
  local cfg="$cfgdir/opencode.json"
  [ -f "$cfg" ] || printf '{"$schema":"https://opencode.ai/config.json"}' > "$cfg"
  merge_file opencode "$cfg" '{}' "$OC_PLUGIN" && say "✓ opencode：插件目录已注册（permission.asked / session.idle）"
}

main() {
  local target="${1:-all}" uninstall="${2:-}"
  if [ "$uninstall" = "--uninstall" ]; then
    uninstall_file
    return 0
  fi
  [ -f "$HOOK_SH" ] || { say "! 缺 $HOOK_SH"; return 1; }
  chmod 0755 "$HOOK_SH"
  case "$target" in
    zcode) do_zcode ;;
    claude) do_claude ;;
    codex) do_codex ;;
    opencode) do_opencode ;;
    all) do_zcode; do_claude; do_codex; do_opencode ;;
    *) say "用法：install-hooks.sh <zcode|claude|codex|opencode|all> [--uninstall]"; return 2 ;;
  esac
}

main "$@"
