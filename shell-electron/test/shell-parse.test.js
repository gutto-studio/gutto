// CORE 契约解析单测：node test/shell-parse.test.js
// 验证：命令清单解析/提示过滤（mac 壳同款语义）、env 三键 upsert（key 保留）、
// 记忆 TSV base64 解码+坏行跳过+窗口截取、活动 TSV 按天分组。
'use strict';
const {
  parseCommandList, filterHints, parseEnv, upsertEnv,
  parseMemoryTsv, parseActivityTsv, upsertEnvKeys, sanitizeProviders,
} = require('../core/parse');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 命令清单：name\tdesc，非 / 开头丢弃，无 desc 收空串
{
  const hints = parseCommandList('/clear\t新开一局\n/new\t同 /clear\nbadline\n/解释\t元气解释\n/noDesc\t');
  assert(hints.length === 4, `清单 4 条（实际 ${hints.length}）`);
  assert(hints[0].name === '/clear' && hints[0].description === '新开一局', '首条解析');
  assert(hints[3].name === '/noDesc' && hints[3].description === '', '无描述收空串');
}

// 2. 提示过滤：命令段前缀匹配；空格后进参数段不再闪；非 / 不弹；上限 6
{
  const hints = parseCommandList('/clear\ta\n/new\tb\n/compact\tc\n/memory\td\n/help\te\n/解释\tf\n/extra\tg');
  assert(filterHints(hints, '/').length === 6, '仅 / = 全部但截到 6');
  assert(filterHints(hints, '/c').map((h) => h.name).join() === '/clear,/compact', '/c 前缀两条');
  assert(filterHints(hints, '/解释 你好').length === 1, '参数段保留当前匹配');
  assert(filterHints(hints, '你好').length === 0, '非斜杠不弹');
  assert(filterHints(hints, '/zzz').length === 0, '无匹配空列表');
}

// 3. env upsert：三键替换、key 留空保留旧行、陌生行原样带走
{
  const old = 'GUTTO_LLM_BASEURL=https://a\nOTHER=x\nGUTTO_LLM_KEY=sk-old\nGUTTO_LLM_MODEL=m1\n';
  const next = upsertEnv(old, { baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'qwen' });
  assert(next.includes('OTHER=x'), '陌生行保留');
  assert(next.includes('GUTTO_LLM_KEY=sk-old'), 'key 留空=原样保留');
  assert(next.includes('GUTTO_LLM_BASEURL=http://127.0.0.1:11434/v1'), 'baseURL 替换');
  assert(!next.includes('m1') && next.includes('GUTTO_LLM_MODEL=qwen'), '模型替换');
  const next2 = upsertEnv(old, { baseUrl: 'b', apiKey: 'sk-new', model: 'm' });
  assert(next2.includes('GUTTO_LLM_KEY=sk-new') && !next2.includes('sk-old'), 'key 非空=换新');
}

// 4. 记忆 TSV：base64 解码（含中文）、坏行跳过、窗口取尾
{
  const b = (s) => Buffer.from(s, 'utf8').toString('base64');
  const tsv = [
    `100\tuser\t${b('你好')}`,
    'bad line no tabs',
    `101\tassistant\t${b('在的～')}`,
    `102\tsystem\t${b('不该收')}`,
    `103\tuser\t!!!notb64!!!`,
    `104\tuser\t${b('第二问')}`,
  ].join('\n');
  const rows = parseMemoryTsv(tsv, 2);
  assert(rows.length === 2, `窗口截取 2 条（实际 ${rows.length}）`);
  assert(rows[0].role === 'assistant' && rows[0].text === '在的～', '中文解码+system 行剔除');
  assert(rows[1].text === '第二问', '坏 base64 行剔除');
}

// 5. 活动 TSV：新→旧、按天分组、summary 自带 tab 不裂（mac 壳 maxSplits 2 语义）
{
  const DAY = 86400;
  const now = Math.floor(Date.now() / 1000);
  const tsv = [
    `${now - 3 * DAY}\tchat\t老账`,
    `${now - 10}\tchat\t问「A\tB」`,
    `${now - 5}\tsay\t说话`,
  ].join('\n');
  const groups = parseActivityTsv(tsv);
  assert(groups.length === 2, `两天两组（实际 ${groups.length}）`);
  assert(groups[0].day === 'today' && groups[0].rows.length === 2, '今天组两条且在最前');
  assert(groups[0].rows[0].kind === 'say', '组内新→旧');
  assert(groups[0].rows[1].summary === '问「A\tB」', 'summary 内 tab 保全');
}

// 5b. 活动 TSV 日期分组 locale 化（v44.10 审稿 M-2）：en/ja/ko 各按本地面貌，
// en 不得泄漏「M月D日」（zh/ja 同形）
{
  const DAY = 86400;
  const now = Math.floor(Date.now() / 1000);
  const tsv = `${now - 3 * DAY}\tchat\t老账`;
  const zh = parseActivityTsv(tsv, 200, 'zh');
  const en = parseActivityTsv(tsv, 200, 'en');
  const ja = parseActivityTsv(tsv, 200, 'ja');
  const ko = parseActivityTsv(tsv, 200, 'ko');
  assert(/月/.test(zh[0].day) && /月/.test(ja[0].day), `zh/ja 日期走「M月D日」（实际 ${zh[0].day} / ${ja[0].day}）`);
  assert(!/月/.test(en[0].day) && /\d/.test(en[0].day), `en 日期无中文泄漏（实际 ${en[0].day}）`);
  assert(/월/.test(ko[0].day), `ko 日期走「M월 D일」（实际 ${ko[0].day}）`);
}

// 6. 通用 env 键 upsert（v42.4 玩法页）：增/换/删/去重/陌生行保留
{
  const old = 'GUTTO_APPROVAL=1\nOTHER=x\nGUTTO_SFX=0\nGUTTO_SFX=1\n';
  let next = upsertEnvKeys(old, { GUTTO_VOICE: '1', GUTTO_SFX: '0' });
  assert(next.includes('GUTTO_VOICE=1') && next.includes('OTHER=x'), '新增+陌生行保留');
  assert(next.match(/GUTTO_SFX=/g).length === 1 && next.includes('GUTTO_SFX=0'), '重复键去重取新值');
  next = upsertEnvKeys(next, { GUTTO_VOICE: '' });
  assert(!next.includes('GUTTO_VOICE'), '空值删键（回落默认）');
  next = upsertEnvKeys(next, { GUTTO_APPROVAL_TIMEOUT: '90' });
  assert(next.includes('GUTTO_APPROVAL_TIMEOUT=90') && next.includes('GUTTO_APPROVAL=1'), '追加并存');
}

// 6b. env 键名白名单+换行剥离（v44.10 审稿 M-3）：env 是 bash 层真源，
// 键名注入 \n 可伪造任意 env 行（如改写 LLM 端点）——白名单外整键丢弃
{
  const evil = upsertEnvKeys('A=1\n', {
    'X\nGUTTO_LLM_BASEURL=http://evil': '1',   // 键名夹带换行=伪造新行
    lowercase: '2',                             // 非法形状
    GUTTO_OK: 'v1\nv2',                         // 值带换行 → 剥成空格
  });
  assert(!evil.includes('GUTTO_LLM_BASEURL'), '键名夹带换行整键拒收');
  assert(!evil.includes('lowercase'), '小写键拒收');
  assert(evil.includes('GUTTO_OK=v1 v2'), '值内换行剥成空格');
  assert(evil.includes('A=1'), '既有行不受牵连');
}

// 7. 供应商档案 sanitize（v42.7）：形状/去重/载量/active 指针
{
  const bad = {
    chat: [
      { id: 'a', name: '云端', baseURL: 'https://x', key: '', model: 'm1' },
      { id: 'a', name: '重复id', baseURL: 'https://y', model: 'm2' },
      null, 'junk',
      { name: '无id', baseURL: 'https://z', model: 'm3' },
    ],
    vl: [],
    chatActive: 'ghost',
  };
  const c = sanitizeProviders(bad);
  assert(c.chat.length === 3, `chat 三条有效（实际 ${c.chat.length}）`);
  const ids = c.chat.map((p) => p.id);
  assert(new Set(ids).size === 3, 'id 全唯一（重复补新）');
  assert(c.chat[0].name === '云端' && c.chat[2].baseURL === 'https://z', '字段保全');
  assert(c.chatActive === 'a', 'active 指向失效回落首条');
  assert(c.vl.length === 0 && c.vlActive === '', '空组 active 空');
  const big = sanitizeProviders({ chat: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `x${i}` })) });
  assert(big.chat.length === 12, '上限 12（实际 ' + big.chat.length + '）');
  const ok = sanitizeProviders({ chat: [{ id: 'k', name: 'n', baseURL: 'b', model: 'm' }], chatActive: 'k' });
  assert(ok.chatActive === 'k', '合法 active 保留');
}

process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
