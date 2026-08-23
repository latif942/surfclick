const { BrowserWindow, screen } = require('electron');
const path = require('path');

let overlayWindow = null;

function createOverlay() {
  if (overlayWindow) return overlayWindow;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width: 220,
    height: 200,
    x: width - 240,
    y: 20,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/overlayPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  overlayWindow.on('closed', () => { overlayWindow = null; });
  return overlayWindow;
}

function destroyOverlay() {
  overlayWindow?.destroy();
  overlayWindow = null;
}

module.exports = {
  createOverlay,
  destroyOverlay,
  getWindow: () => overlayWindow,
};