const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  getState: () => ipcRenderer.invoke('overlay:getState'),
  setCps: (cps) => ipcRenderer.invoke('overlay:setCps', cps),
  setDutyCycle: (dc) => ipcRenderer.invoke('overlay:setDutyCycle', dc),
  setAlwaysOnTop: (val) => ipcRenderer.invoke('overlay:setAlwaysOnTop', val),
  close: () => ipcRenderer.invoke('overlay:close'),
  onUpdate: (cb) => ipcRenderer.on('overlay:update', (_e, s) => cb(s)),
});