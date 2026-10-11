#!/bin/bash
# install-launcher.sh — 零门槛启动安装器（v42.6 主人令「用户要求太严格，能否快速启动」）。
# 干两件事：
#   1) gutto 命令进 PATH（/usr/local/bin → /opt/homebrew/bin → ~/bin 三级回落）
#      → 任何终端直接 `gutto up / down / status`
#   2) ~/Applications/Gutto.app 双击 toggle 小 App（在岗=下班，不在=上工，
#      osascript 通知反馈；LSUIElement 不驻 Dock）——可拖进 Dock 一键切
# 幂等：重复跑安全（ln -sf / 覆盖写）。
set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$DIR/bin/gutto"

# ① PATH 软链
LNK=""
for d in /usr/local/bin /opt/homebrew/bin "$HOME/bin"; do
  if [ -d "$d" ] && [ -w "$d" ]; then LNK="$d"; break; fi
done
if [ -z "$LNK" ]; then
  mkdir -p "$HOME/bin" && LNK="$HOME/bin"
  echo "⚠ ~/bin 新建——PATH 里没有的话在 shellrc 加：export PATH=\"\$HOME/bin:\$PATH\""
fi
ln -sf "$BIN" "$LNK/gutto"
echo "✓ 命令：$LNK/gutto → $BIN（终端任意目录 gutto up/down/status）"

# ② 双击 toggle App（~/Applications）
APP="$HOME/Applications/Gutto.app"
MAC="$APP/Contents/MacOS"
mkdir -p "$MAC"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>GuttoToggle</string>
  <key>CFBundleIdentifier</key><string>lab.guttolab.gutto-toggle</string>
  <key>CFBundleName</key><string>Gutto</string>
  <key>CFBundleDisplayName</key><string>Gutto</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

cat > "$MAC/GuttoToggle" <<TOGGLE
#!/bin/bash
# Gutto 一键上下班（双击=切换；在岗下班/不在上工）
GUTTO="$BIN"
notify() { osascript -e "display notification \"\$1\" with title \"gutto\"" >/dev/null 2>&1 || true; }
if "\$GUTTO" ping >/dev/null 2>&1; then
  "\$GUTTO" down >/dev/null 2>&1
  notify "下班啦，明天见 (￣ω￣)"
else
  "\$GUTTO" up >/dev/null 2>&1
  notify "上工啦！我回来咯 (≧▽≦)"
fi
TOGGLE
chmod +x "$MAC/GuttoToggle"
echo "✓ 双击 App：$APP（Spotlight 搜 Gutto；可拖进 Dock 一键切）"
echo
echo "日常提醒：登录自启本来就开着（gutto autostart），这套是手动开关。"
