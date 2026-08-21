// Registers the global activation key that starts/stops clicking.
//
// Note: Electron's globalShortcut API only supports keyboard accelerators
// (e.g. "F6", "CommandOrControl+Shift+K"). It does NOT support mouse side
// buttons (mouse4/mouse5). To support side-button activation, a native
// hook library like `iohook` would need to be added later - that's a
// separate, more involved integration since it requires listening to raw
// input events rather than registering a shortcut.

const { globalShortcut } = require('electron');

let currentAccelerator = null;

function registerActivationKey(accelerator, callback) {
  unregisterAll();

  try {
    const ok = globalShortcut.register(accelerator, callback);
    if (ok) {
      currentAccelerator = accelerator;
    }
    return ok;
  } catch (err) {
    console.error('Failed to register hotkey:', accelerator, err);
    return false;
  }
}

function unregisterAll() {
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator);
    currentAccelerator = null;
  }
}

module.exports = { registerActivationKey, unregisterAll };
