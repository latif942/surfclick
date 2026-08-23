const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('surfaceClicker', {
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  uninstallApp: () => ipcRenderer.invoke('app:uninstall'),

  // presets (cps + duty cycle only)
  listPresets: () => ipcRenderer.invoke('presets:list'),
  savePreset: (preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),

  // clicker control
  startClicking: (params) => ipcRenderer.invoke('clicker:start', params),
  stopClicking: () => ipcRenderer.invoke('clicker:stop'),
  onStatus: (callback) => {
    ipcRenderer.on('clicker:status', (_event, status) => callback(status));
  },

  // activation key (keyboard key or mouse button, incl. side buttons)
  startHotkeyCapture: () => ipcRenderer.invoke('hotkey:startCapture'),
  cancelHotkeyCapture: () => ipcRenderer.invoke('hotkey:cancelCapture'),
  onHotkeyCaptured: (callback) => {
    ipcRenderer.on('hotkey:captured', (_event, binding) => callback(binding));
  },
  onHotkeyDown: (callback) => {
    ipcRenderer.on('hotkey:down', () => callback());
  },
  onHotkeyUp: (callback) => {
    ipcRenderer.on('hotkey:up', () => callback());
  },
    // window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings:updated', (_event, settings) => callback(settings));
  },
});
