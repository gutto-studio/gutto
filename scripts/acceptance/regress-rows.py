#!/usr/bin/env python3
"""P0 回归：逐行强制动画 + 三连拍帧差（证活）。

用法：python3 regress-rows.py <pid> <outdir>
每行：socket playAnimation → 1.2s 热身 → 3 帧窗口捕获（0.2s 间隔）→ 相邻帧像素差。
判据：diff>500 = 该行动态渲染在跑（变化计数只证活；幅度/帧率另有验收）。
"""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops


def send_ipc(payload: dict) -> dict:
    path = f"/tmp/openpets-{subprocess.run(['id', '-u'], capture_output=True, text=True).stdout.strip()}.sock"
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(3)
    client.connect(path)
    client.sendall((json.dumps(payload) + "\n").encode())
    data = client.recv(65536)
    client.close()
    return json.loads(data) if data else {}


def winid(pid: str) -> str:
    out = subprocess.run(
        ["swift", str(Path(__file__).parent / "wander-winid.swift"), pid],
        capture_output=True, text=True,
    ).stdout.strip().splitlines()[-1]
    return out


def shot(wid: str, path: str) -> None:
    subprocess.run(["screencapture", "-x", "-o", f"-l{wid}", path], check=True)


def diff(a: str, b: str) -> int:
    ia, ib = Image.open(a).convert("RGBA"), Image.open(b).convert("RGBA")
    if ia.size != ib.size:
        return 10**9
    bbox = ImageChops.difference(ia, ib).getbbox()
    if bbox is None:
        return 0
    diff_img = ImageChops.difference(ia, ib).convert("L")
    return sum(1 for v in diff_img.getdata() if v > 12)


def main() -> None:
    pid, outdir = sys.argv[1], Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)
    wid = winid(pid)
    print(f"WID={wid}")
    rows = [
        "idle", "running-right", "running-left", "waving", "jumping",
        "failed", "waiting", "running", "review", "sleep",
        "yawn", "cheer", "stretch", "sit", "look-left", "look-right",
    ]
    fails = []
    for row in rows:
        send_ipc({"type": "playAnimation", "name": row, "loop": True, "ttlSeconds": 30})
        time.sleep(1.2)
        p1, p2, p3 = (outdir / f"{row}-{i}.png" for i in (1, 2, 3))
        shot(wid, str(p1)); time.sleep(0.25)
        shot(wid, str(p2)); time.sleep(0.25)
        shot(wid, str(p3))
        d1, d2 = diff(str(p1), str(p2)), diff(str(p2), str(p3))
        ok = d1 > 500 or d2 > 500
        print(f"{row:16s} diff=[{d1}, {d2}] {'OK' if ok else 'STATIC-FAIL'}")
        if not ok:
            fails.append(row)
        time.sleep(0.6)
    print("REGRESS", "PASS" if not fails else f"FAIL {fails}")
    # 停止强制动画，交还轮换
    send_ipc({"type": "playAnimation", "name": "idle", "loop": True, "ttlSeconds": 2})


if __name__ == "__main__":
    main()
