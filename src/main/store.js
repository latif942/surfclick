const Store = require('electron-store');

const store = new Store({
  defaults: {
    settings: {
      cps: 12.5,
      dutyCycle: 65,
      // A binding is either { type: 'keyboard', keyName } or
      // { type: 'mouse', button } (button 4/5 = side buttons).
      activationKey: { type: 'keyboard', keyName: 'F6' },
      mode: 'toggle', // 'toggle' | 'hold'
    },
    presets: [], // { id, name, cps, dutyCycle }
  },
});

function getSettings() {
  return store.get('settings');
}

function setSettings(partial) {
  const current = store.get('settings');
  const updated = { ...current, ...partial };
  store.set('settings', updated);
  return updated;
}

function getPresets() {
  return store.get('presets');
}

function savePreset({ name, cps, dutyCycle }) {
  const presets = store.get('presets');
  const preset = {
    id: Date.now().toString(36),
    name: name?.trim() || 'untitled',
    cps,
    dutyCycle,
  };
  const updated = [...presets, preset];
  store.set('presets', updated);
  return updated;
}

function deletePreset(id) {
  const presets = store.get('presets');
  const updated = presets.filter((p) => p.id !== id);
  store.set('presets', updated);
  return updated;
}

module.exports = { getSettings, setSettings, getPresets, savePreset, deletePreset };
