// CORE · 契约解析（纯函数，零 Electron 依赖——node test 直测）。
// 三份契约文件的解析/组装，语义与 mac 壳/bash 层一字不差：
//   ~/.gutto/env            KEY=VALUE（bash source 格式）
//   ~/.gutto/chat-memory.tsv ts\trole(user|assistant)\tbase64(text)
//   ~/.gutto/activity.tsv    ts\tkind\tsummary
// 以及斜杠命令清单（gutto-chat.sh --list-commands 输出）的解析与提示过滤
// （过滤语义 = mac 壳 PetChatInputPanel.visibleHints 同款）。
'use strict';

// ── 斜杠命令清单 ────────────────────────────────────────────────

// "--list-commands" 输出：每行 name\tdescription（name 以 / 开头才收）
function parseCommandList(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('\t');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    const description = line.slice(i + 1).trim();
    if (!name.startsWith('/') || !name.slice(1)) continue;
    out.push({ name, description });
  }
  return out;
}

// 提示过滤：text 以 / 开头且还在命令段（没空格）→ 前缀匹配；进参数段不再闪列表。
// 上限 6 条 = mac 壳 hintList(prefix(6)) 同值。
function filterHints(hints, text, limit = 6) {
  if (!text.startsWith('/')) return [];
  const typed = text.split(' ')[0];
  return hints.filter((h) => h.name.startsWith(typed)).slice(0, limit);
}

// ── env（~/.gutto/env）──────────────────────────────────────────

function parseEnv(text) {
  const dict = {};
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('=');
    if (i <= 0) continue;
    dict[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return dict;
}

// 通用 env 键值 upsert（v42.4 玩法页）：changes = {KEY: value}
// value 为 null/'' → 删该键全部行；否则首处替换+去重+追加。陌生行原样保留。
// v44.10 审稿 M-3：键名白名单 + 键值剥换行（env 是 bash 层真源——键名注入
// \n 可伪造任意 env 行改写端点。与 SETTINGS_TABS/APPROVE_VERBS 同款家法）。
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

function upsertEnvKeys(oldText, changes) {
  const kept = [];
  const keys = Object.keys(changes || {}).filter((k) => ENV_KEY_RE.test(String(k)));
  const sanitized = {};
  for (const key of keys) {
    const value = changes[key];
    sanitized[key] = value == null ? '' : String(value).replace(/\r?\n/g, ' ');
  }
  const keySet = new Set(keys);
  const seen = new Set();
  for (const line of String(oldText || '').split('\n')) {
    const eq = line.indexOf('=');
    const key = eq > 0 ? line.slice(0, eq).trim() : null;
    if (key && keySet.has(key)) {
      const value = sanitized[key];
      if (!value) continue;                       // 删除
      if (seen.has(key)) continue;                // 去重
      seen.add(key);
      kept.push(`${key}=${value}`);
    } else {
      kept.push(line);
    }
  }
  for (const key of keys) {
    const value = sanitized[key];
    if (value && !seen.has(key)) kept.push(`${key}=${value}`);
  }
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  return kept.join('\n') + '\n';
}

// 保存语义 = mac 壳 PetSettingsPanelState.save()：三键替换（key 留空=沿用旧值），
// 陌生行原样保留；输出整文件文本（写盘+chmod 600 由 main 做）。
function upsertEnv(oldText, { baseUrl, apiKey, model }) {
  const old = parseEnv(oldText);
  const key = (apiKey || '').trim() || old.GUTTO_LLM_KEY || null;
  return upsertEnvKeys(oldText, {
    GUTTO_LLM_BASEURL: baseUrl || null,
    GUTTO_LLM_MODEL: model || null,
    GUTTO_LLM_KEY: key,
  });
}

// ── chat-memory.tsv ─────────────────────────────────────────────

// 严格 base64（Node 的 Buffer.from 对非法字符静默丢弃不抛错——Swift
// Data(base64Encoded:) 是返回 nil 的严格语义，这里对齐：先验字母表再解）
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function b64DecodeUtf8(s) {
  if (!B64_RE.test(s)) throw new Error('invalid base64');
  return Buffer.from(s, 'base64').toString('utf8');
}

// 取最后 limit 条（默认 60 = mac 壳 reloadHistory 同值），坏行跳过
function parseMemoryTsv(text, limit = 60) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    if (!line) continue;
    const p = line.split('\t');
    if (p.length !== 3) continue;
    if (p[1] !== 'user' && p[1] !== 'assistant') continue;
    const ts = Number(p[0]);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    let body;
    try { body = b64DecodeUtf8(p[2]); } catch (e) { continue; }
    rows.push({ ts, role: p[1], text: body });
  }
  return rows.slice(-limit);
}

// ── activity.tsv ────────────────────────────────────────────────

// 取最后 limit 条（200 = mac 壳同值）新→旧 + 按天分组（今天/昨天走字典键）。
// v44.10 审稿 M-2：更早的日期分组标题此前硬编码「M月D日」，en 界面泄漏中文——
// 调用方（main）传壳语言，en 走 en-US 数字日期（如 10/11）。
function parseActivityTsv(text, limit = 200, lang = 'zh') {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    if (!line) continue;
    const p = line.split('\t');
    if (p.length < 3) continue;
    const ts = Number(p[0]);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    rows.push({ ts, kind: p[1], summary: p.slice(2).join('\t') });
  }
  const recent = rows.slice(-limit).reverse();
  const groups = [];
  const dayKey = (d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today - that) / 86400000);
    return diff === 0 ? 'today' : diff === 1 ? 'yesterday' : null;
  };
  // ja 与 zh 同形「M月D日」（ja-JP 的 numeric 格式在 ICU 是 10/8，非本地面貌）；
  // ko「M월 D일」；en 走 en-US 数字日期。分组键都是纯展示字符串，与 today/yesterday 不撞。
  const fmt = (d) => {
    if (lang === 'en') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    if (lang === 'ko') return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;   // zh/ja
  };
  for (const row of recent) {
    const d = new Date(row.ts * 1000);
    const key = dayKey(d) || fmt(d);
    if (groups.length && groups[groups.length - 1].day === key) {
      groups[groups.length - 1].rows.push(row);
    } else {
      groups.push({ day: key, rows: [row] });
    }
  }
  return groups;
}

// ── 供应商档案（~/.gutto/providers.json，v42.7 学 cc-switch）────────
// 运行时真源仍是 env（bash 层零改动）；providers.json 只管档案与激活指针。
// sanitize：条目形状校验、id 补齐去重、每组上限 12、active 指向必须存在。

function sanitizeProviders(input) {
  const src = input || {};
  const clean = { chat: [], vl: [], chatActive: '', vlActive: '' };
  for (const group of ['chat', 'vl']) {
    const seen = new Set();
    const list = Array.isArray(src[group]) ? src[group] : [];
    for (const item of list.slice(0, 12)) {
      if (!item || typeof item !== 'object') continue;
      let id = String(item.id || '').trim();
      if (!id || seen.has(id)) id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
      seen.add(id);
      clean[group].push({
        id,
        name: String(item.name || '').slice(0, 40) || '未命名',
        baseURL: String(item.baseURL || '').slice(0, 200).trim(),
        key: String(item.key || '').slice(0, 200).trim(),
        model: String(item.model || '').slice(0, 100).trim(),
      });
    }
    const active = String(src[`${group}Active`] || '').trim();
    clean[`${group}Active`] = clean[group].some((p) => p.id === active) ? active
      : (clean[group][0] ? clean[group][0].id : '');
  }
  return clean;
}

module.exports = {
  parseCommandList,
  filterHints,
  parseEnv,
  upsertEnv,
  upsertEnvKeys,
  sanitizeProviders,
  parseMemoryTsv,
  parseActivityTsv,
};
