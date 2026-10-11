#!/usr/bin/env python3
"""gutto hooks 安装器 · 决策脑（stdin→stdout 纯转换，零文件 IO 零路径逻辑）。

家目录路径、存在性检查、落盘全在 install-hooks.sh（bash 执行器，脑手分家
同 gutto-life 先例——本文件连 open 都没有，任何来源的数据只从 stdin 进、
stdout 出。

子命令（argv[1]）：
  zcode        <settings.json          → merge 后新 JSON（SessionStart + PreToolUse + PermissionRequest + enabled）
  claude       <settings.json          → merge 后新 JSON（Notification + Stop）
  codex-hooks  <hooks.json             → merge 后新 JSON（Stop + PermissionRequest）
  codex-toml   <config.toml 文本       → 新文本（[features] hooks = true）
  opencode     <opencode.json          → merge 后新 JSON（plugin 数组 + 插件目录）

argv[2] = hook 脚本绝对路径（bash 传入；写进配置内容用）。
argv[3] = opencode 插件目录绝对路径（仅 opencode 子命令用）。
"""

import json
import sys

BASH = "/bin/bash"


def load(text):
    try:
        return json.loads(text) if text.strip() else {}
    except Exception:
        return None


def emit(data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def entry_text(entry):
    return json.dumps(entry, ensure_ascii=False)


def purge(entries, marker):
    return [e for e in entries if marker not in entry_text(e)]


def zcode(raw, hook_sh):
    data = load(raw)
    if data is None:
        return
    hooks = data.setdefault("hooks", {})
    events = hooks.setdefault("events", {})
    if hooks.get("enabled") is False:
        print("__GUTTO_SKIP__: hooks.enabled=false（显式关闭不覆盖）", file=sys.stderr)
        emit(data)
        return
    hooks["enabled"] = True
    # v44.5：PermissionRequest 升真拦——宿主标签走 argv（process 钩子带不了
    # env 前缀），timeoutMs 8000→120000（审批等待默认 60s+余量，8s 撑不住等卡）
    pr_entry = {"hooks": [{"type": "process", "command": BASH,
                           "args": [hook_sh, "PermissionRequest", "zcode"], "timeoutMs": 120000}]}
    pt_entry = {"hooks": [{"type": "process", "command": BASH,
                           "args": [hook_sh, "PreToolUse"], "timeoutMs": 2000}]}
    # v44.8：SessionStart 上班事件——process 同款形状，不挂宿主标签（非阻塞，
    # 壳侧只播行不回话）；timeoutMs 3000 比老三样宽（首窗冷启 shell 稍慢）
    ss_entry = {"hooks": [{"type": "process", "command": BASH,
                           "args": [hook_sh, "SessionStart"], "timeoutMs": 3000}]}
    for event, entry in (("PermissionRequest", pr_entry), ("PreToolUse", pt_entry),
                         ("SessionStart", ss_entry)):
        entries = purge(events.get(event, []), "agent-hook.sh")
        entries.append(entry)
        events[event] = entries
    emit(data)


def claude(raw, hook_sh):
    data = load(raw)
    if data is None:
        return
    hooks = data.setdefault("hooks", {})
    quoted = f"'{BASH}' '{hook_sh}'"
    for event, timeout in (("Notification", 5), ("Stop", 5), ("PreToolUse", 5)):
        entry = {"matcher": "", "hooks": [{
            "type": "command", "command": f"{quoted} {event}",
            "async": True, "timeout": timeout}]}
        entries = purge(hooks.get(event, []), "agent-hook.sh")
        entries.append(entry)
        hooks[event] = entries
    # v42 阻塞式审批：PermissionRequest 注册（非 async 才能回决策）。
    # GUTTO_HOST=claude 标签 = agent-hook.sh 只对这个注册输出 permissionDecision；
    # 等待上限默认 60s（GUTTO_APPROVAL_TIMEOUT 可调），超时回落原生权限流。
    pr_entry = {"matcher": "", "hooks": [{
        "type": "command",
        "command": f"GUTTO_HOST=claude {quoted} PermissionRequest",
        "async": False, "timeout": 120}]}
    pr_entries = purge(hooks.get("PermissionRequest", []), "agent-hook.sh")
    pr_entries.append(pr_entry)
    hooks["PermissionRequest"] = pr_entries
    emit(data)


def codex_hooks(raw, hook_sh):
    data = load(raw)
    if data is None:
        return
    hooks = data.setdefault("hooks", {})
    quoted = f"'{BASH}' '{hook_sh}'"
    plain = {"hooks": [{"type": "command", "command": quoted, "timeout": 30}]}
    # v44.5：PermissionRequest 升真拦——同步钩子（async 不能拦）+ GUTTO_HOST
    # 标签 + 120s（审批等待 60s 默认+余量）；决策回 hookSpecificOutput 同 claude
    blocking = {"hooks": [{"type": "command",
                           "command": f"GUTTO_HOST=codex {quoted}", "timeout": 120}]}
    for event, entry in (("Stop", plain), ("PreToolUse", plain), ("PermissionRequest", blocking)):
        entries = purge(hooks.get(event, []), "agent-hook.sh")
        entries.append(entry)
        hooks[event] = entries
    emit(data)


def codex_toml(raw):
    lines = raw.splitlines()
    in_features = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("["):
            in_features = stripped == "[features]"
            continue
        if in_features and stripped.startswith("hooks"):
            if stripped in ("hooks = true", "hooks=true"):
                sys.stdout.write(raw)
                return
            print("__GUTTO_SKIP__: config.toml 已有其它 hooks 值", file=sys.stderr)
            sys.stdout.write(raw)
            return
    if in_features:
        lines.append("hooks = true")
    else:
        lines.extend(["[features]", "hooks = true"])
    sys.stdout.write("\n".join(lines) + "\n")


def opencode(raw, plugin_dir):
    data = load(raw)
    if data is None:
        return
    plugins = [p for p in data.get("plugin", []) if isinstance(p, str)]
    if any("opencode-plugin" in p for p in plugins):
        emit(data)  # 已注册，原样吐回
        return
    plugins.append(plugin_dir)
    data["plugin"] = plugins
    emit(data)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    hook_sh = sys.argv[2] if len(sys.argv) > 2 else ""
    plugin_dir = sys.argv[3] if len(sys.argv) > 3 else ""
    raw = sys.stdin.read()
    if cmd == "zcode":
        zcode(raw, hook_sh)
    elif cmd == "claude":
        claude(raw, hook_sh)
    elif cmd == "codex-hooks":
        codex_hooks(raw, hook_sh)
    elif cmd == "codex-toml":
        codex_toml(raw)
    elif cmd == "opencode":
        opencode(raw, plugin_dir)
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
