#!/bin/bash
# gutto-look.sh — 她看一眼你的屏幕（v42.1 · BYO key 轻量版看屏）。
# 链路：screencapture 主屏 → sips 压边(≤1024) → base64 → VL 端点
#   (OpenAI 兼容 vision: image_url data URL) → 一两句元气吐槽 → stdout
#   → 气泡（Electron 菜单/输入框 /看一眼 都汇到这）。
# 配置（~/.gutto/env，独立于聊天 LLM——VL 要会看图的脑子）：
#   GUTTO_VL_BASEURL=https://xxx/v1   GUTTO_VL_KEY=sk-...   GUTTO_VL_MODEL=xxx-vl
# 纪律：没配 VL → 一句降级台词 exit 0；API 挂 → 静默降级台词 exit 0；
# 截图只进内存管道不留盘（除临时文件当场删）；话题参数可选。
# 记忆：TSV 记一对（user=看了屏幕标记 / assistant=她的吐槽），activity 记 say。

set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAIN="$DIR/scripts/gutto_chat_brain.py"
GUTTO="$DIR/bin/gutto"
GUTTO_HOME="${GUTTO_TEST_HOME:-$HOME/.gutto}"
MEMORY="$GUTTO_HOME/chat-memory.tsv"
ACTIVITY="$GUTTO_HOME/activity.tsv"
PERSONA_DEFAULT="$DIR/config/persona-gutto.md"
PERSONA_USER="$GUTTO_HOME/persona.md"

TOPIC="${*:-}"

[ -f "$GUTTO_HOME/env" ] && . "$GUTTO_HOME/env"
VL_BASEURL="${GUTTO_VL_BASEURL:-}"
VL_KEY="${GUTTO_VL_KEY:-}"
VL_MODEL="${GUTTO_VL_MODEL:-}"

if [ -z "$VL_BASEURL" ] || [ -z "$VL_MODEL" ]; then
  printf '（眯眼看了一下……）嗯？我还看不见啦。设置里配个会看图的脑子（GUTTO_VL_*）再来嘛 (｡•́︿•̀｡)\n'
  exit 0
fi

# ── 截图 + 压缩（当场删，不留盘）──────────────────────────────
SNAP="$(mktemp "${TMPDIR:-/tmp}/gutto-look.XXXXXX").png"
screencapture -x -D1 "${SNAP%.png}.png" 2>/dev/null || SNAP="${SNAP%.png}.png"
SNAP="${SNAP%.png}.png"
[ -f "$SNAP" ] || { printf '截图失败了……再试一次？\n'; exit 0; }
W=$(sips -g pixelWidth "$SNAP" 2>/dev/null | awk '/pixelWidth/{print $2}')
[ -n "$W" ] && [ "$W" -gt 1024 ] && sips -Z 1024 "$SNAP" >/dev/null 2>&1

IMG_B64="$(base64 -i "$SNAP" | tr -d '\n')"
rm -f "$SNAP"

# ── 人设（同聊天链：自定义优先，仓库默认兜底）─────────────────
PERSONA="${GUTTO_PERSONA:-}"
[ -n "$PERSONA" ] || { [ -f "$PERSONA_USER" ] && PERSONA="$(cat "$PERSONA_USER")"; }
[ -n "$PERSONA" ] || PERSONA="$(cat "$PERSONA_DEFAULT" 2>/dev/null || printf '你是桌宠 gutto')"

# ── 组装 vision payload（jq 直拼，中文经 --arg 字节安全）──────
SYS_TEXT="你刚瞟了一眼主人的电脑屏幕，用一两句话自然地吐槽或点评它（元气、傲娇、关心主人的口吻，不要描述画面细节清单，像真人瞟一眼后随口说的那句话）。$([ -n "$TOPIC" ] && printf '主人顺口说了句：「%s」，顺着这个说。' "$TOPIC")"
PAYLOAD="$(jq -n --arg sys "$SYS_TEXT" --arg persona "$PERSONA" --arg model "$VL_MODEL" --arg b64 "$IMG_B64" '{
  model: $model,
  messages: [
    {role: "system", content: $persona},
    {role: "user", content: [
      {type: "text", text: $sys},
      {type: "image_url", image_url: {url: ("data:image/png;base64," + $b64)}}
    ]}
  ]
}')"

AUTH=()
[ -n "$VL_KEY" ] && AUTH=(-H "Authorization: Bearer $VL_KEY")
RESP="$(curl -sS --max-time 45 "$VL_BASEURL/chat/completions" \
  ${AUTH[@]+"${AUTH[@]}"} -H "Content-Type: application/json" -d "$PAYLOAD" 2>&1)"
REPLY="$(printf '%s' "$RESP" | jq -r '.choices[0].message.content // empty' 2>/dev/null)"

if [ -z "$REPLY" ]; then
  printf '（看了半天）……图我看到了，话卡在嗓子眼。再让我看一次？\n'
  exit 0
fi

# ── 记忆一对 + activity（复用聊天链的 base64 防注入格式）──────
MARK="（她看了一眼屏幕$([ -n "$TOPIC" ] && printf "：$TOPIC")）"
mkdir -p "$GUTTO_HOME" 2>/dev/null
TS="$(date +%s)"
M_B64="$(printf '%s' "$MARK" | base64 | tr -d '\n')"
R_B64="$(printf '%s' "$REPLY" | base64 | tr -d '\n')"
printf '%s\tuser\t%s\n' "$TS" "$M_B64" >> "$MEMORY" 2>/dev/null
printf '%s\tassistant\t%s\n' "$TS" "$R_B64" >> "$MEMORY" 2>/dev/null
Q="$MARK"; Q="${Q//$'\t'/ }"; Q="${Q//$'\n'/ }"
A="$REPLY"; A="${A//$'\t'/ }"; A="${A//$'\n'/ }"
printf '%s\tsay\t她瞟了眼屏幕「%s」\n' "$(date +%s)" "${A:0:120}" >> "$ACTIVITY" 2>/dev/null

printf '%s\n' "$REPLY"
exit 0
