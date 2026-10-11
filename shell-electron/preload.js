const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gutto', {
  setClickThrough: (through) => ipcRenderer.send('click-through', through),
  // SPEC v2 包读取（主进程 fs —— renderer 的 file:// fetch 被 Chromium 拦）
  loadManifest: (petPath) => ipcRenderer.invoke('load-manifest', petPath),
  loadRow: (petPath, relPath) => ipcRenderer.invoke('load-row', petPath, relPath),
  // 阶段 1：右键菜单（renderer 判定剪影命中后才发）+ 聊天期间的行接管
  contextMenu: () => ipcRenderer.send('pet-contextmenu'),
  onPlayRow: (cb) => ipcRenderer.on('play-row', (_ev, name, holdSeconds) => cb(name, holdSeconds)),
  // v42.9：拖拽（剪影命中按住拖动，main 移窗）
  petMove: (dx, dy) => ipcRenderer.send('pet-move', dx, dy),
  // v44 互动+漫游：摸头/戳（renderer 按命中高度分区）+ 走动步进
  //（main 按工作区边界钳制后回实移量）+ 闸门广播（面板在场不许散步）
  petPoked: (zone) => ipcRenderer.send('pet-poked', zone),
  // v44.9：拿起来晃（renderer 检测甩动翻向后上报，main 走 shake 反应池）
  petShaken: () => ipcRenderer.send('pet-shaken'),
  walkStep: (dx) => ipcRenderer.invoke('walk-step', dx),
  onWalkGate: (cb) => ipcRenderer.on('walk-gate', (_ev, blocked) => cb(blocked)),
  // v43：生命周期——首次使用旗标（登场/退场/首用三件套，主人拍板）
  firstRun: () => ipcRenderer.invoke('first-run'),
});
