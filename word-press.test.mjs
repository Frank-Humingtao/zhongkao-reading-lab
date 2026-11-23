import assert from "node:assert/strict";
import test from "node:test";
import "./word-press.js";

const { pressStep, LONG_PRESS_MS } = globalThis.wordPress;

// Runs a list of events through the long-press decision, returning the effects in order.
function run(events) {
  let state;
  const effects = [];
  for (const event of events) {
    const step = pressStep(state, event);
    state = step.state;
    if (step.effect) effects.push(step.effect);
  }
  return effects;
}

test("holding a finger on a word opens the word menu at the finger", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "timer", time: LONG_PRESS_MS }
  ]), [{ open: { x: 40, y: 80 } }]);
});

test("the click that follows a long-press does not mark the word", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "timer", time: 450 },
    { type: "up", time: 700 },
    { type: "click", time: 710 }
  ]), [{ open: { x: 40, y: 80 } }, { swallowClick: true }]);
});

test("moving the finger more than a little is a scroll, not a long-press", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "move", x: 42, y: 92, time: 100 },
    { type: "timer", time: 450 }
  ]), []);
});

test("a small wobble of the finger still opens the menu", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "move", x: 46, y: 86, time: 100 },
    { type: "timer", time: 450 }
  ]), [{ open: { x: 40, y: 80 } }]);
});

test("scrolling or the browser taking the touch cancels the long-press", () => {
  for (const type of ["scroll", "cancel"]) {
    assert.deepEqual(run([
      { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
      { type, time: 200 },
      { type: "timer", time: 450 }
    ]), [], type);
  }
});

test("lifting before the hold time leaves no menu", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "up", time: 300 },
    { type: "timer", time: 450 }
  ]), []);
});

test("a mouse press or a press off the words never opens the menu", () => {
  assert.deepEqual(run([
    { type: "down", touch: false, onWord: true, x: 40, y: 80, time: 0 },
    { type: "timer", time: 450 },
    { type: "down", touch: true, onWord: false, x: 40, y: 80, time: 1000 },
    { type: "timer", time: 1450 }
  ]), []);
});

test("when no click follows a long-press, the next tap still marks", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "timer", time: 450 },
    { type: "up", time: 700 },
    { type: "click", time: 5000 }
  ]), [{ open: { x: 40, y: 80 } }]);
});

test("a long-press the browser also reports as a right-click opens the menu once", () => {
  // Android and desktop touch emulation send contextmenu after a hold; iOS does not.
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "timer", time: 450 },
    { type: "contextmenu", time: 600 },
    { type: "up", time: 700 },
    { type: "click", time: 710 }
  ]), [{ open: { x: 40, y: 80 } }, { ignoreContextMenu: true }, { swallowClick: true }]);
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "contextmenu", time: 300 },
    { type: "timer", time: 450 },
    { type: "up", time: 700 },
    { type: "click", time: 710 }
  ]), [{ swallowClick: true }]);
});

test("a short tap lets its click through, so it still marks the word", () => {
  assert.deepEqual(run([
    { type: "down", touch: true, onWord: true, x: 40, y: 80, time: 0 },
    { type: "up", time: 120 },
    { type: "click", time: 130 }
  ]), []);
});
