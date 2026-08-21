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
   `@nut-tree-fork/nut-js` (for simulating mouse clicks), and `uiohook-napi`
   (a global keyboard/mouse hook, used for the activation key/button — this
   is what makes side mouse buttons and true hold-mode work). Both nut.js
   and uiohook-napi have native bindings, so this step needs a working build
   toolchain on your machine — if `npm install` fails on either, check their
   docs for platform prerequisites.

   - **macOS**: uiohook-napi needs Accessibility *and* Input Monitoring
     permission (System Settings → Privacy & Security) the first time you
     run the app, or global key/mouse capture won't fire.
   - **Linux**: needs an X11 session — Wayland support in the underlying
     libuiohook is limited.
   - **Windows**: works with no extra setup.

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
│   ├── hotkeys.js       activation binding (key or mouse button) + capture
│   ├── rawInput.js      uiohook-napi wrapper (the global input hook)
│   └── store.js         persisted settings + presets
├── preload/
│   └── preload.js      secure bridge exposing a limited API to the UI
└── renderer/        # the UI (plain HTML/CSS/JS, no build step needed)
    ├── index.html
    ├── app.js
    └── styles/globals.css
```

## Activation input & hold mode

The activation key/button is no longer limited to Electron's
`globalShortcut` (keyboard-only, keydown-only). `src/main/rawInput.js`
wraps `uiohook-napi`, a global hook that sees raw keyboard and mouse events
system-wide, including side buttons (mouse4/mouse5) and both press *and*
release. `src/main/hotkeys.js` uses that to:

- Let "Set key" capture literally any key **or mouse button** as the
  activation input (click "Set key", then press whatever you want to use).
- Send separate down/up events to the renderer, so **Hold** mode is a real
  press-and-hold — clicking starts when you press the input and stops the
  instant you release it, instead of behaving like Toggle.

## Other notes

- CPS slider goes 1-100, and duty cycle 1-100%. Click directly on either
  number to type an exact value — CPS isn't capped at 100 when typed in
  manually, only the slider is.
- Click simulation uses `@nut-tree-fork/nut-js`. If you'd rather use
  `robotjs` instead, swap the import at the top of `src/main/clicker.js`.
