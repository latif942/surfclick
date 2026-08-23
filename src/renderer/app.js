const cpsSlider = document.getElementById('cps-slider');
const cpsValue = document.getElementById('cps-value');
const cdcSlider = document.getElementById('cdc-slider');
const cdcValue = document.getElementById('cdc-value');

const modeOptions = document.querySelectorAll('.mode-option[data-mode]');
const buttonOptions = document.querySelectorAll('#button-toggle .mode-option');

const keyField = document.getElementById('key-field');
const setKeyBtn = document.getElementById('set-key-btn');

const startBtn = document.getElementById('start-btn');
const startBtnLabel = document.getElementById('start-btn-label');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

const presetList = document.getElementById('preset-list');
const presetEmpty = document.getElementById('preset-empty');
const presetNameInput = document.getElementById('preset-name');
const savePresetBtn = document.getElementById('save-preset-btn');

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

const themeSwatches = document.querySelectorAll('.theme-swatch');
const startupToggle = document.getElementById('startup-toggle');
const uninstallBtn = document.getElementById('uninstall-btn');

const THEME_NAMES = ['violet', 'cyber', 'sunset', 'toxic', 'ocean', 'vaporwave'];  // ← this line

const customAccentInput = document.getElementById('custom-accent');
const appLockToggle = document.getElementById('applock-toggle');

appLockToggle.addEventListener('change', () => {
  state.appLockEnabled = appLockToggle.checked;
  persistSettings();
});

const edgeStopToggle = document.getElementById('edgestop-toggle');
if (edgeStopToggle) {
  edgeStopToggle.addEventListener('change', () => {
    state.edgeStop = edgeStopToggle.checked;
    persistSettings();
  });
}


function shade(hex, pct) {
  const f = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const R = f >> 16, G = (f >> 8) & 0xff, B = f & 0xff;
  return '#' + (0x1000000 +
    (Math.round((t - R) * p) + R) * 0x10000 +
    (Math.round((t - G) * p) + G) * 0x100 +
    (Math.round((t - B) * p) + B)
  ).toString(16).slice(1);
}

function hexToRgb(hex) {
  const f = parseInt(hex.slice(1), 16);
  return `${f >> 16}, ${(f >> 8) & 0xff}, ${f & 0xff}`;
}

function applyCustomAccent(hex) {
  const body = document.body;
  body.style.setProperty('--accent', hex);
  body.style.setProperty('--accent-rgb', hexToRgb(hex));
  body.style.setProperty('--accent-dark', shade(hex, -0.2));
  body.style.setProperty('--accent-dark-rgb', hexToRgb(shade(hex, -0.2)));
  body.style.setProperty('--accent-darker', shade(hex, -0.35));
  body.style.setProperty('--accent-light', shade(hex, 0.25));
  body.style.setProperty('--accent-lighter', shade(hex, 0.55));
}

function clearCustomAccent() {
  ['--accent','--accent-rgb','--accent-dark','--accent-dark-rgb','--accent-darker','--accent-light','--accent-lighter']
    .forEach((v) => document.body.style.removeProperty(v));
}

customAccentInput.addEventListener('input', () => {
  state.customAccent = customAccentInput.value;
  applyCustomAccent(state.customAccent);
});
customAccentInput.addEventListener('change', persistSettings);


let state = {
  cps: 12.5,
  dutyCycle: 65,
  mode: 'toggle',
  clickButton: 'left',
  theme: 'violet',
  launchOnStartup: false,
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

function applyTheme(theme) {
  THEME_NAMES.forEach((t) => document.body.classList.remove(`theme-${t}`));
  if (theme && theme !== 'violet') {
    document.body.classList.add(`theme-${theme}`);
  }
}

let themeDebounce = null;
themeSwatches.forEach((el) => {
  el.addEventListener('click', () => {
    state.theme = el.dataset.theme;
    state.customAccent = null;
    clearCustomAccent();
    applyTheme(state.theme);
    clearTimeout(themeDebounce);
    themeDebounce = setTimeout(persistSettings, 150);
  });
});

  startupToggle.addEventListener('change', () => {
    state.launchOnStartup = startupToggle.checked;
    persistSettings();
  });

  uninstallBtn.addEventListener('click', async () => {
    const result = await window.surfaceClicker.uninstallApp();
    if (!result.success && !result.cancelled && result.message) {
      alert(result.message);
    }
  });


function updateButtonUI() {
  buttonOptions.forEach((el) => {
    el.classList.toggle('active', el.dataset.button === state.clickButton);
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
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:10px;">
        <button class="preset-equip-btn" title="Load preset">Equip</button>
        <button class="preset-delete-btn" title="Delete preset">✕</button>
      </div>
    `;
    item.querySelector('.preset-equip-btn').addEventListener('click', () => {
      state.cps = preset.cps;
      state.dutyCycle = preset.dutyCycle;
      updateStatUI();
      persistSettings();
    });
    item.querySelector('.preset-delete-btn').addEventListener('click', async () => {
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
    clickButton: state.clickButton,
    activationKey: state.activationKey,
    theme: state.theme,
    launchOnStartup: state.launchOnStartup,
    appLockEnabled: state.appLockEnabled,
    appLockTarget: state.appLockTarget,
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

// ---- click button toggle ----

buttonOptions.forEach((el) => {
  el.addEventListener('click', () => {
    state.clickButton = el.dataset.button;
    updateButtonUI();
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
  await window.surfaceClicker.startClicking({
    cps: state.cps,
    dutyCycle: state.dutyCycle,
    clickButton: state.clickButton,
  });
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

// ---- window controls ----

minimizeBtn.addEventListener('click', () => {
  console.log('minimize clicked');
  window.surfaceClicker.minimizeWindow();
});

closeBtn.addEventListener('click', () => {
  console.log('close clicked');
  window.surfaceClicker.closeWindow();
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
  updateButtonUI();
  updateKeyUI();
  updateRunningUI();
  applyTheme(state.theme);
  startupToggle.checked = !!state.launchOnStartup;

  if (state.customAccent) {
    customAccentInput.value = state.customAccent;
    applyCustomAccent(state.customAccent);
  }

  if (edgeStopToggle) edgeStopToggle.checked = !!state.edgeStop;

  appLockToggle.checked = !!state.appLockEnabled;
  applockTrigger.textContent = state.appLockTarget || 'No app set';
  applockTrigger.classList.toggle('set', !!state.appLockTarget);
  await refreshOpenWindows();

  const presets = await window.surfaceClicker.listPresets();
  renderPresets(presets);

  pages.forEach((p) => {
    p.style.display = p.dataset.page === 'main' ? '' : 'none';
  });
}

window.surfaceClicker.onSettingsUpdated((settings) => {
  state.cps = settings.cps;
  state.dutyCycle = settings.dutyCycle;
  updateStatUI();
});

const applockTrigger = document.getElementById('applock-trigger');
const applockList = document.getElementById('applock-list');
const applockRefreshBtn = document.getElementById('applock-refresh-btn');

function selectAppLockTarget(title) {
  state.appLockTarget = title;
  applockTrigger.textContent = title || 'No app set';
  applockTrigger.classList.toggle('set', !!title);
  applockList.classList.remove('open');
  persistSettings();
}

async function refreshOpenWindows() {
  const titles = await window.surfaceClicker.listOpenWindows();
  applockList.innerHTML = '';

  const noneItem = document.createElement('div');
  noneItem.className = 'dropdown-item';
  noneItem.textContent = 'No app set';
  noneItem.addEventListener('click', () => selectAppLockTarget(''));
  applockList.appendChild(noneItem);

  titles.forEach((title) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    if (title === state.appLockTarget) item.classList.add('selected');
    item.textContent = title;
    item.addEventListener('click', () => selectAppLockTarget(title));
    applockList.appendChild(item);
  });
}

applockTrigger.addEventListener('click', () => {
  applockList.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#applock-dropdown')) {
    applockList.classList.remove('open');
  }
});

applockRefreshBtn.addEventListener('click', refreshOpenWindows);

init();