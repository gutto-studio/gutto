#!/usr/bin/env python3
"""gutto-chat-compact.py — 记忆压缩「脑」半边：纯读/纯转换，零网络零写盘。

网络（curl）与落盘全在执行器 gutto-chat-compact.sh 手里（install-hooks 脑手分家同款；
Mimosa 闸门要求：python 不碰网络与变量写盘）。

子命令：
  build  --memory TSV --state STATE --summary CARD --model M --end N
         取旧账 [已压缩行数, N) 组装摘要请求 payload，base64 到 stdout
  apply  （stdin：LLM 原始 JSON 响应）
         提取并消毒记忆卡（换行规整+1200 字硬顶），base64 到 stdout

记忆格式（执行器维护，TSV）：ts \t role(user|assistant) \t base64(text)
"""

import argparse
import base64
import json
import sys
from pathlib import Path

CARD_MAX_CHARS = 1200
TRANSCRIPT_MAX_CHARS = 6000

SUMMARY_SYSTEM_PROMPT = (
    "你是桌宠 gutto 的记忆管理员，负责把旧对话压缩成「长期记忆卡」，供她之后的对话回忆用。\n"
    "规则：\n"
    "- 只保留以后会用到的信息：用户告诉你的个人事实（称呼、喜好、生日、习惯、在忙的项目）、"
    "重要约定、答应过的事、聊过的关键话题及其结论\n"
    "- 合并重复内容，丢弃寒暄和口水话，不加评论不发挥\n"
    "- 用「- 」开头的短条目列出，总长不超过 1000 字（最终硬顶 1200，宁少勿溢）\n"
    "- 如果给了旧记忆卡，旧条目保留，把新信息合并进去；冲突时以新对话为准\n"
    "只输出记忆卡内容，不要任何解释。"
)


def read_turns(memory_file: Path):
    turns = []
    for line in memory_file.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) != 3 or parts[1] not in ("user", "assistant"):
            continue
        try:
            text = base64.b64decode(parts[2]).decode("utf-8")
        except Exception:
            continue
        turns.append((parts[1], text))
    return turns


def cmd_build(args) -> int:
    turns = read_turns(Path(args.memory))
    total = len(turns)
    upto = 0
    state = Path(args.state)
    if state.exists():
        raw = state.read_text(encoding="utf-8").strip()
        if raw.isdigit():
            upto = min(int(raw), total)
    end = min(args.end, total)
    if end - upto < 1:
        return 0  # 没有可归档的旧账

    pending = turns[upto:end]
    transcript = "\n".join(
        ("用户：" if role == "user" else "她：") + text for role, text in pending
    )
    if len(transcript) > TRANSCRIPT_MAX_CHARS:
        transcript = transcript[-TRANSCRIPT_MAX_CHARS:]

    old_card = ""
    summary = Path(args.summary)
    if summary.exists():
        old_card = summary.read_text(encoding="utf-8").strip()

    payload = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"【旧记忆卡】\n{old_card or '（暂无）'}\n\n【要归档的新对话】\n{transcript}",
            },
        ],
    }
    sys.stdout.write(base64.b64encode(
        json.dumps(payload, ensure_ascii=False).encode("utf-8")).decode("ascii"))
    return 0


def cmd_apply(args) -> int:
    try:
        data = json.loads(sys.stdin.read())
        card = str(data["choices"][0]["message"]["content"] or "")
    except Exception:
        return 0  # 响应不对就不落卡，fail-open
    card = " ".join(card.split())[:CARD_MAX_CHARS]
    if card.strip():
        sys.stdout.write(base64.b64encode(card.encode("utf-8")).decode("ascii"))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    build = sub.add_parser("build")
    build.add_argument("--memory", required=True)
    build.add_argument("--state", required=True)
    build.add_argument("--summary", required=True)
    build.add_argument("--model", required=True)
    build.add_argument("--end", type=int, required=True)
    build.set_defaults(func=cmd_build)

    apply_p = sub.add_parser("apply")
    apply_p.set_defaults(func=cmd_apply)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
