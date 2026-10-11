#!/usr/bin/env python3
"""gutto-card.py — tavern 角色卡导入 · 纯读纯转换，零写盘零网络。

输入：--card FILE（.json 或 .png）。json 支持 v1 扁平与 v2/v3 带 data 外壳；
png 解析 tEXt 块内嵌的 base64 JSON（关键字 chara / ccv3）。
输出：组装好的 persona 文本打到 stdout（名字 + 描述 + 性格 + 场景 +
system_prompt + 开场白参考，空段跳过）。落盘由调用方负责——设置窗里
先进编辑器预览、点「保存人设」才写 ~/.gutto/persona.md。

脑手分家（Mimosa 闸门）：本文件只读 --card 指定的一个文件，不写任何文件。
世界书（character_book）v1 不导入：条目注入策略需单独设计（挂账）。
"""

import argparse
import base64
import json
import struct
import sys
from pathlib import Path


def parse_png_text(png_path: Path):
    """PNG tEXt 块扫描：返回 {keyword: text}。坏块跳过（fail-open）。"""
    texts = {}
    data = png_path.read_bytes()
    if len(data) < 8 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return texts
    pos = 8
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 8 + length + 4  # 长度+类型+数据+CRC
        if ctype == b"tEXt" and b"\x00" in chunk:
            keyword, _, text = chunk.partition(b"\x00")
            try:
                texts[keyword.decode("latin-1")] = text.decode("latin-1")
            except Exception:
                continue
        if ctype == b"IEND":
            break
    return texts


def extract_card(path: Path):
    """卡片文件 → 卡片 dict（找不到内嵌数据则报错退出）。"""
    suffix = path.suffix.lower()
    if suffix == ".png":
        texts = parse_png_text(path)
        raw = texts.get("ccv3") or texts.get("chara")
        if not raw:
            print("no embedded chara/ccv3 tEXt chunk", file=sys.stderr)
            sys.exit(2)
        return json.loads(base64.b64decode(raw).decode("utf-8"))
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(card):
    """v1/v2/v3 → 统一字段视图（v2/v3 的有效载荷在 data 键下）。"""
    data = card.get("data") if isinstance(card.get("data"), dict) else card
    fields = {}
    for key in ("name", "description", "personality", "scenario",
                "first_mes", "system_prompt"):
        value = data.get(key) or card.get(key) or ""
        if isinstance(value, str):
            fields[key] = value.strip()
    return fields


def compose(fields):
    """卡片字段 → persona 文本（空段跳过，保留原语言原汁原味）。"""
    parts = []
    if fields.get("name"):
        parts.append(f"# {fields['name']}")
    if fields.get("description"):
        parts.append(fields["description"])
    if fields.get("personality"):
        parts.append(f"## 性格\n{fields['personality']}")
    if fields.get("scenario"):
        parts.append(f"## 场景\n{fields['scenario']}")
    if fields.get("system_prompt"):
        parts.append(fields["system_prompt"])
    if fields.get("first_mes"):
        parts.append(f"## 开场白（参考，她可以这样开口）\n{fields['first_mes']}")
    if not parts:
        print("card has no usable fields", file=sys.stderr)
        sys.exit(2)
    return "\n\n".join(parts) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="tavern 角色卡 → persona 文本（stdout）")
    parser.add_argument("--card", required=True, help="卡片文件（.json 或 .png）")
    args = parser.parse_args()
    card = extract_card(Path(args.card))
    print(compose(normalize(card)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
