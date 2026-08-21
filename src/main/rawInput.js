// Thin wrapper around uiohook-napi - a global keyboard/mouse hook.
//
// This is what makes two things possible that Electron's globalShortcut
// can't do on its own:
//   1. Side mouse buttons (mouse4/mouse5) as an activation input.
//   2. True hold-mode: knowing when a key/button is *released*, not just
//      pressed, so a global hotkey can behave like an actual held button.
//
// Note: on macOS this requires the app to be granted Accessibility +
// Input Monitoring permissions (System Settings -> Privacy & Security).
// On Linux it needs an X11 session (Wayland support in libuiohook is
// limited). Windows works out of the box.

let uIOhook;
let UiohookKey;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (err) {
  console.warn(
    'Could not load uiohook-napi. Run `npm install` first. ' +
      'Global hotkeys / side-button support will be a no-op until then.'
  );
}

let started = false;

function ensureStarted() {
  if (!uIOhook || started) return;
  try {
    uIOhook.start();
    started = true;
  } catch (err) {
    console.error('Failed to start uiohook:', err);
  }
}

function shutdown() {
  if (!uIOhook || !started) return;
  try {
    uIOhook.stop();
  } catch (err) {
    console.error('Failed to stop uiohook:', err);
  }
  started = false;
}

// Build a reverse lookup of keycode -> readable key name (e.g. 96 -> "F6")
// from whatever keys uiohook-napi's UiohookKey enum exposes.
const KEY_NAME_BY_CODE = {};
if (UiohookKey) {
  for (const [name, code] of Object.entries(UiohookKey)) {
    // Prefer shorter / more common aliases if there happen to be dupes.
    if (!(code in KEY_NAME_BY_CODE)) {
      KEY_NAME_BY_CODE[code] = name;
    }
  }
}

const MOUSE_BUTTON_LABELS = {
  1: 'Mouse Left',
  2: 'Mouse Right',
  3: 'Mouse Middle',
  4: 'Mouse 4', // "back" side button
  5: 'Mouse 5', // "forward" side button
};

module.exports = {
  uIOhook,
  UiohookKey,
  isAvailable: !!uIOhook,
  ensureStarted,
  shutdown,
  KEY_NAME_BY_CODE,
  MOUSE_BUTTON_LABELS,
};
