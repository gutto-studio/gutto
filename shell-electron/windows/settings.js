'use strict';
// 设置窗逻辑 v3（v43.13 对照 DeepSeek 稿重塑：侧栏导航+白卡+CSS 开关）：
// 三页侧栏导航 + 记录三子页段控 + 状态概览前置 + 行式条目 + 表单就地展开。
// 字符串全走 i18n 字典；样式全在 settings.html <style>（JS 零 cssText）。
// 契约文件读写全经 child-preload 走 main 的 fs。
const LANG = new URLSearchParams(location.search).get('lang') || 'zh';
document.documentElement.lang = LANG;   // 静态 zh 兜底，?lang=en 时同步
const t = window.GuttoI18N.createT(LANG);
const $ = (id) => document.getElementById(id);

// ── 侧栏导航（图标走 icons.js 单源）+ 记录子页段控 ──
const TABS = ['settings', 'play', 'records'];
const SUBS = ['activity', 'history', 'log'];
const NAV_ICONS = { settings: 'settings', play: 'play', records: 'activity' };
const seg = $('seg');
for (const tab of TABS) {
  const b = document.createElement('button');
  b.innerHTML = (window.GuttoIcons.get(NAV_ICONS[tab]) || '') + '<span class="lb"></span>';
  b.querySelector('.lb').textContent = t(`tab.${tab}`);
  b.dataset.tab = tab;
  b.onclick = () => activate(tab);
  seg.appendChild(b);
}
// 页头大标题与导航同文（tab.* 键复用，零新键）
$('ph-settings').textContent = t('tab.settings');
$('ph-play').textContent = t('tab.play');
$('ph-records').textContent = t('tab.records');
const recSub = $('recSub');
for (const sub of SUBS) {
  const b = document.createElement('button');
  b.textContent = t(`tab.${sub}`);
  b.dataset.sub = sub;
  b.onclick = () => activateSub(sub);
  recSub.appendChild(b);
}
function activateSub(sub) {
  for (const b of recSub.children) b.classList.toggle('on', b.dataset.sub === sub);
  for (const name of SUBS) $(`rec-${name}`).classList.toggle('on', name === sub);
  if (sub === 'activity') loadActivity();
  if (sub === 'history') loadHistory();
  if (sub === 'log') loadLog();
}
// activate 收 'records/log' 形态的复合页签（右键菜单直达用）
function activate(param) {
  const [tab, sub] = String(param || 'settings').split('/');
  for (const b of seg.children) b.classList.toggle('on', b.dataset.tab === tab);
  for (const name of TABS) $(`page-${name}`).classList.toggle('on', name === tab);
  if (tab === 'settings') { renderOverview(); loadProviders(); loadLLMParams(); loadPersona(); loadMemoryStats(); }
  if (tab === 'play') loadPlay();
  if (tab === 'records') activateSub(SUBS.includes(sub) ? sub : 'activity');
}
window.gutto.onSettingsTab(activate);

// ── 文案接线（组标题常驻；长说明收 ⓘ 的 title，S7）──
$('llmTitle').textContent = t('group.chatModel');
$('llmInfo').title = t('form.footer');
$('llmThinkLabel').textContent = t('llm.thinkLabel');
$('llmCtxLabel').textContent = t('llm.ctxLabel');
$('llmCtxInfo').title = t('llm.ctxHint');
$('langTitle').textContent = t('group.general');
$('langInfo').title = t('lang.foot');
$('langLabel').textContent = t('lang.label');
$('plVlTitle').textContent = t('group.vl');
$('plVlInfo').title = t('play.vlFoot');
$('personaTitle').textContent = t('group.persona');
$('personaInfo').title = t('persona.footer');
$('memTitle').textContent = t('group.memory');
$('plBondTitle').textContent = t('bond.group');       // v44.3 羁绊组（玩法页头牌）
$('plBondInfo').title = t('bond.foot');
// 投喂（v44.17 C-3）：羁绊卡头按钮 → 壳侧记账+演出（反馈在宠气泡，不占本窗状态行）
$('plFeed').textContent = t('feed.button');
$('plFeed').onclick = () => window.gutto.feedPet();
$('plAnimTitle').textContent = t('play.animTitle');
$('plAnimInfo').title = t('play.animFoot');
$('plHooksTitle').textContent = t('play.hooksTitle');
$('plHooksInfo').title = t('play.hooksFoot');
$('plApprovalLabel').textContent = t('play.approvalToggle');
$('plApprovalLabel').title = t('play.approvalFoot');
$('plApprovalTimeoutLabel').textContent = t('play.approvalTimeout');
$('plSoundTitle').textContent = t('play.soundTitle');
$('plSoundInfo').title = t('play.soundFoot');
$('plSfxLabel').textContent = t('play.sfxToggle');
$('plVoiceLabel').textContent = t('play.voiceToggle');
$('plCmdTitle').textContent = t('play.cmdTitle');
$('plCmdInfo').title = t('play.cmdFoot');
$('provChatAdd').textContent = t('prov.add');
$('provVlAdd').textContent = t('prov.add');
$('test').textContent = t('form.testChat');
$('test').onclick = () => window.gutto.submit(t('form.testChatText'));
$('pSave').textContent = t('persona.save');
$('pImport').textContent = t('card.import');
$('memCompact').textContent = t('memory.compact');
$('plHooksInstall').textContent = t('play.hooksInstall');
$('plCmdOpen').textContent = t('play.cmdOpen');
$('plAnimTour').textContent = t('play.animTour');
$('actEmpty').textContent = t('activity.empty');
$('hisEmpty').textContent = t('history.empty');
$('logEmpty').textContent = t('log.empty');
$('actRefresh').textContent = t('common.refresh');
$('hisRefresh').textContent = t('common.refresh');
$('logRefresh').textContent = t('common.refresh');
$('hisClear').textContent = t('history.clear');
// v44.10 审稿 M-4：logRefresh 此前只设了文案没接行为（死按钮）；日志是滚动环
// 无「总数」概念，计数退单值（{shown} 行），不再渲染恒等的 N / N
$('logRefresh').onclick = () => loadLog();

// ⓘ 补充说明可及（审稿打磨）：title 纯视觉键盘够不着——同步进 aria-label 给读屏；
// 须在上方全部 .title 赋值之后跑
document.querySelectorAll('.info[title]').forEach((el) => el.setAttribute('aria-label', el.title));

// ── S4 状态概览条：当前模型 · agent 联动 · 记忆账本（打开设置页 1 秒内可见）──
let providers = { chat: [], vl: [], chatActive: '', vlActive: '' };

function hostOf(url) {
  try { return new URL(url).host; } catch (e) { return url || '—'; }
}

async function renderOverview() {
  const box = $('overview');
  const [provR, hooksR, memR] = await Promise.all([
    window.gutto.read('providers'),
    window.gutto.read('hooksStatus'),
    window.gutto.read('memoryStats'),
  ]);
  if (provR.ok) providers = provR.providers;
  const chat = providers.chat.find((p) => p.id === providers.chatActive);
  const model = chat ? (chat.model ? `${chat.model} · ${hostOf(chat.baseURL)}` : hostOf(chat.baseURL))
    : t('overview.noModel');
  const hooksKeys = ['zcode', 'claude', 'codex', 'opencode'];
  const onCount = hooksR.ok ? hooksKeys.filter((k) => hooksR[k]).length : 0;
  box.hidden = false;
  box.replaceChildren();
  const cells = [
    [t('overview.model'), model],
    [t('overview.hooks'), hooksR.ok ? t('overview.hooksValue', { on: onCount, total: hooksKeys.length }) : '—'],
    [t('overview.memory'), memR.ok ? t('overview.memValue', { count: memR.total }) : '—'],
  ];
  for (const [k, v] of cells) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const ke = document.createElement('div');
    ke.className = 'k';
    ke.textContent = k;
    const ve = document.createElement('div');
    ve.className = 'v';
    ve.textContent = v;
    ve.title = v;
    cell.append(ke, ve);
    box.appendChild(cell);
  }
}

// ── 供应商分组（S2 行式条目 + S3 就地编辑）──
function provMeta(p) {
  const bits = [hostOf(p.baseURL)];
  if (p.model) bits.push(p.model);
  if (p.key) bits.push('key ✓');
  return bits.join(' · ');
}

function renderProvList(containerId, group) {
  const box = $(containerId);
  box.replaceChildren();
  const list = providers[group];
  const active = providers[`${group}Active`];
  for (const p of list) {
    const on = p.id === active;
    const row = document.createElement('div');
    row.className = on ? 'item active' : 'item';
    row.dataset.id = p.id;
    const dot = document.createElement('span');
    dot.className = 'dot';
    const txt = document.createElement('div');
    txt.className = 'txt';
    const main = document.createElement('div');
    main.className = 'main';
    main.textContent = p.name;
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = provMeta(p);
    txt.append(main, sub);
    const ops = document.createElement('div');
    ops.className = 'ops';
    if (on) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t('prov.inUse');
      ops.appendChild(tag);
    } else {
      const use = document.createElement('button');
      use.className = 'chip-btn';
      use.dataset.act = 'use';
      use.textContent = t('prov.use');
      use.onclick = () => activateProv(group, p.id);
      ops.appendChild(use);
    }
    const edit = document.createElement('button');
    edit.className = 'chip-btn';
    edit.dataset.act = 'edit';
    edit.textContent = t('prov.edit');
    edit.onclick = () => renderProvForm(box, group, p);
    ops.appendChild(edit);
    row.append(dot, txt, ops);
    box.appendChild(row);
  }
}

function renderProvForm(box, group, item) {
  // 就地编辑：表单展开在被编辑行正下方（S3）；新增=列表末尾。一次只开一张。
  box.querySelectorAll('.item-form').forEach((el) => el.remove());
  const isNew = !item;
  const p = item || { id: '', name: '', baseURL: '', key: '', model: '' };
  const form = document.createElement('div');
  form.className = 'item-form';
  const fields = [
    ['prov.nameLabel', 'name', p.name, ''],
    ['prov.hostLabel', 'baseURL', p.baseURL, 'https://…/v1'],
    ['prov.keyLabel', 'key', '', p.key ? `…${p.key.slice(-4)}` : ''],
    ['prov.modelLabel', 'model', p.model, ''],
  ];
  const inputs = {};
  for (const [labelKey, field, value, ph] of fields) {
    const frow = document.createElement('div');
    frow.className = 'frow';
    const label = document.createElement('label');
    label.textContent = t(labelKey);
    const input = document.createElement('input');
    input.className = field === 'key' ? 'field pwd' : 'field';
    input.value = value;
    if (ph) input.placeholder = ph;
    if (field === 'key') input.type = 'password';
    inputs[field] = input;
    frow.append(label, input);
    form.appendChild(frow);
  }
  const actions = document.createElement('div');
  actions.className = 'frow';
  const save = document.createElement('button');
  save.className = 'btn sm';
  save.textContent = t('prov.save');
  save.onclick = async () => {
    const name = inputs.name.value.trim();
    const baseURL = inputs.baseURL.value.trim();
    if (!name || !baseURL) { setStatus(group, t('prov.needName')); return; }
    const entry = {
      id: p.id || `p${Date.now().toString(36)}`,
      name, baseURL,
      key: inputs.key.value.trim() || p.key,
      model: inputs.model.value.trim(),
    };
    if (isNew) providers[group].push(entry);
    else providers[group] = providers[group].map((x) => (x.id === p.id ? entry : x));
    const r = await window.gutto.saveProviders(providers);
    if (r.ok) providers = r.providers;
    // UX-1（round4）：失败不得报成功；本地 state 回读对齐（防幽灵条目被下次
    // 无关的成功保存顺手带进盘，审稿 P2-1）
    if (r.ok) {
      setStatus(group, t('prov.saved'));
    } else {
      const rr = await window.gutto.read('providers');
      if (rr.ok) providers = rr.providers;
      setStatus(group, t('common.saveFailed', { error: r.error || '' }));
    }
    rerenderProv(group);
  };
  const cancel = document.createElement('button');
  cancel.className = 'btn ghost sm';
  cancel.textContent = t('prov.cancel');
  cancel.onclick = () => rerenderProv(group);
  actions.append(save, cancel);
  if (!isNew) {
    const del = document.createElement('button');
    del.className = 'btn danger-ghost sm';
    del.textContent = t('prov.delete');
    del.onclick = async () => {
      providers[group] = providers[group].filter((x) => x.id !== p.id);
      const r = await window.gutto.saveProviders(providers);
      if (r.ok) {
        providers = r.providers;
      } else {
        // 删除失败：行不能从 UI 消失装成功（盘上还在，审稿 P2-1 同款回读）
        const rr = await window.gutto.read('providers');
        if (rr.ok) providers = rr.providers;
        setStatus(group, t('common.saveFailed', { error: r.error || '' }));
      }
      rerenderProv(group);
    };
    actions.appendChild(del);
  }
  form.appendChild(actions);
  if (item) {
    const row = box.querySelector(`.item[data-id="${CSS.escape(item.id)}"]`);
    if (row) row.insertAdjacentElement('afterend', form);
    else box.appendChild(form);
  } else {
    box.appendChild(form);
  }
  inputs.name.focus();
}

function setStatus(group, text) {
  $(group === 'vl' ? 'provVlStatus' : 'provChatStatus').textContent = text;
}

function rerenderProv(group) {
  renderProvList(group === 'vl' ? 'provVl' : 'provChat', group);
}

async function activateProv(group, id) {
  const r = await window.gutto.activateProvider(group, id);
  if (r.ok) {
    providers = r.providers;
    const hit = providers[group].find((x) => x.id === id);
    setStatus(group, t('prov.activated', { name: hit ? hit.name : id }));
    rerenderProv(group);
    renderOverview();   // 概览的「当前模型」跟手
  } else {
    setStatus(group, t('common.saveFailed', { error: r.error || '' }));   // UX-1：切换失败不静默
  }
}

async function loadProviders() {
  const r = await window.gutto.read('providers');
  if (r.ok) providers = r.providers;
  rerenderProv('chat');
  rerenderProv('vl');
}

// ── 模型参数（v44.3 对标 Cherry Studio：思考深度 + 上下文窗口，全局档）──
const THINK_LEVELS = [['off', 'llm.thinkOff'], ['low', 'llm.thinkLow'],
                      ['medium', 'llm.thinkMedium'], ['high', 'llm.thinkHigh']];

function buildThinkChips(current) {
  const box = $('llmThinkChips');
  box.replaceChildren();
  for (const [value, key] of THINK_LEVELS) {
    const chip = document.createElement('button');
    chip.className = value === current ? 'chip-btn sel' : 'chip-btn';
    chip.dataset.v = value;
    chip.textContent = t(key);
    chip.onclick = async () => {
      buildThinkChips(value);
      await window.gutto.saveEnvKeys({ GUTTO_LLM_THINK: value === 'off' ? '' : value });
    };
    box.appendChild(chip);
  }
}

async function loadLLMParams() {
  const envRaw = await window.gutto.read('env');
  const dict = envRaw.ok ? parseEnvText(envRaw.text) : {};
  applyThinkLevel(dict.GUTTO_LLM_THINK || 'off');
  $('llmCtx').value = dict.GUTTO_LLM_CTX || '';
}

function applyThinkLevel(v) { buildThinkChips(['low', 'medium', 'high'].includes(v) ? v : 'off'); }

$('llmCtx').onchange = async () => {
  const v = Math.max(0, Math.min(40, parseInt($('llmCtx').value, 10) || 0));
  $('llmCtx').value = v || '';
  await window.gutto.saveEnvKeys({ GUTTO_LLM_CTX: v > 0 ? String(v) : '' });
};

// ── 界面语言（v44.10）：GUTTO_LANG 写 env，重启壳生效（main 启动时一次性判定）。
// 选中态=本窗实际生效语言（query lang），点同款是 no-op，点异款保存+提示重启。
const LANG_OPTS = [['zh', 'lang.zh'], ['en', 'lang.en'], ['ja', 'lang.ja'], ['ko', 'lang.ko']];

function buildLangChips(current) {
  const box = $('langChips');
  box.replaceChildren();
  for (const [value, key] of LANG_OPTS) {
    const chip = document.createElement('button');
    chip.className = value === current ? 'chip-btn sel' : 'chip-btn';
    chip.dataset.v = value;
    chip.textContent = t(key);
    chip.onclick = async () => {
      if (value === current) return;
      buildLangChips(value);
      await window.gutto.saveEnvKeys({ GUTTO_LANG: value });
      $('langHint').textContent = t('lang.restartHint');
    };
    box.appendChild(chip);
  }
}
buildLangChips(LANG);   // LANG = 本窗 query 的生效语言；env 有无 GUTTO_LANG 不影响显示

$('provChatAdd').onclick = () => renderProvForm($('provChat'), 'chat', null);
$('provVlAdd').onclick = () => renderProvForm($('provVl'), 'vl', null);
loadProviders();

// ── 人设卡 ──
let personaCustom = false;
async function loadPersona() {
  const custom = await window.gutto.read('persona');
  personaCustom = custom.ok;
  $('persona').value = custom.ok ? custom.text : '';
  $('pRevert').textContent = personaCustom ? t('persona.revert') : t('persona.loadDraft');
}
$('pSave').onclick = async () => {
  const r = await window.gutto.savePersona($('persona').value);
  // UX-1：人设保存同样不假成功（写失败时旧卡仍在用）
  $('pStatus').textContent = r.ok ? t('persona.saved')
    : t('common.saveFailed', { error: r.error || '' });
  loadPersona();
};
$('pRevert').onclick = async () => {
  if (personaCustom) {
    const r = await window.gutto.revertPersona();
    // 审稿 P2-2：还原也是破坏性写——失败不假报「已还原」（同 UX-1 第五处）
    $('pStatus').textContent = r.ok ? t('persona.reverted')
      : t('common.saveFailed', { error: r.error || '' });
    if (r.ok) personaCustom = false;
  } else {
    const draft = await window.gutto.read('personaDefault');
    $('persona').value = draft.ok ? draft.text : '';
    $('pStatus').textContent = draft.ok ? t('persona.draftLoaded') : t('persona.draftMissing');
  }
};
loadPersona();

// v42 导入角色卡（SillyTavern JSON/PNG）——进编辑器预览，保存才落盘
$('pImport').onclick = async () => {
  const r = await window.gutto.importCard();
  if (r.ok) {
    $('persona').value = r.text;
    $('pStatus').textContent = t('card.imported', { name: r.name || '?' });
  } else if (!r.canceled) {
    $('pStatus').textContent = t('card.fail', { error: r.error || '?' });
  }
};

// ── 记忆（S7：readout 只读结论替 readonly textarea）──
async function loadMemoryStats() {
  const r = await window.gutto.read('memoryStats');
  if (!r.ok) return;
  const cardState = r.hasSummary
    ? (r.compactAt > r.freshAt ? t('memory.cardOn') : t('memory.cardOff'))
    : t('memory.cardMissing');
  $('memStats').textContent = `${t('memory.total', { count: r.total })} · ${cardState}`;
  $('memSummary').textContent = r.hasSummary ? r.summary : '—';
}
$('memCompact').onclick = async () => {
  const r = await window.gutto.compactNow();
  if (r.ok) {
    $('memStats').textContent = t('memory.compacting');
    setTimeout(loadMemoryStats, 4000);
  }
};

// ── 操作记录 ──（配色令牌在 settings.html 的 .badge[data-kind] 选择器）
async function loadActivity() {
  const r = await window.gutto.read('activity');
  const groups = r.ok ? r.groups : [];
  $('actEmpty').style.display = groups.length ? 'none' : 'block';
  const list = $('actList');
  list.replaceChildren();
  let count = 0;
  for (const g of groups) {
    const day = document.createElement('div');
    day.className = 'day';
    day.textContent = g.day === 'today' ? t('activity.today')
      : g.day === 'yesterday' ? t('activity.yesterday') : g.day;
    list.appendChild(day);
    for (const row of g.rows) {
      count += 1;
      const item = document.createElement('div');
      item.className = 'act';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.dataset.kind = row.kind;
      badge.textContent = t(`kind.${row.kind}`) !== `kind.${row.kind}`
        ? t(`kind.${row.kind}`) : t('kind.system');
      const body = document.createElement('div');
      body.className = 'grow';
      const when = document.createElement('div');
      when.className = 'when';
      when.textContent = new Date(row.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const txt = document.createElement('div');
      txt.className = 'txt';
      txt.textContent = row.summary;
      body.append(when, txt);
      item.append(badge, body);
      list.appendChild(item);
    }
  }
  $('actCount').textContent = count ? `${count}` : '';
}

// ── 聊天记录 ──
$('hisClear').onclick = async () => {
  const r = await window.gutto.clearHistory();
  if (r.ok) {
    $('hisCount').textContent = t('history.cleared');
    loadHistory();
  }
};
async function loadHistory() {
  const r = await window.gutto.read('memory');
  const rows = r.ok ? r.rows : [];
  $('hisEmpty').style.display = rows.length ? 'none' : 'block';
  const list = $('hisList');
  list.replaceChildren();
  for (const row of rows) {
    const isUser = row.role === 'user';
    const wrap = document.createElement('div');
    wrap.className = `hrow ${isUser ? 'me' : 'her'}`;
    const head = document.createElement('div');
    head.className = `hhead ${isUser ? 'me' : 'her'}`;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = isUser ? t('history.me') : t('history.her');
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = ' ' + new Date(row.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    head.append(who, when);
    const body = document.createElement('div');
    body.className = 'hbody';
    body.textContent = row.text;
    wrap.append(head, body);
    list.appendChild(wrap);
  }
  $('hisCount').textContent = rows.length ? t('history.recentCount', { count: rows.length }) : '';
}

// ── 日志 ──
async function loadLog() {
  const lines = await window.gutto.logLines();
  $('logEmpty').style.display = lines.length ? 'none' : 'block';
  const list = $('logList');
  list.replaceChildren();
  for (const line of lines) {
    const el = document.createElement('div');
    el.className = 'logline';
    el.textContent = line;
    list.appendChild(el);
  }
  $('logCount').textContent = t('log.lineCount', { shown: lines.length });
}

// ── 动作预览（v43.5；v43.11 并入分组骨架）──
let animRows = [];        // [{name, hold}]——manifest 行名+单行全长秒
let tourTimer = null;
let tourIndex = -1;

async function loadAnimRows() {
  if (animRows.length) return;
  const r = await window.gutto.read('manifest');
  if (!r.ok || !r.rows || !r.rows.length) return;
  animRows = r.rows.map((row) => ({
    name: row.animation,
    hold: Math.max(2, Math.min(12, row.lengthMs / 1000 + 0.5)),
  }));
}

function buildAnimChips() {
  const box = $('plAnimChips');
  box.replaceChildren();
  for (const row of animRows) {
    const chip = document.createElement('button');
    chip.className = 'chip-btn';
    chip.dataset.anim = row.name;
    chip.textContent = row.name;
    chip.onclick = () => previewAnim(row.name);
    box.appendChild(chip);
  }
  if (!animRows.length) {
    const empty = document.createElement('span');
    empty.className = 'status';
    empty.textContent = t('play.animEmpty');
    box.appendChild(empty);
  }
}

function previewAnim(name) {
  const row = animRows.find((r) => r.name === name);
  if (!row) return;
  window.gutto.playRow(name, row.hold);
  for (const chip of $('plAnimChips').children) {
    chip.classList.toggle('live', chip.dataset.anim === name);
  }
  $('plAnimStatusRow').textContent = t('play.animPlaying', { name });
}

function stopTour() {
  clearTimeout(tourTimer);
  tourTimer = null;
  tourIndex = -1;
  $('plAnimTour').textContent = t('play.animTour');
}

function tourStep() {
  if (tourIndex >= animRows.length) {
    $('plAnimStatusRow').textContent = t('play.animTourDone', { n: animRows.length });
    stopTour();
    return;
  }
  const row = animRows[tourIndex];
  previewAnim(row.name);
  $('plAnimStatusRow').textContent = t('play.animTourProgress',
    { i: tourIndex + 1, n: animRows.length, name: row.name });
  tourIndex += 1;
  tourTimer = setTimeout(tourStep, row.hold * 1000 + 400);
}

$('plAnimTour').onclick = () => {
  if (tourTimer) { stopTour(); return; }
  if (!animRows.length) return;
  tourIndex = 0;
  $('plAnimTour').textContent = t('play.animTourStop');
  tourStep();
};

// ── 玩法页：env 现值 → 开关/字段；hooks 注册态 → .tag ──
function parseEnvText(text) {
  const dict = {};
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) dict[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return dict;
}

async function loadPlay() {
  await loadAnimRows();
  buildAnimChips();
  // v44.3 羁绊条：Lv 名 · 进度 · 连访天数（一行读数，别做第二个仪表盘）
  // v44.16 C-1：+ 羁绊史（最长连访/解锁清单/里程碑时间线——数据全在 bond.json）
  {
    const b = await window.gutto.read('bond');
    if (b.ok) {
      const prog = b.next
        ? t('bond.stat.progress', { points: b.points, next: b.next })
        : t('bond.stat.maxed', { points: b.points });
      $('plBondStats').textContent =
        `Lv${b.lv} ${t(b.nameKey)} · ${prog} · ${t('bond.stat.streak', { days: b.streak })}`
        + ` · ${t('bond.stat.together', { days: b.daysTogether || 1 })}`;
      const hist = $('plBondHistory');
      hist.hidden = false;
      $('plBondBest').textContent = t('bond.stat.best', { days: b.bestStreak || 1 });
      // 解锁清单：达成的亮 sel，未达成的灰态 + 门槛分数
      const uBox = $('plBondUnlocks');
      uBox.replaceChildren();
      for (const u of b.unlocks || []) {
        const chip = document.createElement('span');
        chip.className = 'chip-btn' + (u.done ? ' sel' : '');
        chip.textContent = u.done ? t(u.key) : `${t(u.key)} · ${t('bond.unlockAt', { at: u.at })}`;
        uBox.appendChild(chip);
      }
      // 里程碑时间线：初遇在顶 + 升级事件新→旧（main 已倒序，直渲染；最多 9 条）
      // 日期口径与活动页同源（parse.js fmt：en 数字 / ko 월일 / zh·ja 月日）
      const fmtDate = (iso) => {
        const d = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(d.getTime())) return iso;
        if (LANG === 'en') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        if (LANG === 'ko') return `${d.getMonth() + 1}월 ${d.getDate()}일`;
        return `${d.getMonth() + 1}月${d.getDate()}日`;   // zh/ja 同形
      };
      const items = [];
      if (b.firstSeen) items.push({ d: b.firstSeen, text: t('bond.history.first') });
      for (const h of b.history || []) items.push({ d: h.d, text: t('bond.history.lv', { lv: h.lv }) });
      $('plBondHistTitle').textContent = t('bond.milestones');
      const list = $('plBondHistList');
      list.replaceChildren();
      if (!items.length) {
        list.textContent = t('bond.history.empty');
      } else {
        for (const it of items.slice(0, 9)) {
          const row = document.createElement('div');
          const d = document.createElement('span');
          d.className = 'd';
          d.textContent = fmtDate(it.d);
          row.appendChild(d);
          row.appendChild(document.createTextNode(it.text));
          list.appendChild(row);
        }
      }
    }
  }
  const envRaw = await window.gutto.read('env');
  const dict = envRaw.ok ? parseEnvText(envRaw.text) : {};
  $('plApproval').checked = dict.GUTTO_APPROVAL === '1';
  $('plApprovalTimeout').value = dict.GUTTO_APPROVAL_TIMEOUT || 60;
  $('plSfx').checked = dict.GUTTO_SFX !== '0';    // 默认开
  $('plVoice').checked = dict.GUTTO_VOICE === '1'; // 默认关

  const hs = await window.gutto.read('hooksStatus');
  const chips = $('plHooksChips');
  chips.replaceChildren();
  if (hs.ok) {
    for (const [name, on] of [['ZCode', hs.zcode], ['Claude', hs.claude],
                              ['codex', hs.codex], ['opencode', hs.opencode]]) {
      const chip = document.createElement('span');
      chip.className = on ? 'tag ok' : 'tag off';
      chip.textContent = t('play.hooksStatus', {
        name, state: on ? t('play.hooksOn') : t('play.hooksOff'),
      });
      chips.appendChild(chip);
    }
  }

  const cmds = await window.gutto.read('commands');
  const list = $('plCmdList');
  list.replaceChildren();
  if (cmds.ok && cmds.commands.length) {
    for (const c of cmds.commands) {
      const div = document.createElement('div');
      div.className = 'cmd';
      const name = document.createElement('span');
      name.className = 'cname';
      name.textContent = c.name;
      const desc = document.createElement('span');
      desc.className = 'cmd-desc';
      desc.textContent = c.desc || t('chat.commandFallbackDesc');
      div.append(name, desc);
      list.appendChild(div);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = t('play.cmdEmpty');
    list.appendChild(empty);
  }
}

// 开关：改了就存（value '' 即删键回落默认）
async function saveKey(key, on) {
  await window.gutto.saveEnvKeys({ [key]: on ? '1' : '' });
}
$('plApproval').onchange = () => saveKey('GUTTO_APPROVAL', $('plApproval').checked);
// v44.10 审稿 H-1：SFX 写显形 '1'/'0'（默认开，键缺席=开）——旧协议写 '' 删键，
// 读侧（main sfx）却找 '0'，开关两头死。写读两端现同操一套形状。
$('plSfx').onchange = () => window.gutto.saveEnvKeys({ GUTTO_SFX: $('plSfx').checked ? '1' : '0' });
$('plVoice').onchange = () => saveKey('GUTTO_VOICE', $('plVoice').checked);
$('plApprovalTimeout').onchange = async () => {
  const v = Math.max(10, Math.min(110, parseInt($('plApprovalTimeout').value, 10) || 60));
  $('plApprovalTimeout').value = v;
  await window.gutto.saveEnvKeys({ GUTTO_APPROVAL_TIMEOUT: String(v) });
};

$('plHooksInstall').onclick = async () => {
  $('plHooksStatusRow').textContent = t('play.hooksInstalling');
  const r = await window.gutto.runHooksInstall();
  $('plHooksStatusRow').textContent = r.ok ? t('play.saved') : (r.tail || 'fail').slice(0, 200);
  loadPlay();   // 刷新注册状态
};

$('plCmdOpen').onclick = () => window.gutto.openCommandsFolder();

// 初始页签：菜单直达带 ?tab=（支持 'records/log' 复合；settings-tab IPC 是已开窗的复用路径）
{
  const initial = new URLSearchParams(location.search).get('tab');
  activate(initial && TABS.includes(initial.split('/')[0]) ? initial : 'settings');
}
