// gutto Electron 壳 —— 三闸 PoC → 阶段 1 最小可日用。（v44.0 互动+漫游）
// 跨平台选型依据：reports/2026-10-09-cross-platform-engine-scan.md
// （dsh-pet + clawd 双同行三平台实证；Tauri Wayland 无解弃用）。
// 2026-10-09 主人拍板「全面 Electron 化」：本壳是唯一主线壳，自立门户——
// 自己 spawn 对话脚本（argv 契约同 mac 壳）、自己读写 ~/.gutto 契约文件、
// 自己出菜单/输入条/气泡/设置窗。文案全走 i18n 字典（zh 真源）。
//
// 窗口形态对齐 mac 壳：LSUIElement 等价 = skipTaskbar + 不抢焦点；
// 透明 = backgroundColor '#00000000'；穿透 = setIgnoreMouseEvents 动态开关，
// 剪影命中由 renderer 算 alpha（mac 壳 hitTest 同语义）。
const { app, BrowserWindow, screen, ipcMain, globalShortcut, dialog, Tray, Menu, nativeImage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { createT } = require('./i18n');
const { runChat, listCommands, runLook, runCompact, runApprove } = require('./chat/executor');
const { parseCommandList, upsertEnv, upsertEnvKeys, sanitizeProviders, parseMemoryTsv, parseActivityTsv } = require('./core/parse');
const { WANDER } = require('./core/ambient');
const { pickReaction, countStreak, REACTION_MIN_INTERVAL_MS } = require('./core/interact');
const { levelFor, addPoints, visitToday, daysTogether, momentChance, pickMoment, LEVELS } = require('./core/bond');
const { specialDay } = require('./core/calendar');

const REPO_ROOT = path.resolve(__dirname, '..');

// 契约根目录。GUTTO_TEST_HOME 是沙箱测试隔离口——只认 /tmp 或仓库内
//（否则 env 可把契约读写拐到任意路径，Mimosa L3 path-traversal 拦截项）
function resolveGuttoHome() {
  const testRaw = process.env.GUTTO_TEST_HOME;
  if (testRaw) {
    const testPath = path.resolve(testRaw);
    if (testPath.startsWith('/tmp/') || testPath.startsWith(REPO_ROOT + path.sep)) {
      return testPath;
    }
  }
  return path.join(os.homedir(), '.gutto');
}
const GUTTO_HOME = resolveGuttoHome();

// v44.10 语言设置：env 文件的 GUTTO_LANG 优先（设置页可切），缺席跟随系统 locale。
// 启动时一次性判定——切语言后重启壳生效（窗与菜单在开窗时各自带 lang query）。
const LANGS = ['zh', 'en', 'ja', 'ko'];

function detectLang() {
  try {
    const m = fs.readFileSync(path.join(GUTTO_HOME, 'env'), 'utf8')
      .match(new RegExp(`^GUTTO_LANG=(${LANGS.join('|')})\\s*$`, 'm'));
    if (m) return m[1];
  } catch (e) { /* 无 env 文件=跟随系统 */ }
  const sys = (app.getLocale() || 'zh').slice(0, 2);
  return LANGS.includes(sys) ? sys : 'zh';
}
const LANG = detectLang();
const t = createT(LANG);
// 菜单条宽随语言分档（en 标签长，自适应项宽需更宽的窗——防溢出 v43.10-D1；
// v44.8.1 审稿 L-2：无头实测内容宽 zh 594 / en 663——旧值 zh 620 只剩 14px 头
// （加第 10 项必溢出）、en 920 透明死区 257px（透明不穿透=吃一次点击）。
// 收到 zh 660 / en 700：zh 留 66px 头，en 余 37px。
// v44.13.4 主人令右键减负 9→7 格：无头实测内容宽 zh 476 / en 528——
// 窗宽收到 zh 560（留 84px 头）/ en 640（透明死区纪律同上，宽=可点区）。
// v44.13.5 追砍至 5 格：实测内容宽 zh ~356 / en ~395 后收到 zh 440 / en 480。
const MENU_W = LANG === 'en' ? 480 : 440;

function getArgValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? path.resolve(process.argv[i + 1]) : fallback;
}
function getPetPath() {
  return getArgValue('--pet', path.resolve(__dirname, '../assets'));
}
function getChatScript() {
  // Mimosa L3：--chat-script 的值会交给 /bin/bash 执行，只认仓库 scripts/ 内
  //（argv 拐到任意路径 = 解释器执行外部值），其余回落默认脚本
  const fallback = path.resolve(__dirname, '../scripts/gutto-chat.sh');
  const target = getArgValue('--chat-script', fallback);
  return target.startsWith(path.resolve(__dirname, '../scripts/') + path.sep)
    ? target : fallback;
}

// ── 日志环（壳侧事件日志，设置页「日志」的数据源）──────────────────
// v43.2：同时落盘 GUTTO_HOME/shell.log——launchd 形态下 open 启动不继承
// wrapper stdout，不落盘=黑箱（用户/doctor 都看不到）。
const logRing = [];
// v43.12 治理 F：shell.log 轮转——>2MB 截到末 2000 行（只增不减=磁盘慢性漏）。
// 每 300 次落盘查一次体积，摊薄 stat 成本；截断本身不打日志（防自激）。
let shellLogWrites = 0;
function capShellLog() {
  try {
    const file = path.join(GUTTO_HOME, 'shell.log');
    if (fs.statSync(file).size < 2 * 1024 * 1024) return;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    fs.writeFileSync(file, lines.slice(-2000).join('\n'), 'utf8');
    console.log('[log] shell.log rotated (>2MB → tail 2000)');
  } catch { /* 不可读/不可写：下个检查点再看 */ }
}
function pushLog(kind, text) {
  const ts = new Date().toLocaleTimeString('sv'); // HH:MM:SS
  const line = `[${ts}] [${kind}] ${text}`;
  logRing.push(line);
  if (logRing.length > 300) logRing.shift();
  console.log(line);   // nohup 重定向到文件，排查用
  if (++shellLogWrites % 300 === 1) capShellLog();
  try {
    fs.appendFileSync(path.join(GUTTO_HOME, 'shell.log'), line + '\n', 'utf8');
  } catch { /* home 不可写时静默——UI 环内日志仍可用 */ }
}

// ── 壳心跳（v44.8.1 审稿 H-3）：每 5s touch，CLI pet_alive 查 mtime <30s ──
// 判活与进程名/路径/平台全解耦（旧 ps 匹配打包即恒假）；退出时主动清文件，
// 正常停壳即时判死，kill -9 由 30s 过期兜底。
function touchHeartbeat() {
  try {
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(path.join(GUTTO_HOME, 'shell.heartbeat'), String(Date.now()), 'utf8');
  } catch (e) { /* 只读环境：心跳缺失=判死，CLI 静默成功不误事 */ }
}
touchHeartbeat();
setInterval(touchHeartbeat, 5000);
app.on('will-quit', () => {
  try { fs.unlinkSync(path.join(GUTTO_HOME, 'shell.heartbeat')); } catch (e) { /* 已不在 */ }
});

// v44.8.1 审稿 M-1：主进程崩溃兜底——uncaughtException/unhandledRejection 只留证
// 再退（不吞异常不装健康），宠物无声消失且日志无痕的排障黑洞关掉。
process.on('uncaughtException', (e) => {
  try { pushLog('crash', `uncaughtException: ${String(e && e.message || e).slice(0, 300)}`); } catch (_) {}
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  try { pushLog('crash', `unhandledRejection: ${String(reason).slice(0, 300)}`); } catch (_) {}
});

// ── 窗口注册表 ────────────────────────────────────────────────────
let petWin = null;
let chatWin = null;
let bubbleWin = null;
let settingsWin = null;

// SPEC v2 包读取：manifest 全文 + 按行 webp（renderer 按需取行，壳侧不做
// 全量解码——与 mac 壳 LRU 纪律同构，内存只活在「正在播的行」上）。
// 行路径必须留在包根内（resolve + 前缀含分隔符校验，防 "../" 越界）。
function resolveInPackage(petPath, relPath) {
  const root = path.resolve(petPath);
  const target = path.resolve(root, relPath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('row path escapes package');
  }
  return target;
}

// selfiter R5 F-2：包读取 IPC 不认 renderer 传的 petPath——main 侧一律钳回
// 启动参数（getChatScript 同款白名单家法）：渲染进程即使被注入，也读不出
// 启动包之外的文件（旧版 petPath 任意值=任意路径读的纵深缺口）。
ipcMain.handle('load-manifest', () =>
  fs.readFileSync(path.resolve(getPetPath(), 'pet.json'), 'utf8'));
ipcMain.handle('load-row', (_ev, _petPath, relPath) =>
  fs.readFileSync(resolveInPackage(getPetPath(), relPath)));

// v43.2 启动对账（工程化：防半升级状态静默劣化）——manifest 声明的行数
// 必须=rows/ 目录实际文件数；不符只告警不拒启（旧包/裁剪包场景仍可用），
// 但日志与状态条口径统一，doctor/用户一眼定位。
function auditManifestRows(petPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(petPath, 'pet.json'), 'utf8'));
    const declared = (manifest.rows || []).length;
    const rowsDir = path.resolve(petPath, 'rows');
    const files = fs.existsSync(rowsDir)
      ? fs.readdirSync(rowsDir).filter((f) => f.endsWith('.webp')) : [];
    if (declared !== files.length) {
      pushLog('audit', `manifest rows ${declared} != rows/ files ${files.length} — 半升级或裁剪包，缺行将回退 idle`);
    } else {
      pushLog('audit', `rows ok: ${declared}`);
    }
    return { declared, files: files.length };
  } catch (e) {
    pushLog('audit', `manifest audit fail: ${e.message}`);
    return null;
  }
}

// v43 生命周期（主人拍板：登场/退场+首次使用特别动作）
// 首次使用旗标：一次 true，此后 false——旗标文件与 pet-position 同居 GUTTO_HOME。
ipcMain.handle('first-run', () => {
  const flag = path.join(GUTTO_HOME, 'first-greeting-shown');
  try {
    fs.accessSync(flag);
    return false;
  } catch {
    fs.writeFileSync(flag, new Date().toISOString(), 'utf8');
    return true;
  }
});

// 退场：before-quit 先演 exit 行（v44.4：时长读 manifest 行全长+0.4s 收势——
// 真素材 5s 时代硬编码 2600ms 会掐断告别），到点真退——读不到回落 2.6s 兜底。
let exitPlayed = false;
function exitHoldMs() {
  try {
    const m = JSON.parse(fs.readFileSync(path.resolve(getPetPath(), 'pet.json'), 'utf8'));
    const row = (m.rows || []).find((r) => r.animation === 'exit');
    if (row) {
      const len = (row.frameDurationsMilliseconds || [])
        .slice(0, row.frameCount).reduce((s, d) => s + d, 0);
      if (len > 0) return len + 400;
    }
  } catch (e) { /* 坏档/缺行回落默认 */ }
  return 2600;
}
app.on('before-quit', (ev) => {
  if (exitPlayed || !petWin || petWin.isDestroyed()) return;
  ev.preventDefault();
  exitPlayed = true;
  const hold = exitHoldMs();
  pushLog('lifecycle', `exit row sent (before-quit, ${hold}ms)`);
  try { petWin.webContents.send('play-row', 'exit', Math.ceil(hold / 1000)); } catch { /* 窗口已亡直接退 */ }
  setTimeout(() => app.quit(), hold);
});

function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const CELL = 240 * 0.65; // 与 mac 壳 run.sh scale 0.65 同口径

  // v42.9 位置记忆：有存档就回到上次的家。round3 R-3：clamp 目标=存档点所在的
  // 屏（getDisplayMatching）——旧代码恒取主屏 workArea，副屏上退出重启必回主屏
  //（即使副屏仍连着）；屏真拔了 getDisplayMatching 自然回落最近屏，clamp 兜底。
  const POS_FILE = path.join(GUTTO_HOME, 'pet-position.json');
  let x = Math.round(width * 0.62);
  let y = Math.round(height - CELL * 1.3);
  try {
    const saved = JSON.parse(fs.readFileSync(POS_FILE, 'utf8'));
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const w = Math.round(CELL * 1.6);
      const h = Math.round(CELL * 1.3);
      const display = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: w, height: h });
      const wa = display.workArea;
      x = Math.min(Math.max(saved.x, wa.x + 4), wa.x + wa.width - w - 4);
      y = Math.min(Math.max(saved.y, wa.y + 4), wa.y + wa.height - h - 4);
    }
  } catch (e) { /* 无存档=默认位 */ }

  petWin = new BrowserWindow({
    width: Math.round(CELL * 1.6),
    height: Math.round(CELL * 1.3),
    x, y,
    icon: path.join(getPetPath(), 'brand', 'icon-gutto.png'),   // v44.12 win/linux 窗图标；mac 走 dock.setIcon
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false, // 桌宠永不被 Chromium 后台节流
    },
  });
  petWin.setAlwaysOnTop(true, 'floating');
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // v44：宠窗 renderer 异常可观测（menu/chat 同款——此前唯一盲区，QA44 亲历）
  petWin.webContents.on('console-message', (_e, _level, msg) => pushLog('pet-page', msg));

  // 三闸之二 · 点击穿透：renderer 按剪影 alpha 判定，主进程动态开关。
  // forward:true = 穿透态仍把 mousemove 送进 renderer（命中检测的数据源）。
  ipcMain.on('click-through', (_ev, through) => {
    petWin && petWin.setIgnoreMouseEvents(!!through, { forward: true });
  });

  // v43.5 动作预览：设置窗芯片 → 宠窗播一行。行名只放行 [a-z0-9-] 形状
  //（不存在的行 renderer 自然回退 idle，这里消毒是防脏值进 IPC）。
  ipcMain.on('play-row-request', (_ev, name, hold) => {
    if (!petWin || petWin.isDestroyed()) return;
    const clean = String(name || '').replace(/[^a-z0-9-]/gi, '');
    if (!clean) return;
    const seconds = Math.max(1, Math.min(3600, Number(hold) || 6));
    petWin.webContents.send('play-row', clean, seconds);
    pushLog('preview', `play row ${clean} ${seconds}s`);
  });

  // v42.9 拖拽 + 位置持久（防抖 1s 落盘；只记左上角坐标）
  ipcMain.on('pet-move', (_ev, dx, dy) => {
    if (!petWin) return;
    const [px, py] = petWin.getPosition();
    petWin.setPosition(px + Math.round(dx), py + Math.round(dy), false);
    positionBubble();      // v44.9：锚在她身上的面板跟着走
    positionChatInput();
    savePetPositionDebounced();
  });
  // v44 漫游步进：renderer 50ms 一拍；主进程按工作区钳边界（WANDER.edgeMargin=40
  // 止步不弹回）。实移量回传——撞边时为 0，renderer 收步。
  ipcMain.handle('walk-step', (_ev, dx) => {
    if (!petWin || petWin.isDestroyed()) return { moved: 0 };
    const step = Math.round(Number(dx) || 0);
    if (!step) return { moved: 0 };
    const [px, py] = petWin.getPosition();
    const [w] = petWin.getSize();
    const wa = screen.getDisplayMatching(petWin.getBounds()).workArea;
    const nx = px + step;
    // v44.17 C-5：撞边时告诉 renderer 撞的哪边（贴边坐下歇的触发源）
    if (step < 0 && nx < wa.x + WANDER.edgeMargin) return { moved: 0, atEdge: 'left' };
    if (step > 0 && nx > wa.x + wa.width - WANDER.edgeMargin - w) return { moved: 0, atEdge: 'right' };
    petWin.setPosition(nx, py, false);
    positionBubble();   // v44.9：散步时气泡也吊在头顶跟拍
    savePetPositionDebounced();
    return { moved: nx - px };
  });
  let posTimer = null;
  function savePetPositionDebounced() {
    clearTimeout(posTimer);
    posTimer = setTimeout(() => {
      if (!petWin) return;
      try {
        const [px, py] = petWin.getPosition();
        fs.mkdirSync(GUTTO_HOME, { recursive: true });
        fs.writeFileSync(path.join(GUTTO_HOME, 'pet-position.json'),
          JSON.stringify({ x: px, y: py, ts: Date.now() }), 'utf8');
      } catch (e) { /* 落盘失败=下次回默认位 */ }
    }, 1000);
  }

  petWin.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: {
      pet: getPetPath(), scale: '0.65',
      walk: process.env.GUTTO_WALK === '0' ? '0' : '1',
      sleep: process.env.GUTTO_SLEEP === '0' ? '0' : '1',   // v44.1 入睡总闸
    },
  });
}

// ── 右键图标条（v43.6 参考搜狗输入法工具条，主人拍板）──────────────
// 8 个小图标依次弹出（.15s 微交互档 + 35ms stagger），hover 显名，失焦即收
//（语义同聊天输入条）。原生 Menu 退役；自动验收直驱可测了（合成右键不可行的
// 老边界就此翻篇）。
let menuWin = null;
let menuHideTimer = null;
let menuPageReady = false;      // 页面 JS 就绪前 send 会飞进虚空（气泡同款坑）
let pendingMenuItems = null;

function hidePetMenu() {
  clearTimeout(menuHideTimer);
  if (menuWin && !menuWin.isDestroyed() && menuWin.isVisible()) menuWin.hide();
  pushWalkGate();   // v44：图标条收起，闸门解除
}

function ensureMenuWindow() {
  if (menuWin) return menuWin;
  menuWin = new BrowserWindow({
    width: MENU_W, height: 80, show: false,
    transparent: true, frame: false, backgroundColor: '#00000000',
    hasShadow: false, resizable: false, skipTaskbar: true, focusable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'child-preload.js'),
      contextIsolation: true, backgroundThrottling: false,
    },
  });
  menuWin.setAlwaysOnTop(true, 'floating');
  menuWin.on('blur', hidePetMenu);          // 点别处即收（原生菜单同款习惯）
  menuWin.on('closed', () => {
    menuWin = null;
    menuPageReady = false;
    pendingMenuItems = null;
  });
  menuWin.webContents.on('console-message', (_e, _level, msg) => pushLog('menu-page', msg));
  menuWin.webContents.on('did-finish-load', () => {
    menuPageReady = true;
    if (pendingMenuItems) {
      menuWin && menuWin.webContents.send('menu-show', pendingMenuItems);
      pendingMenuItems = null;
    }
  });
  menuWin.loadFile(path.join(__dirname, 'windows', 'menu.html'), { query: { lang: LANG } });
  return menuWin;
}

function petMenuItems() {
  // icon 由 renderer 按 action 查表（SVG 表内聚在 menu.html，换皮不动壳）
  // v44.13.4 主人令「右键内容太多」：聊天记录/操作记录/日志三个直达合并为
  // 一个「记录」（设置窗记录页的三子页签功能原样在），9→7。
  // v44.13.5 追砍：玩法（设置侧栏本有玩法页签）+ 看一眼屏幕（/look 斜杠
  // 命令兜底），7→5——右键只留高频五件事。
  return [
    { label: t('menu.chat'), enabled: fs.existsSync(getChatScript()), action: 'chat' },
    { label: t('tab.records'), enabled: true, action: 'records' },
    { label: t('menu.settings'), enabled: true, action: 'settings' },
    { label: t('menu.rest'), enabled: true, action: 'rest' },
    { label: t('menu.quit'), enabled: true, action: 'quit' },
  ];
}

function showPetMenu() {
  const win = ensureMenuWindow();
  const pet = petWin.getBounds();
  const wa = screen.getDisplayMatching(pet).workArea;
  const w = MENU_W;
  const h = 80;
  let x = Math.round(pet.x + pet.width / 2 - w / 2);
  let y = pet.y + pet.height + 8;   // 脚下（搜狗工具条同位：面板正下方）
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - w - 4);
  if (y + h > wa.y + wa.height) y = Math.max(wa.y + 4, pet.y - h - 8); // 底边翻到头顶
  win.setPosition(x, y, false);
  const items = petMenuItems();
  if (menuPageReady) {
    win.webContents.send('menu-show', items);
  } else {
    pendingMenuItems = items;       // 首弹赶上页面加载：就绪后补投
  }
  win.show();
  win.focus();
  pushWalkGate();   // v44：图标条在场，散步关门
  clearTimeout(menuHideTimer);
  menuHideTimer = setTimeout(hidePetMenu, 8000);   // 无人理会 8s 自灭
  pushLog('menu', 'icon bar shown');
}

const MENU_ACTIONS = {
  chat: () => showChatInput(),
  records: () => showSettings('records/activity'),   // 记录页默认落活动子页
  settings: () => showSettings('settings'),
  rest: () => petSetHidden(true),   // v44.7 A-3：歇会儿（托盘/再右键叫回）
  quit: () => { pushLog('menu', 'user quit'); app.quit(); },
};

ipcMain.on('pet-contextmenu', () => showPetMenu());
ipcMain.on('menu-action', (_ev, action) => {
  hidePetMenu();
  const fn = MENU_ACTIONS[action];
  pushLog('menu', `action: ${fn ? action : `unknown(${action})`}`);
  if (fn) fn();
});
ipcMain.on('menu-hide', () => hidePetMenu());

// ── 聊天输入窗（宠脚下，提示列表向下生长）────────────────────────
function ensureChatWindow() {
  if (chatWin) return chatWin;
  chatWin = new BrowserWindow({
    width: 264, height: 64, show: false,
    transparent: true, frame: false, backgroundColor: '#00000000',
    hasShadow: false, resizable: false, skipTaskbar: true, focusable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'child-preload.js'),
      contextIsolation: true, backgroundThrottling: false,
    },
  });
  chatWin.setAlwaysOnTop(true, 'floating');
  // 常驻语义同 mac 壳 v39.2：提交不收，失焦即收
  chatWin.on('blur', () => { chatWin && chatWin.hide(); pushWalkGate(); });
  chatWin.webContents.on('console-message', (_e, _level, msg) => pushLog('chat-page', msg));
  chatWin.webContents.on('did-finish-load', () => pushLog('window', 'chat page loaded'));
  chatWin.loadFile(path.join(__dirname, 'windows', 'chat-input.html'), { query: { lang: LANG } });
  return chatWin;
}

// v44.9 输入条跟随：落位只由本函数出（宠脚下锚定），拖拽时同步搬——
// 首次弹出时窗还藏着，故不做 isVisible 拦截（隐藏态 setPosition 无害）。
function positionChatInput() {
  if (!chatWin || chatWin.isDestroyed()) return;
  if (!petWin || petWin.isDestroyed()) return;
  const pet = petWin.getBounds();
  const wa = screen.getDisplayMatching(pet).workArea;
  let x = Math.round(pet.x + pet.width / 2 - 132);
  let y = pet.y + pet.height + 10;   // 脚下（嘴在下面听，话从上面说）
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - 268);
  y = Math.max(y, wa.y + 4);
  chatWin.setPosition(x, y, false);
}

function showChatInput() {
  const win = ensureChatWindow();
  win.setSize(264, 64, false);
  positionChatInput();
  win.show();
  win.focus();
  pushWalkGate();   // v44：输入条在场，散步关门
  pushLog('window', 'chat input shown');
}

ipcMain.on('chat-input-size', (_ev, height) => {
  if (!chatWin || !chatWin.isVisible()) return;
  const h = Math.max(64, Math.min(360, Math.round(height)));
  if (Math.abs(chatWin.getBounds().height - h) < 1) return;
  chatWin.setSize(264, h, false);   // 顶边锚定，向下生长
});
ipcMain.on('chat-close', () => { chatWin && chatWin.hide(); pushWalkGate(); });

// ── 回复气泡（宠头顶 · 对话微缩流）：用户蓝泡+她粉泡上下堆叠，
// 单气泡高度随内容自适应（v42.10 主人令）；等待态不超时（慢路 90s），
// 正文 12s 自灭；透明窗残影靠「先清流再量高+resize 后 invalidate」。
let bubbleTimer = null;
let bubblePending = null;     // 页面没就绪时排队（did-finish-load 后补投）
let bubbleLoaded = false;
let lastUserLine = null;      // 本轮用户的话（切走后她回复时一起回放）
function ensureBubbleWindow() {
  if (bubbleWin) return bubbleWin;
  bubbleWin = new BrowserWindow({
    width: 248, height: 120, show: false,
    transparent: true, frame: false, backgroundColor: '#00000000',
    hasShadow: false, resizable: false, skipTaskbar: true, focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'child-preload.js'),
      contextIsolation: true, backgroundThrottling: false,
    },
  });
  bubbleWin.setAlwaysOnTop(true, 'floating');
  bubbleWin.setIgnoreMouseEvents(false);
  bubbleWin.webContents.on('did-finish-load', () => {
    bubbleLoaded = true;
    if (bubblePending !== null) {
      bubbleWin.webContents.send('bubble-show', bubblePending);
    }
  });
  bubbleWin.on('closed', () => { bubbleWin = null; bubbleLoaded = false; });
  bubbleWin.loadFile(path.join(__dirname, 'windows', 'bubble.html'), { query: { lang: LANG } });
  return bubbleWin;
}

// text=null 是等待态：不设 TTL（LLM 慢路 90s，等待态先灭=回复落空）；
// 正文态 12s 自灭。withUser=true 时把本轮用户的话一起回放（上下堆叠）。
function showBubble(text, { withUser = false } = {}) {
  const win = ensureBubbleWindow();
  const messages = [];
  if (withUser && lastUserLine) messages.push({ role: 'user', text: lastUserLine });
  messages.push({ role: 'her', text, pending: text === null });
  if (bubbleLoaded) {
    win.webContents.send('bubble-show', messages);
  } else {
    bubblePending = messages;
  }
  clearTimeout(bubbleTimer);
  if (text !== null) {
    bubbleTimer = setTimeout(() => bubbleWin && bubbleWin.hide(), 12000);
  }
}

// v44.9 气泡跟随：落位只由本函数出（宠头顶锚定），拖拽/散步每步都喊它——
// 人走了气泡跟着走，不再留在原地装幽灵。隐藏态 setBounds 无害（先定位再 show）。
let bubbleH = 120;                 // 最近内容高（默认=建窗高；bubble-size 持续校准）
function positionBubble() {
  if (!bubbleWin || bubbleWin.isDestroyed()) return;
  if (!petWin || petWin.isDestroyed()) return;
  const pet = petWin.getBounds();
  const wa = screen.getDisplayMatching(pet).workArea;
  const w = 248;
  let x = Math.round(pet.x + pet.width / 2 - w / 2);
  let y = pet.y - bubbleH - 10;           // 头顶
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - w - 4);
  y = Math.max(y, wa.y + 4);
  bubbleWin.setBounds({ x, y, width: w, height: bubbleH }, false);
}

ipcMain.on('bubble-size', (_ev, height) => {
  if (!bubbleWin) return;
  bubbleH = Math.max(96, Math.round(height));   // 最小 96 保底；上限不设（主人令：长回复完整展示）
  // 高度死区 4px：内容微变不缩窗，只放大（防「撑大缩小」观感）
  const cur = bubbleWin.getBounds().height;
  if (!(Math.abs(bubbleH - cur) < 4 && bubbleH <= cur)) {
    bubbleWin.setBounds({ width: 248, height: bubbleH }, false);
    // 透明窗缩尺寸后旧帧残留（截图实证）——强制重绘清底
    bubbleWin.webContents.invalidate();
  }
  positionBubble();
  bubbleWin.showInactive();          // 不抢焦点
});

// ── v44 互动反应：摸头/戳（点击分区→反应行+台词气泡；4s 内连戳 4 次炸毛）──
// 台词键全显式列在反应表 core/interact（禁运行时拼接，i18n-guide §2.2）。
const pokeTimes = [];
let lastPokeAt = 0;
let lastPokeLine = null;
ipcMain.on('pet-poked', (_ev, zoneRaw) => {
  const zone = zoneRaw === 'pat' ? 'pat' : 'hit';
  const now = Date.now();
  pokeTimes.push(now);
  const streak = countStreak(pokeTimes, now);
  bondAdd(streak >= 4 ? 'frenzy' : zone === 'pat' ? 'pat' : 'poke');   // 羁绊记账（炸毛不加分）
  if (now - lastPokeAt < REACTION_MIN_INTERVAL_MS) return;   // 节流：streak 账照记，反应不连发
  lastPokeAt = now;
  const reaction = pickReaction({ zone, streak, lastLineKey: lastPokeLine });
  lastPokeLine = reaction.lineKey;
  sfx('Tink');
  petWin && petWin.webContents.send('play-row', reaction.row, reaction.holdSeconds);
  showBubble(t(reaction.lineKey));
  // A-1 边界（v44.17）：摸头/戳反应**有意不挂语音**——高频短句 × PC TTS 冷启动
  // ~90s = 错位出声（气泡早灭了半分钟她才开口）。低频长句（问候/小剧场/首启）才挂。
  pushLog('poke', `${zone}${streak >= 4 ? ` x${streak}` : ''} -> ${reaction.row}`);
});

// v44.9 拿起来晃：renderer 检测甩动翻向（≥3 翻/700ms）报一次，走 shake 反应池。
// 羁绊记 poke 账（封顶 20/日同戳）；与摸/戳共用 600ms 节流防连发。
ipcMain.on('pet-shaken', () => {
  const now = Date.now();
  if (now - lastPokeAt < REACTION_MIN_INTERVAL_MS) return;
  lastPokeAt = now;
  bondAdd('poke');
  const reaction = pickReaction({ zone: 'shake', lastLineKey: lastPokeLine });
  lastPokeLine = reaction.lineKey;
  sfx('Tink');
  petWin && petWin.webContents.send('play-row', reaction.row, reaction.holdSeconds);
  showBubble(t(reaction.lineKey));
  pushLog('poke', `shake -> ${reaction.row}`);
});

// v44 漫游闸门：输入条/图标条/审批卡在场=她不散步（这些面板锚在她身上，走了就悬空）。
// v44.7：歇会儿（petHidden）也算闸——看不见的散步没有意义。
// 每次开/关都全量重算广播，renderer 听到 blocked=true 即刻收步。
function pushWalkGate() {
  if (!petWin || petWin.isDestroyed()) return;
  const isUp = (win) => Boolean(win && !win.isDestroyed() && win.isVisible());
  const blocked = isUp(chatWin) || isUp(menuWin) || isUp(approvalWin) || petHidden;
  try { petWin.webContents.send('walk-gate', blocked); } catch (e) { /* 窗已亡：下次再播 */ }
}

// ── v44.7 托盘+歇会儿（A-3 断链）：她 alwaysOnTop 却无路可藏，用户唯一的
// 手段是退出——退出就不再打开。托盘=找回的门面；右键八格加「让她歇会儿」。
// 歇会儿只藏宠本体：气泡/审批卡独立窗照常（歇会儿不误正事），散步随闸门停。
let tray = null;
let petHidden = false;

function petSetHidden(hidden) {
  petHidden = hidden;
  if (!petWin || petWin.isDestroyed()) { updateTrayMenu(); return; }
  if (hidden) {
    petWin.hide();
  } else {
    petWin.show();
    try { petWin.focus(); } catch (e) { /* 无焦点环境 */ }
  }
  // v44.8.1 审稿 H-1：藏显都重算闸门——渲染侧 gateBlocked 是黏性布尔（只认
  // 广播不自回弹），恢复显示若不广播，歇会儿一轮后她永久站桩。
  pushWalkGate();
  pushLog('tray', hidden ? 'pet hidden' : 'pet shown');
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  try {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: petHidden ? t('tray.show') : t('tray.rest'), click: () => petSetHidden(!petHidden) },
      { type: 'separator' },
      { label: t('feed.tray'), click: () => feedPet('tray') },   // v44.17 C-3：托盘投喂
      { label: t('menu.settings'), click: () => showSettings('settings') },
      { label: t('menu.quit'), click: () => { pushLog('tray', 'user quit'); app.quit(); } },
    ]));
  } catch (e) { /* 托盘亡=无菜单纯图标 */ }
}

function ensureTray() {
  if (tray) return tray;
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'windows', 'tray-icon.png'));
    // v44.8.1 审稿 L-1：template image——macOS 只取 alpha 随栏色自适应（旧深色
    // 字形对深色栏实测 1.9:1 几乎不可见）；丢粉色点缀换可见性，菜单栏惯例。
    // Windows/Linux 上 no-op。
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setImage(icon);   // v44.13.2：构造后再显式设一次——Electron macOS 构造期
                           // template 图像偶发不应用的民间已知坑，双保险
    tray.setToolTip('gutto');
    tray.on('click', () => petSetHidden(!petHidden));   // 点托盘=显示/歇会儿切换
    updateTrayMenu();
    // v44.13.3 Tray 渲染缺失取证：bounds 全 0 = 系统没给状态项位置（macOS 26 层拒），
    // 正常 bounds = 已上栏但绘制异常——升级 Electron 前后各打一份对照。
    setTimeout(() => {
      try { pushLog('tray', `bounds ${JSON.stringify(tray && tray.getBounds())}`); }
      catch (e) { /* tray 已亡 */ }
    }, 3000);
    pushLog('tray', 'tray ready');
  } catch (e) { pushLog('tray', `init fail: ${e.message}`); }
  return tray;
}

// ── v44.3 羁绊（好感度）：五路记账（摸/戳/聊天/看屏/每日回访）+ 升级庆典 +
// 稀有小剧场（lv2 起，5 分钟一查的低频惊喜）。好感只涨不掉；每类每日封顶防刷
// （戳一千下不等于爱一千分）。台账 ~/.gutto/bond.json；GUTTO_BOND=0 整体休眠。
const BOND_ENABLED = process.env.GUTTO_BOND !== '0';
let bondState = null;

function bondDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadBondState() {
  if (bondState) return bondState;
  try {
    bondState = JSON.parse(fs.readFileSync(path.join(GUTTO_HOME, 'bond.json'), 'utf8'));
  } catch (e) { bondState = null; /* 坏档/无档=从零开始，不迁就旧账 */ }
  if (!bondState || typeof bondState.points !== 'number') {
    bondState = { points: 0, day: '', today: {}, streak: 0, lastSeen: '' };
  }
  if (!bondState.today) bondState.today = {};
  // v44.8 成长史：无档/旧档缺 firstSeen 补今天（迁移一次，YYYY-MM-DD 同
  // bondDateStr 口径）——旧档相伴天数从今天起算，不往前编故事
  if (!bondState.firstSeen) bondState.firstSeen = bondDateStr();
  // v44.16 C-1 羁绊史：升级事件流 + 最长连访（旧档缺字段补默认，向后兼容；
  // 条目形状消毒——手改/半坏档的烂条目进不了渲染管线，审稿 P2-7）
  if (!Array.isArray(bondState.history)) bondState.history = [];
  bondState.history = bondState.history.filter((h) => h && /^\d{4}-\d{2}-\d{2}$/.test(h.d)
    && Number.isFinite(h.lv));
  if (!Number.isFinite(bondState.bestStreak)) bondState.bestStreak = Math.max(1, bondState.streak || 1);
  return bondState;
}

function saveBondState() {
  try {
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(path.join(GUTTO_HOME, 'bond.json'), JSON.stringify(bondState), 'utf8');
  } catch (e) { /* 只读环境：内存态照用，下次再落 */ }
}

function bondAdd(kind) {
  if (!BOND_ENABLED) return;
  const st = loadBondState();
  const before = levelFor(st.points).lv;
  const { gained } = addPoints(st, kind, bondDateStr());
  // v44.16 C-1：升级进成长史——必须在 saveBondState **之前**改内存（审稿
  // P1-2：先存后 push 会让里程碑在下次落盘前退壳即丢账）
  let leveled = null;
  if (gained) {
    const after = levelFor(st.points);
    if (after.lv > before) {
      st.history = (st.history || []).concat([{ d: bondDateStr(), lv: after.lv }]);
      if (st.history.length > 50) st.history = st.history.slice(-50);   // 封顶防无限涨
      leveled = after;
    }
  }
  saveBondState();
  // 返回 {gained} 不分升级与否（selfiter R5 F-1）：feedPet 靠它判封顶态——
  // 旧版只在升级时返回，普通投喂加了分也拿到 undefined，被误演「吃撑了」
  if (!leveled) return { gained };
  {
    // 升级庆典：解锁的行演起来 + 台词（lv4 无新行走舞一支）
    sfx('Glass');
    petWin && petWin.webContents.send('play-row', leveled.unlock === 'cheer' ? 'cheer' : 'dance', 8);
    const line = t('bond.levelup', {
      name: t(leveled.nameKey), lv: leveled.lv, unlock: t(`bond.unlock.${leveled.unlock}`),
    });
    showBubble(line);
    if (voiceOn()) speak(line);   // v44.7 A-1：语音覆盖扩到升级庆典（GUTTO_VOICE=1 才响）
    pushLog('bond', `level up ${before} -> ${leveled.lv} (${st.points} pts)`);
  }
  return { gained };   // v44.17 C-3：投喂要读封顶态（gained=0 → 「吃撑了」台词）
}

// ── v44.17 C-3 投喂：喂小零食（玩法页按钮 + 托盘菜单入口）────────────
// 记账走 bondAdd('feed')（日封顶 30）；演出 cheer + 台词两句轮换（封顶后换
// 「吃撑了」句）。v1 零新素材（cheer 行现成）；专属 eat 行挂素材产线轮。
let feedLineToggle = false;
function feedPet(via) {
  if (!BOND_ENABLED) return;
  sfx('Pop');
  const r = bondAdd('feed');
  petWin && petWin.webContents.send('play-row', 'cheer', 4);
  let key = 'feed.capped';
  if (r && r.gained) {
    feedLineToggle = !feedLineToggle;
    key = feedLineToggle ? 'feed.line1' : 'feed.line2';
  }
  const line = t(key);
  showBubble(line);
  if (voiceOn()) speak(line);
  pushLog('feed', `via ${via}${r && r.gained ? '' : ' (capped)'}`);
}
ipcMain.on('feed-pet', () => feedPet('play'));

// 每日回访：一次 +visit 分；连续相伴 ≥2 天，开场行演完再报天数（不抢首用台词）
function bondDailyVisit() {
  if (!BOND_ENABLED) return;
  const st = loadBondState();
  const today = bondDateStr();
  const { streak, isNew } = visitToday(st, today, bondDateStr(-1));
  if (isNew) {
    if (!st.firstSeen) st.firstSeen = today;   // v44.8 双保险：跨零点首访补档
    const { gained } = addPoints(st, 'visit', today);
    // v44.16 C-1：最长连访记录（成长史画板的数据源之一）
    st.bestStreak = Math.max(st.bestStreak || 1, streak);
    if (gained && streak >= 2) {
      setTimeout(() => {
        const line = t('bond.streak', { days: streak });
        showBubble(line);
        if (voiceOn()) speak(line);   // v44.7 A-1：连访报数也出声（默认关）
      }, 11000);
    }
  }
  saveBondState();
  pushLog('bond', `visit: streak ${st.streak}, ${st.points} pts`);
}

// 稀有小剧场：5 分钟一查（lv1 概率 0）；聊天中/宠窗不在不演，不打扰安静常态
function startBondMoments() {
  if (!BOND_ENABLED) return;
  setInterval(() => {
    if (chatBusy || !petWin || petWin.isDestroyed()) return;
    const lv = levelFor(loadBondState().points).lv;
    if (Math.random() >= momentChance(lv)) return;
    const m = pickMoment(lv);
    if (!m) return;
    petWin.webContents.send('play-row', m.row, 6);
    const line = t(m.lineKey);
    showBubble(line);
    if (voiceOn()) speak(line);   // A-1（v44.17）：小剧场出声（低频长句适合慢路 TTS）
    pushLog('bond', `moment: ${m.row} (lv${lv})`);
  }, 5 * 60 * 1000);
}

// ── v44.16 C-2 日期彩蛋：周年 / 相伴里程碑 / 固定节日 ────────────────
// 启动后 + 跨天（L-1 的 10min tick）各查一次；specialShown 记「键@日期」防重演。
// 演出低调：挥手行 + 气泡 +（语音门内）念一句——彩蛋是惊喜不是闹钟。
// 边界（审稿 P2-2/P2-8）：GUTTO_BOND=0 整体休眠彩蛋一并停；聊天中/歇会儿时
// 不演（气泡单槽别顶掉正事），本轮跳过、specialShown 未记，下轮 tick 补演。
function checkSpecialDay() {
  if (!BOND_ENABLED || chatBusy || petHidden) return;
  if (!petWin || petWin.isDestroyed()) return;
  const st = loadBondState();
  const today = bondDateStr();
  const sp = specialDay(today, st.firstSeen);
  if (!sp) return;
  const mark = `${sp.key}@${today}`;
  if (st.specialShown === mark) return;
  st.specialShown = mark;
  saveBondState();
  const line = t(sp.key, sp.params || {});
  petWin.webContents.send('play-row', 'waving', 5);
  showBubble(line);
  if (voiceOn()) speak(line);
  pushLog('bond', `special day: ${sp.key}`);
}

// ── 聊天执行（单飞：一次一句，等回复期间她演 think）────────────────
let chatBusy = false;
ipcMain.on('chat-submit', (_ev, text) => {
  const script = getChatScript();
  // 消毒在污点源头（渲染进程输入，runApprove 同款口径）：控制符/换行/NUL
  // 全剥 + 800 字封顶——executor 侧同款再设一道（纵深）。
  const clean = String(text || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 800);
  if (!clean) return;
  pushLog('chat', `send: ${clean.slice(0, 60)}`);
  bondAdd('chat');   // v44.3 羁绊：开口就是陪伴
  if (chatBusy) { pushLog('chat', 'busy, dropped'); return; }
  if (!fs.existsSync(script)) { pushLog('chat', `script missing: ${script}`); return; }
  chatBusy = true;
  lastUserLine = clean;              // v42.10：她回复时和用户的话一起回放
  petWin && petWin.webContents.send('play-row', 'think', 12);
  showBubble(null, { withUser: true });   // 等待态（用户泡+她的 …）
  runChat(script, clean, (err, reply) => {
    chatBusy = false;
    if (err) {
      pushLog('chat', `error: ${String(err.message || err).slice(0, 200)}`);
      showBubble(t('chat.error'), { withUser: true });
      petWin && petWin.webContents.send('play-row', 'idle', 2);
      return;
    }
    pushLog('chat', `reply: ${reply.slice(0, 80)}`);
    showBubble(reply, { withUser: true });
    petWin && petWin.webContents.send('play-row', 'review', 5);
    if (voiceOn()) speak(reply);   // v44.7 A-1：回复出声（GUTTO_VOICE=1 才响）
  });
});

ipcMain.handle('chat-hints', async () => {
  const script = getChatScript();
  return new Promise((resolve) => {
    listCommands(script, (err, text) => {
      resolve(err ? [] : parseCommandList(text));
    });
  });
});

// ── 契约文件读写（~/.gutto，renderer 无 node 全走这里）─────────────
function readTextSafe(p) {
  try { return { ok: true, text: fs.readFileSync(p, 'utf8') }; }
  catch (e) { return { ok: false }; }
}

ipcMain.handle('gutto-read', (_ev, name) => {
  switch (name) {
    case 'providers': return { ok: true, providers: readProviders() };
    case 'env': return readTextSafe(path.join(GUTTO_HOME, 'env'));
    case 'persona': return readTextSafe(path.join(GUTTO_HOME, 'persona.md'));
    case 'personaDefault': return readTextSafe(path.join(REPO_ROOT, 'config', 'persona-gutto.md'));
    case 'memory': {
      const r = readTextSafe(path.join(GUTTO_HOME, 'chat-memory.tsv'));
      return { ok: r.ok, rows: r.ok ? parseMemoryTsv(r.text) : [] };
    }
    case 'activity': {
      const r = readTextSafe(path.join(GUTTO_HOME, 'activity.tsv'));
      return { ok: r.ok, groups: r.ok ? parseActivityTsv(r.text, 200, LANG) : [] };
    }
    case 'memoryStats': {
      const mem = readTextSafe(path.join(GUTTO_HOME, 'chat-memory.tsv'));
      const total = mem.ok ? mem.text.split('\n').filter((l) => l.trim()).length : 0;
      const compactRaw = readTextSafe(path.join(GUTTO_HOME, 'chat-memory-compact.state'));
      const freshRaw = readTextSafe(path.join(GUTTO_HOME, 'chat-memory-fresh.state'));
      const parseNum = (text) => {
        const v = parseInt(String(text).trim(), 10);
        return Number.isFinite(v) ? v : 0;
      };
      const summary = readTextSafe(path.join(GUTTO_HOME, 'chat-memory-summary.md'));
      return {
        ok: true,
        total,
        compactAt: compactRaw.ok ? parseNum(compactRaw.text) : 0,
        freshAt: freshRaw.ok ? parseNum(freshRaw.text) : 0,
        hasSummary: summary.ok && !!summary.text.trim(),
        summary: summary.ok ? summary.text : '',
      };
    }
    case 'hooksStatus': {
      // 四家联动注册状态：配置里搜 agent-hook.sh / opencode-plugin 标记
      const hit = (r, marker) => r.ok && r.text.includes(marker);
      const zc = readTextSafe(path.join(os.homedir(), '.zcode/cli/config.json'));
      const cl = readTextSafe(path.join(os.homedir(), '.claude/settings.json'));
      const cx = readTextSafe(path.join(os.homedir(), '.codex/hooks.json'));
      const oc = readTextSafe(path.join(os.homedir(), '.config/opencode/opencode.json'));
      return {
        ok: true,
        zcode: hit(zc, 'agent-hook.sh'),
        claude: hit(cl, 'agent-hook.sh'),
        codex: hit(cx, 'agent-hook.sh'),
        opencode: hit(oc, 'opencode-plugin'),
      };
    }
    case 'commands': {
      // 自定义命令清单：~/.gutto/commands/*.md，frontmatter description 进列表
      const cdir = path.join(GUTTO_HOME, 'commands');
      const out = [];
      try {
        for (const name of fs.readdirSync(cdir).sort()) {
          if (!name.endsWith('.md')) continue;
          const r = readTextSafe(path.join(cdir, name));
          if (!r.ok) continue;
          const m = r.text.match(/^description:\s*(.+)$/m);
          out.push({ name: `/${name.replace(/\.md$/, '')}`, desc: m ? m[1].trim() : '' });
        }
      } catch (e) { /* 目录不存在=空清单 */ }
      return { ok: true, commands: out };
    }
    case 'manifest': {
      // v43.5 动作预览：当前包全部行（名+全长 ms），供设置窗芯片渲染
      try {
        const m = JSON.parse(fs.readFileSync(path.resolve(getPetPath(), 'pet.json'), 'utf8'));
        const rows = (m.rows || []).map((r) => ({
          animation: r.animation,
          frameCount: r.frameCount,
          lengthMs: (r.frameDurationsMilliseconds || [])
            .slice(0, r.frameCount).reduce((s, d) => s + d, 0),
        }));
        return { ok: true, rows };
      } catch (e) { return { ok: false }; }
    }
    case 'bond': {
      // v44.3 羁绊：设置玩法页展示（等级/进度/连访）
      // v44.8 成长史：firstSeen 相伴第一天 + daysTogether 相伴总天数（可见）
      // v44.16 C-1：+bestStreak 最长连访 / unlocks 解锁清单（lv 推导）/ history 里程碑
      const st = loadBondState();
      const lv = levelFor(st.points);
      const unlocks = LEVELS
        .filter((l) => l.unlock)
        .map((l) => ({ key: `bond.unlock.${l.unlock}`, at: l.at, done: lv.lv >= l.lv }));
      return {
        ok: true, points: st.points, streak: st.streak || 0,
        lv: lv.lv, nameKey: lv.nameKey,
        next: lv.next ? lv.next.at : null, toNext: lv.toNext, unlock: lv.unlock,
        firstSeen: st.firstSeen || null,
        daysTogether: daysTogether(st.firstSeen, bondDateStr()),
        bestStreak: st.bestStreak || 1,
        unlocks,
        history: (st.history || []).slice(-8).reverse(),
      };
    }
    default: return { ok: false };
  }
});

ipcMain.handle('gutto-save-env', (_ev, payload) => {
  try {
    const file = path.join(GUTTO_HOME, 'env');
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(file, upsertEnv(old, payload || {}), { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch (e) { /* 已有文件 chmod 保险 */ }
    pushLog('settings', 'env saved');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// v42.4 玩法页：任意 env 键 upsert（开关类 value='' 即删键回落默认）
ipcMain.handle('save-env-keys', (_ev, changes) => {
  try {
    const file = path.join(GUTTO_HOME, 'env');
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(file, upsertEnvKeys(old, changes || {}), { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch (e) { /* 保险 */ }
    pushLog('settings', `env keys saved: ${Object.keys(changes || {}).join(',')}`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// v42.4 一键注册 agent 联动（install-hooks.sh all：merge 只增不毁，备份先行）
// 脚本全部走 shebang 直呼（不经 /bin/bash 解释器——Mimosa L3 口径，v43.10 收口）
ipcMain.handle('run-hooks-install', () => new Promise((resolve) => {
  const script = path.resolve(__dirname, '../scripts/install-hooks.sh');
  const p = spawn(script, ['all']);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('error', (e) => resolve({ ok: false, tail: e.message }));
  p.on('close', (code) => {
    pushLog('settings', `hooks install exit ${code}`);
    resolve({ ok: code === 0, tail: out.trim().split('\n').slice(-12).join('\n') });
  });
}));

// v42.4 打开自定义命令文件夹（Finder，顺手建目录）
ipcMain.handle('open-commands-folder', () => {
  const cdir = path.join(GUTTO_HOME, 'commands');
  try {
    fs.mkdirSync(cdir, { recursive: true });
    spawn('open', [cdir], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── 供应商档案（v42.7 学 cc-switch）：providers.json 管档案，env 仍是运行时真源 ──
const PROVIDERS_FILE = () => path.join(GUTTO_HOME, 'providers.json');

function seedProviders() {
  // 首次：当前 env 导入为「当前配置」+ 常用预设（含主人实栈 PC qwen）
  const envRaw = readTextSafe(path.join(GUTTO_HOME, 'env'));
  const dict = {};
  if (envRaw.ok) {
    for (const line of envRaw.text.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) dict[line.slice(0, i).trim()] = line.slice(i + 1);
    }
  }
  const seed = {
    chat: [
      // round3 R-2：预设名进字典（设置页供应商列表直接显示）。已知形态：译名
      // 随首粒种子持久化进 providers.json，事后切语言不重译——档案文件是真源
      //（对齐 env 本地键同哲学）；id 化现译渲染另立工单（审稿 P2-2 登记）
      { id: 'imported', name: t('prov.preset.imported'),
        baseURL: dict.GUTTO_LLM_BASEURL || 'https://api.deepseek.com',
        key: dict.GUTTO_LLM_KEY || '', model: dict.GUTTO_LLM_MODEL || 'deepseek-chat' },
      { id: 'preset-ds', name: t('prov.preset.ds'),
        baseURL: 'https://api.deepseek.com', key: '', model: 'deepseek-chat' },
      { id: 'preset-local', name: t('prov.preset.local'),
        baseURL: 'http://127.0.0.1:11434/v1', key: '', model: '' },
    ],
    chatActive: 'imported',
    vl: [], vlActive: '',
  };
  return seed;
}

function readProviders() {
  const r = readTextSafe(PROVIDERS_FILE());
  if (r.ok && r.text.trim()) {
    try { return sanitizeProviders(JSON.parse(r.text)); } catch (e) { /* 坏档回落种子 */ }
  }
  const seed = sanitizeProviders(seedProviders());
  try {
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    // SEC-1（round4 full-stack-deep-review）：档案里存明文 key——env 同款 0600，
    // chmod 保险治存量 0644 旧档（mode 只在创建时生效）
    fs.writeFileSync(PROVIDERS_FILE(), JSON.stringify(seed, null, 2),
      { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(PROVIDERS_FILE(), 0o600); } catch (e) { /* 已是 0600 */ }
  } catch (e) { /* 只读环境：内存态照用 */ }
  return seed;
}

ipcMain.handle('save-providers', (_ev, obj) => {
  try {
    const clean = sanitizeProviders(obj);
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(PROVIDERS_FILE(), JSON.stringify(clean, null, 2),
      { encoding: 'utf8', mode: 0o600 });   // SEC-1：同 env 家法
    try { fs.chmodSync(PROVIDERS_FILE(), 0o600); } catch (e) { /* 保险 */ }
    pushLog('settings', 'providers saved');
    return { ok: true, providers: clean };
  } catch (e) { return { ok: false, error: e.message }; }
});

// 激活 = 档案指针 + 真写 env（bash 层零改动，下一句对话即生效）
ipcMain.handle('activate-provider', (_ev, group, id) => {
  try {
    const providers = readProviders();
    const list = group === 'vl' ? providers.vl : providers.chat;
    const hit = list.find((p) => p.id === id);
    if (!hit) return { ok: false, error: 'no such provider' };
    providers[`${group}Active`] = id;
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(PROVIDERS_FILE(), JSON.stringify(providers, null, 2),
      { encoding: 'utf8', mode: 0o600 });   // SEC-1：同 env 家法
    try { fs.chmodSync(PROVIDERS_FILE(), 0o600); } catch (e) { /* 保险 */ }
    const envFile = path.join(GUTTO_HOME, 'env');
    const old = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const changes = group === 'vl'
      ? { GUTTO_VL_BASEURL: hit.baseURL, GUTTO_VL_KEY: hit.key, GUTTO_VL_MODEL: hit.model }
      : { GUTTO_LLM_BASEURL: hit.baseURL, GUTTO_LLM_KEY: hit.key, GUTTO_LLM_MODEL: hit.model };
    fs.writeFileSync(envFile, upsertEnvKeys(old, changes), { mode: 0o600 });
    try { fs.chmodSync(envFile, 0o600); } catch (e) { /* 保险 */ }
    pushLog('settings', `provider active: ${group}/${hit.name}`);
    return { ok: true, providers };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('gutto-save-persona', (_ev, text) => {
  try {
    fs.mkdirSync(GUTTO_HOME, { recursive: true });
    fs.writeFileSync(path.join(GUTTO_HOME, 'persona.md'), String(text || ''), 'utf8');
    pushLog('settings', 'persona saved');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('gutto-revert-persona', () => {
  try {
    const file = path.join(GUTTO_HOME, 'persona.md');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    pushLog('settings', 'persona reverted');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('log-lines', () => [...logRing]);

// ── 12 态事件总线（v42.1）：fs.watch 事件文件 → 行映射 + 气泡 ─────
// 与 agent-hook.sh 的 anim_for_event 同表（Swift 宠走 CLI animate，Electron 走这）。
const EVENT_ROW = {
  pre_tool: ['think', 20],
  permission: ['review', 15],
  stop: ['waving', 6],
  notification: ['waiting', 10],
  // v44.8 上班：agent 开新会话她朝你跑来（SessionStart 事件，hook 侧 20s 节流）
  start: ['running', 8],
};

// v44.7 六情绪→行映射（gutto react 通道，A-2 断链复活）：素材全在包。
// celebrate=欢呼 working=思考中 alert=警觉盯屏 resting=小歇 low-energy=低电量
// charging=回血；hold=调用方 ttl（clamp 1-3600）。
const REACT_ROW = {
  celebrate: 'cheer',
  working: 'think',
  alert: 'review',
  resting: 'sit',
  'low-energy': 'sleep',
  charging: 'stretch',
};
// v44.2：settings 事件的页签白名单（与 windows/settings.js 的 TABS/SUBS 同表）。
// 事件文件用户可写——白名单外一律回落默认页（纵深消毒，同 APPROVE_VERBS 家法）。
const SETTINGS_TABS = ['settings', 'play', 'records', 'records/activity', 'records/history', 'records/log'];
const EVENT_FILE = path.join(GUTTO_HOME, 'events', 'current.json');
// settings 走专属文件：current.json 是单文件共享总线，多 agent 窗口的高频
// pre_tool 会在 1s 轮询间隔里覆写掉低频事件（开窗丢一次=叫她开她没开，
// 2026-10-10 19:15 实锤）——专属文件无人挤兑；fs.watchFile 无启动重放，
// 沉底事件不会在下次启动重开窗。
const SETTINGS_EVENT_FILE = path.join(GUTTO_HOME, 'events', 'settings.json');

function handleAgentEvent() {
  try {
    const ev = JSON.parse(fs.readFileSync(EVENT_FILE, 'utf8'));
    if (ev.type === 'say' && ev.text) {
      // v42.8 桥：bin/gutto say/report 与生活守护（碎碎念/晚安）的气泡通道
      showBubble(String(ev.text));
      // A-1（v44.17）：生活脑来源（src:life，gutto-life.sh 桥标记）挂语音——
      // 时段问候/晚安日报/碎碎念出声；agent 的 say/report 不念。
      // GUTTO_VOICE=1 且 LANG=zh（speak 内语言门控）才响。
      if (ev.src === 'life' && voiceOn()) speak(String(ev.text));
      pushLog('event', `say: ${String(ev.text).slice(0, 60)}`);
      return;
    }
    if (ev.type === 'anim' && ev.name) {
      // v43.5 桥：bin/gutto anim 落事件文件点播（Swift socket 退役后的 CLI 通道）
      const clean = String(ev.name).replace(/[^a-z0-9-]/gi, '');
      if (!clean) return;
      const hold = ev.mode === 'loop' ? 3600 : 8;
      petWin && petWin.webContents.send('play-row', clean, hold);
      pushLog('event', `anim: ${clean} (${ev.mode || 'once'})`);
      return;
    }
    if (ev.type === 'react' && ev.kind) {
      // v44.7 桥（A-2 断链复活）：gutto react 六情绪 → 行映射（Swift socket
      // 退役后 react 曾整条死通道——旧门「CLI ping || exit 0」必然静默跳过）
      const clean = String(ev.kind).replace(/[^a-z-]/g, '');
      const row = REACT_ROW[clean];
      if (row) {
        const ttl = Math.max(1, Math.min(3600, Number(ev.ttl) || 6));
        petWin && petWin.webContents.send('play-row', row, ttl);
      }
      pushLog('event', `react: ${clean}${row ? ` -> ${row}` : ' (no row)'}`);
      return;
    }
    const mapped = EVENT_ROW[ev.type];
    if (mapped) {
      petWin && petWin.webContents.send('play-row', mapped[0], mapped[1]);
    }
    if (ev.type === 'stop' && ev.project) {
      showBubble(t('event.stopBubble', { project: ev.project }));   // round3 R-2
    }
    pushLog('event', `${ev.type}${ev.project ? ` (${ev.project})` : ''}`);
  } catch (e) { /* 坏文件/半写：下一拍再看 */ }
}

// v44.2：专属文件上的开窗处理器（白名单与 bin/gutto settings 同表）
function handleSettingsEvent() {
  try {
    const ev = JSON.parse(fs.readFileSync(SETTINGS_EVENT_FILE, 'utf8'));
    if (ev.type !== 'settings') return;
    const tab = SETTINGS_TABS.includes(ev.tab) ? ev.tab : 'settings';
    showSettings(tab);
    pushLog('event', `settings: ${tab}`);
  } catch (e) { /* 坏文件/半写：下一拍再看 */ }
}

function startEventWatcher() {
  try { fs.mkdirSync(path.dirname(EVENT_FILE), { recursive: true }); } catch (e) {}
  try { fs.watchFile(EVENT_FILE, { interval: 1000 }, handleAgentEvent); } catch (e) {}
  try { fs.watchFile(SETTINGS_EVENT_FILE, { interval: 1000 }, handleSettingsEvent); } catch (e) {}
}

// ── SFX（v42.1）：macOS 系统音 afplay（零素材债），默认开 ──
// v44.10 审稿 H-1 收口：此前读侧只认 process.env 的 '0'，写侧却写 env 文件的
// '1'/删键——两个方向都拨不动。现读侧同查 ~/.gutto/env（deep-review 建议的
// voiceOn 先例），关=env=0 或环境变量=0；写侧（settings）同步改写 '1'/'0' 显形。
function sfx(name) {
  if (process.env.GUTTO_SFX === '0') return;
  try {
    if (/^GUTTO_SFX=0$/m.test(fs.readFileSync(path.join(GUTTO_HOME, 'env'), 'utf8'))) return;
  } catch (e) { /* 无 env 文件=默认开 */ }
  try {
    const p = spawn('afplay', ['-v', '0.25', `/System/Library/Sounds/${name}.aiff`], { detached: true, stdio: 'ignore' });
    p.unref();
  } catch (e) { /* 静默 */ }
}

// ── 语音（v44.7 A-1 扩面）：原本只挂 agent-hook 的 stop 事件；现在聊天回复/
// 升级庆典/连访报数也出声。门不变：GUTTO_VOICE=1 才开（默认关——音色选型是
// 安全形状（Mimosa 口径）：端点=固定字面量（家里 PC 的 TTS 门面与管家，
// 文本只进 JSON body=JSON.stringify 转义，SSRF 面不存在）；播放走固定路径
// afplay（sfx 同款）零动态 spawn。v44.8.1 审稿 M-2：加 GUTTO_TTS_HOST 覆盖口
// （默认回落字面量，与 scripts/gutto-tts.sh 的 TTS_HOST 口径对齐）——换机/换网
// 不用改码，「零不可信输入」不破（host 只进 URL，不进任何执行位）。
// 嗓子按需模式（4070S 档案）：挂起时本次静默放弃并顺手 /wake/voice 下次即响。
// v44.13.6 开源清洗：默认 host 收敛 127.0.0.1（内网 TTS 地址不随码出仓，
// 自用走 GUTTO_TTS_HOST env——voiceOn 默认关，默认值只影响已开语音的自用机）。
const TTS_HOST = process.env.GUTTO_TTS_HOST || '127.0.0.1';
const TTS_SAY_URL = new URL(`http://${TTS_HOST}:9553/say`);
const TTS_WAKE_URL = new URL(`http://${TTS_HOST}:9620/wake/voice`);
const VOICE_WAV = `/tmp/gutto-voice-${process.pid}.wav`;   // 带 pid：双实例互不覆盖
let lastSpokeAt = 0;
function voiceOn() {
  if (process.env.GUTTO_VOICE === '1') return true;
  try {
    return /^GUTTO_VOICE=1$/m.test(fs.readFileSync(path.join(GUTTO_HOME, 'env'), 'utf8'));
  } catch (e) { return false; }
}
function speak(text) {
  // round3 E-4 语音按语言门控：PC TTS 是中文音色，非 zh 档出声=「中文音读外语」
  // 反而更糟（round3 报告 §2.4 建议：E-1 先只翻文本，语音按语言门控）——
  // 非中文档宁可静默，台词照常走气泡。
  if (LANG !== 'zh') return;
  const clean = String(text || '')
    .replace(/[^\p{L}\p{N}，。！？、：；,.!?~～ ]/gu, '')
    .trim().slice(0, 80);
  if (!clean) return;
  const now = Date.now();
  if (now - lastSpokeAt < 5 * 60 * 1000) return;   // 节流：5 分钟最多一条
  try {
    const req = http.request(TTS_SAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 130000,
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return; }
      // v44.8.1 审稿 L-4：配额在真拿到 200 时才扣——嗓子挂起走 error 分支时
      // 不烧 5 分钟窗口（否则挂起常态下该响的一条永远哑）。
      lastSpokeAt = Date.now();
      const ws = fs.createWriteStream(VOICE_WAV);
      res.pipe(ws);
      // v44.8.1 审稿 M-1：pipe 不回传目标流错误——无 error 监听=uncaught 直接
      // 崩主进程（宠物无声消失）。两侧都挂，任一出错拆掉对端防半写文件。
      ws.on('error', () => { try { res.destroy(); } catch (e) { /* 已断 */ } });
      res.on('error', () => { try { ws.destroy(); } catch (e) { /* 已断 */ } });
      ws.on('close', () => {
        if (ws.bytesWritten > 0) {
          const p = spawn('afplay', [VOICE_WAV], { detached: true, stdio: 'ignore' });
          p.unref();
        }
      });
    });
    req.on('error', () => {
      // 嗓子挂起（按需模式常态）：不阻塞不重试，顺手唤醒下次再响
      const wake = http.request(TTS_WAKE_URL, { method: 'POST', timeout: 10000 });
      wake.on('error', () => {});
      wake.end();
    });
    // v44.8.1 审稿 L-5：http.request 的 timeout 只发事件不中断请求——超时
    // 后请求悬着；destroy 掉让它落进 error 分支（顺路触发唤醒）。
    req.on('timeout', () => req.destroy());
    req.end(JSON.stringify({ text: clean }));
    pushLog('voice', `speak: ${clean.slice(0, 30)}`);
  } catch (e) { /* 播报失败静默 */ }
}

// ── 看屏（v42.1 · BYO key VL）：菜单/spawn 脚本 → 气泡 ─────────────
const LOOK_SH = path.resolve(__dirname, '../scripts/gutto-look.sh');
function lookAtScreen(topic) {
  if (!fs.existsSync(LOOK_SH)) return;
  sfx('Pop');
  bondAdd('look');   // v44.3 羁绊：让她看一眼也算相处
  petWin && petWin.webContents.send('play-row', 'review', 8);
  if (topic) lastUserLine = `👀 ${topic}`;   // 话题作为用户泡回放
  showBubble(null, { withUser: Boolean(topic) });
  runLook(LOOK_SH, topic, (reply) => {
    pushLog('look', `reply: ${reply.slice(0, 80)}`);
    showBubble(reply || t('chat.error'), { withUser: Boolean(topic) });
  });
}
// 队列文件即真相：fs.watch 盯 ~/.gutto/approvals/queue/（3s 轮询兜底），
// 有待决就弹卡（先来先审，卡上标注排队数）；按钮/热键写决策文件，
// hook 的 wait 醒来把 allow/deny 交还宿主。决策存储语义见 scripts/gutto-approve.sh。
// ── 审批卡（v42 阻塞式审批 · 桌面端决策面）───────────────────────
// 队列文件即真相：fs.watch 盯 ~/.gutto/approvals/queue/（3s 轮询兜底），
// 有待决就弹卡（先来先审，卡上标注排队数）；按钮/热键写决策文件，
// hook 的 wait 醒来把 allow/deny 交还宿主。决策存储语义见 scripts/gutto-approve.sh。
const APPROVE_SH = path.resolve(__dirname, '../scripts/gutto-approve.sh');
let approvalWin = null;

// runApprove 已迁执行器（动词白名单+参数消毒在彼处；L2 收口）

function ensureApprovalWindow() {
  if (approvalWin) return approvalWin;
  approvalWin = new BrowserWindow({
    width: 264, height: 130, show: false,
    transparent: true, frame: false, backgroundColor: '#00000000',
    hasShadow: false, resizable: false, skipTaskbar: true, focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'child-preload.js'),
      contextIsolation: true, backgroundThrottling: false,
    },
  });
  approvalWin.setAlwaysOnTop(true, 'floating');
  approvalWin.on('closed', () => { approvalWin = null; });
  approvalWin.loadFile(path.join(__dirname, 'windows', 'approval.html'), { query: { lang: LANG } });
  return approvalWin;
}

function showApprovalCard(item, more) {
  const win = ensureApprovalWindow();
  sfx('Pop');
  win.webContents.send('approval-show', { item, more });
}

function refreshApprovals() {
  runApprove(APPROVE_SH, ['pending'], (out) => {
    const items = out ? out.split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(Boolean) : [];
    if (!items.length) {
      if (approvalWin) approvalWin.hide();
      pushWalkGate();   // v44：审批卡收起，闸门解除
      return;
    }
    // 卡位：宠右侧（头顶气泡/脚下输入条都不打架）；贴屏边内收
    showApprovalCard(items[0], items.length - 1);
  });
}

ipcMain.on('approval-decide', (_ev, payload) => {
  if (!payload || !payload.id) return;
  const decision = payload.decision === 'deny' ? 'deny' : 'allow';
  sfx(decision === 'allow' ? 'Glass' : 'Basso');
  runApprove(APPROVE_SH, ['decide', String(payload.id), decision, '--via', 'pet'], () => {});
  pushLog('approval', `${decision}: ${payload.id}`);
  setTimeout(refreshApprovals, 200);
});

ipcMain.on('approval-size', (_ev, height) => {
  if (!approvalWin || !petWin) return;
  const pet = petWin.getBounds();
  const wa = screen.getDisplayMatching(pet).workArea;
  const w = 264;
  const h = Math.max(80, Math.min(200, Math.round(height)));
  let x = pet.x + pet.width + 12;
  let y = pet.y + 10;
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - w - 4);
  y = Math.min(Math.max(y, wa.y + 4), wa.y + wa.height - h - 4);
  approvalWin.setBounds({ x, y, width: w, height: h }, false);
  approvalWin.showInactive();
  pushWalkGate();   // v44：审批卡真正亮出（窗由 approval-size 驱动显示），散步关门
});

function startApprovalWatcher() {
  const qdir = path.join(GUTTO_HOME, 'approvals', 'queue');
  try { fs.mkdirSync(qdir, { recursive: true }); } catch (e) { /* 家目录不可建时轮询自然空转 */ }
  try { fs.watch(qdir, () => refreshApprovals()); } catch (e) { /* watch 失败靠轮询 */ }
  setInterval(refreshApprovals, 3000);
  refreshApprovals();
}

// 热键（clawd 同款键位）：⇧⌘Y 允许 / ⇧⌘N 拒绝——作用于最老待决
function registerApprovalHotkeys() {
  const decideOldest = (decision) => {
    runApprove(APPROVE_SH, ['oldest'], (id) => {
      if (!id) return;
      runApprove(APPROVE_SH, ['decide', id, decision, '--via', 'hotkey'], () => {});
      pushLog('approval', `hotkey ${decision}: ${id}`);
      setTimeout(refreshApprovals, 200);
    });
  };
  globalShortcut.register('CommandOrControl+Shift+Y', () => decideOldest('allow'));
  globalShortcut.register('CommandOrControl+Shift+N', () => decideOldest('deny'));
}

// ── 记忆管理 + 角色卡导入（v42）──────────────────────────────────
// memoryStats 案例已并入上方 gutto-read 主 handler（重复注册会炸 Second handler）
ipcMain.handle('compact-now', () => {
  const script = path.resolve(__dirname, '../scripts/gutto-chat-compact.sh');
  if (runCompact(script)) {
    pushLog('memory', 'compact triggered');
    return { ok: true };
  }
  return { ok: false, error: 'spawn failed' };
});

ipcMain.handle('import-card', async () => {
  const picked = await dialog.showOpenDialog({
    title: t('card.import'),
    filters: [{ name: 'Character Card', extensions: ['json', 'png'] }],
    properties: ['openFile'],
  });
  if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true };
  const file = picked.filePaths[0];
  return new Promise((resolve) => {
    const p = spawn(path.resolve(__dirname, '../scripts/gutto-card.py'), ['--card=' + file]);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => resolve({ ok: false, error: e.message }));
    p.on('close', (code) => {
      if (code === 0 && out.trim()) {
        let cardName = '';
        const m = out.match(/^# (.+)$/m);
        if (m) cardName = m[1].trim();
        pushLog('settings', `card imported: ${cardName || file}`);
        resolve({ ok: true, text: out.trim(), name: cardName });
      } else {
        resolve({ ok: false, error: (err || `exit ${code}`).trim().slice(0, 200) });
      }
    });
  });
});

// ── 设置窗（正规标题窗，页签可被菜单直达）─────────────────────────
function showSettings(tab) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('settings-tab', tab);
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  settingsWin = new BrowserWindow({
    width: 760, height: 652,
    x: Math.round(wa.x + wa.width / 2 - 380),
    y: Math.round(wa.y + wa.height / 2 - 326),
    title: t('window.settingsTitle'),
    resizable: true,
    backgroundColor: '#faf6f6',   // 暖玫纸（--lt-bg 同值）——冷灰窗口底是「不干净」最物理的一刀
    webPreferences: {
      preload: path.join(__dirname, 'child-preload.js'),
      contextIsolation: true,
    },
  });
  // v44.3.1 诊断桥：设置页 renderer 报错落日志（白屏事故取证——uncaught
  // 异常会以 console 消息形式到达，日志页第一行即凶手）
  settingsWin.webContents.on('console-message', (_e, _level, msg) => pushLog('settings-page', msg));
  settingsWin.on('closed', () => { settingsWin = null; });
  settingsWin.loadFile(path.join(__dirname, 'windows', 'settings.html'), {
    query: { lang: LANG, tab: tab || 'settings' },
  });
  pushLog('window', `settings shown (${tab})`);
}

// 聊天记录清空（v42.9）：走 /clear 同一条路（单一真源），fresh 起点落账
ipcMain.handle('clear-history', () => new Promise((resolve) => {
  const script = getChatScript();
  if (!fs.existsSync(script)) return resolve({ ok: false, error: 'chat script missing' });
  const p = spawn(script, ['/clear'], { env: { ...process.env, GUTTO_NO_SAY: '1' } });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.on('error', (e) => resolve({ ok: false, error: e.message }));
  p.on('close', (code) => {
    pushLog('settings', `history cleared (exit ${code})`);
    resolve({ ok: code === 0 });
  });
}));

// v43.1 单实例锁（主人 QA「桌面 2 个桌宠」）：第二实例直接退——launchd 与手动
// 双路径并存时的重复上岗根修；正主收到二次启动信号时把宠窗请回前台。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[lifecycle] another gutto is running — quitting this one');
  app.quit();
} else {
  app.on('second-instance', () => {
    try { petWin && petWin.show(); } catch { /* 窗已亡 */ }
  });
}

app.whenReady().then(() => {
  // v44.12 桌面图标：品牌 gutto（q21c2 家族风：粉底+chibi，素材 assets/brand/）
  // mac=Dock 图标（icns 在 dev 态 Electron setIcon 实测拒载，用 1024 png 同效）；
  // win/linux=BrowserWindow icon 参数在 createPetWindow 里接同一张 png
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(path.join(getPetPath(), 'brand', 'icon-gutto.png')); }
    catch (e) { pushLog('boot', `dock icon fail: ${e.message}`); }
  }
  createPetWindow();
  auditManifestRows(getPetPath());
  startApprovalWatcher();
  registerApprovalHotkeys();
  startEventWatcher();
  bondDailyVisit();      // v44.3 羁绊：每日回访对账（开场行演完再报连访天数）
  setTimeout(checkSpecialDay, 10000);   // v44.16 C-2：开机看一眼今天是什么日子（10s——错开场行 8s hold 与首启气泡，审稿 P2-8）
  // v44.15 L-1（round4 full-stack-deep-review）：常驻壳跨天不重启 → boot 单次
  // 调用=连开几天 visit 分丢失、streak 归 1 重算。10min 一查，**日期真变了才
  // 调**——visitToday 幂等但 bondDailyVisit 尾部无条件落盘+日志，裸 interval
  // 会每 10 分钟刷一条；跨零点第一查她会从正常路径报连访（isNew 分支）。
  if (BOND_ENABLED) {
    setInterval(() => {
      if (loadBondState().lastSeen === bondDateStr()) return;
      bondDailyVisit();
      checkSpecialDay();   // C-2：跨零点后第一查顺带看今天是什么日子
    }, 10 * 60 * 1000);
  }
  startBondMoments();    // v44.3 稀有小剧场（lv2 起低频惊喜）
  ensureTray();          // v44.7 A-3：托盘上岗（歇会儿的找回门面）
  pushLog('boot', `shell up · lang=${LANG} · home=${GUTTO_HOME}`);
  // v42.9 首跑引导：没配过 LLM 就打个招呼指路（一次性，配了就再不打扰）
  const envProbe = readTextSafe(path.join(GUTTO_HOME, 'env'));
  if (!envProbe.ok || !envProbe.text.includes('GUTTO_LLM_BASEURL')) {
    // round3 R-2：首启引导进字典——新用户对产品的第一句话
    // A-1（v44.17）：首启也出声（一次性事件，不算高频）
    const greet = t('firstrun.greet');
    setTimeout(() => {
      showBubble(greet);
      if (voiceOn()) speak(greet);
    }, 2500);
  }
  if (process.env.GUTTO_SHELL_AUTOTEST === '1') {
    setTimeout(autotestSequence, 2500);
  }
});

// 自动验收序列（GUTTO_SHELL_AUTOTEST=1）：右键菜单无法合成（同 mac 壳边界），
// 菜单直达的四扇窗走状态直驱。executeJavaScript 设值+派 input 事件 = 等价敲键。
// v42 追加审批卡链路：假入队 → 卡弹出 → 点允许 → 决策落盘 → 卡收起。
// v43.5 追加 GUTTO_SHOT_DIR=<dir>：autotest 在关键节点用 capturePage 落 PNG
//（app 截自家窗不依赖 TCC 屏幕录制权限——外部 screencapture 会被拦成黑图）。
// 截图目录与 GUTTO_TEST_HOME 同一口径：只认 /tmp/ 或仓库内（防 env 拐写任意路径）。
function resolveShotDir() {
  const raw = process.env.GUTTO_SHOT_DIR;
  if (!raw) return null;
  const p = path.resolve(raw);
  if (p.startsWith('/tmp/') || p.startsWith(REPO_ROOT + path.sep)) return p;
  return null;
}
// 截图名单（Mimosa L3 收口）：autotestShot 只认这份字面量清单，写盘文件名
// 不接受任何运行时拼值——新增截图先来此登记
const SHOT_ALLOW = new Set([
  'B0-lifecycle-boot', 'C0-chat-hints', 'A-settings', 'B-play-preview', 'B2-pet-playing',
  'B3-poke-bubble', 'B4-walking', 'C-records-activity', 'D-records-history', 'E-records-log',
  'F-icon-menu',
]);
async function autotestShot(name, win) {
  const dir = resolveShotDir();
  const clean = SHOT_ALLOW.has(name) ? name : '';   // 白名单外拒拍
  if (!dir || !clean || !win || win.isDestroyed()) return;
  try {
    const img = await win.webContents.capturePage();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${clean}.png`);
    // 落点终检：必须在截图目录内（与 resolveGuttoHome 同款 startsWith 白名单，纵深防御）
    if (!file.startsWith(dir + path.sep)) return;
    fs.writeFileSync(file, img.toPNG());
    pushLog('autotest', `shot ${clean} saved`);
  } catch (e) { pushLog('autotest', `shot ${clean} fail: ${e}`); }
}
function autotestSequence() {
  try {
    // v43：开场行证据（first-greeting/entrance）+ fps 状态条一并落日志
    // v44.4：+4.5s 落一张开场行截图——图集 20 行截尾事故后，登退场可见性要像素级取证
    setTimeout(() => autotestShot('B0-lifecycle-boot', petWin), 4500);
    // v44.6 U-2 取证：塞一条超长描述的自定义命令——+1.5s 的 '/' 提示列表里
    // 它必须被省略号截断而不是撑破 236px 面板（+2.6s 截图为证）
    // v44.8.1 审稿 L-3：只在隔离家（GUTTO_TEST_HOME 已设）写——README 的 QA
    // 口径不带隔离家，无条件写=往真实 ~/.gutto/commands 塞永久死档、还可能
    // 覆盖用户同名命令。末尾 30s 清掉，沙箱也不留垃圾。
    if (process.env.GUTTO_TEST_HOME) {
      try {
        const cdir = path.join(GUTTO_HOME, 'commands');
        fs.mkdirSync(cdir, { recursive: true });
        fs.writeFileSync(path.join(cdir, 'longdesc.md'),
          '---\ndescription: 这是一条特别特别长的自定义命令描述专门用来验收提示列表的省略号截断在 min-width 归零之后是否真正生效而不应该把两百三十六像素的面板撑破出去\n---\n\n验收用正文', 'utf8');
        setTimeout(() => {
          try { fs.unlinkSync(path.join(cdir, 'longdesc.md')); } catch (e) { /* 已不在 */ }
        }, 30000);
      } catch (e) { /* 写不进=提示列表只有内置短描述，取证降级 */ }
    }
    setTimeout(() => autotestShot('C0-chat-hints', chatWin), 2600);
    if (petWin) {
      const probeRow = (tag) => petWin.webContents.executeJavaScript(
        "window.__guttoRow || 'no-row-yet'"
      ).then((s) => pushLog('autotest', `boot row ${tag}: ${s}`))
        .catch((e) => pushLog('autotest', `boot probe fail: ${e}`));
      probeRow('t2.5s');
      setTimeout(() => probeRow('t7s'), 4500);
    }
    showChatInput();
    setTimeout(() => {
      chatWin && chatWin.webContents.executeJavaScript(
        "var i=document.getElementById('text'); i.value='/'; i.dispatchEvent(new Event('input'));"
      ).then(() => pushLog('autotest', 'slash typed'))
        .catch((e) => pushLog('autotest', `slash fail: ${e}`));
    }, 1500);
    setTimeout(() => {
      if (!chatWin) { pushLog('autotest', 'chatWin gone'); return; }
      chatWin.webContents.executeJavaScript(
        "var i=document.getElementById('text'); i.value='在吗？'; i.dispatchEvent(new Event('input')); " +
        "JSON.stringify({v: i.value, g: typeof window.gutto, s: typeof (window.gutto && window.gutto.submit)})"
      ).then((probe) => pushLog('autotest', `pre-click probe: ${probe}`))
        .then(() => chatWin.webContents.executeJavaScript(
          "document.getElementById('send').click(); JSON.stringify({v: document.getElementById('text').value})"
        )).then((r) => pushLog('autotest', `send clicked (after: ${r})`))
        .catch((e) => pushLog('autotest', `send fail: ${e}`));
    }, 4500);
    setTimeout(() => showSettings('settings'), 7500);
    // v42.7 供应商切换往返（+11s 点启用切走，+13.5s 点启用切回，外部对 env 验证）
    // v43.11 选择器随设置重做更新：.prov .btn → .item .chip-btn[data-act=use]
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        "var b=document.querySelector('#provChat .item:not(.active) .chip-btn[data-act=use]'); b ? (b.click(), 'enabled-another') : 'no-btn'"
      ).then((r) => pushLog('autotest', `prov switch away: ${r}`)).catch(() => {});
    }, 11000);
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        "var b=document.querySelector('#provChat .item:not(.active) .chip-btn[data-act=use]'); b ? (b.click(), 'enabled-back') : 'no-btn'"
      ).then((r) => pushLog('autotest', `prov switch back: ${r}`)).catch(() => {});
    }, 13500);
    // v42.9 拖拽 E2E（+16s：合成 mousedown/mousemove/mouseup，验证移窗+位置落盘）
    setTimeout(() => {
      if (!petWin) return;
      const before = petWin.getPosition();
      petWin.webContents.executeJavaScript(
        "(function(){var c=document.getElementById('stage');" +
        "var r=c.getBoundingClientRect();var cx=r.left+r.width/2, cy=r.top+r.height/2;" +
        "c.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:cx,clientY:cy,screenX:500,screenY:500,bubbles:true}));" +
        "window.dispatchEvent(new MouseEvent('mousemove',{clientX:cx+60,clientY:cy-40,screenX:560,screenY:460,bubbles:true}));" +
        "window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 'drag-dispatched';})()"
      ).then((r) => {
        setTimeout(() => {
          const after = petWin.getPosition();
          pushLog('autotest', `drag ${r}: (${before[0]},${before[1]}) -> (${after[0]},${after[1]}) ` +
            (after[0] !== before[0] || after[1] !== before[1] ? 'MOVED-OK' : 'NOT-MOVED-FAIL'));
        }, 1500);
      }).catch((e) => pushLog('autotest', `drag fail: ${e}`));
    }, 16000);
    // v44.9 跟随验收（+20.5s：真链路=renderer 合成拖拽事件→pet-move IPC→双窗搬）：
    // 开气泡→拖 80px→断言气泡窗仍锚在宠头顶（x 对中 ±6px、y=宠顶-气泡高-10 ±6px）
    setTimeout(() => {
      if (!petWin) return;
      try { showBubble('跟拍验收'); } catch (e) { pushLog('autotest', `follow bubble fail: ${e}`); }
      setTimeout(() => {
        petWin.webContents.executeJavaScript(
          "(async function(){var c=document.getElementById('stage');" +
          "var r=c.getBoundingClientRect();var cx=r.left+r.width/2, cy=r.top+r.height/2;" +
          "var sx=window.screenX+cx, sy=window.screenY+cy;" +
          "window.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:cx,clientY:cy,screenX:sx,screenY:sy,bubbles:true}));" +
          "for(var i=1;i<=10;i++){window.dispatchEvent(new MouseEvent('mousemove',{clientX:cx,clientY:cy,screenX:sx+i*8,screenY:sy+i*2,bubbles:true}));" +
          "await new Promise(function(res){setTimeout(res,16);});}" +
          "window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 'follow-drag-dispatched';})()"
        ).then((r) => {
          pushLog('autotest', `follow drag ${r}`);
          const pet = petWin.getBounds();
          const bub = bubbleWin && !bubbleWin.isDestroyed() ? bubbleWin.getBounds() : null;
          if (!bub) { pushLog('autotest', 'follow: bubble missing FAIL'); return; }
          const wantX = Math.round(pet.x + pet.width / 2 - 124);
          const ok = Math.abs(bub.x - wantX) <= 6 && Math.abs(bub.y - (pet.y - bub.height - 10)) <= 6;
          pushLog('autotest', `follow: pet=(${pet.x},${pet.y}) bubble=(${bub.x},${bub.y}) wantX=${wantX} ` +
            (ok ? 'ANCHORED-OK' : 'LEFT-BEHIND-FAIL'));
        }).catch((e) => pushLog('autotest', `follow fail: ${e}`));
      }, 1200);
    }, 20500);
    // v44.9 晃动验收（+25s：±24px 甩 8 下→pet-shaken→shake 池行 failed/angry/jumping）
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript(
        "(async function(){var c=document.getElementById('stage');" +
        "var r=c.getBoundingClientRect();var cx=r.left+r.width/2, cy=r.top+r.height/2;" +
        "var sx=window.screenX+cx, sy=window.screenY+cy;" +
        "window.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:cx,clientY:cy,screenX:sx,screenY:sy,bubbles:true}));" +
        "for(var i=1;i<=8;i++){window.dispatchEvent(new MouseEvent('mousemove',{clientX:cx,clientY:cy,screenX:sx+(i%2?24:-24),screenY:sy,bubbles:true}));" +
        "await new Promise(function(res){setTimeout(res,40);});}" +
        "window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 'shake-dispatched';})()"
      ).then((r) => pushLog('autotest', `shake ${r}`))
        .catch((e) => pushLog('autotest', `shake fail: ${e}`));
      setTimeout(() => {
        petWin.webContents.executeJavaScript("window.__guttoRow || 'no-row-yet'")
          .then((row) => pushLog('autotest', `shake row: ${row} ` +
            (['failed', 'angry', 'jumping'].includes(row) ? 'SHAKE-OK' : 'NO-REACTION-FAIL')))
          .catch((e) => pushLog('autotest', `shake probe fail: ${e}`));
      }, 800);
    }, 25000);
    // v43.6 右键图标条走查（自绘窗=可直驱，原生菜单不可测的边界翻篇）：
    // +7.9s 弹条+截图（stagger 后 6 图标在场）→ +9.0s 点「设置」图标 → 探设置窗在
    setTimeout(() => { try { showPetMenu(); } catch (e) { pushLog('autotest', `menu fail: ${e}`); } }, 7900);
    setTimeout(() => autotestShot('F-icon-menu', menuWin), 8600);
    setTimeout(() => {
      if (!menuWin) { pushLog('autotest', 'menu win missing'); return; }
      menuWin.webContents.executeJavaScript(
        "var n=[].slice.call(document.querySelectorAll('.item'))" +
        ".filter(function(b){return !b.classList.contains('dim');}).length;" +
        "JSON.stringify({live:n, iconsW:document.getElementById('icons').clientWidth})"
      ).then((r) => pushLog('autotest', `menu icons: ${r}`)).catch(() => {});
    }, 8700);
    setTimeout(() => {
      if (!menuWin) return;
      menuWin.webContents.executeJavaScript(
        "var b=[].slice.call(document.querySelectorAll('.item'))" +
        ".find(function(x){return x.getAttribute('aria-label').indexOf('设置')>=0 || x.getAttribute('aria-label').indexOf('Settings')>=0;});" +
        "b ? (b.click(), 'clicked') : 'settings-icon-missing'"
      ).then((r) => pushLog('autotest', `menu settings click: ${r}`)).catch((e) => pushLog('autotest', `menu click fail: ${e}`));
    }, 9000);
    // v43.5 动作预览 + 记录页走查：+9.3s 切玩法页 → +9.8s 点第二枚动作芯片 →
    // +10.6s 探宠窗状态条（应显示被点播的行名）→ +11.4/11.9/12.4s 记录页三子页轮切
    // GUTTO_SHOT_DIR 设置时，各节点 +250~500ms 落 PNG（设置窗 A-E + 宠窗 B2）
    setTimeout(() => autotestShot('A-settings', settingsWin), 8200);
    // v44.3 模型参数走查（+8.6s 点思考深度「高」芯片 → 外部对 env 验证）
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        "var c=document.querySelector('#llmThinkChips .chip-btn[data-v=high]'); c ? (c.click(), 'think-high') : 'no-chip'"
      ).then((r) => pushLog('autotest', `think chip: ${r}`)).catch(() => {});
    }, 8600);
    // v44.10 通用卡走查：语言行接线 + i18n（zh=通用/en=General）+ 选中芯片=当前语言
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        // IIFE 包裹：注入脚本与 settings.js 同一全局词法（顶层 const t 已被 createT 占用，
        // var t 直接 SyntaxError——v44.10 实测），隔离作用域才不撞房规里的 classic 撞名坑
        "(function(){var lt=document.getElementById('langTitle').textContent;" +
        "var lc=document.getElementById('langChips').children.length;" +
        "var ls=document.querySelector('#langChips .chip-btn.sel');" +
        "return JSON.stringify({title:lt, chips:lc, sel:(ls&&ls.dataset.v)||null});})()"
      ).then((r) => {
        let verdict = 'LANG-CARD-UNPARSEABLE';
        try { verdict = JSON.parse(r).chips === 4 ? 'LANG-CARD-OK' : 'LANG-CARD-FAIL'; } catch (e) { /* 原样落日志 */ }
        pushLog('autotest', `lang card: ${r} ${verdict}`);
      }).catch((e) => pushLog('autotest', `lang card fail: ${e}`));
    }, 12400);
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        "var b=document.querySelector('#seg [data-tab=play]'); b ? (b.click(), 'play-tab') : 'no-play-tab'"
      ).then((r) => pushLog('autotest', `preview tab: ${r}`)).catch((e) => pushLog('autotest', `preview tab fail: ${e}`));
    }, 9300);
    setTimeout(() => {
      if (!settingsWin) return;
      settingsWin.webContents.executeJavaScript(
        "var c=document.querySelectorAll('#plAnimChips .chip-btn');" +
        "c.length>1 ? (c[1].click(), c[1].dataset.anim) : (c[0] ? (c[0].click(), c[0].dataset.anim) : 'no-chip')"
      ).then((r) => pushLog('autotest', `preview chip clicked: ${r}`)).catch((e) => pushLog('autotest', `preview chip fail: ${e}`));
    }, 9800);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript(
        "window.__guttoRow || 'no-row'"
      ).then((s) => pushLog('autotest', `preview row probe: ${s}`)).catch(() => {});
    }, 10600);
    setTimeout(() => autotestShot('B-play-preview', settingsWin), 10300);
    setTimeout(() => autotestShot('B2-pet-playing', petWin), 10400);
    for (const [at, sub, shot] of [[11400, '', 'C-records-activity'],
                                   [11900, 'history', 'D-records-history'],
                                   [12400, 'log', 'E-records-log']]) {
      setTimeout(() => {
        if (!settingsWin) return;
        const expr = at === 11400
          ? "var b=document.querySelector('#seg [data-tab=records]'); b ? (b.click(), 'records-tab') : 'no-records-tab'"
          : `var b=document.querySelector('#recSub [data-sub=${sub}]'); b ? (b.click(), 'sub-${sub}') : 'no-${sub}'`;
        settingsWin.webContents.executeJavaScript(expr)
          .then((r) => pushLog('autotest', `records nav: ${r}`)).catch(() => {});
      }, at);
      setTimeout(() => autotestShot(shot, settingsWin), at + 250);
    }
    // v42 审批卡链路（+10s 假入队 → +13.5s 点允许 → 外部查决策文件）
    setTimeout(() => {
      runApprove(APPROVE_SH, ['enqueue', '--project', 'autotest-proj', '--tool', 'Bash',
        '--summary', '自动验收：这条请求应该被允许', '--source', 'claude'], (id) => {
        pushLog('autotest', `approval enqueued: ${id}`);
      });
    }, 10000);
    setTimeout(() => {
      if (!approvalWin) { pushLog('autotest', 'approval card missing'); return; }
      approvalWin.webContents.executeJavaScript(
        "var b=document.getElementById('allow'); b ? (b.click(), 'clicked') : 'no-button'"
      ).then((r) => pushLog('autotest', `approval allow clicked: ${r}`))
        .catch((e) => pushLog('autotest', `approval fail: ${e}`));
    }, 13500);
    // v42.1 look 链路（+16s：无 VL 配置时应出降级文案气泡）
    setTimeout(() => lookAtScreen('自动验收'), 16000);
    // v44 互动+漫游链路：+17s 真路径戳（合成 mousedown/up 无位移，走剪影命中/分区）→
    // +17.8s 探反应行 → +18.2s 气泡截图；+19.5s 分区摸头（__guttoPoke 直驱）；
    // +20.5s 强制散步（__guttoWalkNow，直驱执行链）→ 1.3s 后位移对账 ≥100px
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript(
        "(function(){var c=document.getElementById('stage');var r=c.getBoundingClientRect();" +
        "var cx=r.left+r.width/2, cy=r.top+r.height*0.7;" +
        "c.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:cx,clientY:cy,bubbles:true}));" +
        "c.dispatchEvent(new MouseEvent('mouseup',{button:0,clientX:cx,clientY:cy,bubbles:true}));" +
        "return 'poke-click-dispatched';})()"
      ).then((r) => pushLog('autotest', `poke click: ${r}`)).catch((e) => pushLog('autotest', `poke click fail: ${e}`));
    }, 17000);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript("window.__guttoRow || 'no-row'")
        .then((s) => pushLog('autotest', `poke row probe: ${s}`)).catch(() => {});
    }, 17800);
    setTimeout(() => autotestShot('B3-poke-bubble', bubbleWin), 18200);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript("window.__guttoPoke('pat'); 'pat-sent'")
        .then((r) => pushLog('autotest', r)).catch((e) => pushLog('autotest', `pat fail: ${e}`));
    }, 19500);
    setTimeout(() => {
      if (!petWin) return;
      const before = petWin.getPosition();
      petWin.webContents.executeJavaScript("window.__guttoWalkNow() ? 'walk-started' : 'walk-refused'")
        .then((r) => pushLog('autotest', `${r} from (${before[0]},${before[1]})`))
        .catch((e) => pushLog('autotest', `walk fail: ${e}`));
      setTimeout(() => {
        if (!petWin) return;
        const after = petWin.getPosition();
        const dist = Math.abs(after[0] - before[0]);
        pushLog('autotest', `walk moved: ${dist}px -> (${after[0]},${after[1]}) ` +
          (dist >= 100 ? 'WALK-OK' : 'WALK-FAIL'));
      }, 1300);
    }, 20500);
    setTimeout(() => autotestShot('B4-walking', petWin), 21200);
    // v44.3 羁绊落盘证据：+26.2s 读 bond.json（17s/19.5s 两次互动应已入账）
    setTimeout(() => {
      try {
        const st = JSON.parse(fs.readFileSync(path.join(GUTTO_HOME, 'bond.json'), 'utf8'));
        pushLog('autotest', `bond: ${st.points} pts, streak ${st.streak}, today ${JSON.stringify(st.today)}`);
      } catch (e) { pushLog('autotest', 'bond file missing'); }
    }, 26200);
    // v44.1 昼夜链路：+23s 强制入睡 → +23.7s 探睡态（row=sleep 且 asleep）→
    // +24.4s 戳醒（反应行接管）→ +25.1s 探醒态（非 sleep 且 !asleep）→ SLEEP-WAKE 判定
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript("window.__guttoSleepNow ? window.__guttoSleepNow() : 'no-hook'")
        .then((r) => pushLog('autotest', `sleep force: ${r}`)).catch((e) => pushLog('autotest', `sleep fail: ${e}`));
    }, 23000);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript(
        "JSON.stringify({row: window.__guttoRow, asleep: window.__guttoAsleep ? window.__guttoAsleep() : null})"
      ).then((s) => pushLog('autotest', `sleep probe: ${s}`)).catch(() => {});
    }, 23700);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript("window.__guttoPoke('hit'); 'wake-poke-sent'")
        .then((r) => pushLog('autotest', r)).catch((e) => pushLog('autotest', `wake fail: ${e}`));
    }, 24400);
    setTimeout(() => {
      if (!petWin) return;
      petWin.webContents.executeJavaScript(
        "JSON.stringify({row: window.__guttoRow, asleep: window.__guttoAsleep()})"
      ).then((s) => {
        let ok = false;
        try { const o = JSON.parse(s); ok = o.row !== 'sleep' && o.asleep === false; } catch (e) { /* 解析失败按 FAIL */ }
        pushLog('autotest', `wake probe: ${s} ${ok ? 'SLEEP-WAKE-OK' : 'SLEEP-WAKE-FAIL'}`);
      }).catch(() => {});
    }, 25100);
  } catch (e) {
    pushLog('autotest', String(e));
  }
}

app.on('window-all-closed', () => app.quit());
