#!/usr/bin/env python3
"""agent-hook.sh 的 JSON 字段提取器（纯 stdout，零写入零执行）。

stdin: hook JSON 负载；argv[1]: 取哪个字段（event/cwd/tool_name/message/hook_event_name）。
argv[2]: field=event 时为兜底事件名；field=message 时为截断字符数（按字符不按字节）。
输出 base64——任意 UTF-8 字节安全过 bash（bash 3.2 多字节/引号坑全绕开）。
"""
import base64
import json
import sys


def b64(value) -> None:
    sys.stdout.write(base64.b64encode(str(value if value is not None else "").encode("utf-8")).decode("ascii"))


def main() -> int:
    field = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    if field == "event":
        b64(sys.argv[2] if len(sys.argv) > 2 else payload.get("hook_event_name") or "")
    elif field == "cwd":
        b64(payload.get("cwd") or "")
    elif field == "tool_name":
        # snake_case（claude/codex）优先，camelCase toolName（zcode 信封）兜底
        b64(payload.get("tool_name") or payload.get("toolName") or "")
    elif field == "message":
        value = str(payload.get("message") or "")
        if len(sys.argv) > 2 and sys.argv[2].isdigit():
            value = value[: int(sys.argv[2])]  # 按字符截断；bash 3.2 字节切片会切碎多字节
        b64(value)
    else:
        b64("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
