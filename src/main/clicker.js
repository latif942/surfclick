// Handles the actual mouse-click simulation.
//
// CPS (clicks per second) sets how many click cycles happen per second.
// Duty cycle (%) sets what portion of each cycle the "button" is held down.
//
// The original implementation was hard-capped at ~21 CPS because it used
// await mouse.pressButton() + await mouse.releaseButton() — four serialised
// async calls per cycle — and each nut-js async call has enough native-addon
// + Node.js overhead to eat the entire budget above ~21 CPS.
//
// Fix: use mouse.click() (one native call instead of two) and switch the
// scheduler from setTimeout to setImmediate above ~30 CPS so the event loop
// stops fighting us. At extreme CPS (>200) we fire clicks in tight burst
// batches, catching up to a wall-clock target in the same tick before
// yielding to keep the UI responsive.

const appLock = require('./appLock');
const { performance } = require('perf_hooks');

let mouse, Button;
try {
  ({ mouse, Button } = require('@nut-tree-fork/nut-js'));
  mouse.config.autoDelayMs = 0;
} catch (err) {
  console.warn('Could not load @nut-tree-fork/nut-js...');
}

const BUTTON_MAP = {
  left: () => Button.LEFT,
  right: () => Button.RIGHT,
  middle: () => Button.MIDDLE,
  x1: () => Button.BUTTON_4,
  x2: () => Button.BUTTON_5,
};

function resolveButton(name) {
  return (BUTTON_MAP[name] || BUTTON_MAP.left)();
}

let running = false;
let scheduledTimer = null;
let cfg = { cps: 1, dutyCycle: 50, clickButton: 'left' };

async function doClick(holdMs) {
  if (!mouse) return;
  const btn = resolveButton(cfg.clickButton);
  try {
    if (holdMs >= 4) {
      await mouse.pressButton(btn);
      await new Promise((r) => setTimeout(r, holdMs));
      await mouse.releaseButton(btn);
    } else {
      await mouse.click(btn);
    }
  } catch (err) {
    console.error('Click simulation error:', err);
  }
}


// ---- single-click helper ----
// Below ~30 CPS we can afford the press+hold+release sequence to honour
// the duty cycle duration. Above that, the hold duration is in single-digit
// ms territory where the extra async round-trip costs more than it's worth,
// so we collapse to a single click() call.

const DUTY_CYCLE_THRESHOLD_CPS = 30; // above this, skip explicit hold
const TIGHT_LOOP_THRESHOLD_CPS = 80; // above this, use setImmediate scheduler

async function doClick(holdMs) {
  if (!mouse) return;
  try {
    if (holdMs >= 4) {
      // Two calls but the duty-cycle hold is meaningful at this CPS.
      await mouse.pressButton(0);
      await new Promise((r) => setTimeout(r, holdMs));
      await mouse.releaseButton(0);
    } else {
      // Single call — nut-js fires press+release atomically with no extra
      // async round-trip between them, breaking through the ~21 CPS ceiling.
      await mouse.click(0);
    }
  } catch (err) {
    console.error('Click simulation error:', err);
  }
}

// ---- scheduler ----
// At low-to-medium CPS we use a drift-corrected setTimeout: schedule each
// next tick against the *absolute* target time so jitter doesn't accumulate.
//
// At high CPS (>80) we switch to setImmediate: setTimeout has ~1ms minimum
// resolution on most OSes, which becomes a significant fraction of each cycle
// at 100+ CPS. setImmediate yields to the OS and comes back in the next event
// loop iteration — effectively 0ms overhead — letting us hit 200-500+ CPS.

function scheduleNext(targetTime) {
  const delay = targetTime - performance.now();

  if (cfg.cps >= TIGHT_LOOP_THRESHOLD_CPS) {
    // High CPS: use setImmediate and catch up to the target in burst batches.
    setImmediate(() => runBurst(targetTime));
  } else if (delay <= 1) {
    // Already past due — fire immediately without another timer call.
    setImmediate(() => runCycle(targetTime));
  } else {
    scheduledTimer = setTimeout(() => runCycle(targetTime), Math.max(0, delay - 1));
  }
}

// Standard single-cycle runner (low/medium CPS).
async function runCycle(targetTime) {
  if (!running) return;
  if (!(await appLock.isAllowed())) {
    scheduleNext(targetTime + (1000 / Math.max(0.1, cfg.cps)));
    return;
  }
  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const holdMs =
    cfg.cps < DUTY_CYCLE_THRESHOLD_CPS ? cycleMs * (cfg.dutyCycle / 100) : 0;

  await doClick(holdMs);

  if (!running) return;
  scheduleNext(targetTime + cycleMs);
}
// Burst runner (high CPS): fire multiple clicks per setImmediate tick if we
// are behind the wall clock, then yield. This lets us sustain 200-500+ CPS
// without flooding the event loop — we catch up to the clock in one batch,
// then yield with setImmediate before the next batch.
async function runBurst(targetTime) {
  if (!running) return;

  const cycleMs = 1000 / Math.max(0.1, cfg.cps);
  const now = performance.now();

  let t = targetTime;
  while (t <= now + 0.5 && running) {
    if (await appLock.isAllowed()) {
      await doClick(0);
    }
    t += cycleMs;
  }

  if (!running) return;

  const delay = t - performance.now();
  if (delay <= 1) {
    setImmediate(() => runBurst(t));
  } else {
    scheduledTimer = setTimeout(() => runBurst(t), Math.max(0, delay - 1));
  }
}

// ---- public API ----

function start({ cps, dutyCycle, clickButton }, onStatus) {
  if (running) stop();
  running = true;
  cfg = { cps, dutyCycle, clickButton: clickButton || 'left' };
  onStatus?.({ running: true, cps, dutyCycle, clickButton: cfg.clickButton });
  scheduleNext(performance.now());
}

function stop(onStatus) {
  running = false;
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
  onStatus?.({ running: false });
}

function isRunning() {
  return running;
}

module.exports = { start, stop, isRunning };