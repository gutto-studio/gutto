#!/usr/bin/env python3
"""源帧层烤场景/推拉体检（2026-10-05 廿七轮）。

背景：jumping 行（FL2VA 白底道次）插值中途整段烤成室内场景、stretch 行被 H3
推拉分镜怼脸——两病在源帧上的签名都是 opaque 占比飙升（健康抠图帧 0.14-0.23，
烤场景 ≈1.0，怼脸 ≈0.9），而在图集格子上被 alpha 裁剪缩放搅混（健康 0.27-0.47
与病变分不开）——所以闸门必须放在源帧层，图集层四闸照旧。

用法：
  python3 scripts/check-sources.py                 # 扫 assets/motion60-*（接线产物层）
  python3 scripts/check-sources.py <frames-dir>    # 扫单个帧目录（验收器挂点）
豁免：APNG 贴身框老三样（idle/look/tilt，基线 ~0.55）。输出纯 stdout，闸门
失败 exit 1（调用方重定向落盘，脚本自身零写面，Mimosa 口径）。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

LIMIT = 0.40
EXEMPT = {"motion60-idle", "motion60-look", "motion60-tilt"}


def scan_dir(d: Path):
    files = sorted(d.glob("*.png"))
    if not files:
        return None
    worst, worst_f = 0.0, ""
    for f in files[::max(1, len(files) // 60)]:  # 至少 60 采样点，全段覆盖
        a = np.asarray(Image.open(f).convert("RGBA"))[..., 3]
        r = float((a > 200).mean())
        if r > worst:
            worst, worst_f = r, f.name
    return worst, worst_f, len(files)


def main():
    targets = [Path(sys.argv[1])] if len(sys.argv) > 1 \
        else sorted(Path("assets").glob("motion60-*"))
    fails = []
    for d in targets:
        if not d.is_dir():
            continue
        r = scan_dir(d)
        if r is None:
            continue
        worst, worst_f, n = r
        exempt = d.name in EXEMPT
        ok = exempt or worst <= LIMIT
        print(f"  {d.name:22s} n={n:4d} opaque_max={worst:.2f} ({worst_f})"
              f"{'  [exempt]' if exempt else ''}{'' if ok else '  <-- FAIL'}")
        if not ok:
            fails.append(d.name)
    print(f"VERDICT sources: {'PASS' if not fails else 'FAIL'} ({', '.join(fails)})")
    sys.exit(0 if not fails else 1)


if __name__ == "__main__":
    main()
