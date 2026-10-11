// 台词语言表看守（round3 R-1/E-1/E-3 收口护栏）：node test/lines-i18n.test.js
// 验证：①scripts/lines/{zh,en,ja,ko}.json 四表键集镜像 + 值非空（i18n-guide §6 T1）
// ②占位符 {name} 集合逐键四语一致（§6 T2 口径）③gutto_lines.py 解析器实跑
// （GUTTO_LANG 判定 / env 文件源 / 回退链 / 插值 / 缺参保占位）
// ④四个消费文件无裸 CJK 用户文案（注释与 CLI usage 白名单带缘由，engineering §3）
// ⑤main.js 的 t('字面量键') 必须在 zh 真源在册（动态拼接键本就禁用，§2.2）。
// 扫描器三个已知盲区（审稿 P2-3 登记；本测试是事故拉线非铁闸，绿→红→带缘由加白）：
//   a) 行级扫描逐行复位状态——跨行模板字面量/续行里的 CJK 漏扫；
//   b) 含引号的正则字面量会伪造引号态，可能吞掉或虚构违章；
//   c) 白名单按子串豁免——真违章若含白名单短语即被放过。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LINES_DIR = path.join(ROOT, 'scripts', 'lines');
const LINES_PY = path.join(ROOT, 'scripts', 'gutto_lines.py');
const CJK = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/; // 汉字/假名/谚文

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// ── ① 四表镜像 + 值非空（zh 为基准真源，多键/漏键都点名）──────────────
const tables = {};
for (const lang of ['zh', 'en', 'ja', 'ko']) {
  tables[lang] = JSON.parse(fs.readFileSync(path.join(LINES_DIR, `${lang}.json`), 'utf8'));
}
const zk = Object.keys(tables.zh).sort();
assert(zk.length >= 40, `zh 基准非空（${zk.length} 键）`);
for (const lang of ['en', 'ja', 'ko']) {
  const dk = Object.keys(tables[lang]).sort();
  const missing = zk.filter((k) => !(k in tables[lang]));
  const extra = dk.filter((k) => !(k in tables.zh));
  assert(zk.length === dk.length && !missing.length && !extra.length,
    `${lang} 键集与 zh 完全一致（${dk.length} 键）` +
    (missing.length ? `，缺：${missing.join(',')}` : '') +
    (extra.length ? `，多：${extra.join(',')}` : ''));
  const empties = Object.keys(tables[lang]).filter((k) => !tables[lang][k]);
  assert(!empties.length, `${lang} 无空值`);
}

// ── ② 占位符逐键四语一致（占位符不得翻译，i18n-guide §5.3）────────────
{
  const placeholders = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
  const bad = [];
  for (const key of zk) {
    const want = placeholders(tables.zh[key]);
    for (const lang of ['en', 'ja', 'ko']) {
      if (placeholders(tables[lang][key]) !== want) bad.push(`${key}[${lang}]`);
    }
  }
  assert(!bad.length, `占位符四语一致${bad.length ? `，歪：${bad.join(',')}` : ''}`);
}

// ── ③ 解析器实跑（python3 subprocess：语言判定/插值/回退链）───────────
function runLines(args, envExtra) {
  const r = spawnSync('python3', [LINES_PY, ...args], {
    env: { ...process.env, ...envExtra }, encoding: 'utf8', timeout: 15000,
  });
  return { status: r.status, out: (r.stdout || '').replace(/\n$/, '') };
}
{
  const en = runLines(['hook.stopBody', 'project=demo'], { GUTTO_LANG: 'en' });
  assert(en.status === 0 && en.out === 'demo\'s session just wrapped up. Praise me!',
    `GUTTO_LANG=en 插值实跑（实际 "${en.out}"）`);
  const ja = runLines(['greeting.morning'], { GUTTO_LANG: 'ja' });
  assert(ja.out === tables.ja['greeting.morning'], 'GUTTO_LANG=ja 直取');
  const ko = runLines(['goodnight.mix.1', 'ok=3', 'bad=2'], { GUTTO_LANG: 'ko' });
  assert(ko.out.includes('3') && ko.out.includes('2') && ko.out === tables.ko['goodnight.mix.1']
    .replace('{ok}', '3').replace('{bad}', '2'), 'GUTTO_LANG=ko 双参插值');

  // env 文件源（设置页写入口；GUTTO_LANG 环境变量缺席时生效）+ 沙箱隔离
  // GUTTO_LANG:'' = 压掉 process.env 可能的导出（'' 不在 LANGS → 落 env 文件，
  // 审稿 P2-1：否则开发者 shell 带 GUTTO_LANG 时本用例假阴）
  const home = path.join(os.tmpdir(), `gutto-lines-home-${process.pid}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'env'), 'GUTTO_LANG=ko\n', 'utf8');
  const viaFile = runLines(['title.mutter'], { GUTTO_TEST_HOME: home, GUTTO_LANG: '' });
  assert(viaFile.out === tables.ko['title.mutter'], 'env 文件 GUTTO_LANG=ko 生效（与壳同源）');
  fs.rmSync(home, { recursive: true, force: true });

  // 回退链：未知语言 → zh；两表都缺 → 键名（显性失败）
  // 审稿 P1-1：必须配空沙箱——否则非法 env 值继续落到真实 ~/.gutto/env，
  // 主人设置页切语言当天本断言就红（语言链 env 变量 → env 文件 → zh）
  const empty = path.join(os.tmpdir(), `gutto-lines-empty-${process.pid}`);
  fs.rmSync(empty, { recursive: true, force: true });
  fs.mkdirSync(empty, { recursive: true });
  const frKey = runLines(['no.such.key'], { GUTTO_LANG: 'fr', GUTTO_TEST_HOME: empty });
  assert(frKey.out === 'no.such.key', '未知语言 + 缺键 → 键名');
  const fr = runLines(['greeting.noon'], { GUTTO_LANG: 'fr', GUTTO_TEST_HOME: empty });
  assert(fr.out === tables.zh['greeting.noon'], '未知语言回退 zh 真源');
  fs.rmSync(empty, { recursive: true, force: true });
  const missing = runLines(['goodnight.ok.1'], { GUTTO_LANG: 'en' });
  assert(missing.out.includes('{ok}'), '缺参保留占位（半成品可见，同 createT）');

  // 审稿 P2-4 护栏：approvalReason 直进 hook 的 printf JSON——四语值禁含 "/\
  {
    const bad = [];
    for (const lang of ['zh', 'en', 'ja', 'ko']) {
      if (/["\\\n]/.test(tables[lang]['hook.approvalReason'])) bad.push(lang);
    }
    assert(!bad.length, `hook.approvalReason 无 JSON 破坏字符${bad.length ? `：${bad.join(',')}` : ''}`);
  }
}

// ── ④ 消费文件裸 CJK 扫描（行级引号态机；白名单 Set + 缘由）────────────
// 行内引号态机：追踪 '/"/`（js 含反引号），\ 转义；引号内出现 CJK 即违章。
// 注释天然在引号外（中文注释是家规不管）；py 先剥三引号 docstring 再扫。
function stripPyDocstrings(src) {
  return src.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '""');
}
function stripJsBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}
function cjkInQuotedSpans(src, { backtick = false } = {}) {
  const hits = [];
  src.split('\n').forEach((raw, i) => {
    let state = null;
    let buf = '';
    for (let p = 0; p < raw.length; p += 1) {
      const ch = raw[p];
      if (state) {
        if (ch === '\\' && state !== "'") { p += 1; continue; } // 单引号无转义(POSIX sh/py)
        if (ch === state) {
          state = null;
          if (CJK.test(buf)) hits.push({ line: i + 1, text: buf.trim() });
          buf = '';
        } else buf += ch;
      } else if (ch === "'" || ch === '"' || (backtick && ch === '`')) {
        state = ch;
      }
    }
  });
  return hits;
}
{
  // 白名单条目：命中全文包含该子串即豁免——每条必须带缘由（engineering §3）
  const WHITELIST = {
    'bin/gutto': [
      ['打开设置窗', 'CLI usage 帮助文本——开发者面向，不进用户台词表'],
      ['和她聊天', 'CLI usage 帮助文本——开发者面向'],
      ['武装她的右键', 'CLI chatui 兼容提示——stderr 开发者面向'],
      ['无需武装', 'CLI chatui 兼容提示——stderr 开发者面向'],
      ['TTL秒', 'CLI usage 参数说明——开发者面向'],
      ['TTL 秒', 'CLI usage 参数说明（间隔写法）——开发者面向'],
    ],
    'scripts/agent-hook.sh': [],
    'scripts/gutto-life.py': [
      ['时刻覆盖', 'argparse --now 帮助文本（测试用参数）——开发者面向'],
      ['不落状态文件', 'argparse --dry 帮助文本——开发者面向'],
    ],
    'shell-electron/main.js': [
      ['在吗？', 'autotest 输入探针（GUTTO_SHELL_AUTOTEST=1 专用，非用户文案）'],
      ['自动验收', 'autotest 审批假入队摘要（同上）'],
      ['跟拍验收', 'autotest 跟拍验收气泡（同上）'],
      ['特别特别长', 'autotest U-2 省略号截断假数据（同上）'],
      ["indexOf('设置')", 'autotest 图标条菜单点击探针（同上）'],
      ['半升级或裁剪包', 'shell.log 诊断行（工程排障面向，日志页非台词面）'],
    ],
  };
  const SCAN = [
    ['scripts/agent-hook.sh', { file: 'scripts/agent-hook.sh', strip: (s) => s, backtick: false }],
    ['bin/gutto', { file: 'bin/gutto', strip: (s) => s, backtick: false }],
    ['scripts/gutto-life.py', { file: 'scripts/gutto-life.py', strip: stripPyDocstrings, backtick: false }],
    ['shell-electron/main.js', { file: 'shell-electron/main.js', strip: stripJsBlockComments, backtick: true }],
  ];
  for (const [label, { file, strip, backtick }] of SCAN) {
    const src = strip(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const rules = WHITELIST[label] || [];
    const offenders = cjkInQuotedSpans(src, { backtick }).filter((hit) =>
      !rules.some(([needle]) => hit.text.includes(needle)));
    assert(!offenders.length,
      `${label} 无裸 CJK 用户文案${offenders.length
        ? `，违章：${offenders.map((h) => `${h.line}: "${h.text.slice(0, 60)}"`).join(' / ')}`
        : ''}`);
  }
}

// ── ⑤ main.js 的 t('字面量键') ⊆ UI 字典四表（防键名手滑；台词表是另一份）──
{
  const ui = {
    zh: require('../i18n/zh'), en: require('../i18n/en'),
    ja: require('../i18n/ja'), ko: require('../i18n/ko'),
  };
  const src = fs.readFileSync(path.join(ROOT, 'shell-electron', 'main.js'), 'utf8');
  const used = new Set();
  for (const m of src.matchAll(/\bt\('([a-zA-Z][\w.]*)'\)/g)) used.add(m[1]);
  const unknown = [...used].filter((k) => !(k in ui.zh && k in ui.en && k in ui.ja && k in ui.ko));
  // v44.13.6：preset-pc 预设随开源清洗删除（内网地址出码），键数 16→15——
  // 阈值放 >=15（防 i18n 意外丢线的下限口径，非精确数）
  assert(used.size >= 15, `main.js 字面量键在册（${used.size} 个）`);
  assert(!unknown.length, `t() 键四表全在${unknown.length ? `，漏：${unknown.join(',')}` : ''}`);
}

process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
