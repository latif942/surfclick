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

// Wires up the currently-saved activation binding (keyboard key or mouse
// button, including side buttons) to start/stop the clicker. Sends
// separate down/up IPC events so the renderer can do real toggle vs hold.
function registerCurrentBinding() {
  const { activationKey } = store.getSettings();
  hotkeys.registerActivation(activationKey, {
    onDown: () => mainWindow?.webContents.send('hotkey:down'),
    onUp: () => mainWindow?.webContents.send('hotkey:up'),
  });
}

app.whenReady().then(() => {
  createWindow();
  registerCurrentBinding();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  hotkeys.shutdown();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  hotkeys.shutdown();
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
//
// The renderer can't see side mouse buttons or global key presses on its
// own, so capturing a new binding also happens through the raw input hook
// in the main process. The renderer calls startCapture, then waits for the
// 'hotkey:captured' push event with whatever key/button came in next.

ipcMain.handle('hotkey:startCapture', () => {
  hotkeys.startCapture((binding) => {
    if (!binding) return; // capture unavailable (uiohook failed to load)
    store.setSettings({ activationKey: binding });
    registerCurrentBinding();
    mainWindow?.webContents.send('hotkey:captured', {
      ...binding,
      label: hotkeys.bindingLabel(binding),
    });
  });
  return true;
});

ipcMain.handle('hotkey:cancelCapture', () => {
  hotkeys.cancelCapture();
  return true;
});
