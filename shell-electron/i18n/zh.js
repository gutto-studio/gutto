// i18n 真源字典（zh）——全面 Electron 化（2026-10-09 拍板）阶段 0 地基。
// 纪律（院内 i18n-guide + opencode en.ts 同款打法）：
// - zh 是唯一真源：改文案改这里；en 缺键运行时回退 zh（i18n/index.js 负责）；
// - renderer/main 每条新用户可见字符串第一天就进字典，禁止裸写；
// - 键命名：小写点分层级 <域>.<名>，占位 {name} 单花括号；
// - 键集一致性由 test/i18n.test.js 看守（zh/en 键集必须完全相等）。
// 内容来源：Swift 壳 PetSettingsPanel/PetChatInputPanel 存量文案平移（阶段 1 直接可用）。
// 双栖：node 侧 module.exports；浏览器侧挂 window.GUTTO_DICT_ZH（UMD-lite，
// 阶段 1 实锤教训：renderer 无 require，字典必须能裸 script 加载）。
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GUTTO_DICT_ZH = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // 窗口与页签
    'window.settingsTitle': 'gutto · 设置与记录',
    'tab.settings': '设置',
    'tab.activity': '操作记录',
    'tab.history': '聊天记录',
    'tab.log': '日志',

    // 通用
    'common.save': '保存',
    'common.saveFailed': '保存失败：{error}',
    'common.refresh': '刷新',
    'common.custom': '自定义（~/.gutto/persona.md）',
    'common.default': '默认',

    // LLM 服务表单
    'form.sectionLLM': 'LLM 服务',
    'form.baseUrl': 'Base URL',
    'form.apiKey': 'API Key（本地/离线端点可留空）',
    'form.apiKeyConfigured': '已配置（尾号 …{tail}），留空保持',
    'form.model': '模型',
    'form.fillOllama': '填 Ollama 本地',
    'form.detect': '探测模型',
    'form.detecting': '探测中…',
    'form.detectFail': '连不上（离线端点没开？）',
    'form.detectEmpty': '没探测到模型（服务在线但清单为空）',
    'form.detectDone': '探测到 {count} 个，点选即填入',
    'form.saved': '已保存 → ~/.gutto/env（权限 600）',
    'form.saveFail': '保存失败：{error}',
    'form.testChat': '测试对话',

    // 人设卡
    'persona.section': '人设卡',
    'persona.placeholder': '在这里写人设卡（Markdown）。\n第一次可以从「以默认为底稿」开始改。',
    'persona.save': '保存人设',
    'persona.revert': '恢复默认',
    'persona.loadDraft': '以默认为底稿',
    'persona.saved': '已保存 → ~/.gutto/persona.md（下一句对话生效）',
    'persona.reverted': '已恢复默认人设',
    'persona.draftMissing': '找不到默认底稿（config/persona-gutto.md）',
    'persona.draftLoaded': '已载入默认底稿，改完点「保存人设」',

    // 聊天记录页
    'history.empty': '还没有聊天记录。\n右键她 →「💬 和她说话…」开始第一句。',
    'history.recentCount': '最近 {count} 条',
    'history.me': '我',
    'history.her': 'gutto',

    // 操作记录页
    'activity.empty': '还没有操作记录。\n她的每次对话、清理、状态上报都会记在这里。',
    'activity.today': '今天',
    'activity.yesterday': '昨天',

    // 聊天输入面板
    'chat.placeholder': '说点什么…（/ 看指令）',
    'chat.send': '说',
    'chat.commandFallbackDesc': '自定义提示',
    'chat.busy': '嗯…让她想想',
    'chat.error': '脑子抽了一下…再问一次？',

    // 气泡（v43.12 D-4：长回复手动折叠开关，默认整段展示）
    'bubble.fold': '收起',
    'bubble.unfold': '展开全部',

  // 首启引导 + 事件气泡（round3 R-2：main.js 漏网中文收口）
  'firstrun.greet': '你好呀，我是 gutto！右键我 →「⚙️ 设置」配个脑子（云端或本机都行），就能跟我说话啦 (≧▽≦)',
  'event.stopBubble': '{project} 的会话收工啦，快夸我',

  // 互动反应（v44 摸头/戳——键全语义命名禁编号句群，i18n-guide §2.2；
  // 台词只准颜文字不上 emoji，v36.7 拍板）
  'poke.pat.cozy': '嗯～就喜欢这个',
  'poke.pat.smug': '嘿嘿，手感不错吧？',
  'poke.pat.loveit': '摸头杀！最喜欢你了',
  'poke.hit.startled': '哇！干嘛吓我',
  'poke.hit.annoyed': '有事说话，别戳(｀へ´)',
  'poke.hit.ask': '嗯？是叫我吗',
  'poke.hit.happy': '戳我也超开心哦',
  'poke.frenzy.explode': '戳够了没有！真生气了哦(╬￣皿￣)',
  'poke.frenzy.tax': '再戳就要收摸头税了！',
  'poke.shake.dizzy': '呜哇——晃得头晕啦(＞﹏＜)',
  'poke.shake.letgo': '放我下来！我又不是玩具(｀へ´)',
  'poke.shake.whee': '哇哈——再甩高一点嘛',

  // 通用（v44.10 语言设置——GUTTO_LANG 写 env，重启壳生效）
  'group.general': '通用',
  'lang.label': '界面语言',
  'lang.zh': '中文',
  'lang.en': 'English',
  'lang.ja': '日本語',
  'lang.ko': '한국어',
  'lang.restartHint': '重启 gutto 后生效（右键她 → 退出，再打开）',
  'lang.foot': '切换界面语言。缺省跟随系统语言；写入 GUTTO_LANG 后以此为准。',

  // 羁绊（v44.2 好感度——等级名/升级/解锁/连访/稀有小剧场台词）
  'bond.lv.first': '初识',
  'bond.lv.friendly': '熟络',
  'bond.lv.close': '亲近',
  'bond.lv.soul': '羁绊',
  'bond.group': '羁绊',
  'bond.stat.streak': '连续相伴 {days} 天',
  'bond.stat.together': '相伴第 {days} 天',
  'bond.stat.progress': '{points} / {next} 好感',
  'bond.stat.maxed': '{points} 好感 · 满级啦',
  'bond.foot': '摸摸她、和她说话、每天来看看——好感只涨不掉，升级会解锁她的稀有小剧场。',
  'bond.levelup': '感觉我们更近了……{name}（Lv{lv}）！{unlock}',
  'bond.unlock.dance': '解锁稀有小剧场：她的小舞',
  'bond.unlock.cheer': '解锁稀有小剧场：为你打气',
  'bond.unlock.words': '解锁专属悄悄话',
  'bond.streak': '今天是我们连续相伴的第 {days} 天',
  'bond.moment.twirl': '（趁你没看，转了个小圈）',
  'bond.moment.hum': '哼哼～哼哼哼～',
  'bond.moment.proud': '今天的我也很可靠吧！',
  'bond.moment.gift': '这颗心……喏，先借你保管',
  'bond.moment.soulIdle': '有你在的日子，连打瞌睡都是甜的',
  'bond.moment.soulTogether': '什么都不做，就这样陪着你，也很好',

  // 羁绊史面板（v44.16 C-1：最长连访/解锁清单/里程碑时间线）
  'bond.stat.best': '最长连访 {days} 天',
  'bond.unlockAt': '{at} 分解锁',
  'bond.milestones': '里程碑',
  'bond.history.first': '初遇',
  'bond.history.lv': '升到 Lv{lv}',
  'bond.history.empty': '相伴的每一天都会写在这里',

  // 日期彩蛋（v44.16 C-2：周年/相伴里程碑/固定节日——core/calendar.js 判定，
  // 键集由 test/core-calendar.test.js 与四表对账，加节日先去 calendar 登记）
  'special.newyear': '新年快乐！今年也请多指教，一起加油呀 (≧▽≦)ﾉ',
  'special.valentine': '今、今天是情人节……巧克力是顺手买的，才不是为你！(｀・ω・´)',
  'special.halloween': '不给糖就捣蛋！本小姐今晚要巡遍整个桌面 (｀・ω・´)',
  'special.christmas': '圣诞快乐！袜子放桌角，里面装了什么才不告诉你 ♪',
  'special.anniv': '今天是我们相遇 {years} 周年！往后每一年也请多关照 (｡•̀ᴗ-)✧',
  'special.days100': '相伴第 100 天！第一百天也要闪闪发光哦 ✧',
  'special.days365': '相伴满一年啦！365 天，谢谢每一天都有你',

  // 投喂（v44.17 C-3：玩法页按钮 + 托盘入口；记账类别 feed 日封顶 30）
  'feed.button': '喂小零食',
  'feed.tray': '喂她小零食',
  'feed.line1': '哇——是小零食！谢谢投喂 (≧▽≦)',
  'feed.line2': '好吃！投喂的人也超级好 (๑ᵔ⤙ᵔ๑)',
  'feed.capped': '今天吃太饱啦……再喂要滚不动了，明天再投喂嘛',

  // 右键菜单
  'menu.chat': '和她说话',
  'menu.settings': '设置',
  'menu.rest': '让她歇会儿',
  'menu.quit': '下班（退出）',

  // 托盘（v44.7 A-3：歇会儿的找回门面）
  'tray.show': '叫她回来',
  'tray.rest': '让她歇会儿',

    // 日志页
    'log.empty': '还没有日志。她的对话调用、窗口开关都会记在这里。',
    'log.noFile': '未提供 --log-file，日志不可用',
    'log.lineCount': '{shown} 行',

    // 表单补充
    'form.footer': '三档任选：云端填 key（默认 DeepSeek）；离线指向本机 Ollama/LM Studio（key 留空）；完全不配也能用清理/状态上报（只是不聊天）。key 只存本机 ~/.gutto/env。',
    'form.testChatText': '（设置页测试）在吗？',
    'persona.footer': 'Markdown 即写即生效——下一句对话就用新卡（对话每次现读人设）。「恢复默认」=删除自定义 persona.md，回到仓库默认卡。',

  // 活动类别徽章
  'kind.chat': '对话',
  'kind.clean': '清理',
  'kind.report': '状态',
  'kind.say': '发言',
  'kind.anim': '动画',
  'kind.react': '情绪',
  'kind.system': '系统',

  // 审批卡（v42 阻塞式审批）
  'approval.title': '要你拍板',
  'approval.meta': '{project} 的 {tool}',
  'approval.allow': '允许',
  'approval.deny': '拒绝',
  'approval.more': '还有 {count} 个在排队',
  'approval.hotkeyHint': '⇧⌘Y 允许 · ⇧⌘N 拒绝',

  // 记忆管理（v42）
  'memory.section': '记忆',
  'memory.total': '账本 {count} 条（只增不毁）',
  'memory.cardOn': '长期记忆卡：生效中（已覆盖到本局）',
  'memory.cardOff': '长期记忆卡：不带入（旧局摘要）',
  'memory.cardMissing': '长期记忆卡：还没有',
  'memory.compact': '立即压缩旧账',
  'memory.compacting': '压缩已在后台跑～稍后看卡片',
  'memory.preview': '长期记忆卡预览',

  // 角色卡导入（v42）
  'card.import': '导入角色卡…',
  'card.imported': '已载入「{name}」——改完点「保存人设」生效',
  'card.fail': '卡片解析失败：{error}',

    // 玩法页（v42.4：新玩法全部可视化配置，不再藏 env）
    'tab.play': '玩法',

    // 记录页（v43.5 五页签收敛三页：操作/聊天/日志并为子页）
    'tab.records': '记录',

    // 分组标题（v43.11 设置重做：卡片堆 → 分组行式条目）
    'group.chatModel': '对话模型',
    'group.vl': '看屏',
    'group.persona': '人设卡',
    'group.memory': '记忆',
    'overview.model': '当前模型',
    'overview.hooks': 'agent 联动',
    'overview.memory': '记忆账本',
    'overview.hooksValue': '{on}/{total} 已接上',
    'overview.memValue': '{count} 条',
    'overview.noModel': '未配置',

    // 动作预览（v43.5：Swift hover 巡检面板 + bin/gutto anim 的接班面）
    'play.animTitle': '动作预览',
    'play.animEmpty': '包里没有动作行（pet.json 缺失）',
    'play.animPlaying': '正在演：{name}',
    'play.animTour': '巡检全部',
    'play.animTourStop': '停止巡检',
    'play.animTourProgress': '巡检 {i}/{n}：{name}',
    'play.animTourDone': '巡检完成，{n} 行全过',
    'play.animFoot': '点芯片让她演一行（播完整遍）；「巡检」从头连播全包动作。命令行同样可点播：gutto anim <动作名>。',
  'play.hooksTitle': 'agent 联动',
  'play.hooksStatus': '{name}：{state}',
  'play.hooksOn': '已接上',
  'play.hooksOff': '未注册',
  'play.hooksInstall': '注册 / 更新联动',
  'play.hooksInstalling': '正在注册…',
  'play.hooksFoot': '注册后：她在你跑 agent 时演思考/收工行，审批时举牌等你拍板。按钮会合并进各家配置，只增不毁（备份在 /tmp/gutto-hooks-backup/）。',
  'play.approvalToggle': '阻塞式审批（审批卡上点按钮/⇧⌘Y 允许 · ⇧⌘N 拒绝）',
  'play.approvalTimeout': '等待上限（秒，超时回落原生弹窗）',
  'play.approvalFoot': '对 Claude / ZCode / codex 三家协议明确的形状真正拦截（ZCode/codex 需重跑一次注册；codex 还要在 TUI 里 /hooks 信任一次）；opencode 插件仍只提醒。审批卡需要本壳在跑。',
  'play.vlTitle': '看屏（她瞟一眼你的屏幕吐槽）',
  'play.vlFoot': '填任一 OpenAI 兼容的视觉模型端点（跟聊天 LLM 相互独立）。配好后聊天输入框敲 /look，她就看一眼你的屏幕。',
  'play.vlSaved': '看屏配置已保存',
  'play.soundTitle': '声音',
  'play.sfxToggle': '音效（审批弹卡/允许/拒绝的提示音）',
  'play.voiceToggle': '语音播报（收工战报出声，音色还在调）',
  'play.soundFoot': '音效走系统提示音；语音走 PC TTS（默认关，音色调好元气款再开）。',
  'play.cmdTitle': '自定义命令',
  'play.cmdOpen': '打开命令文件夹',
  'play.cmdFoot': '往 ~/.gutto/commands/ 放 markdown：文件名=命令（解释.md → /解释），正文=提示词，$ARGUMENTS 换参数。输入框打 / 看清单。',
  'play.cmdEmpty': '还没有自定义命令——放一个 .md 进来就有了',
  'play.saved': '已保存',

    // 模型参数（v44.3 对标 Cherry Studio：思考深度+上下文窗口，全局档）
    'llm.thinkLabel': '思考深度',
    'llm.thinkOff': '关闭',
    'llm.thinkLow': '低',
    'llm.thinkMedium': '中',
    'llm.thinkHigh': '高',
    'llm.ctxLabel': '上下文窗口（轮）',
    'llm.ctxHint': '携带的历史对话轮数（1-40），留空/0=自动（8~40 动态）。本地端点（Ollama 等）会同时把它作为 num_ctx 传给模型——旧版端点不认时在端点侧设 OLLAMA_CONTEXT_LENGTH。思考深度=推理模型的 reasoning_effort（low/medium/high），普通模型选「关闭」保持原样。',

    // 供应商档案（v42.7 学 cc-switch；v43.11 分组化）
    'prov.use': '启用',
  'prov.inUse': '使用中',
  'prov.edit': '编辑',
  'prov.add': '＋ 新增供应商',
  'prov.save': '保存',
  'prov.cancel': '取消',
  'prov.delete': '删除',
  'prov.nameLabel': '名称',
  'prov.keyLabel': 'API Key',
  'prov.modelLabel': '模型',
  'prov.hostLabel': 'Base URL',
  'prov.saved': '档案已保存',
  'prov.activated': '已切换 → {name}（下一句对话生效）',
  'prov.needName': '名称和 Base URL 必填',

  // 供应商预设名（round3 R-2：种子档案名进字典）
  'prov.preset.imported': '当前配置（导入）',
  'prov.preset.ds': '云端 DeepSeek',
  'prov.preset.local': '本机 Ollama',

  // 聊天记录清空（v42.9：新开一局语义，记录本体只增不毁）
  'history.clear': '清空显示（新开一局）',
  'history.cleared': '新的一局！旧账不再进窗口（记录本体保留在 ~/.gutto，只增不毁）',
};
});
