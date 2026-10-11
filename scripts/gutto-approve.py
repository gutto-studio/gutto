#!/usr/bin/env python3
"""gutto 审批队列 · 脑半边：JSON 组装/轮询读，零写盘零网络。

落盘（mkdir/写/删）全在执行器 gutto-approve.sh（install-hooks 脑手分家同款；
Mimosa 闸门要求：python 不碰变量写盘——本文件没有任何写模式的文件操作）。
路径全部由 bash 算好直传（同 gutto-chat-compact.py 的参数形状）。

子命令：
  new      --project P --tool T [--summary S] --source X
           → stdout 两行：id、待决 JSON（bash 落盘队列）
  decision <id> allow|deny [--via V]
           → stdout：决策 JSON（bash 落盘决策目录）
  wait     --decision FILE [--timeout 秒]（默认 60）
           → 轮询读该文件；等到=stdout 原文 exit 0；超时 exit 3（清理由 bash 做）
  pending  --queue-dir DIR
           → 读该目录下的 *.json，旧到新每行一个 JSON

id 白名单：字母数字加点横下划线（argv 进来的 id 参与文件名，从严）。
"""

import json
import re
import sys
import time
import uuid

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def safe_id(req_id):
    if not ID_RE.match(req_id or "") or (req_id or "").find(".") == 0:
        print(f"bad id: {req_id!r}", file=sys.stderr)
        sys.exit(2)
    return req_id


def parse(argv):
    args = {}
    positional = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            if "=" in a:
                k, v = a.split("=", 1)
                args[k] = v
            elif i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                args[a] = argv[i + 1]
                i += 1
            else:
                args[a] = "1"
        else:
            positional.append(a)
        i += 1
    return args, positional


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    cmd = sys.argv[1]
    args, positional = parse(sys.argv[2:])

    if cmd == "new":
        project = args.get("--project", "会话")
        tool = args.get("--tool", "操作")
        summary = args.get("--summary") or f"{project} 在等你批准「{tool}」"
        req_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
        obj = {"id": req_id, "ts": int(time.time()), "project": project,
               "tool": tool, "summary": summary, "source": args.get("--source", "unknown")}
        print(req_id)
        print(json.dumps(obj, ensure_ascii=False))
        return 0

    if cmd == "decision":
        if len(positional) < 2:
            print("usage: decision <id> allow|deny", file=sys.stderr)
            return 2
        req_id = safe_id(positional[0])
        verdict = positional[1]
        if verdict not in ("allow", "deny"):
            print("decision must be allow|deny", file=sys.stderr)
            return 2
        obj = {"id": req_id, "ts": int(time.time()), "decision": verdict,
               "via": args.get("--via", "cli")}
        print(json.dumps(obj, ensure_ascii=False))
        return 0

    if cmd == "wait":
        decision_file = args.get("--decision")
        timeout = float(args.get("--timeout", "60"))
        if not decision_file:
            print("--decision FILE required", file=sys.stderr)
            return 2
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                with open(decision_file, encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        print(content)
                        return 0
            except OSError:
                pass
            time.sleep(0.25)
        return 3

    if cmd == "pending":
        queue_dir = args.get("--queue-dir")
        if not queue_dir:
            print("--queue-dir DIR required", file=sys.stderr)
            return 2
        import os
        items = []
        try:
            names = os.listdir(queue_dir)
        except OSError:
            names = []
        for name in names:
            if not name.endswith(".json"):
                continue
            try:
                with open(queue_dir + "/" + name, encoding="utf-8") as f:
                    items.append(json.load(f))
            except (OSError, ValueError):
                continue
        # (ts, id) 双键排序：同一秒内并列时靠 id 的毫秒前缀保序
        items.sort(key=lambda x: (x.get("ts", 0), x.get("id", "")))
        for obj in items:
            print(json.dumps(obj, ensure_ascii=False))
        return 0

    print(f"unknown command: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
