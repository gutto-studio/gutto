#!/usr/bin/env python3
# gutto_clean.py — 清理扫描器（脑手分家的「脑」半边：纯读、零进程、零写入）
# 七条铁律映射（reports/2026-10-09-agent-safety-scan.md）：
#   铁律5 清理三惯例——扫描器与执行器分离，本脚本只出清单永不删除；
#   铁律6 注入防御——文件名是数据不是指令，本脚本输出结构化行由执行器代码消费；
#   安全边界——硬拒绝根目录在扫描侧先挡一层（执行器还有一层，双保险）。
#
# 用法：
#   gutto_clean.py scan  --root DIR [--days N] [--json]   # 人类可读摘要（--json 出计划）
#   gutto_clean.py paths --root DIR [--days N]            # 老文件路径逐行（size\tpath）
#
# v0.1 口径：只扫 root 顶层（depth-1）条目，跳过点文件与符号链接；old = mtime ≥ N 天。

import json
import os
import sys
import time
from pathlib import Path

DEFAULT_DAYS = 90
ENTRY_CAP = 20000  # 单条目递归计容量的文件数上限，防巨型目录拖死扫描

HARD_DENY = ("/", "/System", "/Library", "/usr", "/bin", "/sbin",
             "/etc", "/Volumes", "/private", "/dev", "/opt")


def refuse(msg: str) -> "NoReturn":  # type: ignore[valid-type]
    print(f"gutto-clean 安全闸：{msg}", file=sys.stderr)
    sys.exit(3)


def validate_root(root: Path) -> Path:
    if not root.exists():
        refuse(f"根目录不存在：{root}")
    if not root.is_dir():
        refuse(f"不是目录：{root}")
    real = os.path.realpath(root)
    home = Path.home()
    if real == "/":
        refuse("根目录不能是文件系统根")
    if real == os.path.realpath(home):
        refuse("根目录不能是整个家目录（范围太宽，拒绝执行）")
    for deny in HARD_DENY:
        if real == deny or real.startswith(deny + "/"):
            refuse(f"系统路径在硬拒绝清单内：{real}")
    return Path(real)


def dir_size(top: Path) -> int:
    total = 0
    seen = 0
    for base, dirs, files in os.walk(top, followlinks=False):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            if name.startswith("."):
                continue
            seen += 1
            if seen > ENTRY_CAP:
                return total
            try:
                total += os.lstat(os.path.join(base, name)).st_size
            except OSError:
                pass
    return total


def collect(root: Path, days: int) -> list:
    now = time.time()
    cutoff = now - days * 86400
    items = []
    try:
        entries = sorted(os.scandir(root), key=lambda e: e.name)
    except OSError as e:
        refuse(f"无法读取目录：{e}")
    for entry in entries:
        if entry.name.startswith("."):
            continue
        try:
            st = entry.stat(follow_symlinks=False)
        except OSError:
            continue
        if entry.is_symlink():
            continue
        is_dir = entry.is_dir(follow_symlinks=False)
        size = dir_size(entry.path) if is_dir else st.st_size
        items.append({
            "path": entry.path,
            "name": entry.name,
            "bytes": size,
            "is_dir": is_dir,
            "age_days": round((now - st.st_mtime) / 86400, 1),
            "old": st.st_mtime <= cutoff,
        })
    return items


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f}{unit}" if unit != "B" else f"{n}B"
        n /= 1024
    return f"{n}TB"


def main() -> None:
    argv = sys.argv[1:]
    if not argv or argv[0] not in ("scan", "paths"):
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    mode = argv[0]

    root = Path.home() / "Downloads"
    days = DEFAULT_DAYS
    as_json = False
    it = iter(argv[1:])
    for a in it:
        if a == "--root":
            root = Path(next(it))
        elif a == "--days":
            days = int(next(it))
        elif a == "--json":
            as_json = True
        else:
            print(f"未知参数：{a}", file=sys.stderr)
            sys.exit(2)

    root = validate_root(root)
    items = collect(root, days)
    old = [i for i in items if i["old"]]
    total_old_bytes = sum(i["bytes"] for i in old)

    if mode == "paths":
        for i in old:
            print(f"{i['bytes']}\t{i['path']}")
        return

    if as_json:
        plan = {"root": str(root), "days": days, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "scanned": len(items), "old_count": len(old),
                "old_bytes": total_old_bytes, "items": items}
        print(json.dumps(plan, ensure_ascii=False))
        return

    print(f"扫描范围：{root}（{days} 天未动 = 老）")
    print(f"顶层条目 {len(items)} 个，其中老条目 {len(old)} 个，共 {human(total_old_bytes)}")
    if old:
        print("老条目清单（按大小前 10）：")
        for i in sorted(old, key=lambda x: -x["bytes"])[:10]:
            kind = "📁" if i["is_dir"] else "📄"
            print(f"  {kind} {i['name']:<40} {human(i['bytes']):>10}  {i['age_days']:.0f} 天未动")
    else:
        print("没有可清理的老条目，她无活可干。")


if __name__ == "__main__":
    main()
