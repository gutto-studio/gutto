#!/usr/bin/env python3
"""绿幕批量验收器（2026-10-04 廿三轮）：mp4 → 抽帧 → matte-green(含修剪) →
评分 → 白底基线对照 → 暗底拼图。判据：semi<0.001；幅度 amp ≥ 白底×0.5
（生成随机性容差）；h_rng<0.1（构图稳定）；产出验收拼图供目检复核。
用法：python3 green-batch-accept.py <tag> <mp4>   # 产物落 assets/motion-frames-<tag>-g
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # 仓库根（脚本住 scripts/acceptance/，两级 parent 只到 scripts/——jumpg 验收帧抽进 scripts/assets 的暗雷即此因，廿七轮修正）
WHITE_BASE = {  # 白底基线（覆盖前快照 /tmp/white-baseline-*.txt）
    "wave": (0.0030, 0.3375), "yawn": (0.0029, 0.1998), "cheer": (0.0028, 0.3363),
    "stretch": (0.0029, 0.1221), "sleep": (0.0027, 0.3892), "sit": (0.0028, 0.2914),
    "lookleft": (0.0030, 0.3061), "lookright": (0.0030, 0.2571),
    "runside": (0.0022, 0.5432), "think": (0.0032, 1.9231),
    "angry": (0.0030, 0.2825), "crawl": (0.0051, 2.1783),
    # 廿七轮重产 tag（基线沿用同动作白底口径；jump 无白底绿批基线——
    # amp 基线取 v3 白底时代的 0.822×0.5 容差）
    "jumpg": (0.0030, 0.411), "stretchg": (0.0029, 0.1221), "cheerg": (0.0028, 0.3363),
    "sitdown": (0.0028, 0.1457),  # 廿七轮：sit 白底基线 amp 0.2914×0.5 容差
    # 卅二轮：idle 家族 H3 重产（替代 APNG，无白底 H3 基线——calm 行 amp 门槛
    # 只防废标/冻结帧，真闸=scene-clean+目检）
    "idleg": (0.0028, 0.08), "waitingg": (0.0028, 0.10), "reviewg": (0.0028, 0.10),
}
# h_rng 动作语义豁免：收腿跳的高度波动（团身/伸展）就是动作本身，
# standing 行的 0.12 标尺不适用（jumpg 首产实测 0.23 = 真收腿）；stretchg
# 举手过头+踮脚、cheerg 双臂高举+弹跳同理——包围盒高度随姿势涨 33-39%
# 是解剖学事实（jumpg 0.23 / stretchg 0.39 / cheerg 0.33 实测）；sitdown
# 坐下=身高掉 ~1/3，同豁
H_RNG_OVERRIDE = {"jumpg": 0.35, "jump": 0.35, "stretchg": 0.45, "cheerg": 0.45,
                  "sitdown": 0.45}


def main():
    tag, mp4 = sys.argv[1], Path(sys.argv[2])
    raw = ROOT / f"assets/motion-raw-{tag}-g"
    frames = ROOT / f"assets/motion-frames-{tag}-g"
    subprocess.run(["rm", "-rf", str(raw), str(frames)], check=True)
    raw.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
                    "-vf", "fps=12", str(raw / "f%03d.png")], check=True)
    key = subprocess.run(
        ["python3", str(ROOT / "scripts/matte-green.py"), str(raw), str(frames)],
        capture_output=True, text=True)
    print(key.stdout.strip())

    # 廿七轮：源帧层烤场景/推拉体检——keying 后立刻验，坏道次在此枪毙
    # （jump2 烤场景 1.00 / stretch 推拉 0.93 的教训；图集层 opaque 被裁剪
    # 缩放搅混分不开健康带，闸门必须在源帧层）
    src_check = subprocess.run(
        ["python3", str(ROOT / "scripts/check-sources.py"), str(frames)],
        capture_output=True, text=True)
    print(src_check.stdout.strip())
    scene_ok = src_check.returncode == 0

    score = json.loads(subprocess.run(
        ["python3", str(ROOT / "scripts/score-motion.py"), str(frames)],
        capture_output=True, text=True).stdout)
    v = list(score.values())[0]
    semi_base, amp_base = WHITE_BASE[tag]
    checks = {
        "semi": (v["amp"] is not None, v.get("bg_med") is None),  # 占位，见下
    }
    semi = None
    # semi 从 keying 输出解析
    for line in key.stdout.splitlines():
        if line.startswith("semi-alpha ratio:"):
            semi = float(line.split("mean=")[1].split()[0])
    verdicts = []
    verdicts.append(("semi", semi is not None and semi < 0.001, f"{semi} vs white {semi_base}"))
    verdicts.append(("amp", v["amp"] >= amp_base * 0.5, f"{v['amp']} vs white {amp_base}"))
    verdicts.append(("composition-stable", v["height_rng"] < H_RNG_OVERRIDE.get(tag, 0.12),
                     f"h_rng {v['height_rng']} (limit {H_RNG_OVERRIDE.get(tag, 0.12)})"))
    verdicts.append(("scene-clean", scene_ok, "源帧 opaque_max ≤0.40（烤场景/推拉枪毙线）"))

    # 暗底三帧拼图（人工复核材料）
    from PIL import Image
    files = sorted(frames.glob("f*.png"))
    picks = [files[int(len(files) * f)] for f in (0.1, 0.5, 0.9)]
    strip = Image.new("RGB", (3 * 320, 580), (28, 30, 38))
    for i, f in enumerate(picks):
        im = Image.open(f).convert("RGBA")
        dark = Image.new("RGB", im.size, (28, 30, 38))
        dark.paste(im, (0, 0), im)
        strip.paste(dark.resize((320, 580)), (i * 320, 0))
    out = f"/tmp/{tag}-g-check.png"
    strip.save(out)

    all_ok = all(ok for _, ok, _ in verdicts)
    for name, ok, detail in verdicts:
        print(f"  {name:20s} {'PASS' if ok else 'FAIL'} ({detail})")
    print(f"VERDICT {tag}: {'PASS' if all_ok else 'FAIL'} | strip: {out}")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
