// Handles the actual mouse-click simulation.
//
// CPS (clicks per second) sets how many click cycles happen per second.
// Duty cycle (%) sets what portion of each cycle the "button" is considered
// held down before releasing - this only matters visually/behaviorally for
// games that read hold duration, since a plain click is instantaneous.
// We simulate it by holding mouseDown for (dutyCycle% of the cycle) then
// mouseUp for the remainder.

const { performance } = require('perf_hooks');

let mouse;
try {
  // @nut-tree-fork/nut-js provides cross-platform mouse control.
  // Run `npm install` in the project root before starting the app.
  ({ mouse } = require('@nut-tree-fork/nut-js'));

  // IMPORTANT: nut-js's pressButton/releaseButton each sleep for
  // mouse.config.autoDelayMs *before* doing anything, and it defaults to
  // 100ms. That's on top of whatever CPS we ask for below, and it's what
  // was hard-capping this app at ~21 cps no matter what the slider said.
  // We do our own timing via cycleMs/holdMs, so we don't want nut-js
  // adding its own delay on top of that.
  mouse.config.autoDelayMs = 0;
} catch (err) {
  console.warn(
    'Could not load @nut-tree-fork/nut-js. Run `npm install` first. ' +
      'Click simulation will be a no-op until then.'
  );
}

let running = false;
let scheduledTimer = null;
let cfg = { cps: 1, dutyCycle: 50 };

function msFromCps(cps) {
  const safeCps = Math.max(0.1, Number(cps) || 1);
  return 1000 / safeCps;
}

async function press() {
  if (!mouse) return;
  try {
    await mouse.pressButton(0); // 0 = left button
  } catch (err) {
    console.error('Click simulation error (press):', err);
  }
}

async function release() {
  if (!mouse) return;
  try {
    await mouse.releaseButton(0);
  } catch (err) {
    console.error('Click simulation error (release):', err);
  }
}

// Schedules the next cycle against an absolute target timestamp (rather
// than "wait N ms from now") so timer jitter doesn't accumulate into a
// slower and slower effective CPS over time - each cycle self-corrects
// against the clock instead of drifting off the previous one.
function scheduleNext(targetTime) {
  const delay = Math.max(0, targetTime - performance.now());
  scheduledTimer = setTimeout(() => runCycle(targetTime), delay);
}

async function runCycle(targetTime) {
  if (!running) return;

  const cycleMs = msFromCps(cfg.cps);
  const holdMs = cycleMs * (cfg.dutyCycle / 100);

  await press();

  // Only bother with an explicit "hold" delay if it's long enough to
  // matter. At high CPS the whole cycle can be a handful of ms, and an
  // extra timer in the middle just adds more jitter for no real benefit -
  // games mostly care that a press+release happened, not its exact
  // duration at that point.
  if (holdMs >= 4) {
    await new Promise((r) => setTimeout(r, holdMs));
  }

  await release();

  if (!running) return;
  scheduleNext(targetTime + cycleMs);
}

function start({ cps, dutyCycle }, onStatus) {
  if (running) stop();

  running = true;
  cfg = { cps, dutyCycle };

  onStatus?.({ running: true, cps, dutyCycle });

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
