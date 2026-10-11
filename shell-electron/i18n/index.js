// i18n 加载器——zh 真源 + 四语言 + {name} 插值（v44.11 起 zh/en/ja/ko）。
// 用法（main/renderer 同构）：
//   main/node：const { createT } = require('./i18n'); const t = createT('en');
//   renderer：<script src="../i18n/zh.js"></script>…四份字典全挂 + index.js 后
//            window.GuttoI18N.createT('zh')
// 回退链：目标语言字典 → zh 真源 → 返回键名（显性失败，UI 上看得见漏译）。
// 语言检测：main 侧 env 文件 GUTTO_LANG → app.getLocale() → zh（detectLang）；
// renderer 侧 query.lang（main 建窗时传入）。都落到 'zh'/'en'/'ja'/'ko' 四档，
// 未知语言回退 zh。daemon/hook 侧台词在 scripts/lines/*.json + gutto_lines.py，
// 语言判定与此处同源（GUTTO_LANG）。
// 阶段 1 实锤教训：renderer 无 require——浏览器态从 window.GUTTO_DICT_* 取字典，
// 字典文件自身是 UMD-lite（node 导出 / 浏览器挂全局），此处不许再 require。
'use strict';

let zh, en, ja, ko;
if (typeof module !== 'undefined' && module.exports) {
  zh = require('./zh');
  en = require('./en');
  ja = require('./ja');
  ko = require('./ko');
} else {
  zh = window.GUTTO_DICT_ZH;
  en = window.GUTTO_DICT_EN;
  ja = window.GUTTO_DICT_JA;
  ko = window.GUTTO_DICT_KO;
}

const DICTS = {};
if (zh) DICTS.zh = zh;
if (en) DICTS.en = en;
if (ja) DICTS.ja = ja;
if (ko) DICTS.ko = ko;

function createT(lang) {
  const table = DICTS[lang] || {};
  return function t(key, params) {
    let s = table[key];
    if (s === undefined) s = (zh || {})[key];   // 缺键回退真源
    if (s === undefined) return key;            // 仍缺：返回键名，漏译显性可见
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (m, name) =>
        params[name] !== undefined ? String(params[name]) : m);
    }
    return s;
  };
}

const EXPORTS = { createT, locales: Object.keys(DICTS) };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPORTS;
} else {
  window.GuttoI18N = EXPORTS;
}
