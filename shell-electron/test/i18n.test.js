// i18n 字典看守测试：node test/i18n.test.js
// 验证：zh/en/ja/ko 四表键集完全一致（i18n-guide 键一致护栏）/ 回退链 / 插值 / 显性失败。
'use strict';
const zh = require('../i18n/zh');
const en = require('../i18n/en');
const ja = require('../i18n/ja');
const ko = require('../i18n/ko');
const { createT, locales } = require('../i18n');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

// 1. 键集一致性：四表互为镜像（zh 为基准，多键/漏键都点名）
{
  const zk = Object.keys(zh).sort();
  for (const [name, dict] of [['en', en], ['ja', ja], ['ko', ko]]) {
    const dk = Object.keys(dict).sort();
    const missing = zk.filter((k) => !(k in dict));
    const extra = dk.filter((k) => !(k in zh));
    assert(zk.length === dk.length && missing.length === 0 && extra.length === 0,
      `${name} 键集一致（zh ${zk.length} = ${name} ${dk.length}）` +
      (missing.length ? `，缺：${missing.join(',')}` : '') +
      (extra.length ? `，多：${extra.join(',')}` : ''));
  }
}

// 2. 值非空：空字符串等于漏译
{
  const empties = Object.entries({ zh, en, ja, ko })
    .map(([name, dict]) => [name, Object.keys(dict).filter((k) => !dict[k]).length]);
  assert(empties.every(([, n]) => n === 0),
    `无空值（${empties.map(([n, c]) => `${n} 空 ${c}`).join('，')}）`);
}

// 3. 回退链：en 缺键回退 zh 真源——用影子字典模拟缺键
{
  const t = createT('en');
  assert(t('tab.history') === en['tab.history'], 'en 正常取键');
  // 直接构造缺键场景：临时删一个键再还原
  const saved = en['tab.history'];
  delete en['tab.history'];
  assert(t('tab.history') === zh['tab.history'], 'en 缺键回退 zh 真源');
  en['tab.history'] = saved;
}

// 4. 未知语言整体回退 zh
{
  const t = createT('fr');
  assert(t('tab.settings') === zh['tab.settings'], '未知语言（fr）回退 zh');
}

// 5. 显性失败：两表都缺 → 返回键名（UI 上看得见，不静默）
{
  const t = createT('en');
  assert(t('no.such.key') === 'no.such.key', '缺键返回键名');
}

// 6. 插值：{name} 替换、缺参保留占位（半成品文案可见）
{
  const t = createT('zh');
  assert(t('form.detectDone', { count: 3 }) === '探测到 3 个，点选即填入', '插值替换');
  assert(t('form.detectDone') === '探测到 {count} 个，点选即填入', '缺参保留占位');
  const te = createT('en');
  assert(te('form.detectDone', { count: 7 }) === 'Found 7, click to fill in', 'en 插值替换');
}

// 7. locales 清单（v44.10 四语言）
assert(locales.length === 4 && ['zh', 'en', 'ja', 'ko'].every((l) => locales.includes(l)),
  `locales = ${locales.join(',')}`);

// 8. 语言名键互认：每本字典的 lang.* 四键=语言原生名（选择器上的国籍脸）
{
  const NATIVE = { 'lang.zh': '中文', 'lang.en': 'English', 'lang.ja': '日本語', 'lang.ko': '한국어' };
  const bad = [];
  for (const [name, dict] of Object.entries({ zh, en, ja, ko })) {
    for (const [k, v] of Object.entries(NATIVE)) {
      if (dict[k] !== v) bad.push(`${name}:${k}=${dict[k]}`);
    }
  }
  assert(bad.length === 0, `lang.* 原生名四表统一${bad.length ? `，歪：${bad.join(',')}` : ''}`);
}

process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
