// gutto Electron 壳 · renderer：SPEC v2 按行解码 + LRU + 60fps rAF + 剪影穿透。
// 三闸对应的实现：
//   闸1 真透明  —— main.js 窗口参数 + body transparent（本文件无背景色）
//   闸2 点击穿透 —— mousemove 采样当前帧 alpha，剪影外 setClickThrough(true)
//   闸3 60fps   —— rAF 驱动 + manifest 帧时长步进（fps 证据由 autotest 截图链验证）
// 内存纪律（SPEC v2 §5 同构 mac 壳）：启动只解 idle 行，其余行走 LRU(4+idle)。
// v43.9：调试状态条（#stat）撤——正式壳不露帧率内账；autotest 探针改走
// window.__guttoRow（每次切行更新，验收点播/轮换仍可断言）。
'use strict';

// v44.10 审稿 H-2 配套：renderer 的未处理拒绝主进程收不到（process 级 handler
// 只管主进程）——桥成 console.error，经 petWin 的 console-message 监听落 shell.log
window.addEventListener('unhandledrejection', (ev) => {
  console.error(`[pet] unhandled rejection: ${ev.reason && ev.reason.message || ev.reason}`);
});
window.addEventListener('error', (ev) => {
  console.error(`[pet] page error: ${ev.message}`);
});

const params = new URLSearchParams(location.search);
const PET_PATH = params.get('pet');
const SCALE = parseFloat(params.get('scale') || '0.65');
// v44 漫游总闸：GUTTO_WALK=0 时 main 传 walk=0（env 开关不进 renderer，走 query）
const WALK_ENABLED = params.get('walk') !== '0';
// v44.1 入睡总闸：GUTTO_SLEEP=0 时 main 传 sleep=0（同上）
const SLEEP_ENABLED = params.get('sleep') !== '0';

const LR_KEEP = 4;           // LRU 容量（idle 另钉住）——与 mac 壳同值
const HIT_ALPHA_FLOOR = 10;  // 与 mac 壳 hitGrid 同阈值

const state = {
  manifest: null,
  rowsByAnim: new Map(),   // animation -> {bitmap: ImageBitmap, frameCount, durations}
  lru: [],                 // 非 idle 行的最近使用序（front = newest）
  canvas: document.getElementById('stage'),
  frameIndex: 0,
  frameShownAt: 0,
  current: 'idle',
  rowSwitchAt: 0,
  forcedUntil: 0,           // v44：play-row 强制接管到期（漫游不抢点播/聊天的戏）
  scheduler: new GuttoCore.AmbientScheduler(),
};

function setCurrent(name) {
  state.current = name;
  window.__guttoRow = name;    // 测试探针（AUTOTEST 日志取证用）
}

async function decodeRow(animation, row) {
  const buf = await window.gutto.loadRow(PET_PATH, row.path);
  const blob = new Blob([buf], { type: 'image/webp' });
  const bitmap = await createImageBitmap(blob);
  state.rowsByAnim.set(animation, {
    bitmap, frameCount: row.frameCount,
    durations: row.frameDurationsMilliseconds,
    cellW: bitmap.width / Math.max(1, row.frameCount),
    cellH: bitmap.height,
  });
  if (animation !== 'idle') {
    state.lru = state.lru.filter((a) => a !== animation);
    state.lru.unshift(animation);
    while (state.lru.length > LR_KEEP) {
      const evict = state.lru.pop();
      state.rowsByAnim.delete(evict); // ImageBitmap 随引用释放（close() 保险见下）
    }
  }
}

function touchRow(animation) {
  state.lru = state.lru.filter((a) => a !== animation);
  state.lru.unshift(animation);
}

async function ensureRow(animation) {
  if (state.rowsByAnim.has(animation)) {
    if (animation !== 'idle') touchRow(animation);
    return state.rowsByAnim.get(animation);
  }
  const row = state.manifest.rows.find((r) => r.animation === animation);
  if (!row) return state.rowsByAnim.get('idle');
  await decodeRow(animation, row);
  return state.rowsByAnim.get(animation);
}

function drawFrame(entry, index, tnow) {
  const { canvas } = state;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { bitmap, cellW, cellH, durations, frameCount } = entry;
  const dpr = window.devicePixelRatio || 2;
  const dw = Math.round(cellW * SCALE);
  const dh = Math.round(cellH * SCALE);
  if (canvas.width !== dw * dpr) {
    canvas.width = dw * dpr;
    canvas.height = dh * dpr;
    canvas.style.width = `${dw}px`;
    canvas.style.height = `${dh}px`;
  }
  const sx = (index % frameCount) * cellW;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, 0, cellW, cellH, 0, 0, canvas.width, canvas.height);
  void durations; void tnow;
}

// 剪影命中：当前显示帧的指针位 alpha 采样（1px，命中阈值同 mac 壳）
function silhouetteHit(x, y) {
  const entry = state.rowsByAnim.get(state.current);
  if (!entry) return true;
  const ctx = state.canvas.getContext('2d', { willReadFrequently: true });
  const dpr = window.devicePixelRatio || 2;
  const px = Math.min(state.canvas.width - 1, Math.max(0, Math.round(x * dpr)));
  const py = Math.min(state.canvas.height - 1, Math.max(0, Math.round(y * dpr)));
  const a = ctx.getImageData(px, py, 1, 1).data[3];
  return a > HIT_ALPHA_FLOOR;
}

function wireClickThrough() {
  let last = null;
  window.addEventListener('mousemove', (ev) => {
    if (dragState.active) return;   // 拖拽期间不动穿透开关
    const hit = silhouetteHit(ev.clientX, ev.clientY);
    if (hit !== last) {
      last = hit;
      window.gutto.setClickThrough(!hit);
    }
  });
  // 阶段 1：右键菜单——剪影命中才弹（穿透态的右键属于桌面，不是她的）
  window.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (silhouetteHit(ev.clientX, ev.clientY)) window.gutto.contextMenu();
  });
  // v42.9：拖拽——剪影上按住拖动她（≥3px 才算拖，免得误吞点击）
  // v44：按住没拖成=一次互动（上段摸头/下段戳）；上手抓她时散步立刻停
  // v44.16 C-4：mousemove 记位移样本（释放速度取样），松手有速度=抛掷滑行
  window.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || !silhouetteHit(ev.clientX, ev.clientY)) return;
    abortWalk();
    abortFling();
    noteActivity();
    dragState.wasAsleep = wake();   // 状态先醒；懒腰挪到 mouseup（点一下会被 poke 反应行盖掉）
    dragState.active = true;
    dragState.lastX = ev.screenX;
    dragState.lastY = ev.screenY;
    dragState.startY = ev.clientY;
    dragState.moved = false;
    dragState.samples = [];
    resetShake();
  });
  window.addEventListener('mousemove', (ev) => {
    if (!dragState.active) return;
    const dx = ev.screenX - dragState.lastX;
    const dy = ev.screenY - dragState.lastY;
    if (!dragState.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    dragState.moved = true;
    dragState.lastX = ev.screenX;
    dragState.lastY = ev.screenY;
    window.gutto.petMove(dx, dy);
    dragState.samples.push({ t: performance.now(), dx });
    // 审稿 P2-6：释放速度只看 90ms 窗——样本留 24 条足够，长按拖几分钟不积攒
    if (dragState.samples.length > 24) dragState.samples.shift();
    trackShake(dx, dy);   // v44.9：拿在手里快速甩=一次晃动互动
  });
  window.addEventListener('mouseup', () => {
    if (dragState.active && !dragState.moved) sendPoke(dragState.startY);
    // v44.16 C-4：有速度的松手=抛出去（惯性滑行→撞边反弹→摩擦停步→落地挤压）
    if (dragState.active && dragState.moved) {
      const v = GuttoInteract.releaseVelocity(dragState.samples, performance.now());
      if (Math.abs(v) >= GuttoInteract.FLING.MIN_V) startFling(v);
    }
    // v44.2：拽醒的懒腰在松手时才演——mousedown 就演会被 0.1s 后的 poke 反应行盖掉
    if (dragState.active && dragState.moved && dragState.wasAsleep && !fling.active) {
      playRowLocal(GuttoRhythm.WAKE_ROW, 2.5);
    }
    dragState.active = false;
  });
  // 聊天期间的行接管：等回复演 think，回复后短停一拍回 ambient 轮换
  if (window.gutto.onPlayRow) {
    window.gutto.onPlayRow((name, holdSeconds) => {
      abortWalk();               // v44：聊天/点播接管，散步让位
      abortFling();              // v44.16：点播接管，滑行也停（演什么戏听新的）
      wake();                     // v44.1：任何点播都叫得醒（戳醒走反应行，这里兜底）
      noteActivity();
      playRowLocal(name, holdSeconds || 6);
    });
  }
  // v44 漫游闸门：输入条/图标条/审批卡在场=不散步（这些面板锚在她身上）
  if (window.gutto.onWalkGate) {
    window.gutto.onWalkGate((blocked) => {
      walk.gateBlocked = !!blocked;
      // 审稿 P1-1：闸门落下滑行也停——否则歇会儿/图标条/审批卡在场时她
      // 隐身滑行搬家（walkStep handler 不看闸门），回来人已换位、面板脱锚
      if (blocked) { abortWalk(); abortFling(); }
    });
  }
}

const dragState = { active: false, lastX: 0, lastY: 0, moved: false, startY: 0, wasAsleep: false, shake: null, samples: [] };

// ── v44.9 晃动检测：任一轴 SWING_PX 起算翻向，WINDOW_MS 内翻满 FLIPS 次=晃了一下；
// COOLDOWN_MS 冷却防一场甩演成连播。阈值口径：单次位移 ≥14px 才算一甩（慢拖同向不计）。
const SHAKE = { SWING_PX: 14, WINDOW_MS: 700, FLIPS: 3, COOLDOWN_MS: 2500 };
function resetShake() {
  dragState.shake = { dir: { x: 0, y: 0 }, flips: { x: 0, y: 0 }, firstFlipAt: { x: 0, y: 0 }, lastEmitAt: 0 };
}
function trackShake(dx, dy) {
  const st = dragState.shake;
  if (!st) return;
  const now = performance.now();
  for (const axis of ['x', 'y']) {
    const delta = axis === 'x' ? dx : dy;
    if (Math.abs(delta) < SHAKE.SWING_PX) continue;
    const dir = delta > 0 ? 1 : -1;
    if (dir === st.dir[axis]) continue;
    st.dir[axis] = dir;
    if (st.flips[axis] > 0 && now - st.firstFlipAt[axis] > SHAKE.WINDOW_MS) st.flips[axis] = 0;
    if (st.flips[axis] === 0) st.firstFlipAt[axis] = now;
    st.flips[axis] += 1;
  }
  if (st.flips.x < SHAKE.FLIPS && st.flips.y < SHAKE.FLIPS) return;
  if (now - st.lastEmitAt < SHAKE.COOLDOWN_MS) return;
  st.lastEmitAt = now;
  st.flips.x = 0;
  st.flips.y = 0;
  window.gutto.petShaken();
}

// v44 互动：命中点落画布上 45% 算摸头、其余算戳（分区阈值与剪影阈值同文件内聚）
function sendPoke(clientY) {
  const rect = state.canvas.getBoundingClientRect();
  if (!rect.height) return;
  const zone = clientY - rect.top < rect.height * 0.45 ? 'pat' : 'hit';
  window.gutto.petPoked(zone);
}

function hasRow(name) {
  return state.manifest.rows.some((r) => r.animation === name);
}

// ── v44 漫游：WANDER 节律（mac 壳同值——两壳性格一致）───────────────
// 40-80s 试探一次、走完冷却 90-180s、步速 190pt/s、步幅 160-320pt；
// 屏边 40pt 止步（钳制在 main walk-step，实移量回传）。安静是常态，散步是稀客。
// ambient.js 顶层 const WANDER 已占全局词法名（跨 classic script 共享）——重名声明
// = SyntaxError 整脚本死（QA44 实测），解构改名同源引用
const { WANDER: WANDER_CFG } = GuttoCore;
function randRange(range) { return range[0] + Math.random() * (range[1] - range[0]); }
const walk = {
  active: false,
  nextAttemptAt: performance.now() / 1000 + randRange(WANDER_CFG.triggerEveryS),
  stepTimer: null,
  gateBlocked: false,
};

function canWalkNow() {
  const nowS = performance.now() / 1000;
  return WALK_ENABLED && !walk.active && !fling.active && !walk.gateBlocked && !dragState.active && !rhythm.asleep
    && !(state.forcedUntil && nowS < state.forcedUntil)
    && (hasRow('running-left') || hasRow('running-right'));
}

function startWalk() {
  const hasLeft = hasRow('running-left');
  const hasRight = hasRow('running-right');
  if (!hasLeft && !hasRight) return false;
  const dir = !hasLeft ? 1 : !hasRight ? -1 : (Math.random() < 0.5 ? -1 : 1);
  const row = dir < 0 ? 'running-left' : 'running-right';
  const stride = WANDER_CFG.minimumStride * (1 + Math.random());
  const durationS = stride / WANDER_CFG.pointsPerSecond;
  const nowS = performance.now() / 1000;
  walk.active = true;
  setCurrent(row);
  state.frameIndex = 0;
  state.frameShownAt = 0;
  state.rowSwitchAt = nowS + durationS + 0.3;
  ensureRow(row);
  let travelled = 0;
  walk.stepTimer = setInterval(() => {
    const want = dir * WANDER_CFG.pointsPerSecond * 0.05;   // 50ms 一拍 ≈9.5pt
    window.gutto.walkStep(want).then((res) => {
      const moved = (res && res.moved) || 0;
      travelled += Math.abs(moved);
      // 撞屏边（实移≈0）或走满步幅：收步
      if (Math.abs(moved) < Math.abs(want) - 0.5 || travelled >= stride) {
        // v44.17 C-5 贴边坐：撞边收步后 1/4 概率就地坐下歇一会（v1 零台词零新素材；
        // 真攀窗要辅助功能权限，登记 P2）
        const atEdge = res && res.atEdge;
        finishWalk();
        if (atEdge && Math.random() < 0.25 && hasRow('sit')) playRowLocal('sit', 8);
      }
    }).catch(() => finishWalk());   // IPC 断了别吊着计时器
  }, 50);
  return true;
}

function finishWalk() {
  if (walk.stepTimer) { clearInterval(walk.stepTimer); walk.stepTimer = null; }
  walk.active = false;
  noteActivity();   // 散步也算活动：走完重记空闲起点
  walk.nextAttemptAt = performance.now() / 1000 + randRange(WANDER_CFG.cooldownS);
}

// 中断（被拽/被点播/闸门落下）：同样进冷却，行尽快归还 ambient
function abortWalk() {
  if (!walk.active) return;
  finishWalk();
  state.rowSwitchAt = Math.min(state.rowSwitchAt, performance.now() / 1000 + 0.4);
}

// ── v44.16 拖拽物理（C-4 抛掷）：有速度的松手=被抛出去 ──────────────
// 惯性滑行（水平）复用漫游 walk-step 通道（50ms 一拍，主进程钳屏边）；
// 撞边反弹衰减、摩擦耗尽停步（纯函数在 core/interact FLING/flingStep）。
// 落地/撞边演 squash（CSS 变形 .15s 微交互档，motion-standards 合规）——
// 零素材成本：sprite 不动，transform 挤压。
const fling = { active: false, vx: 0, timer: null };

let squashTimer = null;
function squash(strength = 1) {
  const c = state.canvas;
  if (!c) return;
  try {
    if (squashTimer) clearTimeout(squashTimer);   // 审稿 P2-10：重叠挤压不互掐（反弹拍别提前清掉落地蹲）
    c.style.transformOrigin = 'center bottom';
    c.style.transition = 'transform 0.15s ease-out';
    c.style.transform = `scaleY(${(1 - 0.18 * strength).toFixed(3)}) scaleX(${(1 + 0.12 * strength).toFixed(3)})`;
    squashTimer = setTimeout(() => { c.style.transform = ''; squashTimer = null; }, 160);
  } catch (e) { /* 变形是锦上添花，失败不影响滑行 */ }
}

function flingRow() {
  const row = fling.vx < 0 ? 'running-left' : 'running-right';
  return hasRow(row) ? row : null;
}

function startFling(vx0) {
  abortWalk();
  abortFling();
  if (flingRow() === null) return;   // 旧包没有 run 行=滑不动，原地放下
  fling.active = true;
  fling.vx = Math.max(-GuttoInteract.FLING.MAX_V, Math.min(GuttoInteract.FLING.MAX_V, vx0));
  playRowLocal(flingRow(), 4);       // 被抛着滑：演方向行（物理循环续期/收步交还）
  fling.timer = setInterval(() => {
    const want = fling.vx * 0.05;
    window.gutto.walkStep(want).then((res) => {
      const moved = (res && res.moved) || 0;
      const st = GuttoInteract.flingStep(fling.vx, want, moved);
      fling.vx = st.vx;
      if (st.bounce) squash(0.6);
      if (!fling.vx) return finishFling();
      const next = flingRow();
      if (!next) return finishFling();
      if (state.current !== next) playRowLocal(next, 4);   // 反弹换向换行
    }).catch(() => finishFling());   // IPC 断了别吊着计时器
  }, GuttoInteract.FLING.TICK_MS);
}

function finishFling() {
  if (fling.timer) { clearInterval(fling.timer); fling.timer = null; }
  fling.active = false;
  squash(1);   // 落地一蹲
  noteActivity();
  state.rowSwitchAt = Math.min(state.rowSwitchAt, performance.now() / 1000 + 0.5);   // 尽快交还 ambient
}

function abortFling() {
  if (!fling.active) return;
  if (fling.timer) { clearInterval(fling.timer); fling.timer = null; }
  fling.active = false;
}

// ── v44.1 昼夜：空闲够点入睡（白天 60s / 夜间 23-5 点 15s——mac 壳同值）──
// 台词层（晨/午/晚问候、晚安日报、23 点静默）归 gutto-life daemon，这里只管身子。
const rhythm = { asleep: false, lastActiveAt: performance.now() / 1000 };

function noteActivity() {
  rhythm.lastActiveAt = performance.now() / 1000;
}

// 本地起行（非 IPC 点播）：懒腰醒等自家演出走这里
function playRowLocal(name, holdSeconds) {
  setCurrent(name);
  state.rowSwitchAt = performance.now() / 1000 + holdSeconds;
  state.forcedUntil = state.rowSwitchAt;
  state.frameIndex = 0;
  state.frameShownAt = 0;
  ensureRow(name);
}

function enterSleep() {
  rhythm.asleep = true;
  setCurrent(GuttoRhythm.SLEEP_ROW);
  state.rowSwitchAt = Infinity;   // 睡着不换台（tnow >= Infinity 恒假）
  state.frameIndex = 0;
  state.frameShownAt = 0;
  ensureRow(GuttoRhythm.SLEEP_ROW);
}

// 任何互动都叫得醒：戳醒走反应行、点播走接管行——这里只交还轮换权
function wake() {
  if (!rhythm.asleep) return false;
  rhythm.asleep = false;
  noteActivity();
  state.rowSwitchAt = Math.min(state.rowSwitchAt, performance.now() / 1000 + 0.3);
  return true;
}

// v44.10 审稿 H-2：tick 曾裸奔——任一次解码/IPC reject 即永断帧循环（rAF 在
// 尾行，异常后永不执行），冻结对所有监控隐形（心跳在主进程照跳）。现最外层
// try/catch，rAF 挪进 finally：单帧失败只丢一帧，日志经 console-message 桥落盘。
async function tick(tnow) {
  try {
    const entry = await ensureRow(state.current);
    // 帧步进：按 manifest 帧时长累积（60fps 内容=17ms，全速跟 rAF）
    const durations = entry.durations && entry.durations.length ? entry.durations : [17];
    if (tnow - state.frameShownAt >= durations[state.frameIndex % durations.length]) {
      state.frameShownAt = tnow;
      state.frameIndex = (state.frameIndex + 1) % entry.frameCount;
      drawFrame(entry, state.frameIndex, tnow);
    }

    // 行为轮换（CORE ambient）：驻留到期换台（ambient 接管即解除强制标记；
    // 睡着时轮换暂停——醒来/入睡路径自行管理 rowSwitchAt）
    if (!rhythm.asleep && tnow / 1000 >= state.rowSwitchAt) {
      const next = state.scheduler.pick();
      setCurrent(next.animation);
      state.rowSwitchAt = tnow / 1000 + next.holdSeconds;
      state.forcedUntil = 0;
      state.frameIndex = 0;
      state.frameShownAt = 0;
      await ensureRow(state.current);
    }

    // v44 漫游试探：到期且闸门全开才出发；被拦就 40-80s 后再试
    if (!walk.active && tnow / 1000 >= walk.nextAttemptAt) {
      if (canWalkNow() && startWalk()) { /* 出发；冷却由 finishWalk 排 */ }
      else walk.nextAttemptAt = tnow / 1000 + randRange(WANDER_CFG.triggerEveryS);
    }

    // v44.1 入睡判定：非强制、非散步、非滑行、包里有 sleep 行、空闲够点（夜里 15s/白天 60s）
    if (SLEEP_ENABLED && !rhythm.asleep && !walk.active && !fling.active
        && !(state.forcedUntil && tnow / 1000 < state.forcedUntil)
        && hasRow(GuttoRhythm.SLEEP_ROW)
        && GuttoRhythm.shouldSleep({ idleSeconds: tnow / 1000 - rhythm.lastActiveAt, hour: new Date().getHours() })) {
      enterSleep();
    }
  } catch (e) {
    console.error(`[pet] tick fail: ${e && e.message || e}`);
  } finally {
    requestAnimationFrame(tick);   // 调度链不因单帧异常而断
  }
}

(async function boot() {
  state.manifest = JSON.parse(await window.gutto.loadManifest(PET_PATH));
  const idleRow = state.manifest.rows.find((r) => r.animation === 'idle');
  await decodeRow('idle', idleRow); // 启动只解 idle（SPEC v2 内存纪律）
  wireClickThrough();

  // v44 验收钩子：autotest 直驱（分区戳/强制散步——绕过闸门只走执行链）
  window.__guttoPoke = (zone) => window.gutto.petPoked(zone === 'pat' ? 'pat' : 'hit');
  window.__guttoWalkNow = () => startWalk();
  // v44.1 验收钩子：强制入睡 + 睡态探针
  window.__guttoSleepNow = () => (hasRow(GuttoRhythm.SLEEP_ROW) ? (enterSleep(), 'asleep') : 'no-sleep-row');
  window.__guttoAsleep = () => rhythm.asleep;

  // v43 生命周期开场：首次使用演 first-greeting，此后每次登场演 entrance；
  // 行不在包里（旧包）则静默回退 idle。hold=行全长+0.3s，到期自然交还 ambient。
  let holdSeconds = 8;
  try {
    const first = window.gutto.firstRun ? await window.gutto.firstRun() : false;
    const anim = first ? 'first-greeting' : 'entrance';
    const row = state.manifest.rows.find((r) => r.animation === anim);
    if (row) {
      await ensureRow(anim);
      setCurrent(anim);              // 测试探针同落 window.__guttoRow
      holdSeconds = row.frameDurationsMilliseconds
        .slice(0, row.frameCount).reduce((s, d) => s + d, 0) / 1000 + 0.3;
    }
  } catch { /* 生命周期行缺席/旗标失败=普通启动 */ }
  state.rowSwitchAt = performance.now() / 1000 + holdSeconds;
  requestAnimationFrame(tick);
})();
