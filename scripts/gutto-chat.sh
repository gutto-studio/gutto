#!/bin/bash
# gutto-chat.sh — 对话执行器（脑手分家的「手」半边：curl 网络 + 记忆落盘 + 气泡）
# 链路：用户一句话 → 脑（组装 messages，含人设卡+长期记忆卡+记忆窗口）→ LLM API → 回复
#   → 终端全文 + gutto say 气泡（首行）+ 记忆追加（本轮 user/assistant 各一条）
#   → 旧账积压 ≥24 条时后台滚动摘要成记忆卡（gutto-chat-compact.sh，主动压缩）
#
# 配置（~/.gutto/env，bash source 格式，缺失即优雅降级）：
#   GUTTO_LLM_BASEURL=https://api.deepseek.com   # OpenAI 兼容端点均可
#   GUTTO_LLM_KEY=sk-...
#   GUTTO_LLM_MODEL=deepseek-chat
# 可选覆盖：GUTTO_PERSONA=人设卡路径（默认仓库 config/persona-gutto.md，也可放 ~/.gutto/persona.md）
#
# 用法：gutto-chat.sh "你想对她说的话"

set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAIN="$DIR/scripts/gutto_chat_brain.py"
GUTTO="$DIR/bin/gutto"
GUTTO_HOME="${GUTTO_TEST_HOME:-$HOME/.gutto}"   # 测试隔离口：GUTTO_TEST_HOME 指到临时目录即不碰真实记忆
MEMORY="$GUTTO_HOME/chat-memory.tsv"
PERSONA_DEFAULT="$DIR/config/persona-gutto.md"
PERSONA_USER="$GUTTO_HOME/persona.md"
MAX_BUBBLE=80   # 气泡只放首行截断，全文走终端

# v44.7 双通道：$1 契约不变（终端/测试）；无参数且非 tty（管道）时读 stdin
# ——Electron 主进程走标准输入传文本，argv 零动态数据（Mimosa 口径）。
if [ $# -ge 1 ]; then
  TEXT="$*"
elif [ -t 0 ]; then
  echo "usage: gutto-chat.sh TEXT" >&2; exit 2
else
  TEXT="$(cat)"
fi
[ -n "$TEXT" ] || { echo "usage: gutto-chat.sh TEXT" >&2; exit 2; }

# ── 指令清单（v40.2：输入框「/」提示列表的数据源；引擎/人皆可调）──────
# 输出：名称<TAB>描述 每行一条。基础 5 条 + 自定义（~/.gutto/commands/*.md，
# frontmatter description 没写就给占位文案）。纯本地零网络，fail-open。
if [ "${1:-}" = "--list-commands" ]; then
  printf '/clear\t新开一局，旧上下文不再带入\n'
  printf '/new\t同 /clear\n'
  printf '/compact\t立即压缩旧账成长期记忆卡\n'
  printf '/memory\t看记忆状态\n'
  printf '/help\t这份清单\n'
  printf '/look\t让她看一眼你的屏幕并吐槽（/look 或 /看一眼，可带话题）\n'
  printf '/settings\t打开她的设置窗（/settings 或 /设置，可带页名 play/records）\n'
  if [ -d "$GUTTO_HOME/commands" ]; then
    for f in "$GUTTO_HOME/commands"/*.md; do
      [ -f "$f" ] || continue
      name="/$(basename "$f" .md)"
      desc="$(awk 'NR==1 && $0 !~ /^---[[:space:]]*$/ {nofm=1}
                   /^---[[:space:]]*$/ {dashes++; next}
                   dashes==1 && /^description:/ {sub(/^description:[[:space:]]*/, ""); gsub(/\t/, " "); print; exit}
                   ' "$f")"
      [ -n "$desc" ] || desc="自定义提示"
      printf '%s\t%s\n' "$name" "$desc"
    done
  fi
  exit 0
fi

# ── 斜杠命令（v40：Claude Code / opencode 同款习惯）──────────────
# /clear、/new 新开一局——旧上下文不再带进对话（TSV 只增不毁，起点记在
# chat-memory-fresh.state）；/compact 立即压缩旧账；/memory 看记忆状态。
# 人设卡是身份不是记忆：/clear 保留人设，只清对话上下文。
FRESH_STATE="$GUTTO_HOME/chat-memory-fresh.state"
CMD="${TEXT%% *}"
case "$CMD" in
  /clear|/new)
    fresh="$(wc -l < "$MEMORY" 2>/dev/null | tr -d ' ')"
    [ -n "$fresh" ] || fresh=0
    mkdir -p "$GUTTO_HOME" 2>/dev/null
    printf '%s' "$fresh" > "$FRESH_STATE"
    printf '新的一局！旧账不再带进对话（记录本体还在 %s，只增不毁）。\n人设卡保留——接着聊就是新开始(≧▽≦)\n' "$MEMORY"
    exit 0
    ;;
  /look|/看一眼)
    # v42.1 看屏（BYO key VL）：剩余部分当话题，exec 交棒（stdout 同路出气泡）
    LOOK_TOPIC="${TEXT#* }"
    [ "$LOOK_TOPIC" = "$TEXT" ] && LOOK_TOPIC=""
    exec bash "$DIR/scripts/gutto-look.sh" "$LOOK_TOPIC"
    ;;
  /compact)
    [ -f "$MEMORY" ] || { printf '还没有记忆可压缩\n'; exit 0; }
    nohup bash "$DIR/gutto-chat-compact.sh" >/dev/null 2>&1 &
    printf '收到，正在后台压缩旧账～新记忆卡好了她自己会用上\n'
    exit 0
    ;;
  /memory)
    total="$(wc -l < "$MEMORY" 2>/dev/null | tr -d ' ')"; [ -n "$total" ] || total=0
    upto="$(cat "$GUTTO_HOME/chat-memory-compact.state" 2>/dev/null || printf 0)"
    case "$upto" in ''|*[!0-9]*) upto=0 ;; esac
    fresh="$(cat "$FRESH_STATE" 2>/dev/null || printf 0)"
    case "$fresh" in ''|*[!0-9]*) fresh=0 ;; esac
    if [ "$upto" -gt "$fresh" ]; then card="生效中（已覆盖到本局）"; else card="不带入（旧局摘要）"; fi
    printf '记忆账本：%s 条（只增不毁）\n压缩点：第 %s 条｜新局起点：第 %s 条\n长期记忆卡：%s｜每轮对话带最近 8 轮\n' "$total" "$upto" "$fresh" "$card"
    exit 0
    ;;
  /settings|/设置)
    # v44.2 打开设置窗（事件桥：bin/gutto settings → 壳 fs.watch → showSettings）。
    # 页名白名单与 bin/gutto 同表；乱给的参数不传参，回落默认设置页。
    SETTINGS_TAB="${TEXT#* }"
    [ "$SETTINGS_TAB" = "$TEXT" ] && SETTINGS_TAB=""
    case "$SETTINGS_TAB" in
      settings|play|records|records/activity|records/history|records/log) ;;
      *) SETTINGS_TAB="settings" ;;
    esac
    if "$GUTTO" settings "$SETTINGS_TAB" 2>/dev/null; then
      printf '设置窗这就开！想改我的性格去「人设卡」分组，改完下一句话就生效(๑•̀ㅂ•́)\n'
    else
      printf '呜，设置窗没开成……壳可能不在岗。右键我 → 图标条里也有「设置」(⊙_⊙)\n'
    fi
    exit 0
    ;;
  /help)
    printf '基础指令（Claude Code / opencode 同款习惯）：\n  /clear 或 /new   新开一局，旧上下文不再带入\n  /compact         立即压缩旧账成长期记忆卡\n  /memory          看记忆状态\n  /look 或 /看一眼  她瞟一眼屏幕吐槽（要配 VL，见设置）\n  /settings 或 /设置 打开她的设置窗（改人设去「人设卡」分组）\n  /help            这份清单\n'
    if [ -d "$GUTTO_HOME/commands" ] && ls "$GUTTO_HOME/commands"/*.md >/dev/null 2>&1; then
      printf '自定义提示（~/.gutto/commands/，$ARGUMENTS=命令后参数）：\n'
      for f in "$GUTTO_HOME/commands"/*.md; do
        [ -f "$f" ] || continue
        desc="$(awk 'NR==1 && $0 !~ /^---[[:space:]]*$/ {nofm=1}
                     /^---[[:space:]]*$/ {dashes++; next}
                     dashes==1 && /^description:/ {sub(/^description:[[:space:]]*/, ""); gsub(/\t/, " "); print; exit}
                     ' "$f")"
        [ -n "$desc" ] || desc="自定义提示"
        printf '  /%-16s %s\n' "$(basename "$f" .md)" "$desc"
      done
    fi
    exit 0
    ;;
  /*)
    # v40.2 自定义提示命令（学 opencode：~/.gutto/commands/*.md，文件名即命令）。
    # 正文=提示词模板，$ARGUMENTS 替换为命令后全部参数；模板没写占位符而带了
    # 参数时追加到尾部。基础指令已在上面分支截住——同名时基础赢。展开后的
    # TEXT 落正常对话流：这就是本轮用户消息（进脑、进记忆、进气泡）。
    CMD_FILE="$GUTTO_HOME/commands/${CMD#/}.md"
    if [ -f "$CMD_FILE" ]; then
      TEMPLATE="$(awk 'NR==1 && $0 !~ /^---[[:space:]]*$/ {nofm=1; print; next}
                       /^---[[:space:]]*$/ {dashes++; next}
                       dashes>=2 || nofm {print}
                       ' "$CMD_FILE")"
      ARGS="${TEXT#* }"
      [ "$ARGS" = "$TEXT" ] && ARGS=""
      # 纯 bash 字面量替换（3.2 实测过 & | \ 元字符安全）——sed 的 &/分隔符雷不碰
      if printf '%s' "$TEMPLATE" | grep -q '\$ARGUMENTS'; then
        TEXT="${TEMPLATE//\$ARGUMENTS/$ARGS}"
      else
        if [ -n "$ARGS" ]; then TEXT="$TEMPLATE $ARGS"; else TEXT="$TEMPLATE"; fi
      fi
    fi
    ;;   # 文件不存在→原样送脑（她对裸 / 开头的话自由发挥）
  esac

# ── 配置 ─────────────────────────────────────────────────────────
BASEURL="https://api.deepseek.com"
MODEL="deepseek-chat"
KEY=""
[ -f "$GUTTO_HOME/env" ] && . "$GUTTO_HOME/env"
KEY="${GUTTO_LLM_KEY:-}"
[ -n "${GUTTO_LLM_BASEURL:-}" ] && BASEURL="$GUTTO_LLM_BASEURL"
[ -n "${GUTTO_LLM_MODEL:-}" ] && MODEL="$GUTTO_LLM_MODEL"
# v44.3 对标 Cherry Studio 模型参数面板：思考深度 + 上下文窗口（全局档）
# THINK：low/medium/high 白名单，其他值（含空/off）=不发字段（行为同旧）。
THINK=""
case "${GUTTO_LLM_THINK:-}" in
  low|medium|high) THINK="$GUTTO_LLM_THINK" ;;
esac
# CTX：1-40 轮合法（=携带的历史轮数，Cherry Studio「上下文数量」同语义）；
# 0/空=自动（内部动态 8~40）。本地端点时同值作 num_ctx 顶层透传（新版
# Ollama OpenAI 层认；旧版忽略无害——端点侧兜底 OLLAMA_CONTEXT_LENGTH）。
USER_CTX=0
case "${GUTTO_LLM_CTX:-}" in
  ''|*[!0-9]*) USER_CTX=0 ;;
  *) USER_CTX="$GUTTO_LLM_CTX"
     [ "$USER_CTX" -gt 40 ] && USER_CTX=40
     [ "$USER_CTX" -lt 1 ] && USER_CTX=0 ;;
esac
# v37.1: 离线档——回环/私网/Tailscale 端点免 key（自家 Ollama/LM Studio 不验签）
IS_LOCAL=0
case "$BASEURL" in
  http://127.0.0.1*|http://localhost*|http://\[::1\]*|http://192.168.*|http://10.*|http://100.*|http://172.1[6-9].*|http://172.2[0-9].*|http://172.3[01].*)
    IS_LOCAL=1 ;;
esac
if [ -z "$KEY" ] && [ "$IS_LOCAL" != 1 ]; then
  echo "gutto-chat: 还没配 LLM key。右键她 →「设置」里填（或写 $GUTTO_HOME/env）。" >&2
  echo "  云端（DeepSeek 等）：GUTTO_LLM_BASEURL + GUTTO_LLM_KEY + GUTTO_LLM_MODEL" >&2
  echo "  离线（本机 Ollama/LM Studio）：只填 BASEURL 指向本地端点，key 可留空" >&2
  "$GUTTO" say "脑子还没接上……右键我 → 设置里填 API key（本地模型免 key）(｡•́ ₃ •̀๑)" || true
  exit 1
fi
CURL_AUTH=()
[ -n "$KEY" ] && CURL_AUTH=(-H "Authorization: Bearer $KEY")
# v37.1: 本地端点冷加载（模型从显存卸载后首问，GPU 满载时 >30s）放宽到 90s
CURL_TIMEOUT=30
[ "$IS_LOCAL" = 1 ] && CURL_TIMEOUT=90
PERSONA="${GUTTO_PERSONA:-}"
[ -n "$PERSONA" ] || { [ -f "$PERSONA_USER" ] && PERSONA="$PERSONA_USER"; }
[ -n "$PERSONA" ] || PERSONA="$PERSONA_DEFAULT"

# ── 主动压缩（v38.1）：旧账积压 ≥24 条就后台摘要成「长期记忆卡」────────
# 零阻塞（nohup 后台）+ fail-open（失败只影响卡片新鲜度）；积压未落卡期间，
# 窗口动态扩到覆盖压缩点（上限 40 轮，仍远小于 ctx 8192）——上下文零间隙。
# v40 新局语义：/clear 后 fresh 起点同时是 压缩下限/扩窗下限/卡片生效线
fresh_lines=0
if [ -f "$FRESH_STATE" ]; then
  fresh_lines="$(cat "$FRESH_STATE" 2>/dev/null || printf 0)"
  case "$fresh_lines" in ''|*[!0-9]*) fresh_lines=0 ;; esac
fi
COMPACT_TURNS=""
USE_SUMMARY=0
if [ -f "$MEMORY" ]; then
  total_lines="$(wc -l < "$MEMORY" | tr -d ' ')"
  upto_lines="$(cat "$GUTTO_HOME/chat-memory-compact.state" 2>/dev/null || printf 0)"
  case "$upto_lines" in ''|*[!0-9]*) upto_lines=0 ;; esac
  [ "$upto_lines" -le "$total_lines" ] || upto_lines=$total_lines
  mem_floor="$upto_lines"
  [ "$fresh_lines" -gt "$mem_floor" ] && mem_floor=$fresh_lines
  backlog=$(( total_lines - mem_floor ))
  if [ "$backlog" -ge 24 ]; then
    nohup bash "$DIR/gutto-chat-compact.sh" >/dev/null 2>&1 &
  fi
  if [ "$upto_lines" -gt "$fresh_lines" ] && [ -f "$GUTTO_HOME/chat-memory-summary.md" ]; then
    USE_SUMMARY=1   # 卡片已覆盖到本局才带入；旧局摘要不进上下文
  fi
  if [ "$backlog" -gt 16 ]; then
    COMPACT_TURNS=$(( (backlog + 3) / 2 ))
    [ "$COMPACT_TURNS" -gt 40 ] && COMPACT_TURNS=40
  fi
fi

# ── 脑：组装 messages（纯读）────────────────────────────────────
B64="$(printf '%s' "$TEXT" | base64 | tr -d '\n')"
# v40: 卡片只在覆盖到本局时传入；bash 3.2 不吃双引号 $() 里嵌数组展开的
# 写法（review 同款教训）——用 if 分直路，不嵌套
if [ "$USE_SUMMARY" = 1 ]; then
  SUMMARY_ARG="$GUTTO_HOME/chat-memory-summary.md"
else
  SUMMARY_ARG=""
fi
TURNS_ARG="$COMPACT_TURNS"
[ -z "$TURNS_ARG" ] && TURNS_ARG=0
# v44.3：用户显式设了上下文轮数 → 尊重用户值压掉动态扩窗（压缩后台照跑、
# 摘要卡照带——窗口大小是用户口味，压缩补偿是记忆完整性，两不相欠）
[ "$USER_CTX" -gt 0 ] && TURNS_ARG="$USER_CTX"
# v40.1（bash 3.2 解析雷区）：${var:+...} 嵌双引号 $() 的写法会让 3.2 找不到
# 匹配括号（-n 与运行时双炸，实测）——一律显式传参，空值由 brain 端归一：
# summary 空串=不带卡；turns 传 0=回落默认 8 轮
MSGS="$(python3 "$BRAIN" build --persona "$PERSONA" --memory "$MEMORY" --text-b64 "$B64" --after "$fresh_lines" --summary "$SUMMARY_ARG" --turns "$TURNS_ARG")" || exit $?

# ── 手：调 LLM ──────────────────────────────────────────────────
# v44.3：THINK 合法 → reasoning_effort；本地端点且 CTX 合法 → num_ctx 透传
NUMCTX=0
[ "$IS_LOCAL" = 1 ] && [ "$USER_CTX" -gt 0 ] && NUMCTX="$USER_CTX"
PAYLOAD="$(jq -n --argjson m "$MSGS" --arg model "$MODEL" --arg think "$THINK" \
  --argjson numctx "$NUMCTX" \
  '{model:$model,messages:$m} + (if $think=="" then {} else {reasoning_effort:$think} end) + (if $numctx==0 then {} else {num_ctx:$numctx} end)')"
RESP="$(curl -sS --max-time "$CURL_TIMEOUT" "$BASEURL/chat/completions" \
  ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} -H "Content-Type: application/json" -d "$PAYLOAD" 2>&1)"
REPLY="$(printf '%s' "$RESP" | jq -r '.choices[0].message.content // empty' 2>/dev/null)"
if [ -z "$REPLY" ]; then
  echo "gutto-chat: LLM 无回复。原始返回：" >&2
  echo "$RESP" >&2
  "$GUTTO" say "脑子抽了一下……再问人家一次？" || true
  exit 1
fi

# ── 记忆追加（base64 防分隔符注入）──────────────────────────────
mkdir -p "$GUTTO_HOME" 2>/dev/null
TS="$(date +%s)"
R_B64="$(printf '%s' "$REPLY" | base64 | tr -d '\n')"
printf '%s\tuser\t%s\n' "$TS" "$B64" >> "$MEMORY"
printf '%s\tassistant\t%s\n' "$TS" "$R_B64" >> "$MEMORY"

# ── 出口：终端全文 + 气泡首行 + 操作记录 ─────────────────────────
printf '%s\n' "$REPLY"
# v39.5: 首行截断挪 python 按字符切——cut -c 在 C locale 按字节切，会把中文
# 切成半个字（bash 3.2 多字节家规同源）
FIRST_LINE="$(printf '%s' "$REPLY" | python3 -c 'import sys
lines = sys.stdin.read().splitlines()
print((lines[0] if lines else "")[: int(sys.argv[1])])' "$MAX_BUBBLE")"
# v36.9: 桌面路径（引擎 GUTTO_NO_SAY=1）不再双气泡——回复气泡由引擎 finishChat 出
if [ "${GUTTO_NO_SAY:-0}" != "1" ]; then
  "$GUTTO" say "$FIRST_LINE" || true
fi
{
  Q="$TEXT"; Q="${Q//$'\t'/ }"; Q="${Q//$'\n'/ }"; Q="${Q:0:60}"
  A="$REPLY"; A="${A//$'\t'/ }"; A="${A//$'\n'/ }"; A="${A:0:120}"
  mkdir -p "$GUTTO_HOME" 2>/dev/null
  printf '%s\tchat\t我问「%s」→ 她「%s」\n' "$(date +%s)" "$Q" "$A" >> "$GUTTO_HOME/activity.tsv" 2>/dev/null
} || true
exit 0
