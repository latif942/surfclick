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

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

let state = {
  cps: 12.5,
  dutyCycle: 65,
  mode: 'toggle',
  activationKey: { type: 'keyboard', keyName: 'F6', label: 'F6' },
  running: false,
};

let listeningForKey = false;
let holdKeyDown = false;

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
    keyField.textContent = label || 'No key set';
    keyField.classList.toggle('set', !!label);
    keyField.classList.remove('listening');
  }
}

function updateRunningUI() {
  startBtnLabel.textContent = state.running ? 'Stop' : 'Start';
  startBtn.classList.toggle('running', state.running);
  statusDot.classList.toggle('running', state.running);
  statusText.textContent = state.running ? 'running' : 'idle';
  // swap icon
  const icon = startBtn.querySelector('i');
  if (icon) {
    icon.className = state.running ? 'ti ti-player-stop' : 'ti ti-player-play';
  }
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
        <button class="preset-action-btn equip" title="Load preset">
          <i class="ti ti-check"></i>
        </button>
        <button class="preset-action-btn delete" title="Delete preset">
          <i class="ti ti-x"></i>
        </button>
      </div>
    `;
    item.querySelector('.equip').addEventListener('click', () => {
      state.cps = preset.cps;
      state.dutyCycle = preset.dutyCycle;
      updateStatUI();
      persistSettings();
    });
    item.querySelector('.delete').addEventListener('click', async () => {
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

// ---- nav ----

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    const page = item.dataset.page;
    pages.forEach((p) => {
      p.style.display = p.dataset.page === page ? '' : 'none';
    });
  });
});

// ---- slider events ----

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

// ---- click-to-type on CPS / duty cycle numbers ----

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
  cpsSlider.value = state.cps;
  cdcSlider.value = state.dutyCycle;
  cpsValue.textContent = fmt(state.cps);
  cdcValue.textContent = fmt(state.dutyCycle);
}

// ---- mode toggle ----

modeOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.mode = el.dataset.mode;
    updateModeUI();
    persistSettings();
  });
});

// ---- activation key capture ----

setKeyBtn.addEventListener('click', async () => {
  listeningForKey = true;
  keyField.textContent = 'Press any key or button…';
  keyField.classList.add('listening');
  keyField.classList.remove('set');
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
});

window.surfaceClicker.onHotkeyCaptured((binding) => {
  state.activationKey = binding;
  listeningForKey = false;
  updateKeyUI();
});

// ---- start/stop button ----

async function startClicking() {
  if (state.running) return;
  await window.surfaceClicker.startClicking({ cps: state.cps, dutyCycle: state.dutyCycle });
}

async function stopClicking() {
  if (!state.running) return;
  await window.surfaceClicker.stopClicking();
}

startBtn.addEventListener('click', async () => {
  if (state.running) {
    await stopClicking();
  } else {
    await startClicking();
  }
});

// ---- clicker status from main process ----

window.surfaceClicker.onStatus((status) => {
  state.running = status.running;
  updateRunningUI();
});

// ---- hotkey down/up ----

window.surfaceClicker.onHotkeyDown(() => {
  if (state.mode === 'toggle') {
    if (state.running) {
      stopClicking();
    } else {
      startClicking();
    }
  } else if (state.mode === 'hold') {
    if (!holdKeyDown && !state.running) {
      holdKeyDown = true;
      startClicking();
    }
  }
});

window.surfaceClicker.onHotkeyUp(() => {
  if (state.mode === 'hold') {
    holdKeyDown = false;
    if (state.running) {
      stopClicking();
    }
  }
});

// ---- presets ----

savePresetBtn.addEventListener('click', async () => {
  const name = presetNameInput.value.trim();
  if (!name) {
    presetNameInput.focus();
    presetNameInput.style.borderColor = 'rgba(248,113,113,0.6)';
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

  pages.forEach((p) => {
    p.style.display = p.dataset.page === 'main' ? '' : 'none';
  });
}

init();