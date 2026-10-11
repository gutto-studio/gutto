#!/usr/bin/env python3
"""帧差 gap 分布分析（P0 帧率验收）：视频 → 帧差>阈值的时间间隔直方图。

用法：regress-gap.py <video> <x> <y> <w> <h> <outdir>
x/y 是窗口 top-left 全局坐标（CGWindowList 系），自动处理视频像素坐标系。
判据：gap 聚在 1f/2f（60fps 口径 16.7/33ms；50fps 口径 20/40ms）。
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

video, x, y, w, h, outdir = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
out = Path(outdir)
out.mkdir(parents=True, exist_ok=True)

# 逐帧原速抽帧（不重采样，保真实时间轴），PNG 序列
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", video,
     "-vf", f"crop={w}:{h}:{x}:{y}", "-vsync", "0", str(out / "f%04d.png")],
    check=True,
)
frames = sorted(out.glob("f*.png"))
if not frames:
    sys.exit("no frames extracted")
print(f"frames={len(frames)}")

# 帧差（像素变化计数>阈值 = 有新内容）
diffs = []
prev = None
for i, f in enumerate(frames):
    img = np.asarray(Image.open(f).convert("L"), dtype=np.int16)
    if prev is not None:
        d = int((np.abs(img - prev) > 12).sum())
        diffs.append((i, d))
    prev = img

# 时间戳：抽帧保真原帧率，用 ffprobe 拿每帧 pts 更准——用 nb_frames/时长近似
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
     "stream=avg_frame_rate", "-of", "csv=p=0", video],
    capture_output=True, text=True,
).stdout.strip()
num, den = map(int, probe.split("/"))
fps = num / den
frame_dt = 1.0 / fps
print(f"container_fps={fps:.2f} frame_dt={frame_dt*1000:.1f}ms")

changed = [i for i, d in diffs if d > 300]
if len(changed) < 4:
    print("NOT ENOUGH CHANGES — static or missing pet")
    sys.exit(1)

gaps_ms = [(b - a) * frame_dt * 1000 for a, b in zip(changed, changed[1:])]
gaps_frames = [b - a for a, b in zip(changed, changed[1:])]

hist = {}
for g in gaps_frames:
    hist[g] = hist.get(g, 0) + 1
print("gap histogram (frames):", dict(sorted(hist.items())[:12]))
print(f"gap ms: p50={np.median(gaps_ms):.0f} p90={np.percentile(gaps_ms,90):.0f} max={max(gaps_ms):.0f}")
one_two = sum(c for g, c in hist.items() if g <= 2)
print(f"1f/2f share: {one_two}/{len(gaps_frames)} = {100*one_two/len(gaps_frames):.0f}%")
total_span = (changed[-1] - changed[0]) * frame_dt
eff = (len(changed) - 1) / total_span if total_span > 0 else 0
print(f"effective change rate: {eff:.1f}/s over {total_span:.1f}s")
