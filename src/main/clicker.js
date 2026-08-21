// Handles the actual mouse-click simulation.
//
// CPS (clicks per second) sets how many click cycles happen per second.
// Duty cycle (%) sets what portion of each cycle the "button" is considered
// held down before releasing - this only matters visually/behaviorally for
// games that read hold duration, since a plain click is instantaneous.
// We simulate it by holding mouseDown for (dutyCycle% of the cycle) then
// mouseUp for the remainder.

let mouse;
try {
  // @nut-tree-fork/nut-js provides cross-platform mouse control.
  // Run `npm install` in the project root before starting the app.
  ({ mouse } = require('@nut-tree-fork/nut-js'));
} catch (err) {
  console.warn(
    'Could not load @nut-tree-fork/nut-js. Run `npm install` first. ' +
      'Click simulation will be a no-op until then.'
  );
}

let intervalId = null;
let running = false;

function msFromCps(cps) {
  const safeCps = Math.max(0.1, Number(cps) || 1);
  return 1000 / safeCps;
}

async function performClickCycle(cycleMs, dutyCycle) {
  const holdMs = Math.max(1, cycleMs * (dutyCycle / 100));
  const releaseMs = Math.max(0, cycleMs - holdMs);

  if (!mouse) return; // dependency not installed yet

  try {
    await mouse.pressButton(0); // 0 = left button
    await new Promise((r) => setTimeout(r, holdMs));
    await mouse.releaseButton(0);
    if (releaseMs > 0) {
      await new Promise((r) => setTimeout(r, releaseMs));
    }
  } catch (err) {
    console.error('Click simulation error:', err);
  }
}

function start({ cps, dutyCycle }, onStatus) {
  if (running) stop();

  running = true;
  const cycleMs = msFromCps(cps);

  onStatus?.({ running: true, cps, dutyCycle });

  intervalId = setInterval(() => {
    performClickCycle(cycleMs, dutyCycle);
  }, cycleMs);
}

function stop(onStatus) {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
  onStatus?.({ running: false });
}

function isRunning() {
  return running;
}

module.exports = { start, stop, isRunning };
