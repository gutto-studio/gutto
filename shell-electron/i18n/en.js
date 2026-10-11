// i18n 英文字典——初翻（2026-10-09，小g 手翻第一版；海外上线前过母语审校）。
// 键集必须与 zh.js 完全一致（test/i18n.test.js 看守）；运行时缺键回退 zh 真源。
// 双栖：node 侧 module.exports；浏览器侧挂 window.GUTTO_DICT_EN。
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GUTTO_DICT_EN = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // Window & tabs
    'window.settingsTitle': 'gutto · Settings & History',
    'tab.settings': 'Settings',
    'tab.activity': 'Activity',
    'tab.history': 'Chat History',
    'tab.log': 'Logs',

    // Common
    'common.save': 'Save',
    'common.saveFailed': 'Save failed: {error}',
    'common.refresh': 'Refresh',
    'common.custom': 'Custom (~/.gutto/persona.md)',
    'common.default': 'Default',

    // LLM service form
    'form.sectionLLM': 'LLM Service',
    'form.baseUrl': 'Base URL',
    'form.apiKey': 'API Key (optional for local/offline)',
    'form.apiKeyConfigured': 'Configured (…{tail}), leave blank to keep',
    'form.model': 'Model',
    'form.fillOllama': 'Use local Ollama',
    'form.detect': 'Detect models',
    'form.detecting': 'Detecting…',
    'form.detectFail': "Can't connect (offline endpoint down?)",
    'form.detectEmpty': 'No models found (server up, list empty)',
    'form.detectDone': 'Found {count}, click to fill in',
    'form.saved': 'Saved → ~/.gutto/env (mode 600)',
    'form.saveFail': 'Save failed: {error}',
    'form.testChat': 'Test chat',

    // Persona card
    'persona.section': 'Persona',
    'persona.placeholder': 'Write the persona card here (Markdown).\nStart from "Use default as draft" for a first edit.',
    'persona.save': 'Save persona',
    'persona.revert': 'Restore default',
    'persona.loadDraft': 'Use default as draft',
    'persona.saved': 'Saved → ~/.gutto/persona.md (effective next message)',
    'persona.reverted': 'Restored default persona',
    'persona.draftMissing': 'Default draft not found (config/persona-gutto.md)',
    'persona.draftLoaded': 'Default draft loaded — edit, then "Save persona"',

    // Chat history tab
    'history.empty': 'No chat history yet.\nRight-click her → "💬 Talk to her…" to start.',
    'history.recentCount': 'Last {count}',
    'history.me': 'Me',
    'history.her': 'gutto',

    // Activity tab
    'activity.empty': 'No activity yet.\nEvery chat, cleanup and report lands here.',
    'activity.today': 'Today',
    'activity.yesterday': 'Yesterday',

    // Chat input panel
    'chat.placeholder': 'Say something… (/ for commands)',
    'chat.send': 'Say',
    'chat.commandFallbackDesc': 'Custom prompt',
    'chat.busy': 'Hmm… let her think',
    'chat.error': 'Brain glitched… try again?',

    // Bubble (v43.12 D-4: manual fold for long replies, fully shown by default)
    'bubble.fold': 'Fold',
    'bubble.unfold': 'Expand all',

  // First-run greeting + event bubble (round3 R-2)
  'firstrun.greet': "Hi, I'm gutto! Right-click me → ⚙️ Settings to give me a brain (cloud or local both work), then we can chat (≧▽≦)",
  'event.stopBubble': "{project}'s session just wrapped up. Praise me!",

  // Poke reactions (v44 pat/poke — semantic leaf keys, no numbered series)
  'poke.pat.cozy': 'Mmm~ right there',
  'poke.pat.smug': 'Hehe, feels nice, right?',
  'poke.pat.loveit': 'Head pats! Love you most',
  'poke.hit.startled': 'Waah! You scared me',
  'poke.hit.annoyed': 'Use words, not pokes (｀へ´)',
  'poke.hit.ask': 'Hmm? Did you call me?',
  'poke.hit.happy': 'Pokes make me happy too',
  'poke.frenzy.explode': 'THAT IS ENOUGH! I am actually mad (╬￣皿￣)',
  'poke.frenzy.tax': 'One more poke and the pat tax kicks in!',
  'poke.shake.dizzy': 'Whoa— you got me dizzy (＞﹏＜)',
  'poke.shake.letgo': 'Put me down! I am not a toy (｀へ´)',
  'poke.shake.whee': 'Wheee— swing me higher!',

  // General (v44.10 language setting — GUTTO_LANG in env, applies after shell restart)
  'group.general': 'General',
  'lang.label': 'Interface language',
  'lang.zh': '中文',
  'lang.en': 'English',
  'lang.ja': '日本語',
  'lang.ko': '한국어',
  'lang.restartHint': 'Takes effect after restarting gutto (right-click her → Quit, then reopen)',
  'lang.foot': 'Switch the interface language. Defaults to your system language; once GUTTO_LANG is set it takes precedence.',

  // Bond (v44.2 affection — level names / level-up / unlocks / streak / rare moments)
  'bond.lv.first': 'Acquainted',
  'bond.lv.friendly': 'Familiar',
  'bond.lv.close': 'Close',
  'bond.lv.soul': 'Bonded',
  'bond.group': 'Bond',
  'bond.stat.streak': '{days} days together',
  'bond.stat.together': 'Day {days} together',
  'bond.stat.progress': '{points} / {next} bond',
  'bond.stat.maxed': '{points} bond · max level',
  'bond.foot': 'Pat her, talk to her, show up daily. Bond never drops, and level-ups unlock her rare little moments.',
  'bond.levelup': 'Feels like we got closer... {name} (Lv{lv})! {unlock}',
  'bond.unlock.dance': 'Unlocked a rare moment: her little dance',
  'bond.unlock.cheer': 'Unlocked a rare moment: cheering for you',
  'bond.unlock.words': 'Unlocked her whispered words',
  'bond.streak': 'Day {days} of us together in a row',
  'bond.moment.twirl': '(snuck in a twirl while you weren\'t looking)',
  'bond.moment.hum': 'Hmm~ hmm-hm-hmm~',
  'bond.moment.proud': 'Pretty reliable today, right?',
  'bond.moment.gift': 'This heart... here, you keep it safe for now',
  'bond.moment.soulIdle': 'With you around, even naps taste sweet',
  'bond.moment.soulTogether': 'Doing nothing, just being with you. It\'s nice',

  // Bond history panel (v44.16 C-1)
  'bond.stat.best': 'Longest streak: {days} days',
  'bond.unlockAt': 'unlocks at {at}',
  'bond.milestones': 'Milestones',
  'bond.history.first': 'First met',
  'bond.history.lv': 'Reached Lv{lv}',
  'bond.history.empty': 'Every day together writes itself here',

  // Calendar specials (v44.16 C-2 — core/calendar.js, keys audited by core-calendar test)
  'special.newyear': 'Happy New Year! Counting on you again this year (≧▽≦)ﾉ',
  'special.valentine': 'V-Valentine\'s... this chocolate was spare, don\'t get any ideas! (｀・ω・´)',
  'special.halloween': 'Trick or treat! I\'m patrolling the whole desktop tonight (｀・ω・´)',
  'special.christmas': 'Merry Christmas! Stocking at the desk corner... no spoilers on what\'s inside ♪',
  'special.anniv': 'It\'s our {years}-year anniversary! Here\'s to every year ahead (｡•̀ᴗ-)✧',
  'special.days100': 'Day 100 together! May the hundredth day sparkle too ✧',
  'special.days365': 'A full year together! Thank you for every single day',

  // Feeding (v44.17 C-3 — play page button + tray; feed capped at 30/day)
  'feed.button': 'Give a treat',
  'feed.tray': 'Give her a treat',
  'feed.line1': 'A treat! Thank you for feeding me (≧▽≦)',
  'feed.line2': 'Yummy! Whoever treats me this well is the best (๑ᵔ⤙ᵔ๑)',
  'feed.capped': 'I\'m stuffed... feed me again tomorrow, okay?',

  // Context menu
  'menu.chat': 'Talk to her',
  'menu.settings': 'Settings',
  'menu.rest': 'Let her rest',
  'menu.quit': 'Clock out (quit)',

  // Tray (v44.7 A-3: the way back after resting)
  'tray.show': 'Bring her back',
  'tray.rest': 'Let her rest',

    // Logs tab
    'log.empty': 'No logs yet. Chat calls and window events land here.',
    'log.noFile': '--log-file not provided, logs unavailable',
    'log.lineCount': '{shown} lines',

    // Form extras
    'form.footer': 'Three tiers: cloud with key (DeepSeek default); local Ollama/LM Studio (leave key empty); or none — cleanup/status still work, just no chat. Key stays in ~/.gutto/env.',
    'form.testChatText': '(Settings test) you there?',
    'persona.footer': 'Markdown applies immediately — the next message uses the new card. "Restore default" deletes persona.md and returns to the repo default.',

  // Activity kind badges
  'kind.chat': 'Chat',
  'kind.clean': 'Cleanup',
  'kind.report': 'Status',
  'kind.say': 'Speech',
  'kind.anim': 'Anim',
  'kind.react': 'Mood',
  'kind.system': 'System',

  // Approval card (v42)
  'approval.title': 'Needs your call',
  'approval.meta': '{project} — {tool}',
  'approval.allow': 'Allow',
  'approval.deny': 'Deny',
  'approval.more': '{count} more waiting',
  'approval.hotkeyHint': '⇧⌘Y allow · ⇧⌘N deny',

  // Memory management (v42)
  'memory.section': 'Memory',
  'memory.total': 'Ledger: {count} entries (append-only)',
  'memory.cardOn': 'Long-term card: active (covers this session)',
  'memory.cardOff': 'Long-term card: off (old-session summary)',
  'memory.cardMissing': 'Long-term card: none yet',
  'memory.compact': 'Compress now',
  'memory.compacting': 'Compressing in background — check the card later',
  'memory.preview': 'Long-term memory card preview',

  // Character card import (v42)
  'card.import': 'Import character card…',
  'card.imported': 'Loaded "{name}" — edit, then "Save persona"',
  'card.fail': 'Card parse failed: {error}',

  // Play tab (v42.4: every feature configurable here, no hidden env)
  'tab.play': 'Play',

  // Records tab (v43.5: five tabs folded into three; activity/history/log as sub-views)
  'tab.records': 'Records',

  // Group titles (v43.11 settings redesign: card stacks → grouped rows)
  'group.chatModel': 'Chat model',
  'group.vl': 'Screen glance',
  'group.persona': 'Persona',
  'group.memory': 'Memory',
  'overview.model': 'Model',
  'overview.hooks': 'Agent link-up',
  'overview.memory': 'Memory ledger',
  'overview.hooksValue': '{on}/{total} linked',
  'overview.memValue': '{count} entries',
  'overview.noModel': 'Not set',

  // Action preview (v43.5: successor to the Swift hover tour panel + bin/gutto anim)
  'play.animTitle': 'Action preview',
  'play.animEmpty': 'No animation rows in the package (pet.json missing)',
  'play.animPlaying': 'Playing: {name}',
  'play.animTour': 'Tour all',
  'play.animTourStop': 'Stop tour',
  'play.animTourProgress': 'Tour {i}/{n}: {name}',
  'play.animTourDone': 'Tour done — all {n} rows played',
  'play.animFoot': 'Click a chip to play one full row; "Tour" plays the whole package back to back. CLI works too: gutto anim <name>.',
  'play.hooksTitle': 'Agent link-up',
  'play.hooksStatus': '{name}: {state}',
  'play.hooksOn': 'connected',
  'play.hooksOff': 'not registered',
  'play.hooksInstall': 'Register / update link-up',
  'play.hooksInstalling': 'Registering…',
  'play.hooksFoot': 'Once registered she acts while your agents work (thinking/waving rows) and holds up a card on approvals. Merges into each CLI config — additive only, backups in /tmp/gutto-hooks-backup/.',
  'play.approvalToggle': 'Blocking approval (decide on her card / ⇧⌘Y allow · ⇧⌘N deny)',
  'play.approvalTimeout': 'Wait limit (seconds, then fall back to native dialog)',
  'play.approvalFoot': 'Truly blocks for Claude / ZCode / codex (ZCode/codex need one re-registration; codex also needs a one-time /hooks trust in its TUI); the opencode plugin still notifies only. The approval card needs this shell running.',
  'play.vlTitle': 'Screen glance (she peeks and comments)',
  'play.vlFoot': 'Any OpenAI-compatible vision endpoint (independent of your chat LLM). Then type /look in the chat box and she will peek at your screen.',
  'play.vlSaved': 'Screen-glance config saved',
  'play.soundTitle': 'Sound',
  'play.sfxToggle': 'SFX (approval card / allow / deny cues)',
  'play.voiceToggle': 'Voice reports (spoken wrap-ups; voice still being tuned)',
  'play.soundFoot': 'SFX uses system sounds; voice goes through the PC TTS (off by default until the voice sounds right).',
  'play.cmdTitle': 'Custom commands',
  'play.cmdOpen': 'Open commands folder',
  'play.cmdFoot': 'Drop markdown into ~/.gutto/commands/: filename = command (explain.md → /explain), body = prompt, $ARGUMENTS substitutes. Type / in her input bar to list.',
  'play.cmdEmpty': 'No custom commands yet — drop a .md in and it appears',
  'play.saved': 'Saved',

  // Model params (v44.3, Cherry Studio parity: reasoning effort + context turns, global)
  'llm.thinkLabel': 'Thinking depth',
  'llm.thinkOff': 'Off',
  'llm.thinkLow': 'Low',
  'llm.thinkMedium': 'Medium',
  'llm.thinkHigh': 'High',
  'llm.ctxLabel': 'Context window (turns)',
  'llm.ctxHint': 'History turns carried into each request (1-40); blank/0 = auto (dynamic 8~40). Local endpoints (Ollama etc.) also pass it as num_ctx — for older endpoints set OLLAMA_CONTEXT_LENGTH on the endpoint side. Thinking depth maps to reasoning_effort (low/medium/high) for reasoning models; keep Off for regular models.',

  // Provider profiles (v42.7, after cc-switch)
  'prov.use': 'Use',
  'prov.inUse': 'Active',
  'prov.edit': 'Edit',
  'prov.add': '＋ Add provider',
  'prov.save': 'Save',
  'prov.cancel': 'Cancel',
  'prov.delete': 'Delete',
  'prov.nameLabel': 'Name',
  'prov.keyLabel': 'API Key',
  'prov.modelLabel': 'Model',
  'prov.hostLabel': 'Base URL',
  'prov.saved': 'Profile saved',
  'prov.activated': 'Switched → {name} (effective next message)',
  'prov.needName': 'Name and Base URL are required',

  // Provider preset names (round3 R-2)
  'prov.preset.imported': 'Current config (imported)',
  'prov.preset.ds': 'DeepSeek (cloud)',
  'prov.preset.local': 'Local Ollama',

  // Chat history clear (v42.9: fresh-session semantics, ledger append-only)
  'history.clear': 'Clear view (fresh session)',
  'history.cleared': 'Fresh session! Old turns stay out of the window (ledger itself is append-only in ~/.gutto)',
};
});
