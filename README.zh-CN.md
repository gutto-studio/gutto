# gutto

[English](README.md) · 简体中文 · [日本語](README.ja.md) · [한국어](README.ko.md)

![license](https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-blue)
![platform](https://img.shields.io/badge/platform-macOS-lightgrey)

**一只住在桌面上的 chibi 小女仆——替你盯着 AI agent 干活。**

<p align="center">
  <img src="assets/gutto.png" alt="gutto，一只 chibi 女仆桌宠" width="420">
  <br><sub><i>gutto，当班中。（图为 AI 生成）</i></sub>
</p>

你的 coding agent 在一个你看不见的终端窗口里埋头苦干：一跑就是好几分钟，
中途停下来要权限，而你要等到恰好切回终端那一刻，才知道任务是干完了——
还是卡在等批准上。

`gutto` 把这些状态搬到你能感知的地方。她是桌面上的一位小女仆，实时演出
agent 的状态：在干活、在等待、被审批卡住、干完了。当 agent 需要一个
「允许/拒绝」时，她把审批卡递到你面前。而当你自己需要休息时，她还是一只
桌宠——摸摸头、戳一戳、聊聊天。

## 痛点

2026 年的 agent 很能干，但都是隐形的：

- **不停 alt-tab**——你只能人肉盯终端，因为不亲眼看就分不清「还在跑」
  和「卡死了」。
- **审批弹在你看不见的窗口里**——本来点一下就能继续的任务，卡上十分钟。
- **桌面上毫无生气**——机器干着惊人的活儿，过程却什么也不给你看。

gutto 一次解决「看不见」「审批卡」「冷清」这三件事。

## 她是怎么盯岗的

你的 agent 运行时通过 hooks 上报生命周期事件；gutto 把它们演出来。

1. agent 开始任务 → gutto 上工，进入「干活中」——伏案敲键盘，尾巴摇摆。
2. agent 等待工具审批 → gutto 弹出**阻塞式审批卡**：看清命令，按 `⇧⌘Y`
   放行或 `⇧⌘N` 拒绝。agent 会真的被你的决定卡住，和终端里一模一样。
3. 任务完成 → 她来汇报。长时间空闲 → 她出门散步，然后打盹（晚上睡得更多）。
4. 随时找她聊天——带记忆压缩的对话、斜杠命令、自定义命令、角色卡导入。
   API key 自备。

今天支持的运行时：**Claude Code、ZCode、Codex**（hooks 真阻塞审批）和
**opencode**（仅提醒的插件）。

## 和 gutto 的一天

装一次就好（macOS）：

```bash
$ git clone https://github.com/gutto-studio/gutto
$ cd gutto && bin/gutto up        # 她上工——登录自启默认开启
```

之后一整天就三个动作：

- **摸头或戳她**——她用动画和一句台词回应你。连戳四下她会炸毛。
- **右键点她**——对话、设置、记录，还有「看看屏幕」菜单。
- **放着不管**——她在屏幕上散步、看钟点，天晚了就自己钻被窝。

她注意到的一切都会积累：好感度系统记录摸头、戳、聊天和每日回访
（每日封顶防刷，只涨不掉），四级升级，偶尔解锁一段稀有小剧场。
她还记得你们已经相伴多少天。

## 里面有什么

| 部件              | 干什么                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `shell-electron/` | 她本人：动画、互动、聊天界面、设置、通知（Electron 单码基）                                   |
| `integrations/`   | agent 运行时的桥（hooks + opencode 插件），接进 gutto 的事件总线                             |
| `bin/gutto`       | 一条命令管上工/下班、状态、自启、对话窗口、设置                                              |
| `skills/`         | SKILL.md 文件，让你的 agent 也会「聊」gutto                                                  |
| `assets/`         | 精灵图集与美术素材（AI 生成——已披露，见许可证）                                             |

## 隐私

**零遥测、零云同步。** gutto 知道的每一个字节——聊天记录、好感度、agent
事件——都留在你机器上的 `~/.gutto/`。聊天用你自己的 API key 打到你选的
供应商；gutto 自身没有任何后端。见
[docs/PRIVACY.md](docs/PRIVACY.md)。

## 什么时候不需要她

- 你不在本地跑 coding agent——她还是一只可爱的桌宠，但「盯岗」才是灵魂。
- 你今天就想要跨平台——她在 macOS 上构建并实测；代码基也面向
  Windows/Linux，但还早。

## 项目状态

早期阶段，活跃开发中。核心闭环——agent hooks → 桌面演出 → 阻塞审批 →
聊天 → 好感度——在 macOS 上已是日常主力，稳定运行。

## 许可证

[PolyForm Noncommercial 1.0.0](LICENSE)——个人与非商业用途自由使用；
商业使用需获得 guttolab 授权。美术素材为 AI 生成并如实披露。桌宠引擎
fork 自 [OpenPets](https://github.com/alterhq/OpenPets)（MIT）。
