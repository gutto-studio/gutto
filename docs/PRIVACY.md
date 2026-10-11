# gutto 隐私说明（Privacy）

> 适用：gutto 桌宠（macOS / Windows / Linux）。最后更新：2026-10-10。

## 她知道什么、存在哪

全部数据只存在**你自己的电脑**上（`~/.gutto/` 目录），没有任何云同步、没有任何内置遥测/崩溃上报：

| 文件 | 内容 | 谁写 |
| --- | --- | --- |
| `~/.gutto/env` | LLM/VL 端点与 API key（权限 600，仅本机） | 设置窗 |
| `~/.gutto/providers.json` | 供应商档案（含 key，本机明文） | 设置窗 |
| `~/.gutto/chat-memory.tsv` | 对话记忆账本（只增不毁） | 对话链路 |
| `~/.gutto/chat-memory-summary.md` | 长期记忆卡（旧账摘要） | 压缩器 |
| `~/.gutto/persona.md` | 人设卡 | 你/角色卡导入 |
| `~/.gutto/activity.tsv` | 操作记录时间线 | 各功能 |
| `~/.gutto/approvals/` | 审批队列与决策 | agent hooks |
| `~/.gutto/events/current.json` | 最近一条 agent 事件（含 say 文本） | hooks/桥 |
| `~/.gutto/pet-position.json` | 她站的位置 | 拖拽 |

## 对话与模型

- **你选哪个模型她就连哪个**（BYO key）：云端（如 DeepSeek）或本机（Ollama 等）。
- 对话内容按所选模型的供应商隐私政策处理；本机端点则完全不出门。
- API key 只写在本机 `env`（600 权限），不进 git、不进任何上报。

## 看屏功能（可选）

- **只在你说「看一眼」时**截一次屏，压缩后发给**你自己配的 VL 端点**，临时文件当场删除。
- 不配置 VL 端点时该功能自动降级，永不截屏。

## 删除与退出

- 「清空显示（新开一局）」= 旧对话不再进入她的上下文；账本本体保留（只增不毁是安全设计）。
- 彻底删除：退出桌宠后删除 `~/.gutto/` 目录即可，无残留、无注销流程。

## 开源致谢

- 桌宠引擎起步于 [OpenPets](https://github.com/alterhq/OpenPets) / OpenPetsKit（MIT License）的 fork。
- 跨平台壳使用 [Electron](https://www.electronjs.org/)（MIT）。
- 角色形象与动画素材为本项目自产（AI 生成管线），不含第三方版权素材。
