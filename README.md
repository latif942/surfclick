# Surface Clicker

A configurable autoclicker with CPS (clicks per second) and duty cycle
control, a global activation key, toggle/hold modes, and saveable presets.

## Setup

1. **Add your icons.** Drop your logo files into `assets/`:
   - `assets/SurfaceClicker.ico` — Windows app icon
   - `assets/SurfaceClicker.png` — window icon, Linux icon
   - `assets/SurfaceClicker.icns` — macOS icon (optional, only needed if you build for Mac)

   These paths are already wired up in `package.json` (the `build` field),
   `electron-builder.yml`, and `src/main/main.js`.

2. **Install dependencies:**
   ```
   npm install
   ```

   This installs Electron, `electron-store` (for saving settings/presets),
   and `@nut-tree-fork/nut-js` (for simulating mouse clicks). The nut.js
   package has native bindings, so this step needs a working build toolchain
   on your machine — if `npm install` fails on that specific package, see
   the nut.js docs for platform prerequisites.

3. **Run it:**
   ```
   npm start
   ```

4. **Build an installer:**
   ```
   npm run build:win     # Windows .exe
   npm run build:mac     # macOS .dmg
   npm run build:linux   # Linux AppImage
   ```

## Project structure

```
src/
├── main/           # Electron main process (system-level access)
│   ├── main.js         window creation, IPC wiring
│   ├── clicker.js      click simulation (CPS + duty cycle timing)
│   ├── hotkeys.js       global activation key registration
│   └── store.js         persisted settings + presets
├── preload/
│   └── preload.js      secure bridge exposing a limited API to the UI
└── renderer/        # the UI (plain HTML/CSS/JS, no build step needed)
    ├── index.html
    ├── app.js
    └── styles/globals.css
```

## Known limitations / next steps

- **Side mouse buttons** (mouse4/mouse5) as an activation key aren't
  supported yet. Electron's `globalShortcut` API only covers keyboard keys.
  Adding side-button support means listening to raw input events via a
  library like `iohook`, which is a separate integration.
- **Hold mode** currently behaves the same as toggle for a *global* hotkey,
  because `globalShortcut` only fires on key down, not key up. True
  press-and-hold behavior needs the same raw-input-hook approach as above.
- Click simulation uses `@nut-tree-fork/nut-js`. If you'd rather use
  `robotjs` instead, swap the import at the top of `src/main/clicker.js`.
