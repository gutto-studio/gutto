#!/bin/bash
# pet-doctor.sh — 用户一键自检（v43.2 工程化：别的用户也能自查，不用考古）。
# 用法：bash scripts/pet-doctor.sh   （全绿=环境健康）
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
A="$DIR/assets"
SHELL_DIR="$DIR/shell-electron"
PASS=0; FAIL=0

ck() {  # ck <名称> <命令>   命令退出 0=PASS
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✅ $name"; PASS=$((PASS+1))
  else
    echo "  ❌ $name"; FAIL=$((FAIL+1))
  fi
}

echo "== gutto 宠物医生 =="

echo "[1] 进程（应恰好 1 个实例）"
N=$(ps ax -o command= | grep -E "dist/Electron.*--pet" | grep -v grep | wc -l | tr -d ' ')
if [ "$N" -le 1 ]; then echo "  ✅ 实例数 $N"; PASS=$((PASS+1)); else echo "  ❌ 实例数 $N（双开！跑 pkill -f 'dist/Electron.*--pet' 后 scripts/run.sh）"; FAIL=$((FAIL+1)); fi

echo "[2] 资产完整性（manifest ↔ rows/ ↔ 图集）"
node -e "
const fs=require('fs'),path=require('path');
const m=JSON.parse(fs.readFileSync('$A/pet.json','utf8'));
const files=fs.readdirSync(path.join('$A','rows')).filter(f=>f.endsWith('.webp'));
process.exit(m.rows.length===files.length?0:1);
" && { echo "  ✅ manifest 行数=rows 文件数"; PASS=$((PASS+1)); } || { echo "  ❌ 行数不对账（半升级？跑 make_spritesheet 重建）"; FAIL=$((FAIL+1)); }
ck "spritesheet.webp 存在" test -f "$A/spritesheet.webp"

echo "[3] 壳依赖"
ck "electron 已安装(node_modules)" test -d "$SHELL_DIR/node_modules/electron"
ck "渲染器入口存在" test -f "$SHELL_DIR/renderer/pet.js"

echo "[4] 数据目录"
GUTTO_HOME="${GUTTO_TEST_HOME:-$HOME/.gutto}"
ck "GUTTO_HOME 可写 ($GUTTO_HOME)" test -w "$GUTTO_HOME" -o -w "$HOME"
if [ -f "$GUTTO_HOME/shell.log" ] && [ "$(find "$GUTTO_HOME/shell.log" -mtime -1 2>/dev/null)" ]; then
  echo "  ✅ shell.log 24h 内有写入（tail -20 $GUTTO_HOME/shell.log 看最近事件）"; PASS=$((PASS+1))
else
  echo "  ⚠️ shell.log 缺席或过期（跑过才会有；黑箱排查入口）"
fi

echo "[5] 常驻（装过就应在岗）"
if launchctl print "gui/$(id -u)/lab.guttolab.gutto-electron" >/dev/null 2>&1; then
  echo "  ✅ launchd agent 在岗"; PASS=$((PASS+1))
else
  echo "  ⚠️ agent 未装（手动跑 scripts/run.sh 也可，开机不自启）"
fi
if [ -f "$HOME/Library/LaunchAgents/lab.guttolab.gutto-pet.plist" ] \
   && [ ! -f "$HOME/Library/LaunchAgents/lab.guttolab.gutto-pet.plist.retired" ]; then
  echo "  ❌ 旧 Swift agent plist 还在（重启会双 agent！→ 改名 .retired）"; FAIL=$((FAIL+1))
else
  echo "  ✅ 无旧 Swift agent 残留"; PASS=$((PASS+1))
fi

echo "——"
echo "结果: $PASS 过 / $FAIL 挂"
[ "$FAIL" -eq 0 ]
