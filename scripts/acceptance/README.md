# 验收工具箱（2026-10-03 第十一轮归档）

窗口级实弹验收用的小工具，全部吃 `pid` 参数（`pgrep -f "bin/openpets run"` 取）。
统一用法：先编译再打，避免解释模式 2-4s 冷启动拖过目标时间窗（ ambush 类
工具的教训：`sleep 0.2 + swift 脚本` 冷启动会追不上 5s 的短程漫游）。

```bash
swiftc scripts/acceptance/wander-sample.swift -o /tmp/sample && /tmp/sample <pid> <seconds>
```

| 工具 | 用途 | 关键点 |
|---|---|---|
| `wander-winid` | 取宠物窗口 CGWindowID | 其余窗口类工具的前置 |
| `wander-sample` | 轨迹采样：每 2s 记窗口 origin + 分段汇总（MOVE/HOLD） | 自带每 10s 防睡微移（夜间 15s 阈值下保她醒着） |
| `wander-wiggle` | 单发防睡微移（mouseMoved 带真实 timestamp） | 合成事件必须设 `ev.timestamp`，否则 dragTracker 速度算 0（家规） |
| `wander-click` | 对宠物窗口合成单击（戳一戳打断） | mouseDown/Up 都带 timestamp |
| `wander-drag` | 合成拖拽甩飞（14 帧 × 16ms 位移 → 起飞速度 ~2100pts/s） | 验证拖拽打断漫游 + glide 互斥 + 落地恢复 |
| `glide-trace` | 甩飞后全程 x/y 轨迹（0.2s 步进 + still 标记） | 物理收敛时长的定性证据（尾部 still 段起点=收敛时刻） |
| `wander-shot` | CGWindowList 定位 + screencapture -l 兜底封装 | 显示器休眠时先 `caffeinate -u`（见下） |

## 已知的坑（都用真实翻车换的）

- `String(format:)` 的 `%s` 传 Swift String 会 SIGSEGV——格式串标量用 `%d/%.0f`，
  对象用 `%@`（与引擎内 BOOL 崩溃同族，glide-trace 第一版就这么死的）
- CGEvent 坐标是 top-left 全局系；双屏环境下 x 可超出主屏宽度，别当异常
- `screencapture -x -o -l <winid>` 是窗口级捕获唯一正道；全屏截屏拍不到
  layer=statusBar 的她（假阴性）
- 日志监听 ambush（tail -F 等 START 再打）有 1-3s flush 延迟，5s 内的短程
  行程会错过——追实时动作用 `wander-sample` 的坐标漂移检测思路
- **显示器休眠会让 `screencapture -l` 报 "could not create image from
  window"**（凌晨无人输入 2 分钟触发 displaysleep，窗口拒绝渲染捕获；
  2026-10-03 凌晨实测踩坑）——先 `caffeinate -u -t 20 &` 再拍。CGWindowList
  里窗口明明 on-screen，别去查窗口状态，那是显示器的事
