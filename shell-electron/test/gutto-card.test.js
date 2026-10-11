// gutto-card.py 导入测试：node test/gutto-card.test.js
// 验证：v2 JSON（data 外壳）/ v1 扁平 JSON / PNG tEXt 内嵌（chara）三形态解析
// + persona 组装（空段跳过、名字进 # 标题）。PNG fixture 由内嵌 python 生成
// （tEXt 块要 CRC，node 侧没有现成 crc32）。
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CARD = path.resolve(__dirname, '../../scripts/gutto-card.py');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

function runCard(file) {
  const r = spawnSync('python3', [CARD, '--card', file], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gutto-card-'));

// 1. v2 JSON（data 外壳，SillyTavern 主流形态）
{
  const card = {
    spec: 'chara_card_v2',
    data: {
      name: '星野',
      description: '白天是天文台讲解员，晚上是追星少女。',
      personality: '元气、好奇心旺盛、偶尔冒失',
      scenario: '天文台的深夜值班室',
      first_mes: '你也是来看流星雨的吗？',
      system_prompt: '',
      creator_notes: '不该出现',
      character_book: { entries: [] },
    },
  };
  const file = path.join(tmp, 'v2.json');
  fs.writeFileSync(file, JSON.stringify(card), 'utf8');
  const r = runCard(file);
  assert(r.code === 0, `v2 解析 exit 0（${r.code}）`);
  assert(r.out.startsWith('# 星野'), '名字进标题');
  assert(r.out.includes('天文台讲解员'), '描述保留');
  assert(r.out.includes('## 性格') && r.out.includes('元气'), '性格段');
  assert(r.out.includes('## 开场白') && r.out.includes('流星雨'), '开场白段');
  assert(!r.out.includes('creator_notes') && !r.out.includes('不该出现'), '杂字段不漏');
  // scenario 有值应出现；system_prompt 空应消失
  assert(r.out.includes('## 场景'), 'scenario 段在');
  assert(!r.out.includes('system_prompt'), '空 system_prompt 不留痕');
}

// 2. v1 扁平 JSON
{
  const file = path.join(tmp, 'v1.json');
  fs.writeFileSync(file, JSON.stringify({
    name: '旧式卡', description: 'v1 扁平结构', personality: '', scenario: '',
  }), 'utf8');
  const r = runCard(file);
  assert(r.code === 0 && r.out.includes('# 旧式卡') && r.out.includes('v1 扁平结构'), 'v1 扁平解析');
  assert(!r.out.includes('## 性格'), '空性格跳过');
}

// 3. PNG tEXt 内嵌（chara 关键字，base64 JSON）
{
  const py = `
import base64, struct, sys, zlib
card = {"spec":"chara_card_v2","data":{"name":"喵酱","description":"PNG 里长出来的猫娘","personality":"傲娇","scenario":"","first_mes":"哼，才不是等你呢","system_prompt":""}}
payload = base64.b64encode(card_json := __import__('json').dumps(card, ensure_ascii=False).encode()).decode()
def chunk(ctype, data):
    return struct.pack('>I', len(data)) + ctype + data + struct.pack('>I', zlib.crc32(ctype + data) & 0xffffffff)
png = b'\\x89PNG\\r\\n\\x1a\\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
png += chunk(b'tEXt', b'chara\\x00' + payload.encode('latin-1'))
png += chunk(b'IDAT', zlib.compress(b'\\x00\\x00\\x00\\x00\\x00'))
png += chunk(b'IEND', b'')
open(sys.argv[1], 'wb').write(png)
`;
  const pngFile = path.join(tmp, 'card.png');
  const gen = spawnSync('python3', ['-c', py, pngFile]);
  assert(gen.status === 0, 'PNG fixture 生成');
  const r = runCard(pngFile);
  assert(r.code === 0, `PNG 卡解析 exit 0（${r.code}）${r.err.slice(0, 80)}`);
  assert(r.out.includes('# 喵酱') && r.out.includes('PNG 里长出来的'), 'PNG 内嵌字段');
  assert(r.out.includes('傲娇') && r.out.includes('才不是等你'), '中文 base64 无损');
}

// 4. 坏输入：无内嵌数据的 PNG / 不存在的文件
{
  const plain = path.join(tmp, 'plain.png');
  fs.writeFileSync(plain, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), 'utf8');
  const r1 = runCard(plain);
  assert(r1.code === 2, '坏 PNG exit 2');
  const r2 = runCard(path.join(tmp, 'nope.json'));
  assert(r2.code !== 0, '缺文件非零退出');
}

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
console.log(failed ? '\nFAILED' : '\nALL PASS');
