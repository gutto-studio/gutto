// 令牌护栏：windows/ 下所有 UI 文件禁裸写色号——色值唯一出口是 theme.css
// （v43.10 令牌收口配套，engineering §3 护栏模板；theme.css 本体不在扫描范围）。
// 规则：色声明属性行（color/background/border/shadow/fill/stroke…）的值里出现
// #hex 或 rgb()/rgba() 且不含 var( 即违规；SVG 属性 fill/stroke="..." 同查。
// id 选择器（#seg 等）不在声明值位，不误伤。JS 侧只查 settings.js 的 cssText 逃逸。
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'windows');
const FILES = fs.readdirSync(DIR)
  .filter((n) => n.endsWith('.html') || n === 'settings.js');
// 色声明属性：行内出现「<属性名>:」且前缀是行首/;/{/'（cssText 串的同款形状）
const DECL = /(?:^|;|\{|['"])\s*(?:[-a-z]*color|background(?:-color|-image)?|border(?:-color)?|box-shadow|fill|stroke)\s*:/i;
const RAW = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
// SVG 属性形态：fill="#fff" / stroke="#abc"（var() 引用不受限）
const SVG_RAW = /\b(?:fill|stroke)=["'][^"']*#[0-9a-fA-F]{3,8}\b/;

let failed = 0;
for (const name of FILES) {
  const src = fs.readFileSync(path.join(DIR, name), 'utf8');
  src.split('\n').forEach((line, i) => {
    const bare = (DECL.test(line) || SVG_RAW.test(line)) && RAW.test(line) && !line.includes('var(');
    if (bare) {
      failed += 1;
      console.error(`  FAIL ${name}:${i + 1} 裸写色号（色值只许走 theme.css 令牌）: ${line.trim().slice(0, 80)}`);
    }
  });
}

if (failed) {
  console.error(`\n  ${failed} 处裸写色号`);
  process.exit(1);
}
console.log('  ok  零裸写色号（windows/ 全部走 theme.css 令牌）');
