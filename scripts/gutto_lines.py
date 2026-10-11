#!/usr/bin/env python3
"""gutto_lines.py — daemon/hook/CLI 侧台词语言表（round3 R-1 四语言收口）。

单一真源 scripts/lines/{zh,en,ja,ko}.json；语言判定与 Electron 壳同源：
GUTTO_LANG 环境变量 → $GUTTO_HOME(env 文件里的 GUTTO_LANG) → zh。
（GUTTO_HOME 认 GUTTO_TEST_HOME，与 bin/gutto / 壳 resolveGuttoHome 同口径。）
回退链：目标语言 → zh 真源 → 键名（与 shell-electron/i18n 同纪律，漏译显性可见）。
插值：{name} 单花括号（ICU 风格），缺参保留占位（同壳 createT 半成品可见）。

用法：
  bash 侧：gutto_lines.py <KEY> [name=value …]（stdout 单行文本）
  python 侧：import gutto_lines; gutto_lines.line(KEY, name=…)
  无参调用：打印当前判定语言（调试用）
"""
import json
import os
import re
import sys
from pathlib import Path

LANGS = ("zh", "en", "ja", "ko")
_DIR = Path(__file__).resolve().parent / "lines"
_TABLES = {}
_LANG = None  # 每进程判定一次（daemon 一拍一进程，切语言下一拍生效）

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _env_file_lang():
    """读 $GUTTO_HOME/env 的 GUTTO_LANG（设置页写入口，壳 detectLang 同款正则）。"""
    home = os.environ.get("GUTTO_TEST_HOME") or os.path.join(os.path.expanduser("~"), ".gutto")
    try:
        m = re.search(r"^GUTTO_LANG=(zh|en|ja|ko)\s*$",
                      Path(home, "env").read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1)
    except Exception:
        pass  # 无 env 文件/不可读 = 跟随缺省
    return ""


def resolve_lang():
    global _LANG
    if _LANG is None:
        env = os.environ.get("GUTTO_LANG", "")
        if env in LANGS:
            _LANG = env
        else:
            from_file = _env_file_lang()
            _LANG = from_file if from_file in LANGS else "zh"
    return _LANG


def _table(lang):
    if lang not in _TABLES:
        try:
            _TABLES[lang] = json.loads(
                _DIR.joinpath(f"{lang}.json").read_text(encoding="utf-8"))
        except Exception:
            _TABLES[lang] = {}  # 坏档/缺档=落回退链，不炸调用方（异常不炸脑纪律）
    return _TABLES[lang]


def line(key, **params):
    """取台词：目标语 → zh 真源 → 键名；{name} 缺参保留占位。"""
    s = _table(resolve_lang()).get(key)
    if s is None:
        s = _table("zh").get(key)
    if s is None:
        return key
    return _PLACEHOLDER.sub(
        lambda m: str(params[m.group(1)]) if m.group(1) in params else m.group(0), s)


def main(argv):
    if not argv or argv[0].startswith("-"):
        print(resolve_lang())
        return 0
    params = {}
    for kv in argv[1:]:
        name, sep, val = kv.partition("=")
        if sep:
            params[name] = val
    out = line(argv[0], **params)
    print(" ".join(str(out).split()))  # 单行纪律：气泡/通知吃不了多行
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
