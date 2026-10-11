// icons.js — 全壳图标库（v43.11 治理 C：从 menu.html 内聚表升格，新增图标只写一处）。
// 笔触规范（v43.7 定档）：viewBox 24 / stroke-width 2 / round cap+join；
// 主线 currentColor（随容器色，hover 染色零成本），点缀恒 --pink-petal（梅黑上 7:1）。
// UMD-lite 双栖：node 侧 module.exports（测试可断言），浏览器挂 window.GuttoIcons。
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GuttoIcons = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const P = 'var(--pink-petal)';
  const ICONS = {
    chat: `<svg viewBox="0 0 24 24" ${S}><rect x="3.5" y="4.5" width="17" height="12.5" rx="4"/><path d="M8.5 17v3.5L13 17"/><circle cx="8.6" cy="10.8" r="1" fill="${P}" stroke="none"/><circle cx="12" cy="10.8" r="1" fill="${P}" stroke="none"/><circle cx="15.4" cy="10.8" r="1" fill="${P}" stroke="none"/></svg>`,
    look: `<svg viewBox="0 0 24 24" ${S}><path d="M2.5 12Q12 4.5 21.5 12Q12 19.5 2.5 12Z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1.1" fill="${P}" stroke="none"/></svg>`,
    play: `<svg viewBox="0 0 24 24" ${S}><rect x="2.5" y="7.5" width="19" height="9.5" rx="4.75"/><path d="M6.8 10.3v3.9M4.85 12.25h3.9"/><circle cx="16.4" cy="11.2" r="1.05" fill="${P}" stroke="none"/><circle cx="18.9" cy="13.7" r="1.05" fill="${P}" stroke="none"/></svg>`,
    history: `<svg viewBox="0 0 24 24" ${S}><circle cx="12.6" cy="9.8" r="6.6"/><circle cx="8" cy="18.4" r="1.4" fill="${P}" stroke="none"/><circle cx="4.9" cy="21.4" r="1" fill="${P}" stroke="none"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.6 2.1"/></svg>`,
    log: `<svg viewBox="0 0 24 24" ${S}><path d="M6.5 3.5h7l5 5V19a1.6 1.6 0 0 1-1.6 1.6H6.5A1.6 1.6 0 0 1 4.9 19V5.1A1.6 1.6 0 0 1 6.5 3.5Z"/><path d="M13.5 3.5v5h5"/><path d="M8.5 13h6.5M8.5 16.4h4.5"/></svg>`,
    records: `<svg viewBox="0 0 24 24" ${S}><rect x="4.6" y="6.4" width="4.2" height="13.2" rx="1.2"/><rect x="10.2" y="4.4" width="4.2" height="15.2" rx="1.2"/><rect x="15.8" y="7.4" width="4.2" height="12.2" rx="1.2"/><circle cx="12.3" cy="16.6" r="1.05" fill="${P}" stroke="none"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.1"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/></svg>`,
    quit: `<svg viewBox="0 0 24 24" ${S}><path d="M19.8 14.6A8.2 8.2 0 1 1 9.4 4.2a6.6 6.6 0 0 0 10.4 10.4Z"/><path d="M15.2 3.4h3.3l-3.3 3.7h3.3" stroke="var(--pink-petal)" stroke-width="1.7"/></svg>`,
    rest: `<svg viewBox="0 0 24 24" ${S}><path d="M19.2 13.6A7.6 7.6 0 1 1 10.4 4.8a6 6 0 0 0 8.8 8.8Z"/><path d="M16.4 4.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" fill="var(--pink-petal)" stroke="none"/></svg>`,
  };
  return { ICONS, get(name) { return ICONS[name] || ''; } };
});
