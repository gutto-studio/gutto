#!/usr/bin/env python3
"""图集成品验证（2026-10-04 步态根治轮）：三项闸门 + 锚点/体型基线对照 + 镜像验证。

方法照抄 2026-10-04 审计（row-metrics.csv 同口径）：
- 逐帧 alpha bbox 度量身高/脚底/水平中心/漂移
- 回文检测：ImageChops.difference 验证 frame[i] == frame[64-i]
- run 行闸门：G1 非回文 / G2 接缝帧差 ≤ 邻帧差均值×1.5 / G3 帧差自相关主周期

用法：python3 verify-atlas.py [--baseline reports/2026-10-04-animation-audit/atlas/row-metrics.csv]
"""
import csv
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

CELL, COLS, ROWS = 240, 64, 23  # 行数随 ROW_NAMES（v43 生命周期三行后 23）；
# # 廿七轮：360px 试车被 WebP 16383 上限毙（见 make_spritesheet 注），回滚

# ---- 卅一轮第四闸：抠图残留预算（2026-10-05 主人拍板「设计无绿」）----
# 旧闸门只量几何/步态，量不到「没抠干净」——擂台 semi-alpha 0.0000 与肉眼
# 脏可以并存（白 rim 实锤轮）。两条预算：
#   green_per_cell ≤ 5   设计绿=0，角色身上任何深绿（hue 115-170 + sat≥0.50
#                        + val≥0.30）都是 H3 道具/绿底残留（眼睛黄绿 hue≈62° 不计）
#   rim_ratio    ≤ 6%    外圈 2px 带内「半透明且亮」的 rim 像素占比
#                        （resize 渗白/渗绿 + 光晕带的机器可测代理）
GREEN_BUDGET = 5.0
RIM_LIMIT = 0.06
ROW_NAMES = ["idle", "running-right", "running-left", "waving",
             "jumping", "failed", "waiting", "running", "review",
             "sleep", "yawn", "cheer", "stretch",
             "sit", "look-left", "look-right",
             "dance", "think", "angry", "crawl",   # v13 扩行（与引擎 codexRows=20 同步）
             # v43 生命周期三行（与 make_spritesheet.ROW_NAMES 同步维护）
             "entrance", "exit", "first-greeting"]


def row_frames(sheet: Image.Image, row: int):
    return [sheet.crop((c * CELL, row * CELL, (c + 1) * CELL, (row + 1) * CELL))
            for c in range(COLS)]


def row_metrics(frames):
    heights, bottoms, xcs = [], [], []
    for f in frames:
        b = f.getchannel("A").getbbox()
        if b is None:
            heights.append(0); bottoms.append(0); xcs.append(0.0)
            continue
        heights.append(b[3] - b[1])
        bottoms.append(b[3])
        xcs.append((b[0] + b[2]) / 2)
    return {
        "height_min": min(heights), "height_max": max(heights),
        "height_range": max(heights) - min(heights),
        "bottom_min": min(bottoms), "bottom_max": max(bottoms),
        "bottom_drift": max(bottoms) - min(bottoms),
        "xcenter_drift": round(max(xcs) - min(xcs), 1),
    }


def palindrome_pairs(frames):
    """镜像位对（frame[i] 与 frame[64-i] 像素级相同）计数，审计同口径 8 采样对。"""
    same = 0
    probes = [1, 2, 3, 5, 8, 13, 21, 34]  # 审计采样位
    for i in probes:
        j = COLS - i
        diff = ImageChops.difference(frames[i], frames[j])
        if diff.getbbox() is None:
            same += 1
    return f"{same}/{len(probes)}"


def gait_gates(frames):
    """G1 非回文 / G2 接缝无缝 / G3 周期对齐（对成品 64 帧）。"""
    arrs = [np.asarray(f, dtype=np.float32) for f in frames]
    adj = [float(np.mean(np.abs(arrs[i] - arrs[i + 1]))) for i in range(COLS - 1)]
    seam = float(np.mean(np.abs(arrs[-1] - arrs[0])))
    adj_mean = sum(adj) / len(adj)
    # G1：任何 i 使 frame[i]==frame[64-i] 即回文嫌疑（全 32 对查）
    g1_same = sum(1 for i in range(1, COLS // 2)
                  if ImageChops.difference(frames[i], frames[COLS - i]).getbbox() is None)
    # G3：缩略灰度帧差自相关主周期
    th = np.stack([np.asarray(f.convert("L").resize((96, 96), Image.BILINEAR),
                              dtype=np.float32) for f in frames])
    n = th.shape[0]
    lags = range(4, 32)
    curve = {L: float(np.mean(np.abs(th[:-L] - th[L:]))) for L in lags}
    base = float(np.median(list(curve.values())))
    best_lag, best_depth = None, -1.0
    for L in lags:
        if curve[L] < base and curve[L] < curve.get(L - 1, 1e9) and curve[L] <= curve.get(L + 1, 1e9):
            d = (base - curve[L]) / base
            if d > best_depth:
                best_lag, best_depth = L, d
    return {
        "G1_mirror_pairs_full": g1_same, "G1_pass": g1_same == 0,
        "G2_seam": round(seam, 2), "G2_adjacent_mean": round(adj_mean, 2),
        "G2_ratio": round(seam / adj_mean, 2), "G2_pass": seam <= adj_mean * 1.5,
        "G3_period": best_lag, "G3_depth": round(best_depth, 3),
    }


def residual_gates(frames):
    """卅一轮第四闸：逐行抠图残留（内部深绿预算 + 边缘亮带占比）。
    MinFilter 腐蚀免 scipy 依赖。"""
    greens, rims, edges = 0, 0, 0
    for f in frames:
        arr = np.asarray(f, dtype=np.int32)
        r, g, b, al = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
        hsv = np.asarray(f.convert("HSV"), dtype=np.float32)
        hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        greens += int(((al > 200) & (hue >= 115.0) & (hue <= 170.0)
                       & (sat >= 0.50) & (val >= 0.30)).sum())
        m = al > 128
        if not m.any():
            continue
        er = np.asarray(Image.fromarray((m * 255).astype(np.uint8))
                        .filter(ImageFilter.MinFilter(5))) > 128
        edge = m & ~er
        edges += int(edge.sum())
        semi = (al > 0) & (al <= 220)
        rims += int((edge & semi & (r > 215) & (g > 215) & (b > 215)).sum())
    per_cell = greens / COLS
    rim_ratio = rims / max(edges, 1)
    return {"green_per_cell": round(per_cell, 1), "green_total": greens,
            "rim_ratio": round(rim_ratio, 3),
            "pass": per_cell <= GREEN_BUDGET and rim_ratio <= RIM_LIMIT}


def mirror_check(fr_right, fr_left):
    """running-left == running-right 的水平镜像。两级口径：
    exact = 逐像素相同（webp 有损压缩下少数帧会差 1 个压缩噪声像素）；
    visible = 可见像素（任一侧 alpha>0）差异像素占比 <0.5%（webp q90 噪声级）。"""
    exact = 0
    vis_ok = 0
    for a, b in zip(fr_right, fr_left):
        a = a.transpose(Image.FLIP_LEFT_RIGHT)
        if ImageChops.difference(a, b).getbbox() is None:
            exact += 1
            vis_ok += 1
            continue
        x = np.asarray(a, dtype=np.int32)
        y = np.asarray(b, dtype=np.int32)
        mask = (x[..., 3] > 0) | (y[..., 3] > 0)
        if mask.any():
            d = np.abs(x - y).max(axis=2)
            if (d[mask] > 0).mean() < 0.005:
                vis_ok += 1
    return exact, vis_ok


def main():
    # 内部验收工具：路径为字面量、必须从仓库根运行（不留 CLI 路径输入面，Mimosa 口径）
    if Path.cwd().resolve() != Path(__file__).resolve().parent.parent:
        raise SystemExit("run from the repo root")
    sheet = Image.open("assets/spritesheet.webp").convert("RGBA")
    assert sheet.size == (CELL * COLS, CELL * ROWS), sheet.size

    base = {}
    # --baseline 长期只在用法里挂名没接线（2026-10-08 插帧前移轮接线）：
    # 基线刷新走「新 csv 路径」，canonical 默认不变
    baseline = Path("reports/2026-10-04-green-batch/atlas-baseline-green.csv")
    if "--baseline" in sys.argv:
        baseline = Path(sys.argv[sys.argv.index("--baseline") + 1])
    if baseline.exists():
        for r in csv.DictReader(open(baseline)):
            base[r["row"]] = {k: float(v) for k, v in r.items()
                              if k not in ("row", "palindrome_pairs")}

    rows_out, regressions = [], []
    run_rows = {"running-right": 1, "running-left": 2, "running": 7}
    gates = {}
    frames_cache = {}
    for r, name in enumerate(ROW_NAMES):
        frames = row_frames(sheet, r)
        frames_cache[r] = frames
        m = row_metrics(frames)
        m["row"] = name
        m["palindrome_pairs"] = palindrome_pairs(frames)
        rows_out.append(m)
        # 基线回归检查：锚点漂移不回退、身高区间不劣化（jumping 大 range 为设计内）。
        # 二十一轮判据语义修正：gait 行（整周期非回文）有真实腾空相位——侧身
        # 跑步态窗口的 bottom 极差是动作不是漂移，上限放宽到 8px；回文行 4px。
        if name in base:
            b = base[name]
            drift_limit = 8 if name in ("running-right", "running-left", "running") else 4
            # height 容差同理：gait 行的相位窗口重选会改变团身/伸展相位的
            # 分布区间（二十一轮回抠实测仅 run 三行 -6px、其余 13 行 ±3 内、
            # 跨行中位带 213-222 不变=体型统一无恙）——动作范围 10px 容差
            height_tol = 10 if name in ("running-right", "running-left", "running") else 6
            for key, limit in [("bottom_drift", drift_limit)]:
                if m[key] > max(b[key], limit):
                    regressions.append(f"{name}.{key}: {m[key]} > baseline {b[key]} (limit {limit})")
            if m["height_min"] < b["height_min"] - height_tol or m["height_max"] > b["height_max"] + height_tol:
                regressions.append(f"{name}.height: [{m['height_min']},{m['height_max']}] "
                                   f"vs baseline [{b['height_min']:.0f},{b['height_max']:.0f}]")
        if name in run_rows:
            gates[name] = gait_gates(frames)

    mir_exact, mir_vis = mirror_check(frames_cache[1], frames_cache[2])

    # 卅一轮第四闸：逐行残留预算（fail 计入 regressions，进 VERDICT）
    resid = {name: residual_gates(frames_cache[r]) for r, name in enumerate(ROW_NAMES)}
    for name, g in resid.items():
        if not g["pass"]:
            regressions.append(
                f"{name}.residual: green/cell {g['green_per_cell']} (limit {GREEN_BUDGET}), "
                f"rim {g['rim_ratio']:.1%} (limit {RIM_LIMIT:.0%})")

    # 输出走 stdout：CSV 段 + JSON 段由调用方重定向落盘（脚本自身零写面）
    print("==BEGIN-CSV==")
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows_out[0].keys()))
    w.writeheader()
    w.writerows(rows_out)

    print("== row metrics: CSV 段见上（==BEGIN-CSV== 之后）==")
    for m in rows_out:
        name = m["row"]
        tag = ""
        if name in base:
            b = base[name]
            tag = (f" (base: h[{b['height_min']:.0f},{b['height_max']:.0f}] "
                   f"bdrift {b['bottom_drift']:.0f})")
        print(f"  {name:14s} h[{m['height_min']},{m['height_max']}] range {m['height_range']} "
              f"bottom[{m['bottom_min']},{m['bottom_max']}] drift {m['bottom_drift']} "
              f"pal {m['palindrome_pairs']}{tag}")

    print("== gait gates (run rows)")
    for name, g in gates.items():
        print(f"  {name}: G1 mirror_pairs={g['G1_mirror_pairs_full']} pass={g['G1_pass']} | "
              f"G2 seam {g['G2_seam']}/adj {g['G2_adjacent_mean']} ratio {g['G2_ratio']} "
              f"pass={g['G2_pass']} | G3 period {g['G3_period']} depth {g['G3_depth']}")
    print("== residual gates (设计无绿：内部深绿预算 + 边缘亮带)")
    for name, g in resid.items():
        mark = "" if g["pass"] else "  <-- FAIL"
        print(f"  {name:14s} green/cell {g['green_per_cell']:6.1f} (total {g['green_total']:6d}) "
              f"rim {g['rim_ratio'] * 100:4.1f}%{mark}")
    print(f"== mirror check running-left vs running-right: "
          f"exact {mir_exact}/64, visible-tolerant {mir_vis}/64")
    print(f"== baseline regressions: {len(regressions)}")
    for r in regressions:
        print(f"  REGRESSION: {r}")
    all_pass = (all(g["G1_pass"] and g["G2_pass"] for g in gates.values())
                and mir_vis == 64 and not regressions)
    print("VERDICT:", "PASS" if all_pass else "FAIL")
    print("==BEGIN-JSON==")
    print(json.dumps(
        {"gates": gates, "mirror_exact": mir_exact, "mirror_visible": mir_vis,
         "residual": {k: {kk: vv for kk, vv in v.items()} for k, v in resid.items()},
         "regressions": regressions}, indent=2))
    # P-2（round4 full-stack-deep-review）：判定必须进退出码——此前只 print 恒
    # exit 0，pre-commit 只能文本 grep（grep 形状 = 假绿闸的根）。下游看门狗
    # 本就无视退出码（P-3 另账），此变更只收紧不破坏。
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
