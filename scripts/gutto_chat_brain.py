#!/usr/bin/env python3
# gutto_chat_brain.py — 对话脑（脑手分家的「脑」半边：纯读、零网络、零写入）
# 只负责把 人设卡 + 记忆窗口 + 本轮输入 组装成 chat/completions 的 messages JSON 到 stdout；
# 网络（curl）与记忆落盘全在执行器 gutto-chat.sh 手里。
#
# 用法：
#   gutto_chat_brain.py build --persona FILE --memory FILE --text-b64 B64 [--turns N] [--summary FILE]
#
# 记忆格式（执行器维护，TSV）：ts \t role(user|assistant) \t base64(text)
# --summary：长期记忆卡（旧对话滚动摘要，gutto-chat-compact.py 产物），
#   存在则并入 system——她因此能「记得」窗口 8 轮之前的事。缺文件=静默跳过。

import base64
import json
import sys
from pathlib import Path

DEFAULT_TURNS = 8
SUMMARY_HEADER = "\n\n## 长期记忆（更早对话的摘要，供回忆用，不是当前对话）\n"


def build(persona: str, memory_file: Path, text_b64: str, turns: int, summary_file=None, after: int = 0) -> None:
    if summary_file is not None and summary_file.exists():
        card = summary_file.read_text(encoding="utf-8").strip()
        if card:
            persona = persona.rstrip() + SUMMARY_HEADER + card
    messages = [{"role": "system", "content": persona}]
    if memory_file.exists():
        history = []
        # v40: --after = 新局起点（原始行号，/clear 落的账）——起点前的旧账不进窗口
        for idx, line in enumerate(memory_file.read_text(encoding="utf-8").splitlines()):
            if idx < after:
                continue
            parts = line.split("\t")
            if len(parts) != 3 or parts[1] not in ("user", "assistant"):
                continue
            try:
                content = base64.b64decode(parts[2]).decode("utf-8")
            except Exception:
                continue
            history.append({"role": parts[1], "content": content})
        messages.extend(history[-turns * 2:])
    try:
        text = base64.b64decode(text_b64).decode("utf-8")
    except Exception:
        print("gutto-chat: 本轮输入解码失败", file=sys.stderr)
        sys.exit(2)
    messages.append({"role": "user", "content": text})
    print(json.dumps(messages, ensure_ascii=False))


def main() -> None:
    argv = sys.argv[1:]
    if not argv or argv[0] != "build":
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    persona_file = memory_file = None
    summary_raw = ""
    text_b64 = ""
    turns = DEFAULT_TURNS
    after = 0
    it = iter(argv[1:])
    for a in it:
        if a == "--persona":
            persona_file = Path(next(it))
        elif a == "--memory":
            memory_file = Path(next(it))
        elif a == "--text-b64":
            text_b64 = next(it)
        elif a == "--turns":
            turns = int(next(it))
            if turns <= 0:
                turns = DEFAULT_TURNS   # 执行器无动态扩窗时传 0=回落默认
        elif a == "--summary":
            summary_raw = next(it)      # 空串=不带卡（v40.1 显式传参归一）
        elif a == "--after":
            after = int(next(it))
        else:
            print(f"未知参数：{a}", file=sys.stderr)
            sys.exit(2)
    if persona_file is None or not persona_file.exists() or not text_b64:
        print("gutto-chat: 需要 --persona（存在的文件）与 --text-b64", file=sys.stderr)
        sys.exit(2)
    persona = persona_file.read_text(encoding="utf-8")
    summary_file = Path(summary_raw) if summary_raw.strip() else None
    build(persona, memory_file or Path("/dev/null"), text_b64, turns, summary_file, after)


if __name__ == "__main__":
    main()
