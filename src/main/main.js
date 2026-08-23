const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const store = require('./store');
const clicker = require('./clicker');
const hotkeys = require('./hotkeys');
const edgeStop = require('./edgeStop');
const appLock = require('./appLock');

let mainWindow;

function createWindow() {
  // Remove the native menu bar entirely
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
      width: 940,
      height: 680,
      minWidth: 780,
      minHeight: 560,
      resizable: false,
      backgroundColor: '#050006',
      frame: false,
      icon: path.join(__dirname, '../../assets/SurfaceClicker.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  mainWindow.on('close', async (e) => {
    if (clicker.isRunning()) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Stop & Close'],
        defaultId: 0,
        cancelId: 0,
        title: 'Clicker is running',
        message: 'Surface Clicker is still running.',
        detail: 'Close anyway? This will stop the autoclicker.',
      });
      if (response === 1) {
        clicker.stop();
        mainWindow.destroy();
      }
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Uncomment while developing to open devtools automatically
  // mainWindow.webContents.openDevTools(); 
}

function applyLoginItemSettings(enabled) {
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
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
  edgeStop.init(() => {
    if (clicker.isRunning()) {
      clicker.stop((status) => mainWindow?.webContents.send('clicker:status', status));
      mainWindow?.webContents.send('clicker:status', { running: false });
    }
  });
  edgeStop.setEnabled(store.getSettings().edgeStop);
  applyLoginItemSettings(store.getSettings().launchOnStartup);
  appLock.setEnabled(store.getSettings().appLockEnabled);
  appLock.setTarget(store.getSettings().appLockTarget);

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
  if (partial.launchOnStartup !== undefined) {
    applyLoginItemSettings(partial.launchOnStartup);
    if (partial.edgeStop !== undefined) edgeStop.setEnabled(partial.edgeStop);
  }
  if (partial.appLockEnabled !== undefined) appLock.setEnabled(partial.appLockEnabled);
  if (partial.appLockTarget !== undefined) appLock.setTarget(partial.appLockTarget);
  mainWindow?.webContents.send('settings:updated', updated);
  return updated;
});

ipcMain.handle('app:uninstall', async () => {
  if (!app.isPackaged) {
    return { success: false, cancelled: false, message: 'Uninstall only works in a packaged build, not dev mode.' };
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 0,
    cancelId: 0,
    title: 'Uninstall Surface Clicker',
    message: 'Are you sure you want to uninstall Surface Clicker?',
    detail: process.platform === 'win32'
      ? 'This will open the Windows uninstaller.'
      : 'This will move the app to Trash and quit.',
  });

  if (response !== 1) return { success: false, cancelled: true };

  try {
    if (process.platform === 'win32') {
      const uninstallerPath = path.join(path.dirname(process.execPath), 'Uninstall Surface Clicker.exe');
      if (!fs.existsSync(uninstallerPath)) {
        return { success: false, cancelled: false, message: 'Uninstaller not found.' };
      }
      spawn(uninstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      const appPath = process.execPath.split('.app')[0] + '.app';
      const script = `sleep 1 && osascript -e 'tell application "Finder" to delete POSIX file "${appPath}"'`;
      spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'linux') {
      const appImagePath = process.env.APPIMAGE;
      if (!appImagePath) {
        return { success: false, cancelled: false, message: 'Could not detect AppImage path.' };
      }
      spawn('/bin/sh', ['-c', `sleep 1 && rm -f "${appImagePath}"`], { detached: true, stdio: 'ignore' }).unref();
    }

    setTimeout(() => app.quit(), 300);
    return { success: true, cancelled: false };
  } catch (err) {
    console.error('Uninstall failed:', err);
    return { success: false, cancelled: false, message: err.message };
  }
});

ipcMain.handle('presets:list', () => store.getPresets());

ipcMain.handle('presets:save', (_event, preset) => store.savePreset(preset));

ipcMain.handle('presets:delete', (_event, id) => store.deletePreset(id));

// ---- IPC: clicker control ----

ipcMain.handle('clicker:start', (_event, { cps, dutyCycle, clickButton }) => {
  clicker.start({ cps, dutyCycle, clickButton }, (status) => {
    mainWindow?.webContents.send('clicker:status', status);
  });
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

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
  return true;
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
  return true;
});

ipcMain.handle('applock:listWindows', () => appLock.listOpenWindows()); 