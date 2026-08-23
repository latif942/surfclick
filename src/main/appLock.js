let activeWin;
try {
  activeWin = require('active-win');
} catch (err) {
  console.warn('active-win not installed. Run npm install active-win@7');
}

let enabled = false;
let targetTitle = '';

function setEnabled(val) {
  enabled = !!val;
}

function setTarget(title) {
  targetTitle = (title || '').toLowerCase();
}

async function isAllowed() {
  if (!enabled || !targetTitle) return true;
  if (!activeWin) return true;   // require('active-win') failed → always allowed
  try {
    const win = await activeWin();
    if (!win) return false;
    return win.title.toLowerCase().includes(targetTitle);
  } catch {
    return true;   // any error here → always allowed
  }
}

async function getCurrentWindowTitle() {
  if (!activeWin) return null;
  try {
    const win = await activeWin();
    return win?.title || null;
  } catch {
    return null;
  }
}


const { spawn } = require('child_process');

function listOpenWindows() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }
    const psCmd = "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty MainWindowTitle";
    const ps = spawn('powershell', ['-NoProfile', '-Command', psCmd]);
    let out = '';
    ps.stdout.on('data', (d) => (out += d.toString()));
    ps.on('close', () => {
      const titles = out
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);
      resolve([...new Set(titles)]);
    });
    ps.on('error', () => resolve([]));
  });
}

module.exports = { setEnabled, setTarget, isAllowed, getCurrentWindowTitle, listOpenWindows };
