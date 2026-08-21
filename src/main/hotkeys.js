// Registers the activation input (keyboard key OR mouse button, including
// side buttons mouse4/mouse5) and reports down/up events separately so the
// renderer can implement real toggle vs. hold behavior.
//
// A "binding" looks like one of:
//   { type: 'keyboard', keyName: 'F6' }
//   { type: 'mouse', button: 4 }

const {
  uIOhook,
  isAvailable,
  ensureStarted,
  KEY_NAME_BY_CODE,
  MOUSE_BUTTON_LABELS,
} = require('./rawInput');

let activeBinding = null;
let activeHandlers = null; // { onDown, onUp }

let captureCallback = null;
let captureTimeout = null;

let listening = false;

function bindingLabel(binding) {
  if (!binding) return null;
  if (binding.type === 'keyboard') return binding.keyName;
  if (binding.type === 'mouse') {
    return MOUSE_BUTTON_LABELS[binding.button] || `Mouse ${binding.button}`;
  }
  return null;
}

function bindingsMatch(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'keyboard') return a.keyName === b.keyName;
  if (a.type === 'mouse') return a.button === b.button;
  return false;
}

function finishCapture(binding) {
  const cb = captureCallback;
  captureCallback = null;
  if (captureTimeout) {
    clearTimeout(captureTimeout);
    captureTimeout = null;
  }
  cb?.(binding);
}

function handleKeyDown(evt) {
  const keyName = KEY_NAME_BY_CODE[evt.keycode] || `Key${evt.keycode}`;
  if (captureCallback) {
    finishCapture({ type: 'keyboard', keyName });
    return;
  }
  if (bindingsMatch(activeBinding, { type: 'keyboard', keyName })) {
    activeHandlers?.onDown?.();
  }
}

function handleKeyUp(evt) {
  const keyName = KEY_NAME_BY_CODE[evt.keycode] || `Key${evt.keycode}`;
  if (bindingsMatch(activeBinding, { type: 'keyboard', keyName })) {
    activeHandlers?.onUp?.();
  }
}

function handleMouseDown(evt) {
  if (captureCallback) {
    finishCapture({ type: 'mouse', button: evt.button });
    return;
  }
  if (bindingsMatch(activeBinding, { type: 'mouse', button: evt.button })) {
    activeHandlers?.onDown?.();
  }
}

function handleMouseUp(evt) {
  if (bindingsMatch(activeBinding, { type: 'mouse', button: evt.button })) {
    activeHandlers?.onUp?.();
  }
}

function ensureListening() {
  if (!isAvailable || listening) return;
  ensureStarted();
  uIOhook.on('keydown', handleKeyDown);
  uIOhook.on('keyup', handleKeyUp);
  uIOhook.on('mousedown', handleMouseDown);
  uIOhook.on('mouseup', handleMouseUp);
  listening = true;
}

function registerActivation(binding, handlers) {
  ensureListening();
  activeBinding = binding || null;
  activeHandlers = handlers || null;
  return isAvailable;
}

function unregisterAll() {
  activeBinding = null;
  activeHandlers = null;
}

function startCapture(onCaptured) {
  ensureListening();
  if (!isAvailable) {
    onCaptured?.(null);
    return;
  }
  captureCallback = onCaptured;
  captureTimeout = setTimeout(() => {
    captureCallback = null;
  }, 15000);
}

function cancelCapture() {
  captureCallback = null;
  if (captureTimeout) {
    clearTimeout(captureTimeout);
    captureTimeout = null;
  }
}

function shutdown() {
  unregisterAll();
  cancelCapture();
}

module.exports = {
  registerActivation,
  unregisterAll,
  startCapture,
  cancelCapture,
  bindingLabel,
  shutdown,
};