#!/usr/bin/env python3
"""gutto-life.py — gutto 的日子·脑子（家庭成员型 B）：作息 + 账本 + 管你。

本文件是纯决策脑：零进程执行、零网络（Mimosa 口径：SSRF/命令注入结构性不存在）。
台账 JSON 由 gutto-life.sh（curl）落盘后经 --ledger-file 喂进来；动作以
`SAY|动画|标题|正文` 指令行吐给 stdout，由执行器发给桌宠。

纪律（沿用语音播报家规）：深夜静默后只说睡语；催睡每晚最多 2 次；异常不炸脑。
key 全程只在执行器（bash）侧，不进本文件、不进库。

台词全部走语言表 scripts/lines/{zh,en,ja,ko}.json（round3 R-1 四语言收口，
gutto_lines.py 解析；GUTTO_LANG 判定与壳同源）——本文件不再硬编码任何用户
可见文案；键清单在本文件显式列出（禁运行时拼接键，i18n-guide §2.2）。

用法（一般经 gutto-life.sh 调用）：
  gutto-life.py --tick [--ledger-file F] [--now HH:MM] [--dry]
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

from gutto_lines import line

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / ".gutto-life.json"

# 动画白名单：不在册的名字一律不下发
ANIM_ALLOWED = {"waving", "failed", "running", "waiting", "idle", "jumping", "review"}

# 时段问候（companion-layer-spec §3.3 拍板口径；文案在语言表 greeting.*）
GREETINGS = [
    ((5, 11), "greeting.morning"),
    ((11, 14), "greeting.noon"),
    ((14, 18), "greeting.afternoon"),
    ((18, 23), "greeting.evening"),
]
MORNING_BAND = (5, 11)
SLEEP_LINE_KEY = "sleep.line"
NUDGES = [("23:30", "nudge.2330"),
          ("00:00", "nudge.midnight")]
SLEEP_FROM, SLEEP_TO = 23, 5  # 23:00–次日 5:00 深夜静默

# 晚安日报（v42，主人点单「journal 人格升级」）：22 点档每天一次，
# 真实台账收尾——零 LLM 纯模板（七铁律口径），LLM 生成版挂账 BYO key 场景。
GOODNIGHT_FROM = 22  # 22:00–23:00（SLEEP_FROM 前），过了这村就等明天
GOODNIGHTS_OK = ["goodnight.ok.1", "goodnight.ok.2"]
GOODNIGHTS_MIX = ["goodnight.mix.1", "goodnight.mix.2"]
GOODNIGHTS_EMPTY = [
    "goodnight.empty.1",
]

# 碎碎念（2026-10-10，dsh-pet 周期碎碎念的台账升级版）：醒着时段每 75–120
# 分钟随机一泡。纯模板池 × 台账状态——脑不接网不调 LLM（七铁律口径：
# 台词预定义，零成本零抽疯；LLM 生成版挂账 BYO key 场景）。台词走颜文字
# 人设（v36.7 拍板：桌宠不用 emoji 彩色图标）。
MUTTER_MIN_GAP_MIN = 75
MUTTER_MAX_GAP_MIN = 120
MUTTERS_PLAIN = [
    "mutter.plain.1",
    "mutter.plain.2",
    "mutter.plain.3",
    "mutter.plain.4",
    "mutter.plain.5",
]
MUTTERS_DONE = ["mutter.done.1", "mutter.done.2"]
MUTTERS_BAD = ["mutter.bad.1", "mutter.bad.2"]


def _pick(seq, st, key):
    """轮转取台词：state 里记索引，避免连着复读同一条。"""
    idx = int(st.get(key, 0)) % len(seq)
    st[key] = idx + 1
    return seq[idx]


def mutter(today, hour, now, st, ledger_file):
    """碎碎念：距上次 ≥ 随机间隔（间隔落 state，跨拍稳定）才开口。"""
    next_key = "mutter_next"
    if st.get("mutter_date") != today:
        st["mutter_date"] = today
        st[next_key] = None  # 新的一天重排
    nxt = st.get(next_key)
    now_min = hour * 60 + now.minute
    if nxt is None:
        # 第一泡：醒着后 20–50 分钟
        st[next_key] = now_min + 20 + (now_min * 7) % 31
        return False
    if now_min < int(nxt):
        return False
    st[next_key] = now_min + MUTTER_MIN_GAP_MIN + (now_min * 13) % (
        MUTTER_MAX_GAP_MIN - MUTTER_MIN_GAP_MIN + 1)

    ok = bad = None
    if ledger_file:
        try:
            rows = json.loads(Path(ledger_file).read_text()).get("rows") or []
            rows = [r for r in rows if (r.get("created_at") or "")[:10] == today]
            if rows:
                ok = sum(1 for r in rows if r.get("kind") in ("done", "fix"))
                bad = sum(1 for r in rows if r.get("kind") == "problem")
        except Exception:
            ok = bad = None

    if ok and bad:
        line_txt = line(_pick(MUTTERS_DONE, st, "mutter_i"), ok=ok) + \
            " " + line("mutter.doneExtra", bad=bad)
    elif ok:
        line_txt = line(_pick(MUTTERS_DONE, st, "mutter_i"), ok=ok)
    elif bad:
        line_txt = line(_pick(MUTTERS_BAD, st, "mutter_j"), bad=bad)
    else:
        line_txt = line(_pick(MUTTERS_PLAIN, st, "mutter_i"))
    return line_txt

_CTRL = re.compile(r"[\x00-\x1f\x7f]")


def _clean(s, cap=200):
    """外部文本消毒：去控制字符、压空白、去指令分隔符、限长。"""
    return _CTRL.sub("", " ".join(str(s).split())).replace("|", " ")[:cap]


def load_state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {}


def save_state(st, dry):
    if dry:
        return
    try:
        STATE.write_text(json.dumps(st, ensure_ascii=False))
    except Exception:
        pass


def emit(text, anim="", title="gutto", ttl=8):
    safe = _clean(text)
    a = anim if anim in ANIM_ALLOWED else ""
    print(f"SAY|{a}|{_clean(title, cap=40)}|{safe}|{int(ttl)}", flush=True)
    print(f"[brain] say: {safe}", flush=True)


def _today_rows(today, ledger_file):
    """今日台账行；日期字段优先 event_date（v42 实锤），回退 created_at。"""
    if not ledger_file:
        return []
    try:
        rows = json.loads(Path(ledger_file).read_text()).get("rows") or []
    except Exception:
        return []
    out = []
    for r in rows:
        day = (r.get("event_date") or r.get("created_at") or "")[:10]
        if day == today:
            out.append(r)
    return out


def _counts(today, ledger_file):
    """今日台账 (ok, bad) 计数；账本缺失/损坏返回 (0, 0)。"""
    rows = _today_rows(today, ledger_file)
    ok = sum(1 for r in rows if r.get("kind") in ("done", "fix"))
    bad = sum(1 for r in rows if r.get("kind") == "problem")
    return ok, bad


def goodnight(today, st):
    """v42 晚安日报文本：按今日账本挑模板（预定义台词，七铁律口径）。"""
    ok, bad = st.get("_counts", (0, 0))
    if ok == 0 and bad == 0:
        return line(_pick(GOODNIGHTS_EMPTY, st, "goodnight_empty"))
    if bad > 0:
        return line(_pick(GOODNIGHTS_MIX, st, "goodnight_mix"), ok=ok, bad=bad)
    return line(_pick(GOODNIGHTS_OK, st, "goodnight_ok"), ok=ok)


def ledger_brief(today, ledger_file):
    """今日台账一句话；账本缺失/损坏返回空串。外部数据只做统计，原文不出口。"""
    rows = _today_rows(today, ledger_file)
    if not rows:
        return ""
    ok = sum(1 for r in rows if r.get("kind") in ("done", "fix"))
    bad = sum(1 for r in rows if r.get("kind") == "problem")
    return line("ledger.brief", ok=ok, bad=bad)


def tick(now, dry, ledger_file):
    st = load_state()
    today = now.strftime("%Y-%m-%d")
    hour = now.hour

    # v42 晚安日报：22–23 点档每天一次（赶不上就等明天，不补发）
    if GOODNIGHT_FROM <= hour < SLEEP_FROM and st.get("goodnight_date") != today:
        st["_counts"] = _counts(today, ledger_file)
        emit(goodnight(today, st), anim="waving", title=line("title.goodnight"), ttl=20)
        st["goodnight_date"] = today
        st.pop("_counts", None)
        save_state(st, dry)
        return

    if hour >= SLEEP_FROM or hour < SLEEP_TO:  # 深夜
        if st.get("slept_date") != today:
            emit(line(SLEEP_LINE_KEY))
            st["slept_date"] = today
            save_state(st, dry)
            return
        for slot, key in NUDGES:  # 催睡：每档每晚一次（±10 分钟窗口）
            mark = f"{today} {slot}"
            slot_dt = now.replace(hour=int(slot[:2]), minute=int(slot[3:]),
                                  second=0, microsecond=0)
            if not st.get("nudged", {}).get(mark) and \
               abs((now - slot_dt).total_seconds()) <= 600:
                emit(line(key), anim="failed")
                st.setdefault("nudged", {})[mark] = True
                save_state(st, dry)
                return
        return  # 静默：深夜其余时间一个字不说

    # 醒着：每天第一拍问安；台账单独一泡（气泡 UI 会截断长文案，不拼一条）
    if st.get("greet_date") != today:
        band_key = next((k for (rng, k) in GREETINGS if rng[0] <= hour < rng[1]), None)
        if band_key:
            emit(line(band_key), anim="waving")
            brief = ledger_brief(today, ledger_file)
            if brief:
                emit(brief, title=line("title.ledger"))
            st["greet_date"] = today
            save_state(st, dry)

    # 碎碎念：间隔到了才开口（开口才落盘，防每拍写状态）
    line_txt = mutter(today, hour, now, st, ledger_file)
    if line_txt:
        emit(line_txt, anim="waving", title=line("title.mutter"))
        save_state(st, dry)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tick", action="store_true")
    ap.add_argument("--ledger-file", default="")
    ap.add_argument("--now", help="HH:MM 时刻覆盖（测试用）")
    ap.add_argument("--dry", action="store_true", help="不落状态文件")
    a = ap.parse_args()
    if not a.tick:
        raise SystemExit("use gutto-life.sh daemon|tick; --tick is internal")

    if a.now:
        h, m = map(int, a.now.split(":"))
        now = dt.datetime.now().replace(hour=h, minute=m, second=0, microsecond=0)
        tick(now, dry=True, ledger_file=a.ledger_file)  # --now 视同 dry
    else:
        tick(dt.datetime.now(), a.dry, a.ledger_file)


if __name__ == "__main__":
    main()
