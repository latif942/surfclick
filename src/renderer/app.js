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
  activationKey: { type: 'keyboard', keyName: 'F6', label: 'F6' },
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
    const label = state.activationKey?.label;
    keyField.textContent = label || 'press any key or mouse button';
    keyField.classList.toggle('set', !!label);
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

// ---- click-to-type on the CPS / duty cycle numbers ----
// Clicking the big number swaps it for a number input so you can type any
// value directly instead of dragging the slider. CPS isn't clamped to the
// slider's max (100) since "type anything" is the point; duty cycle stays
// clamped to 1-100 since it's a percentage and anything else is meaningless.

function makeValueEditable(valueEl, slider, { min, max, clampToSlider }, onCommit) {
  valueEl.addEventListener('click', () => {
    const startingValue = parseFloat(slider.value);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'stat-value-input';
    input.value = startingValue;
    input.min = clampToSlider ? slider.min : min;
    input.max = clampToSlider ? slider.max : max;
    input.step = slider.step || 'any';

    valueEl.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    function commit(revert) {
      if (settled) return;
      settled = true;

      let n = revert ? startingValue : parseFloat(input.value);
      if (Number.isNaN(n)) n = startingValue;
      n = Math.min(max, Math.max(min, n));

      input.replaceWith(valueEl);
      onCommit(n);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') commit(true);
    });
    input.addEventListener('blur', () => commit(false));
  });
}

makeValueEditable(
  cpsValue,
  cpsSlider,
  { min: 0.1, max: 1000, clampToSlider: false },
  (n) => {
    state.cps = n;
    slidersToState();
    persistSettings();
  }
);

makeValueEditable(
  cdcValue,
  cdcSlider,
  { min: 1, max: 100, clampToSlider: true },
  (n) => {
    state.dutyCycle = n;
    slidersToState();
    persistSettings();
  }
);

function slidersToState() {
  // Sliders visually clamp to their own min/max even if state holds a
  // typed-in value beyond that (e.g. cps > 100) - that's expected.
  cpsSlider.value = state.cps;
  cdcSlider.value = state.dutyCycle;
  cpsValue.textContent = fmt(state.cps);
  cdcValue.textContent = fmt(state.dutyCycle);
}

modeOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.mode = el.dataset.mode;
    updateModeUI();
    persistSettings();
  });
});

// Capturing a new activation input happens in the main process via the
// raw input hook, since side mouse buttons never reach the renderer as DOM
// events. We just ask main to listen for the next key/click and wait.
setKeyBtn.addEventListener('click', async () => {
  listeningForKey = true;
  keyField.textContent = 'press any key or mouse button...';
  keyField.classList.add('listening');
  await window.surfaceClicker.startHotkeyCapture();
});

window.addEventListener('keydown', async (e) => {
  if (!listeningForKey) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    await window.surfaceClicker.cancelHotkeyCapture();
    listeningForKey = false;
    updateKeyUI();
  }
  // Any other key press is picked up system-wide by the main process hook
  // and arrives via onHotkeyCaptured below, not through this listener.
});

window.surfaceClicker.onHotkeyCaptured((binding) => {
  state.activationKey = binding;
  listeningForKey = false;
  updateKeyUI();
});

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

// The main process reports the activation input's down and up separately
// (via the uiohook raw input hook), so hold mode is a real press-and-hold
// now instead of behaving like toggle.
window.surfaceClicker.onHotkeyDown(() => {
  if (state.mode === 'toggle') {
    startBtn.click();
  } else if (state.mode === 'hold' && !state.running) {
    startBtn.click();
  }
});

window.surfaceClicker.onHotkeyUp(() => {
  if (state.mode === 'hold' && state.running) {
    startBtn.click();
  }
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
