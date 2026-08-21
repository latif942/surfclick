const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const store = require('./store');
const clicker = require('./clicker');
const hotkeys = require('./hotkeys');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 780,
    minHeight: 560,
    backgroundColor: '#050006',
    icon: path.join(__dirname, '../../assets/SurfaceClicker.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Uncomment while developing to open devtools automatically
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  hotkeys.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  hotkeys.unregisterAll();
  clicker.stop();
});

// ---- IPC: settings persistence ----

ipcMain.handle('settings:get', () => store.getSettings());

ipcMain.handle('settings:set', (_event, partial) => {
  const updated = store.setSettings(partial);
  return updated;
});

ipcMain.handle('presets:list', () => store.getPresets());

ipcMain.handle('presets:save', (_event, preset) => store.savePreset(preset));

ipcMain.handle('presets:delete', (_event, id) => store.deletePreset(id));

// ---- IPC: clicker control ----

ipcMain.handle('clicker:start', (_event, { cps, dutyCycle }) => {
  clicker.start({ cps, dutyCycle }, (status) => {
    mainWindow?.webContents.send('clicker:status', status);
  });
  return true;
});

ipcMain.handle('clicker:stop', () => {
  clicker.stop();
  return true;
});

// ---- IPC: activation key capture ----

ipcMain.handle('hotkey:set', (_event, accelerator) => {
  const ok = hotkeys.registerActivationKey(accelerator, () => {
    mainWindow?.webContents.send('hotkey:triggered');
  });
  if (ok) store.setSettings({ activationKey: accelerator });
  return ok;
});
