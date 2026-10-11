# gutto Electron 壳 PoC（Windows/Linux 壳 · 三闸验收）

> 2026-10-10 · 跨平台四步之三（接 SPEC v2）。选型依据：`reports/2026-10-09-cross-platform-engine-scan.md`。
> **2026-10-09 晚改道**：主人拍板「全面 Electron 化」单码基三端（opencode 同款架构 + clawd-on-desk 实证），本壳从 Win/Linux 壳升级为**唯一主线壳**；Swift 壳转维护态，阶段 1 起所有新 UI 写这里。

## 结构

```
shell-electron/
├── main.js        # 窗口家族：宠+输入条+气泡+设置窗、右键菜单、spawn 对话、契约读写
├── preload.js     # 宠窗桥：setClickThrough / SPEC v2 行加载 / contextMenu / play-row
├── child-preload.js # 子窗桥：hints/submit/契约读写/日志/页签直达
├── core/ambient.js # ★ CORE：行为轮换状态机（Swift 1:1 平移，Node/浏览器双吃）
├── core/parse.js   # ★ CORE：契约解析纯函数（env/memory/activity/命令清单+提示过滤）
├── core/bond.js    # ★ CORE：羁绊纯函数（七路记账/等级/连访/小剧场池，v44.2+）
├── core/interact.js # ★ CORE：互动反应纯函数（摸戳分区/连击炸毛/拖拽物理，v44+44.16）
├── core/calendar.js # ★ CORE：日期彩蛋纯函数（周年/相伴里程碑/固定节日，v44.16）
├── core/rhythm.js  # ★ CORE：昼夜节律纯函数（入睡/唤醒阈值，v44.1）
├── chat/executor.js # spawn gutto-chat.sh（argv 契约）+ --list-commands 30s 缓存
├── i18n/          # 字典（zh 真源 + en 初翻 + createT）——UMD-lite 双栖
├── renderer/pet.js # SPEC v2 按行解码 + LRU + rAF + 剪影命中/右键
├── windows/       # chat-input（/ 提示列表）/ bubble / settings（四页分段）
└── test/          # 16 个看守：core 五模块 + i18n/lines 键集 + parse/approval/react/start/heartbeat/card
```

## 最小可日用（阶段 1，2026-10-09）

- **右键她**（剪影命中）→ 图标条在宠脚下弹出（v43.6 参考搜狗输入法工具条，主人拍板）：
  自绘 SVG 小图标+常显小字标签（v43.7/43.8：统一 2px 圆角线条+花瓣粉点缀，
  纯图标要猜=不合格主人 QA，action 查表内聚 menu.html）
  依次蹦出（.15s 微交互档 + 35ms stagger），hover 染亮粉，失焦/点图标即收、
  8s 自灭；自绘窗可被 autotest 直驱（原生菜单不可测的边界翻篇）——
  和她说话 / 记录 / 设置 / 让她歇会儿 / 下班
  （v44.13.4/13.5 两轮减负 9→5：记录类三直达并「记录」，玩法在设置侧栏、
  看屏走聊天框 /look——入口冗余清零）
- **聊天**：输入条在宠脚下（`/` 弹提示列表，点击补全，`$ARGUMENTS` 自定义命令同 bash 层）、
  回复气泡在宠头顶（等待态不超时——LLM 慢路 90s；正文 12s 自灭/点击关）、
  等回复期间她演 think 行
- **设置窗**：三页分段（v43.5 五页收敛；无 TabView——macOS 26 幽灵 tab 教训跨壳贯彻）——
  设置（对话/看屏供应商档案+人设卡+记忆）、玩法（动作预览+agent 联动+声音+自定义命令）、
  记录（操作/聊天/日志三子页）；LLM 档案（env 写入保 600 权限、key 留空=保留）；
  v43.11 重做（docs/settings-ui-redesign.md S1-S8）：段控全窗唯一页签语言+状态概览条
  前置+分组行式条目+编辑就地展开+说明收 ⓘ，排版走 --fs/--sp 刻度、图标走
  windows/icons.js 单源
- **模型参数**（v44.3 对标 Cherry Studio）：设置 → 对话模型卡——思考深度
  （关闭/低/中/高 → reasoning_effort）+ 上下文窗口 1-40 轮（留空=自动 8~40；
  本地端点同值透传 num_ctx，旧版端点侧设 OLLAMA_CONTEXT_LENGTH 兜底）
- **动作预览**：设置 → 玩法 → 动作芯片点播（播完整遍）或「巡检全部」连播全包；
  CLI 同道：`bin/gutto anim <行名>`（事件文件桥，Swift socket 退役后的通道）
- **验收**：`GUTTO_SHELL_AUTOTEST=1 npx electron . --pet ../assets` 跑脚本化
  序列（开输入条→打 /→真发一句→开设置窗），日志走 nohup 文件；
  实弹全绿证据见 rounds v41 阶段 1
- 已知边界：合成右键不可行（同 mac 壳），菜单视觉留主人真手一眼

## i18n 纪律（阶段 0 立，全面 Electron 化地基）

- `i18n/zh.js` 是**唯一真源**，`en.js`/`ja.js`/`ko.js` 键集必须与它完全一致（`test/i18n.test.js` 看守四表互为镜像 + 语言原生名统一）
- 回退链：目标语言 → zh → 返回键名（漏译在 UI 上显性可见，不静默）
- renderer/main 每条新用户可见字符串**第一天就进字典**，禁止裸写；新键同步补进四表
- 用法：main/test `require('./i18n')`；renderer 五窗 `<script src="../i18n/*.js">` 全挂四字典后 `window.GuttoI18N.createT(lang)`（双栖导出同 ambient.js 范式）
- 翻译时机：en/ja/ko 均为初翻（母语审校等海外信号），对话语言不归这里管（LLM persona 层天生多语言）
- 语言选择（v44.10）：启动时 env 文件 `GUTTO_LANG=zh|en|ja|ko` 优先，缺席跟随系统 locale；设置→通用→界面语言可切（写 env，重启壳生效）
- 右键图标条标签宽度吃语言：菜单键取短形（ja/ko 标签字符数 ≤ zh），MENU_W 维持 en 700 / 其余 660

### 台词层（round3 R-1 收口）：daemon/hook/CLI 的语言表

UI 字典管壳内界面；**她说的话**（时段问候/晚安日报/碎碎念/催睡）、hook 的系统通知与审批文案、CLI 记账摘要走**另一份语言表** `scripts/lines/{zh,en,ja,ko}.json`：

- 解析器 `scripts/gutto_lines.py`：语言判定与壳同源（`GUTTO_LANG` env → `$GUTTO_HOME/env` 文件 → zh）；回退链同 UI 侧（目标语 → zh 真源 → 键名）；bash 侧 `gutto_lines.py <KEY> [name=value …]`，python 侧 `import gutto_lines`
- 台词键清单在 `scripts/gutto-life.py` 显式列出（禁运行时拼接键，i18n-guide §2.2）
- 语音按语言门控（E-4）：PC TTS 是中文音色，非 zh 档 `gutto-tts.sh` 与壳侧 `speak()` 直接静默——文本走气泡，不出「中文音读外语」
- 看守：`test/lines-i18n.test.js`（四表镜像 + 占位符一致 + 解析器实跑 + 四消费文件裸 CJK 扫描 + main.js t() 键在册）
- en/ja/ko 台词同为初翻待审校；CLI usage/argparse 帮助文本保持中文（开发者面向，白名单有案）

## 三闸验收记录（2026-10-10，macOS 侧）

| 闸 | 结果 | 证据 |
| --- | --- | --- |
| 真透明 | **PASS** | 全屏截图对照：窗口区透出桌面内容（角点 RGB=壁纸色）；`screencapture -l` 单窗模式黑底是仪器伪影（透明区填黑），与 mac 壳验证同坑 |
| 点击穿透 | **代码路径就绪，真手待验** | Electron `setIgnoreMouseEvents(true,{forward:true})`（文档化 API）+ renderer 剪影 alpha 判定动态切换；dsh-pet/clawd 双同行三平台实证。合成事件在本环境不可靠（同 mac 壳「CUA 无法对非激活窗合成点击」边界）——真手点击归主人验收 |
| 图集播放 | **PASS（内容速率正确）** | 状态条 `idle f41 p50=83.3ms` = manifest 78ms/帧 + vsync 量化（5×16.7）；ambment 轮换切 sit 行 dec=4（LRU 按需解码工作）；gap p95=84ms 无掉帧尖峰。「60fps 能力」=rAF 链无瓶颈 + 帧时长数学（17ms 内容帧可跑 60）；当前素材全 78/83/42ms，内容速率与 mac 壳一致（素材课题非壳课题） |

## SPEC v2 内存纪律（壳侧同构）

启动只解 idle 行（`dec=1`），其余行走 LRU（容量 4 + idle 钉住），驱逐即释放
ImageBitmap——与 mac 壳 `PetSpriteFrameStore` 同构，SPEC 层承诺兑现。

## CORE · ambient（第一块）

- `AMBIENT_BEHAVIORS` 权重表 1:1 平移（合计 0.87，Swift 抽选按池和归一——行为等价）；
- 大动作冷却 75-165s、冷却期只出安静行；驻留区间逐行一致；睡眠阈值白天 60s/夜间 15s；
- **已知差异（登记）**：cursorGlance（idle 时瞄光标）依赖壳侧光标查询，未平移；
  wander/glide 运动学待 CORE 第二块。
- 单测：`node test/core-ambient.test.js` 九项全绿。

## 跑法

```bash
cd shell-electron
npm install
npm start                 # --pet ../assets（默认）
# Windows：同上（PowerShell），electron 下载走 ELECTRON_MIRROR
```

## Windows 真机

4070S PC（node v24）部署于 `D:\ai\temp\gutto-poc\`——真机三闸（尤其 DWM
真透明 + click-through 实点击）验收记录见 README 主文档本轮章节。

## 许可与使用条款

- **许可证**：[PolyForm Noncommercial 1.0.0](./LICENSE)——个人使用、学习、修改、
  非商业分发：随意；**任何商业性使用（含售卖、付费捆绑、商业产品集成）需另行获得
  guttolab 书面授权**。
- **版权**：Copyright © 2026 guttolab（gutto-studio）。保留所有权利。
- **素材披露**：本仓库内 `assets/` 下的角色形象与动画素材为 **AI 生成**
  （自研生成管线产出）+ 人工抠像/图集工艺，与代码同受上述许可证约束；
  转载/二改请保留本披露与署名。
- **商标与角色**：「gutto」名称、角色形象与品牌标识（含蝴蝶结标识）不随许可证
  授权，商用场景使用需单独许可。
- 商业授权咨询：联系 guttolab（或本仓库 Issue 留联系方式）。
