const { screen } = require('electron');
const { uIOhook, isAvailable, ensureStarted } = require('./rawInput');

const THRESHOLD = 2;
let enabled = false;
let onTrigger = null;
let listening = false;

function checkPos(x, y) {
  if (!enabled) return;
  const { bounds } = screen.getDisplayNearestPoint({ x, y });
  const atEdge =
    x <= bounds.x + THRESHOLD ||
    y <= bounds.y + THRESHOLD ||
    x >= bounds.x + bounds.width - 1 - THRESHOLD ||
    y >= bounds.y + bounds.height - 1 - THRESHOLD;
  if (atEdge) onTrigger?.();
}

function init(triggerCb) {
  onTrigger = triggerCb;
  if (!isAvailable || listening) return;
  ensureStarted();
  uIOhook.on('mousemove', (e) => checkPos(e.x, e.y));
  listening = true;
}

function setEnabled(val) {
  enabled = !!val;
}

module.exports = { init, setEnabled };