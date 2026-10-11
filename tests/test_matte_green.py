#!/usr/bin/env python3
"""matte-green 金样本回归（2026-10-09 工程化轮）。

纯标准库 unittest + numpy 合成帧，不依赖 assets 素材，任何机器可跑：

    python3 tests/test_matte_green.py          # 全部
    python3 tests/test_matte_green.py -v       # 详细
    python3 tests/test_matte_green.py RimKill  # 单类

靶子（历史事故逐一固化）：
  1. 绿底抠净 —— HSV 判据+flood+choke 后背景区 alpha 必须为 0
  2. 内嵌设计白豁免 —— 白月牙刀只杀「贴透明缘」的白，嵌在前景内部的不能误伤
     （后处理染色翻车轮：误伤眉毛/蝴蝶结/鼻梁的教训）
  3. 白羽刀三档 —— off 档不崩（NameError 雷回归靶）/ off 全留 / soft 减半 /
     full 归零（卅六轮「头发裁多」档位化 + 卅七轮 crescent 刀的行为契约）
  4. 真实帧冒烟 —— wave 行首帧存在时三档跑通且半透明占比合理

改 matte-green.py 的任何一刀之前先跑这个；改完必须还是绿的。
"""
import importlib.util
import os
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "matte_green", ROOT / "scripts" / "matte-green.py")
mg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mg)


def make_frame() -> np.ndarray:
    """704x1280 产线绿底合成帧：
    - 中央黑圆（角色代理，半径 200）
    - 圆心白方块 80x80（内嵌设计白代理：白花/耳环——邻域全前景）
    - 圆右缘 24px 贴边白条（贴纸白描边代理：外缘贴绿底；24px 保证深区
      超出 sticker 8px / rim 6px / crescent 5px 的射程，供「射程有限性」断言）
    """
    w, h = 704, 1280
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[..., 1] = 0xA6  # #00A63E 产线绿
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx, r = h // 2, w // 2, 200
    disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= r * r
    rgb[disc] = (30, 30, 30)
    inner = disc & (np.abs(yy - cy) < 40) & (np.abs(xx - cx) < 40)
    rgb[inner] = (250, 250, 250)
    rim_strip = disc & (xx > cx + r - 24)
    rgb[rim_strip] = (252, 252, 252)
    return rgb


def region_stats(rgba: np.ndarray):
    """按合成帧几何分区统计 alpha。
    rim_near  = 白条贴绿外带（0-8px 深，sticker/rim/crescent 射程内）
    rim_deep  = 白条深区（12-24px 深，全部刀射程之外）"""
    h, w = rgba.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx, r = h // 2, w // 2, 200
    bg = ((yy - cy) ** 2 + (xx - cx) ** 2) > (r + 8) ** 2          # 绿底区
    disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= (r - 14) ** 2        # 圆内（去边缘带）
    inner_white = disc & (np.abs(yy - cy) < 36) & (np.abs(xx - cx) < 36)
    depth = r - (xx - cx)          # 白条内每点距圆外缘的深度
    in_strip = disc & (depth < 24) & (np.abs(yy - cy) < r - 60)
    rim_near = in_strip & (depth < 8)
    rim_deep = in_strip & (depth >= 12) & (depth < 24)
    a = rgba[..., 3].astype(int)
    return {
        "bg_solid": int((a[bg] > 30).sum()),            # 背景漏前景=抠图失败
        "disc_kept": float((a[disc] > 200).mean()),      # 本体保留率
        "inner_white_kept": float((a[inner_white] > 200).mean()),
        "rim_near_alive": int((a[rim_near] > 20).sum()),  # 贴绿带白存活
        "rim_deep_alive": int((a[rim_deep] > 200).sum()),  # 深区白存活（应全档保留）
    }


def matte_with_mode(rgb: np.ndarray, mode: str, matte_mode: str = "full") -> np.ndarray:
    """matte_mode: full=旧全刀管线（本文件各契约类的靶子）；simple=简化管线。
    2026-10-10 定档：产线默认已是 simple，full 契约类必须显式钉 full 才有效。"""
    old_rim = os.environ.get("MATTE_RIM_KILL")
    old_mode = os.environ.get("MATTE_MODE")
    os.environ["MATTE_RIM_KILL"] = mode
    os.environ["MATTE_MODE"] = matte_mode
    try:
        return mg.matte(rgb)
    finally:
        for k, v in (("MATTE_RIM_KILL", old_rim), ("MATTE_MODE", old_mode)):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class GreenBase(unittest.TestCase):
    def setUp(self):
        self.frame = make_frame()

    def test_background_fully_keyed(self):
        out = matte_with_mode(self.frame, "full")
        s = region_stats(out)
        self.assertEqual(
            s["bg_solid"], 0,
            f"绿底区残留 {s['bg_solid']} 实心 px——抠图失败")

    def test_body_and_inner_white_survive(self):
        out = matte_with_mode(self.frame, "full")
        s = region_stats(out)
        self.assertGreaterEqual(s["disc_kept"], 0.95, "黑圆本体被误杀")
        self.assertGreaterEqual(
            s["inner_white_kept"], 0.95,
            "内嵌设计白被白月牙/白羽刀误伤（染色轮眉毛事故回归）")


class RimKill(unittest.TestCase):
    """白羽刀三档行为契约。off 档曾经一跑就 NameError（未提交 WIP 雷），此为回归靶。

    已知真相（金样本实测钉档，2026-10-09）：贴绿亮白结构的生死由三把刀叠加
    决定——sticker 亮白 8px（无档）+ rim 三档（6px 带）+ crescent（无档，
    贴新透明缘 5px、≥120px 连通）。三档只调 rim 带，故本类断言「单调性 +
    射程有限性」，不精确断言每把刀的边界。"""

    def setUp(self):
        self.frame = make_frame()

    def test_all_three_modes_run(self):
        for mode in ("off", "soft", "full"):
            with self.subTest(mode=mode):
                matte_with_mode(self.frame, mode)  # 不抛异常即过

    def test_deep_white_survives_all_modes(self):
        """射程有限性：距绿 12px 外的白任何档位不许杀——护住发丝体积/亮手。"""
        for mode in ("off", "soft", "full"):
            with self.subTest(mode=mode):
                s = region_stats(matte_with_mode(self.frame, mode))
                self.assertGreater(
                    s["rim_deep_alive"], 0,
                    f"{mode} 档白羽射程越界：深区白被杀（裁切 QA 的刀伤靶子）")

    def test_survival_monotonic_off_ge_soft_ge_full(self):
        """单调性：贴绿带白存活 off ≥ soft ≥ full。"""
        alive = {m: region_stats(matte_with_mode(self.frame, m))["rim_near_alive"]
                 for m in ("off", "soft", "full")}
        self.assertGreaterEqual(alive["off"], alive["soft"])
        self.assertGreaterEqual(alive["soft"], alive["full"])


class RealFrameSmoke(unittest.TestCase):
    """真实帧冒烟：素材目录在本机时才跑（中间件已断供，非所有检出都有）。"""

    REAL = ROOT / "assets" / "motion-frames-wave-g" / "f001.png"

    def setUp(self):
        if not self.REAL.is_file():
            self.skipTest(f"真实帧不在本机: {self.REAL}")

    def test_real_frame_three_modes(self):
        rgb = np.asarray(Image.open(self.REAL).convert("RGB"))
        for mode in ("off", "soft", "full"):
            with self.subTest(mode=mode):
                out = matte_with_mode(rgb, mode)
                a = out[..., 3]
                semi = ((a > 20) & (a < 250)).mean()
                self.assertLess(semi, 0.05, f"{mode} 档半透明占比异常: {semi:.4f}")


class SimpleDefault(unittest.TestCase):
    """2026-10-10 定档契约：默认（无环境变量）= simple 简化管线。"""

    def setUp(self):
        self.frame = make_frame()
        for k in ("MATTE_MODE", "MATTE_RIM_KILL"):
            os.environ.pop(k, None)

    def test_default_is_simple(self):
        """默认路径：背景抠净 + 内嵌白/深区白都保留（旧刀退役后不再误伤）。"""
        out = mg.matte(self.frame)
        s = region_stats(out)
        self.assertEqual(s["bg_solid"], 0, "simple 默认背景必须抠净")
        self.assertGreaterEqual(s["disc_kept"], 0.95)
        self.assertGreaterEqual(s["inner_white_kept"], 0.95)
        self.assertGreater(s["rim_deep_alive"], 0, "深区白（发丝体积/亮手）必须存活")


def make_v3_frame() -> np.ndarray:
    """v3 契约帧：黑圆角色 + 腰带处一块深青绿（角色绿内容）+ 圆内一块幕布绿小孔。"""
    w, h = 704, 1280
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[..., 1] = 0xA6
    rgb[..., 2] = 0x3E
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx, r = h // 2, w // 2, 200
    disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= r * r
    rgb[disc] = (30, 30, 30)
    belt = disc & (np.abs(yy - cy) < 30) & (np.abs(xx - cx) < 60) & \
           (np.abs(xx - cx) > 10)
    rgb[belt] = (0, 90, 50)          # 角色绿内容：hue≈134/sat 1.0/val 0.35，与幕布 dist≈77
    hole = disc & (np.abs(yy - cy) < 18) & (np.abs(xx - cx) < 18) & \
           (np.abs(yy - cy) + np.abs(xx - cx) > 6)
    rgb[hole] = (0, 166, 62)          # 真透孔：=幕布绿
    return rgb


class SimpleV3(unittest.TestCase):
    """v3 契约（主人指认 S1 一刀切不标准后立）：flood 背景 + 闭合区真伪判定。"""

    def setUp(self):
        self.frame = make_v3_frame()
        for k in ("MATTE_MODE", "MATTE_RIM_KILL", "MATTE_V2"):
            os.environ.pop(k, None)

    def test_enclosed_backdrop_hole_removed(self):
        out = mg.matte(self.frame)
        a = out[..., 3]
        h, w = a.shape
        cy, cx = h // 2, w // 2
        hole = np.zeros((h, w), bool)
        hole[cy - 12:cy + 12, cx - 12:cx + 12] = True
        self.assertEqual(int((a[hole] > 30).sum()), 0,
                         "闭合幕布绿真孔必须透")

    def test_enclosed_garment_green_survives(self):
        out = mg.matte(self.frame)
        a = out[..., 3]
        h, w = a.shape
        cy, cx = h // 2, w // 2
        belt = np.zeros((h, w), bool)
        belt[cy - 25:cy + 25, cx - 55:cx + 55] = True
        belt[cy - 8:cy + 8, cx - 12:cx + 12] = False
        kept = int((a[belt] > 200).sum())
        self.assertGreater(kept, 500,
                           f"角色绿内容(深青腰带)必须存活, 实存 {kept}px")


if __name__ == "__main__":
    unittest.main(verbosity=2)
