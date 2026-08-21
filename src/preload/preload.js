const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('surfaceClicker', {
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

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

  // activation key
  setHotkey: (accelerator) => ipcRenderer.invoke('hotkey:set', accelerator),
  onHotkeyTriggered: (callback) => {
    ipcRenderer.on('hotkey:triggered', () => callback());
  },
});
