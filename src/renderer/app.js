const cpsSlider = document.getElementById('cps-slider');
const cpsValue = document.getElementById('cps-value');
const cdcSlider = document.getElementById('cdc-slider');
const cdcValue = document.getElementById('cdc-value');

const modeOptions = document.querySelectorAll('.mode-option');

const keyField = document.getElementById('key-field');
const setKeyBtn = document.getElementById('set-key-btn');

const startBtn = document.getElementById('start-btn');
const startBtnLabel = document.getElementById('start-btn-label');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const presetList = document.getElementById('preset-list');
const presetEmpty = document.getElementById('preset-empty');
const presetNameInput = document.getElementById('preset-name');
const savePresetBtn = document.getElementById('save-preset-btn');

let state = {
  cps: 12.5,
  dutyCycle: 65,
  mode: 'toggle',
  activationKey: 'F6',
  running: false,
};

let listeningForKey = false;

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function updateStatUI() {
  cpsSlider.value = state.cps;
  cpsValue.textContent = fmt(state.cps);
  cdcSlider.value = state.dutyCycle;
  cdcValue.textContent = fmt(state.dutyCycle);
}

function updateModeUI() {
  modeOptions.forEach((el) => {
    el.classList.toggle('active', el.dataset.mode === state.mode);
  });
}

function updateKeyUI() {
  if (!listeningForKey) {
    keyField.textContent = state.activationKey || 'press any key or side button';
    keyField.classList.toggle('set', !!state.activationKey);
    keyField.classList.remove('listening');
  }
}

function updateRunningUI() {
  startBtnLabel.textContent = state.running ? 'Stop' : 'Start';
  startBtn.classList.toggle('running', state.running);
  statusDot.classList.toggle('running', state.running);
  statusText.textContent = state.running ? 'running' : 'idle';
}

function renderPresets(presets) {
  presetList.querySelectorAll('.preset-item').forEach((el) => el.remove());

  if (!presets || presets.length === 0) {
    presetEmpty.style.display = 'flex';
    return;
  }
  presetEmpty.style.display = 'none';

  presets.forEach((preset) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.innerHTML = `
      <div class="preset-item-info">
        <div class="name">${escapeHtml(preset.name)}</div>
        <div class="details">${fmt(preset.cps)} cps · ${fmt(preset.dutyCycle)}% duty</div>
      </div>
      <div class="preset-item-actions">
        <i class="ti ti-player-play-filled preset-load" title="Load preset"></i>
        <i class="ti ti-trash preset-delete" title="Delete preset"></i>
      </div>
    `;
    item.querySelector('.preset-load').addEventListener('click', () => {
      state.cps = preset.cps;
      state.dutyCycle = preset.dutyCycle;
      updateStatUI();
      persistSettings();
    });
    item.querySelector('.preset-delete').addEventListener('click', async () => {
      const updated = await window.surfaceClicker.deletePreset(preset.id);
      renderPresets(updated);
    });
    presetList.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function persistSettings() {
  window.surfaceClicker.setSettings({
    cps: state.cps,
    dutyCycle: state.dutyCycle,
    mode: state.mode,
    activationKey: state.activationKey,
  });
}

// ---- events ----

cpsSlider.addEventListener('input', () => {
  state.cps = parseFloat(cpsSlider.value);
  cpsValue.textContent = fmt(state.cps);
});
cpsSlider.addEventListener('change', persistSettings);

cdcSlider.addEventListener('input', () => {
  state.dutyCycle = parseFloat(cdcSlider.value);
  cdcValue.textContent = fmt(state.dutyCycle);
});
cdcSlider.addEventListener('change', persistSettings);

modeOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.mode = el.dataset.mode;
    updateModeUI();
    persistSettings();
  });
});

setKeyBtn.addEventListener('click', () => {
  listeningForKey = true;
  keyField.textContent = 'press a key...';
  keyField.classList.add('listening');
});

window.addEventListener('keydown', async (e) => {
  if (!listeningForKey) return;
  e.preventDefault();

  const accelerator = mapKeyToAccelerator(e);
  if (!accelerator) return;

  const ok = await window.surfaceClicker.setHotkey(accelerator);
  listeningForKey = false;

  if (ok) {
    state.activationKey = accelerator;
  }
  updateKeyUI();
});

function mapKeyToAccelerator(e) {
  // Function keys map directly (F1-F24). Letters/numbers map directly too.
  // Modifier-only presses are ignored.
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) return e.key;

  const parts = [];
  if (e.ctrlKey) parts.push('CommandOrControl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);

  return parts.join('+');
}

startBtn.addEventListener('click', async () => {
  if (state.running) {
    await window.surfaceClicker.stopClicking();
  } else {
    await window.surfaceClicker.startClicking({ cps: state.cps, dutyCycle: state.dutyCycle });
  }
});

window.surfaceClicker.onStatus((status) => {
  state.running = status.running;
  updateRunningUI();
});

window.surfaceClicker.onHotkeyTriggered(() => {
  if (state.mode === 'toggle') {
    startBtn.click();
  }
  // 'hold' mode would need keyup detection via a raw input hook (iohook) -
  // globalShortcut only fires on keydown, so true press-and-hold behavior
  // for a global hotkey needs that additional dependency.
});

savePresetBtn.addEventListener('click', async () => {
  const name = presetNameInput.value.trim();
  if (!name) {
    presetNameInput.focus();
    presetNameInput.style.borderColor = 'rgba(248,113,113,0.7)';
    setTimeout(() => {
      presetNameInput.style.borderColor = '';
    }, 1200);
    return;
  }
  const updated = await window.surfaceClicker.savePreset({
    name,
    cps: state.cps,
    dutyCycle: state.dutyCycle,
  });
  presetNameInput.value = '';
  renderPresets(updated);
});

// ---- init ----

async function init() {
  const settings = await window.surfaceClicker.getSettings();
  state = { ...state, ...settings, running: false };

  updateStatUI();
  updateModeUI();
  updateKeyUI();
  updateRunningUI();

  const presets = await window.surfaceClicker.listPresets();
  renderPresets(presets);
}

init();
