const { contextBridge, ipcRenderer } = require('electron');

// 子窗（聊天输入/气泡/设置）共用的桥。renderer 无 node，文件读写全走 main，
// 契约解析在各自页面 JS 里做（纯函数已在 core/parse.js 过单测，语义同源）。
contextBridge.exposeInMainWorld('gutto', {
  // 聊天
  hints: () => ipcRenderer.invoke('chat-hints'),
  submit: (text) => ipcRenderer.send('chat-submit', text),
  // 输入窗尺寸（提示列表出现/消失 → 面板向下生长，顶边锚在宠脚）
  setSize: (height) => ipcRenderer.send('chat-input-size', height),
  closeMe: () => ipcRenderer.send('chat-close'),
  // 气泡
  onBubble: (cb) => ipcRenderer.on('bubble-show', (_ev, text) => cb(text)),
  bubbleReady: (height) => ipcRenderer.send('bubble-size', height),
  // 契约文件
  read: (name) => ipcRenderer.invoke('gutto-read', name),
  saveEnv: (payload) => ipcRenderer.invoke('gutto-save-env', payload),
  savePersona: (text) => ipcRenderer.invoke('gutto-save-persona', text),
  revertPersona: () => ipcRenderer.invoke('gutto-revert-persona'),
  // 日志（main 进程滚动缓冲）
  logLines: () => ipcRenderer.invoke('log-lines'),
  // 设置窗页签直达（右键菜单 → 已开的设置窗切页）
  onSettingsTab: (cb) => ipcRenderer.on('settings-tab', (_ev, tab) => cb(tab)),
  // 审批卡（v42）
  onApproval: (cb) => ipcRenderer.on('approval-show', (_ev, payload) => cb(payload)),
  approvalDecide: (payload) => ipcRenderer.send('approval-decide', payload),
  approvalReady: (height) => ipcRenderer.send('approval-size', height),
  // 记忆管理 + 角色卡导入（v42）
  compactNow: () => ipcRenderer.invoke('compact-now'),
  importCard: () => ipcRenderer.invoke('import-card'),
  // 玩法页（v42.4）
  saveEnvKeys: (changes) => ipcRenderer.invoke('save-env-keys', changes),
  runHooksInstall: () => ipcRenderer.invoke('run-hooks-install'),
  openCommandsFolder: () => ipcRenderer.invoke('open-commands-folder'),
  // 投喂（v44.17 C-3）：玩法页按钮 → 壳侧记账+演出
  feedPet: () => ipcRenderer.send('feed-pet'),
  // 动作预览（v43.5）：芯片点播 → 宠窗播一行
  playRow: (name, hold) => ipcRenderer.send('play-row-request', name, hold),
  // 右键图标条（v43.6，参考搜狗工具条）：菜单项注入 + 动作回传 + 收条
  onMenuShow: (cb) => ipcRenderer.on('menu-show', (_ev, items) => cb(items)),
  menuAction: (action) => ipcRenderer.send('menu-action', action),
  menuHide: () => ipcRenderer.send('menu-hide'),
  // 供应商档案（v42.7 学 cc-switch）
  saveProviders: (obj) => ipcRenderer.invoke('save-providers', obj),
  activateProvider: (group, id) => ipcRenderer.invoke('activate-provider', group, id),
  // 聊天记录清空（v42.9）
  clearHistory: () => ipcRenderer.invoke('clear-history'),
});
