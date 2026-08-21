const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

const store = require('./store');
const clicker = require('./clicker');
const hotkeys = require('./hotkeys');

let mainWindow;

function createWindow() {
  // Remove the native menu bar entirely
  Menu.setApplicationMenu(null);

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
  // Push an explicit running:true status immediately so the UI doesn't wait
  mainWindow?.webContents.send('clicker:status', { running: true });
  return true;
});

ipcMain.handle('clicker:stop', () => {
  clicker.stop((status) => {
    mainWindow?.webContents.send('clicker:status', status);
  });
  // Push an explicit running:false immediately
  mainWindow?.webContents.send('clicker:status', { running: false });
  return true;
});

// ---- IPC: activation key capture ----

ipcMain.handle('hotkey:startCapture', () => {
  hotkeys.startCapture((binding) => {
    if (!binding) return;
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