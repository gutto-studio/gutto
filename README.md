# pet-trial：gutto 桌宠（macOS 原生 + Electron 跨平台）

Guttolab 原创 chibi 女仆桌宠。OpenPets 壳 fork 的 Swift 引擎上桌（macOS），
SPEC v2 资产包 + protocol-first HTTP 面支撑 Electron/Windows 跨平台 PoC。
Guttolab 的活项目，本 README 只写「现在是什么、怎么跑」。

## 现状一页

| 项 | 值 |
| --- | --- |
| 常驻壳 | **Electron（macOS/Win/Linux 单码基）**，Swift 壳已下岗（可 `scripts/run.sh` 手动对照） |
| 图集 | SPEC v2：20 行 × 64 列 × 240px（`assets/rows/*.webp` 按行拆包 + v1 整张兜底） |
| 动作行 | 23 行全真动画（v44.4 登场/退场/初见三行出库，图集 ROWS 截尾根修）；锚点 2.1 画风（黑发+中性深灰高光） |
| 互动 | v44：单击摸头/戳分区反应（台词气泡+反应行动作，连戳 4 次炸毛）+ 漫游散步（40-80s 试探、190pt/s、屏边 40pt 止步；`GUTTO_WALK=0` 关）+ 昼夜入睡（空闲白天 60s/夜间 15s 入睡，戳/拽/点播唤醒；`GUTTO_SLEEP=0` 关；晨午晚问候与晚安日报走 `gutto-life` daemon） |
| 羁绊 | v44.3 好感度系统：摸头/戳/聊天/看屏/每日回访五路记账（每类每日封顶防刷，只涨不掉），四级曲线（初识→熟络→亲近→羁绊）升级解锁稀有小剧场（低频惊喜）；连续相伴天数开场报数；设置·玩法页可查进度；`GUTTO_BOND=0` 关 |
| 聊天 | 供应商档案一键切换（学 cc-switch）/ 记忆压缩 / 斜杠+自定义命令 / 角色卡导入 |
| agent 联动 | 四家 hooks、12 态事件总线、阻塞式审批卡（默认关；v44.5 起 Claude/ZCode/codex 三家真拦截——zcode 走顶层 `{"decision"}` strict schema、codex 同 claude 形状 `hookSpecificOutput`，opencode 插件只提醒）、热键 ⇧⌘Y/N |
| 隐私 | 零遥测零云同步，全量数据在本机 `~/.gutto/`——见 [`docs/PRIVACY.md`](docs/PRIVACY.md) |
| 许可 | 整体 [PolyForm Noncommercial 1.0.0](../LICENSE)（个人/非商业自由，商用需 guttolab 授权；**素材为 AI 生成**并披露）；引擎 fork 自 OpenPets/OpenPetsKit（MIT，署名保留）；Electron(MIT)/jq(MIT) |

## 怎么跑

**三种启动方式（装一次 `scripts/install-launcher.sh` 后全有）**：终端 `gutto up`（PATH 命令）/ 双击 `~/Applications/Gutto.app`（在岗下班、不在上工，可拖 Dock）/ Spotlight 搜 Gutto。登录自启默认开（`gutto autostart off` 关）。

```bash
bin/gutto up                # 上工（= run.sh：在跑则重启，换二进制后也走这）
bin/gutto down              # 下班（优雅停；3s 不走强杀；Electron 测试实例一并收）
bin/gutto status            # 看岗：两宠存活 + 内存 footprint + 登录自启状态
bin/gutto autostart on|off  # 登录自启开关（off 顺带下班）
bin/gutto ping              # 活着回 pong
bin/gutto chatui            # 右键对话菜单
bin/gutto settings [页]     # 打开设置窗（页=settings/play/records；聊天里 /settings 同款）
python3 scripts/preview-atlas.py   # 图集 20 行缩览 → assets/preview/
```

**自检与排障**（v43.2 工程化）：

```bash
bash scripts/pet-doctor.sh  # 一键体检：实例数/资产对账/壳依赖/常驻/旧 agent 残留
tail -20 ~/.gutto/shell.log # 壳侧日志（审计对账/生命周期/双开拦截都有痕）
```

单实例：`requestSingleInstanceLock` 双开自动秒退（锁需双方新代码，升级后重启一次正主）。

引擎构建（不在本仓）：`openpets-alter/` 干净重建（`rm -rf .build && swift build -c release`），
产物 `run.sh` 自动同步进 `bin/OpenPets-gutto.app`。launchd 驻留见
`scripts/install-launchagent.sh`（Mimosa 环境内执行会被拦，终端跑）。

## 素材产线（重摇/换代必读）

一条链：**锚点 → 重摇 → 入库 → 图集 → 验证**。逐工具说明见
[`docs/production-line.md`](docs/production-line.md)。

```
scripts/anchor-regen.py      锚点立绘生成（Qwen edit，画风源头）
scripts/gutto-motion-trial.py  H3 重摇（4070S ComfyUI，一动作一验纪律）
scripts/reingest-anchor2.sh  批量入库（抽帧→keying；runside 走 RIFE 链）
scripts/matte-green.py       绿幕 keying（HSV 判据+道具击杀+三档白羽刀 MATTE_RIM_KILL）
scripts/make_spritesheet.py  图集合成（行内统一变换，19 行接线表在文件尾）
scripts/verify-atlas.py      四闸验证（绿预算/rim/几何/步态+基线对照）
scripts/watchdog-anchor2d.sh 重摇→入库→重建→verify 全自动看门狗（正编；a/b/c 已退役）
```

素材分层（[`docs/asset-inventory.md`](docs/asset-inventory.md) 有全账）：

- **入库**：`assets/motion-src/`（源 mp4+锚点图）、成品图集（`spritesheet.webp`+`rows/`+`pet.json`）、statics 立绘
- **不入库**（可再生产物，.gitignore 断供）：`motion60-*` / `motion-frames-*` / `motion-raw-*` / `.ingest2-*` / `*.bak-*`
- 证据截图一律进 `reports/evidence/`（按轮建子目录），**根目录不许落 PNG**

## 目录地图

```
assets/            成品图集(23行 manifest 真源) + motion-src 源 + statics（中间件已断供不入库）
shell-electron/    ★ 现行唯一壳：Electron（main/preload/renderer/core/chat/i18n/windows/test）
scripts/           产线/运行/验证工具；electron-wrapper.sh=常驻入口，pet-doctor.sh=体检
docs/              rounds.md 轮记总档 / asset-inventory / production-line / spec/
reports/           按日期的扫描报告 + evidence/ 截图
bin/gutto          用户 CLI（up/down/status/say/report…，事件桥驱动）
```

> ⚰️ **Swift 壳全线退役（v43.4，2026-10-10）**：openpets-alter / openpetskit-src /
> OpenPets 预编译包 / bin/openpets 等遗产大件已搬出仓库，封存于
> `~/work/gutto/pet-trial-swift-attic/`（含引擎补丁历史）。退役脚本
> （launchd-wrapper/install-launchagent/tour-actions/acceptance/）原地保留但
> 头部有 ⚰️ 墓碑注——勿装勿跑。下个窗口：一切从 `shell-electron/` 和
> `bin/gutto` 出发。

## 纪律（历史事故换来的，别省）

- 换素材代：先刷 verify-atlas 基线（人工审定差异定性再刷）；工作区必须=HEAD 再开工
- 图集重产后必须 kickstart 重启才生效；动作验收必须验幅度（变化计数会假绿）
- 视觉验收用窗口级捕获（`screencapture -l <ID>`），显示器休眠=冻结帧假象，先 `caffeinate -u`
- 引擎改动在 `openpets-alter` 干净重建，部署前不信增量链接
- 完整轮记与教训：[`docs/rounds.md`](docs/rounds.md)（1427 行，卅八轮全史）
