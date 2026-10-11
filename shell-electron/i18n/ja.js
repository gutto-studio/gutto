// i18n 字典（ja）——v44.10 四语言扩展。zh 为真源，本表缺键运行时回退 zh
//（i18n/index.js）。键集必须与 zh 完全一致（test/i18n.test.js 看守）。
// 定位：初翻（README i18n 纪律：母语审校等海外信号）；台词体=カジュアルな
// 女の子口調，颜文字沿用不上 emoji（v36.7 拍板）。技术词（Base URL/API Key
// /Ollama 等）保持原文。双栖导出同 zh.js（UMD-lite，renderer 裸 script 加载）。
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GUTTO_DICT_JA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // 窗口与页签
    'window.settingsTitle': 'gutto · 設定と記録',
    'tab.settings': '設定',
    'tab.activity': '操作記録',
    'tab.history': 'チャット履歴',
    'tab.log': 'ログ',

    // 通用
    'common.save': '保存',
    'common.saveFailed': '保存に失敗しました：{error}',
    'common.refresh': '更新',
    'common.custom': 'カスタム（~/.gutto/persona.md）',
    'common.default': 'デフォルト',

    // LLM 服务表单
    'form.sectionLLM': 'LLM サービス',
    'form.baseUrl': 'Base URL',
    'form.apiKey': 'API Key（ローカル/オフライン端点は空欄可）',
    'form.apiKeyConfigured': '設定済み（末尾 …{tail}）、空欄で維持',
    'form.model': 'モデル',
    'form.fillOllama': 'Ollama ローカルを記入',
    'form.detect': 'モデルを探す',
    'form.detecting': '探しています…',
    'form.detectFail': 'つながらない（オフライン端点が止まってる？）',
    'form.detectEmpty': 'モデルが見つからない（サービスは生きてるけどリストが空）',
    'form.detectDone': '{count} 個見つかったよ、クリックで記入',
    'form.saved': '保存した → ~/.gutto/env（権限 600）',
    'form.saveFail': '保存失敗：{error}',
    'form.testChat': 'テスト会話',

    // 人设卡
    'persona.section': 'ペルソナカード',
    'persona.placeholder': 'ここにペルソナカードを書く（Markdown）。\n初めてなら「デフォルトを下書きに」からどうぞ。',
    'persona.save': 'ペルソナを保存',
    'persona.revert': 'デフォルトに戻す',
    'persona.loadDraft': 'デフォルトを下書きに',
    'persona.saved': '保存した → ~/.gutto/persona.md（次の会話から反映）',
    'persona.reverted': 'デフォルトのペルソナに戻したよ',
    'persona.draftMissing': 'デフォルトの下書きが見つからない（config/persona-gutto.md）',
    'persona.draftLoaded': 'デフォルトの下書きを読み込んだ、書き換えて「ペルソナを保存」してね',

    // 聊天记录页
    'history.empty': 'まだチャット履歴がない。\n彼女を右クリック →「💬 話しかける…」で最初のひとことを。',
    'history.recentCount': '最近の {count} 件',
    'history.me': 'わたし',
    'history.her': 'gutto',

    // 操作记录页
    'activity.empty': 'まだ操作記録がない。\n彼女の会話・お掃除・ステータス報告はみんなここに記録されるよ。',
    'activity.today': '今日',
    'activity.yesterday': '昨日',

    // 聊天输入面板
    'chat.placeholder': '何か話しかけて…（/ でコマンド）',
    'chat.send': '話す',
    'chat.commandFallbackDesc': 'カスタムプロンプト',
    'chat.busy': 'えっと…考えてる',
    'chat.error': '頭がポカっとした…もう一回聞いて？',

    // 气泡
    'bubble.fold': '折りたたむ',
    'bubble.unfold': '全部見る',

  // 初回ガイド + イベントバブル（round3 R-2／初翻：母語審校待ち）
  'firstrun.greet': 'こんにちは、gutto だよ！右クリック →「⚙️ 設定」で頭（AI）を設定してね。クラウドでもローカルでも OK、そうしたらお話できるよ (≧▽≦)',
  'event.stopBubble': '{project} のセッションが終わったよ、ほめて！',

    // 互动反应（台词只准颜文字不上 emoji——v36.7 拍板，全语言同规）
    'poke.pat.cozy': 'ん～、これ好き',
    'poke.pat.smug': 'へへっ、いい感じでしょ？',
    'poke.pat.loveit': 'なでなで殺！いちばん好き',
    'poke.hit.startled': 'わっ！びっくりさせないで',
    'poke.hit.annoyed': '用があるなら言葉で(｀へ´)',
    'poke.hit.ask': 'ん？呼んだ？',
    'poke.hit.happy': 'つつかれるのも超嬉しい',
    'poke.frenzy.explode': 'もう十分でしょ！本気で怒るよ(╬￣皿￣)',
    'poke.frenzy.tax': 'これ以上つつくとなでなで税取るからね！',
    'poke.shake.dizzy': 'うわぁ——目が回った(＞﹏＜)',
    'poke.shake.letgo': '下ろして！おもちゃじゃないんだから(｀へ´)',
    'poke.shake.whee': 'わはは——もっと高く振ってよ',

    // 通用（语言设置）
    'group.general': '一般',
    'lang.label': '表示言語',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.ja': '日本語',
    'lang.ko': '한국어',
    'lang.restartHint': 'gutto の再起動後に反映（右クリック → 終了、もう一度開く）',
    'lang.foot': '表示言語を切り替える。未設定ならシステム言語に追従、GUTTO_LANG を書けばそちらが優先。',

    // 羁绊
    'bond.lv.first': 'はじまり',
    'bond.lv.friendly': '仲良し',
    'bond.lv.close': '親密',
    'bond.lv.soul': '絆',
    'bond.group': '絆',
    'bond.stat.streak': '{days} 日連続で一緒',
    'bond.stat.together': '一緒に {days} 日目',
    'bond.stat.progress': '{points} / {next} 好感度',
    'bond.stat.maxed': '{points} 好感度 · MAXだよ',
    'bond.foot': 'なでなで・おしゃべり・毎日会いに来て——好感度は下がらないよ。レベルアップでレアな小劇場が解放される。',
    'bond.levelup': 'なんか近づいた気がする……{name}（Lv{lv}）！{unlock}',
    'bond.unlock.dance': 'レア小劇場解放：彼女のダンス',
    'bond.unlock.cheer': 'レア小劇場解放：応援してくれる',
    'bond.unlock.words': '専用のヒミツ話を解放',
    'bond.streak': '今日で {days} 日連続一緒にいるよ',
    'bond.moment.twirl': '（見てない隙に、くるっと一回転）',
    'bond.moment.hum': 'んん～♪ んふんふ～',
    'bond.moment.proud': '今日のわたしも頼りになるでしょ！',
    'bond.moment.gift': 'このココロ……ほら、とりあえず預かってあげる',
    'bond.moment.soulIdle': 'あなたがいる日は、うとうとするのも甘いの',
    'bond.moment.soulTogether': '何もしないで、こうして隣にいるのも、いいね',

  // 絆の記録パネル（v44.16 C-1／初翻：母語審校待ち）
  'bond.stat.best': '最長連続 {days} 日',
  'bond.unlockAt': '{at} ポイントで解放',
  'bond.milestones': '節目',
  'bond.history.first': '初めて出会った日',
  'bond.history.lv': 'Lv{lv} に到達',
  'bond.history.empty': '一緒に過ごす毎日がここに書かれていく',

  // 日付の特別演出（v44.16 C-2／初翻：母語審校待ち）
  'special.newyear': 'あけおめ！今年もよろしく、一緒にがんばろうね (≧▽≦)ﾉ',
  'special.valentine': 'バ、バレンタインだから……チョコは余っただけ、勘違いしないで！ (｀・ω・´)',
  'special.halloween': 'トリック・オア・トリート！今夜はデスクトップ中をパトロールするんだから (｀・ω・´)',
  'special.christmas': 'メリークリスマス！靴下を机の隅に……中身は内緒だよ ♪',
  'special.anniv': '今日は出会って {years} 周年！これからも毎年よろしくね (｡•̀ᴗ-)✧',
  'special.days100': '一緒に 100 日目！100 日目もきらきらでいようね ✧',
  'special.days365': '一緒に満 1 年！365 日、毎日にありがとう',

  // おやつ（v44.17 C-3／初翻：母語審校待ち）
  'feed.button': 'おやつをあげる',
  'feed.tray': 'おやつをあげる',
  'feed.line1': 'わ——おやつだ！たべるたべる (≧▽≦)',
  'feed.line2': 'おいしい！おやつの時間、さいこう (๑ᵔ⤙ᵔ๑)',
  'feed.capped': '今日はおなかいっぱい……また明日ね、約束！',

    // 右键菜单（标签短形——图标条宽度吃语言，v44.10）
    'menu.chat': '話しかける',
    'menu.settings': '設定',
    'menu.rest': 'ひと休み',
    'menu.quit': 'お仕事おわり',

    // 托盘
    'tray.show': '呼び戻す',
    'tray.rest': 'ひと休み',

    // 日志页
    'log.empty': 'まだログがない。会話呼び出しやウィンドウの開閉はここに記録されるよ。',
    'log.noFile': '--log-file なし、ログは使えない',
    'log.lineCount': '{shown} 行',

    // 表单补充
    'form.footer': '3 択：クラウドは key を記入（デフォルト DeepSeek）；オフラインはローカルの Ollama/LM Studio へ（key 空欄）；未設定でもお掃除/ステータス報告は使える（おしゃべりだけできない）。key はローカルの ~/.gutto/env だけに保存。',
    'form.testChatText': '（設定ページのテスト）いる？',
    'persona.footer': 'Markdown は書いた瞬間に反映——次の会話から新しいカード（会話は毎回ペルソナを現読み）。「デフォルトに戻す」=カスタム persona.md を削除してリポジトリ既定に戻る。',

    // 活动类别徽章
    'kind.chat': '会話',
    'kind.clean': 'お掃除',
    'kind.report': 'ステータス',
    'kind.say': '発言',
    'kind.anim': 'アニメ',
    'kind.react': '感情',
    'kind.system': 'システム',

    // 审批卡
    'approval.title': '決定してほしい',
    'approval.meta': '{project} の {tool}',
    'approval.allow': '許可',
    'approval.deny': '拒否',
    'approval.more': '他に {count} 件待機中',
    'approval.hotkeyHint': '⇧⌘Y 許可 · ⇧⌘N 拒否',

    // 记忆管理
    'memory.section': 'メモリ',
    'memory.total': '帳簿 {count} 件（追記のみ・消さない）',
    'memory.cardOn': '長期メモリカード：有効（このセッションに反映済み）',
    'memory.cardOff': '長期メモリカード：持ち込まない（旧セッションの要約）',
    'memory.cardMissing': '長期メモリカード：まだない',
    'memory.compact': '古い帳簿を今すぐ圧縮',
    'memory.compacting': '圧縮はバックグラウンドで走ってる～後でカード見てね',
    'memory.preview': '長期メモリカードのプレビュー',

    // 角色卡导入
    'card.import': 'キャラカードを取り込む…',
    'card.imported': '「{name}」を読み込んだ——書き換えて「ペルソナを保存」で反映',
    'card.fail': 'カードの解析に失敗：{error}',

    // 玩法页
    'tab.play': '遊び方',

    // 记录页
    'tab.records': '記録',

    // 分组标题
    'group.chatModel': 'チャットモデル',
    'group.vl': '画面のぞき見',
    'group.persona': 'ペルソナカード',
    'group.memory': 'メモリ',
    'overview.model': '現在のモデル',
    'overview.hooks': 'agent 連携',
    'overview.memory': 'メモリ帳簿',
    'overview.hooksValue': '{on}/{total} 接続済み',
    'overview.memValue': '{count} 件',
    'overview.noModel': '未設定',

    // 动作预览
    'play.animTitle': 'アクションプレビュー',
    'play.animEmpty': 'パックにアニメ行がない（pet.json の欠落）',
    'play.animPlaying': '再生中：{name}',
    'play.animTour': '全部まわす',
    'play.animTourStop': 'まわすの止める',
    'play.animTourProgress': 'まわり中 {i}/{n}：{name}',
    'play.animTourDone': 'まわり完了、{n} 行全部通過',
    'play.animFoot': 'チップをクリックすると彼女が一行演じる（フル再生）；「全部まわす」はパック全アクションを連続再生。コマンドラインでも再生可：gutto anim <アクション名>。',
    'play.hooksTitle': 'agent 連携',
    'play.hooksStatus': '{name}：{state}',
    'play.hooksOn': '接続済み',
    'play.hooksOff': '未登録',
    'play.hooksInstall': '連携を登録 / 更新',
    'play.hooksInstalling': '登録中…',
    'play.hooksFoot': '登録後：あなたが agent を走らせると彼女は考え中/仕上げのアクションを演じ、承認時は札を挙げて決定を待つ。ボタンは各社の設定にマージ、追記のみで壊さない（バックアップは /tmp/gutto-hooks-backup/）。',
    'play.approvalToggle': 'ブロッキング承認（承認カードのボタン / ⇧⌘Y 許可 · ⇧⌘N 拒否）',
    'play.approvalTimeout': '待ち上限（秒、超過でネイティブダイアログに戻る）',
    'play.approvalFoot': 'Claude / ZCode / codex の3社、プロトコルが明確な形は本当にブロックする（ZCode/codex は再登録が一回必要；codex はさらに TUI の /hooks で信頼一回）；opencode プラグインはまだ注意喚起のみ。承認カードにはこのシェルの起動が必要。',
    'play.vlTitle': '画面のぞき見（あなたの画面をチラ見してツッコむ）',
    'play.vlFoot': 'OpenAI 互換の視覚モデル端点ならどれでも（チャット LLM とは独立）。設定したらチャット入力欄で /look——彼女が画面をちらっと見るよ。',
    'play.vlSaved': '画面のぞき見の設定を保存した',
    'play.soundTitle': 'サウンド',
    'play.sfxToggle': '効果音（承認カード/許可/拒否の通知音）',
    'play.voiceToggle': '音声読み上げ（仕上げ戦報が声を出す、声質は調整中）',
    'play.soundFoot': '効果音はシステム音；音声は PC の TTS（デフォルト OFF、元気な声に整ったら ON）。',
    'play.cmdTitle': 'カスタムコマンド',
    'play.cmdOpen': 'コマンドフォルダを開く',
    'play.cmdFoot': '~/.gutto/commands/ に markdown を置く：ファイル名=コマンド（説明.md → /説明）、本文=プロンプト、$ARGUMENTS が引数置換。入力欄で / で一覧。',
    'play.cmdEmpty': 'カスタムコマンドはまだない——.md をひとつ置けば増えるよ',
    'play.saved': '保存した',

    // 模型参数
    'llm.thinkLabel': '思考の深さ',
    'llm.thinkOff': 'オフ',
    'llm.thinkLow': '低',
    'llm.thinkMedium': '中',
    'llm.thinkHigh': '高',
    'llm.ctxLabel': 'コンテキスト窓（ターン）',
    'llm.ctxHint': '持ち込む履歴ターン数（1-40）、空欄/0=自動（8~40 で動的）。ローカル端点（Ollama など）はこれを num_ctx としてモデルに渡す——旧端点で効かない場合は端点側で OLLAMA_CONTEXT_LENGTH を設定。思考の深さ=推論モデルの reasoning_effort（low/medium/high）、通常モデルは「オフ」で現状維持。',

    // 供应商档案
    'prov.use': '使う',
    'prov.inUse': '使用中',
    'prov.edit': '編集',
    'prov.add': '＋ プロバイダ追加',
    'prov.save': '保存',
    'prov.cancel': 'キャンセル',
    'prov.delete': '削除',
    'prov.nameLabel': '名前',
    'prov.keyLabel': 'API Key',
    'prov.modelLabel': 'モデル',
    'prov.hostLabel': 'Base URL',
    'prov.saved': 'プロファイルを保存した',
    'prov.activated': '切り替え → {name}（次の会話から反映）',
    'prov.needName': '名前と Base URL は必須',

  // プロバイダー既定名（round3 R-2／初翻：母語審校待ち）
  'prov.preset.imported': '現在の設定（インポート）',
  'prov.preset.ds': 'クラウド DeepSeek',
  'prov.preset.local': 'ローカル Ollama',

    // 聊天记录清空
    'history.clear': '表示をクリア（新セッション開始）',
    'history.cleared': '新しいセッション！昔の帳はもう窓に入らないよ（記録本体は ~/.gutto に保持、消さない）',
  };
});
