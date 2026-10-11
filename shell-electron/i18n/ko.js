// i18n 字典（ko）——v44.10 四语言扩展。zh 为真源，本表缺键运行时回退 zh
//（i18n/index.js）。键集必须与 zh 完全一致（test/i18n.test.js 看守）。
// 定位：初翻（README i18n 纪律：母语审校等海外信号）；台词体=애교 섞인
// 반말，颜文字沿用不上 emoji（v36.7 拍板）。技术词（Base URL/API Key
// /Ollama 等）保持原文。双栖导出同 zh.js（UMD-lite，renderer 裸 script 加载）。
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GUTTO_DICT_KO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // 窗口与页签
    'window.settingsTitle': 'gutto · 설정과 기록',
    'tab.settings': '설정',
    'tab.activity': '작업 기록',
    'tab.history': '채팅 기록',
    'tab.log': '로그',

    // 通用
    'common.save': '저장',
    'common.saveFailed': '저장 실패: {error}',
    'common.refresh': '새로고침',
    'common.custom': '커스텀(~/.gutto/persona.md)',
    'common.default': '기본값',

    // LLM 服务表单
    'form.sectionLLM': 'LLM 서비스',
    'form.baseUrl': 'Base URL',
    'form.apiKey': 'API Key(로컬/오프라인 엔드포인트는 비워도 됨)',
    'form.apiKeyConfigured': '설정됨(끝자리 …{tail}), 비우면 유지',
    'form.model': '모델',
    'form.fillOllama': 'Ollama 로컬 채우기',
    'form.detect': '모델 찾기',
    'form.detecting': '찾는 중…',
    'form.detectFail': '연결이 안 돼(오프라인 엔드포인트 꺼져있어?)',
    'form.detectEmpty': '모델이 안 잡혀(서비스는 살아있는데 목록이 비었음)',
    'form.detectDone': '{count}개 찾았어, 눌러서 채워 넣어',
    'form.saved': '저장했어 → ~/.gutto/env(권한 600)',
    'form.saveFail': '저장 실패: {error}',
    'form.testChat': '테스트 대화',

    // 人设卡
    'persona.section': '페르소나 카드',
    'persona.placeholder': '여기에 페르소나 카드를 써(Markdown).\n처음이면 「기본값으로 시작」부터 고쳐 보면 좋아.',
    'persona.save': '페르소나 저장',
    'persona.revert': '기본값으로 되돌리기',
    'persona.loadDraft': '기본값으로 시작',
    'persona.saved': '저장했어 → ~/.gutto/persona.md(다음 대화부터 반영)',
    'persona.reverted': '기본 페르소나로 되돌렸어',
    'persona.draftMissing': '기본 초안을 못 찾았어(config/persona-gutto.md)',
    'persona.draftLoaded': '기본 초안을 불러왔어, 고치고 「페르소나 저장」 눌러',

    // 聊天记录页
    'history.empty': '아직 채팅 기록이 없어.\n걔를 우클릭 → 「💬 말 걸기…」로 첫마디를 시작해 봐.',
    'history.recentCount': '최근 {count}개',
    'history.me': '나',
    'history.her': 'gutto',

    // 操作记录页
    'activity.empty': '아직 작업 기록이 없어.\n걔의 대화·청소·상태 보고가 전부 여기에 기록돼.',
    'activity.today': '오늘',
    'activity.yesterday': '어제',

    // 聊天输入面板
    'chat.placeholder': '뭐든 말해 봐…(/ 는 명령어)',
    'chat.send': '말해',
    'chat.commandFallbackDesc': '커스텀 프롬프트',
    'chat.busy': '응… 생각 좀 할게',
    'chat.error': '머리가 잠깐 삐끗했어… 다시 물어봐 줄래?',

    // 气泡
    'bubble.fold': '접기',
    'bubble.unfold': '전체 펼치기',

  // 첫 실행 안내 + 이벤트 버블(round3 R-2／초번역: 모국어 검수 대기)
  'firstrun.greet': '안녕, 나 gutto야! 나를 우클릭 → 「⚙️ 설정」에서 두뇌(AI)를 설정해 줘. 클라우드든 로컬이든 OK, 그러면 대화할 수 있어 (≧▽≦)',
  'event.stopBubble': '{project} 세션이 끝났어, 칭찬해 줘!',

    // 互动反应（台词只准颜文字不上 emoji——v36.7 拍板，全语言同规）
    'poke.pat.cozy': '음~ 이거 좋아',
    'poke.pat.smug': '헤헤, 손맛 괜찮지?',
    'poke.pat.loveit': '쓰다듬기 공격! 제일 좋아',
    'poke.hit.startled': '왜! 깜짝 놀라게 하지 마',
    'poke.hit.annoyed': '할 말이면 말로 해(｀へ´)',
    'poke.hit.ask': '응? 나 불러?',
    'poke.hit.happy': '콕콕 찔려도 엄청 신나',
    'poke.frenzy.explode': '이제 됐지! 진짜 화날 거야(╬￣皿￣)',
    'poke.frenzy.tax': '더 찌르면 쓰다듬기 세금 받을 거야!',
    'poke.shake.dizzy': '우와—— 어질어질해(＞﹏＜)',
    'poke.shake.letgo': '내려놔! 나 장난감 아니라고(｀へ´)',
    'poke.shake.whee': '와하하—— 더 높이 흔들어 줘',

    // 通用（语言设置）
    'group.general': '일반',
    'lang.label': '인터페이스 언어',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.ja': '日本語',
    'lang.ko': '한국어',
    'lang.restartHint': 'gutto 재시작 후 적용(우클릭 → 종료, 다시 열기)',
    'lang.foot': '인터페이스 언어를 바꿔. 미설정이면 시스템 언어를 따라가고, GUTTO_LANG을 쓰면 그게 우선이야.',

    // 羁绊
    'bond.lv.first': '첫만남',
    'bond.lv.friendly': '친해짐',
    'bond.lv.close': '가까워짐',
    'bond.lv.soul': '인연',
    'bond.group': '인연',
    'bond.stat.streak': '{days}일 연속 함께',
    'bond.stat.together': '함께한 {days}일째',
    'bond.stat.progress': '{points} / {next} 호감도',
    'bond.stat.maxed': '{points} 호감도 · 만렙이야',
    'bond.foot': '쓰다듬고, 말 걸고, 매일 보러 와——호감도는 안 줄어. 레벨업하면 레어 이벤트가 열려.',
    'bond.levelup': '우리 더 가까워진 것 같아……{name}(Lv{lv})! {unlock}',
    'bond.unlock.dance': '레어 이벤트 해금: 걔의 춤',
    'bond.unlock.cheer': '레어 이벤트 해금: 응원해 줄게',
    'bond.unlock.words': '전용 속삭임 해금',
    'bond.streak': '오늘은 우리 {days}일 연속 함께한 날이야',
    'bond.moment.twirl': '(안 볼 틈에 살짝 빙글 돌았어)',
    'bond.moment.hum': '흐음~ 흐흐흠~',
    'bond.moment.proud': '오늘의 나도 엄청 든든하지!',
    'bond.moment.gift': '이 마음…… 자, 일단 너한테 맡겨 둘게',
    'bond.moment.soulIdle': '네가 있는 날은 졸아도 달콤해',
    'bond.moment.soulTogether': '아무것도 안 하고 이렇게 옆에 있는 것도, 좋아',

  // 유대 기록 패널(v44.16 C-1／초번역: 모국어 검수 대기)
  'bond.stat.best': '최장 연속 {days}일',
  'bond.unlockAt': '{at}점에 해금',
  'bond.milestones': '이정표',
  'bond.history.first': '처음 만난 날',
  'bond.history.lv': 'Lv{lv} 달성',
  'bond.history.empty': '함께하는 매일이 여기에 기록돼',

  // 날짜 특별 연출(v44.16 C-2／초번역: 모국어 검수 대기)
  'special.newyear': '새해 복 많이 받아! 올해도 잘 부탁해, 같이 힘내자 (≧▽≦)ﾉ',
  'special.valentine': '바, 발렌타인이니까……초콜릿은 남아서 준 거야, 오해하지 마! (｀・ω・´)',
  'special.halloween': '트릭 오어 트릿! 오늘 밤엔 데스크톱 전체를 순찰할 거야 (｀・ω・´)',
  'special.christmas': '메리 크리스마스! 양말을 책상 모서리에…… 안에 뭐가 들었는지는 비밀 ♪',
  'special.anniv': '오늘은 우리가 만난 지 {years}주년! 앞으로도 매년 잘 부탁해 (｡•̀ᴗ-)✧',
  'special.days100': '함께한 지 100일! 백 번째 날도 반짝반짝하게 ✧',
  'special.days365': '함께한 지 딱 1년! 365일, 매일매일 고마워',

  // 간식(v44.17 C-3／초번역: 모국어 검수 대기)
  'feed.button': '간식 주기',
  'feed.tray': '간식 주기',
  'feed.line1': '와——간식이다! 잘 먹을게 (≧▽≦)',
  'feed.line2': '맛있어! 간식 시간이 최고야 (๑ᵔ⤙ᵔ๑)',
  'feed.capped': '오늘은 배불러……내일 또 챙겨 줘, 약속!',

    // 右键菜单（标签短形——图标条宽度吃语言，v44.10）
    'menu.chat': '말걸기',
    'menu.settings': '설정',
    'menu.rest': '잠깐 쉬기',
    'menu.quit': '퇴근하기',

    // 托盘
    'tray.show': '불러 오기',
    'tray.rest': '잠깐 쉬기',

    // 日志页
    'log.empty': '아직 로그가 없어. 대화 호출이나 창 열닫이 여기에 기록돼.',
    'log.noFile': '--log-file 없음, 로그 사용 불가',
    'log.lineCount': '{shown}줄',

    // 表单补充
    'form.footer': '셋 중 택1: 클라우드는 key 입력(기본 DeepSeek); 오프라인은 로컬 Ollama/LM Studio 지정(key 비움); 아예 미설정이면 청소/상태 보고만 쓸 수 있어(대화만 안 됨). key는 로컬 ~/.gutto/env에만 저장돼.',
    'form.testChatText': '(설정 페이지 테스트) 있어?',
    'persona.footer': 'Markdown은 쓰는 즉시 반영——다음 대화부터 새 카드(대화는 매번 페르소나를 새로 읽어). 「기본값으로 되돌리기」= 커스텀 persona.md를 지우고 저장소 기본 카드로.',

    // 活动类别徽章
    'kind.chat': '대화',
    'kind.clean': '청소',
    'kind.report': '상태',
    'kind.say': '발언',
    'kind.anim': '애니',
    'kind.react': '감정',
    'kind.system': '시스템',

    // 审批卡
    'approval.title': '결정이 필요해',
    'approval.meta': '{project}의 {tool}',
    'approval.allow': '허용',
    'approval.deny': '거부',
    'approval.more': '대기 중 {count}개 더',
    'approval.hotkeyHint': '⇧⌘Y 허용 · ⇧⌘N 거부',

    // 记忆管理
    'memory.section': '메모리',
    'memory.total': '장부 {count}개(추가만 하고 안 지워)',
    'memory.cardOn': '장기 기억 카드: 작동 중(이 세션에 반영됨)',
    'memory.cardOff': '장기 기억 카드: 안 가져옴(이전 세션 요약)',
    'memory.cardMissing': '장기 기억 카드: 아직 없음',
    'memory.compact': '오래된 장부 지금 압축',
    'memory.compacting': '압축은 뒤에서 돌고 있어~ 나중에 카드 봐',
    'memory.preview': '장기 기억 카드 미리보기',

    // 角色卡导入
    'card.import': '캐릭터 카드 가져오기…',
    'card.imported': '「{name}」불러왔어—— 고치고 「페르소나 저장」 누르면 적용',
    'card.fail': '카드 파싱 실패: {error}',

    // 玩法页
    'tab.play': '놀이',

    // 记录页
    'tab.records': '기록',

    // 分组标题
    'group.chatModel': '대화 모델',
    'group.vl': '화면 훔쳐보기',
    'group.persona': '페르소나 카드',
    'group.memory': '메모리',
    'overview.model': '현재 모델',
    'overview.hooks': 'agent 연동',
    'overview.memory': '기억 장부',
    'overview.hooksValue': '{on}/{total} 연결됨',
    'overview.memValue': '{count}개',
    'overview.noModel': '미설정',

    // 动作预览
    'play.animTitle': '액션 미리보기',
    'play.animEmpty': '팩에 애니 행이 없어(pet.json 누락)',
    'play.animPlaying': '재생 중: {name}',
    'play.animTour': '전부 돌리기',
    'play.animTourStop': '돌리기 멈추기',
    'play.animTourProgress': '돌리는 중 {i}/{n}: {name}',
    'play.animTourDone': '돌리기 완료, {n}개 행 전부 통과',
    'play.animFoot': '칩을 누르면 걔가 한 행 연기해(풀 재생); 「전부 돌리기」는 팩의 모든 액션을 연속 재생. 명령줄로도 재생 가능: gutto anim <액션명>.',
    'play.hooksTitle': 'agent 연동',
    'play.hooksStatus': '{name}: {state}',
    'play.hooksOn': '연결됨',
    'play.hooksOff': '미등록',
    'play.hooksInstall': '연동 등록 / 갱신',
    'play.hooksInstalling': '등록 중…',
    'play.hooksFoot': '등록하면: 네가 agent를 돌릴 때 걔가 생각/마무리 행을 연기하고, 승인 때 팻말을 들고 결정을 기다려. 버튼은 각사 설정에 병합, 추가만 하고 안 부숴(백업은 /tmp/gutto-hooks-backup/).',
    'play.approvalToggle': '블로킹 승인(승인 카드 버튼/⇧⌘Y 허용 · ⇧⌘N 거부)',
    'play.approvalTimeout': '대기 상한(초, 초과 시 네이티브 대화창으로 폴백)',
    'play.approvalFoot': 'Claude / ZCode / codex 삼사, 프로토콜이 명확한 형태는 진짜로 가로막아(ZCode/codex는 재등록 한 번 필요; codex는 추가로 TUI에서 /hooks로 신뢰 한 번); opencode 플러그인은 아직 알림만. 승인 카드는 이 셸이 돌아가는 게 필요해.',
    'play.vlTitle': '화면 훔쳐보기(네 화면을 슬쩍 보고 지적해)',
    'play.vlFoot': 'OpenAI 호환 비전 모델 엔드포인트면 뭐든(채팅 LLM과 독립). 설정 후 채팅 입력창에 /look——걔가 화면을 슬쩍 봐줄 거야.',
    'play.vlSaved': '화면 훔쳐보기 설정 저장했어',
    'play.soundTitle': '사운드',
    'play.sfxToggle': '효과음(승인 카드/허용/거부 알림음)',
    'play.voiceToggle': '음성 방송(퇴근 보고를 목소리로, 목소리는 조정 중)',
    'play.soundFoot': '효과음은 시스템음; 음성은 PC TTS(기본 꺼짐, 발랄한 톤 다듬어지면 켜기).',
    'play.cmdTitle': '커스텀 명령',
    'play.cmdOpen': '명령 폴더 열기',
    'play.cmdFoot': '~/.gutto/commands/에 markdown을 놓기: 파일명=명령(설명.md → /설명), 본문=프롬프트, $ARGUMENTS가 인자 치환. 입력창에서 / 로 목록 확인.',
    'play.cmdEmpty': '커스텀 명령이 아직 없어—— .md 하나만 놓으면 생겨',
    'play.saved': '저장했어',

    // 模型参数
    'llm.thinkLabel': '사고 깊이',
    'llm.thinkOff': '끔',
    'llm.thinkLow': '낮음',
    'llm.thinkMedium': '중간',
    'llm.thinkHigh': '높음',
    'llm.ctxLabel': '컨텍스트 창(턴)',
    'llm.ctxHint': '가져올 대화 턴 수(1-40), 비움/0=자동(8~40 동적). 로컬 엔드포인트(Ollama 등)는 이걸 num_ctx로 모델에 전달——구버전 엔드포인트가 안 받으면 엔드포인트 쪽에서 OLLAMA_CONTEXT_LENGTH 설정. 사고 깊이=추론 모델의 reasoning_effort(low/medium/high), 일반 모델은 「끔」으로 유지.',

    // 供应商档案
    'prov.use': '사용',
    'prov.inUse': '사용 중',
    'prov.edit': '편집',
    'prov.add': '＋ 프로바이더 추가',
    'prov.save': '저장',
    'prov.cancel': '취소',
    'prov.delete': '삭제',
    'prov.nameLabel': '이름',
    'prov.keyLabel': 'API Key',
    'prov.modelLabel': '모델',
    'prov.hostLabel': 'Base URL',
    'prov.saved': '프로필 저장했어',
    'prov.activated': '전환 → {name}(다음 대화부터 반영)',
    'prov.needName': '이름과 Base URL은 필수',

  // 공급자 기본 이름(round3 R-2／초번역: 모국어 검수 대기)
  'prov.preset.imported': '현재 설정(가져옴)',
  'prov.preset.ds': '클라우드 DeepSeek',
  'prov.preset.local': '로컬 Ollama',

    // 聊天记录清空
    'history.clear': '표시 비우기(새 판 시작)',
    'history.cleared': '새로운 판! 옛 장부는 더 이상 창에 안 들어와(기록 본체는 ~/.gutto에 보존, 지우지 않아)',
  };
});
