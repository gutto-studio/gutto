#!/bin/bash
# macOS 系统通知薄壳（失焦备援通道）：标题/正文经 osascript `on run argv`
# 传入——参数列表，文本不进脚本源码，注入面为零。
# 用法：macos-notify.sh "标题" "正文"
set -u
TITLE="${1:-gutto}"
MESSAGE="${2:-}"
exec /usr/bin/osascript -e 'on run argv
display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"
end run' "$TITLE" "$MESSAGE"
