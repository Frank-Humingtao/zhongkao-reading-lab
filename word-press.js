// Long-press on a word (touch only): what a finger held on a word should do.
// Phones do not send a right-click, so holding a word opens the same word menu.
// A plain script so index.html can load it before its own script; it defines
// `wordPress` on the global object (tests import it the same way).
(function (root) {
  const LONG_PRESS_MS = 450;
  const MOVE_TOLERANCE_PX = 10;
  const CLICK_WINDOW_MS = 800;

  // One step: the state after `event`, and what the page should do now.
  //   event {type: "down", touch, onWord, x, y, time} | {type: "timer", time}
  function pressStep(state, event) {
    const idle = { phase: "idle" };
    state ??= idle;
    switch (event.type) {
      case "down":
        if (!event.touch || !event.onWord) return { state: idle };
        return { state: { phase: "pressing", x: event.x, y: event.y, since: event.time } };
      case "timer":
        if (state.phase !== "pressing") return { state };
        return { state: { phase: "opened" }, effect: { open: { x: state.x, y: state.y } } };
      case "move":
        if (state.phase !== "pressing") return { state };
        if (Math.hypot(event.x - state.x, event.y - state.y) > MOVE_TOLERANCE_PX) return { state: idle };
        return { state };
      case "scroll":
      case "cancel":
        return { state: state.phase === "pressing" ? idle : state };
      case "contextmenu":
        // The menu is already open from the hold: leave it where it is.
        if (state.phase === "opened" || state.phase === "lifted") return { state, effect: { ignoreContextMenu: true } };
        // The browser reported the hold first and its right-click opens the menu.
        if (state.phase === "pressing") return { state: { phase: "opened" } };
        return { state };
      case "up":
        // The browser may or may not send a click after a long hold, so only
        // a click soon after the finger lifts belongs to the long-press.
        if (state.phase !== "opened") return { state: idle };
        return { state: { phase: "lifted", until: event.time + CLICK_WINDOW_MS } };
      case "click":
        if (state.phase === "opened" || (state.phase === "lifted" && event.time <= state.until)) {
          return { state: idle, effect: { swallowClick: true } };
        }
        return { state: state.phase === "pressing" ? state : idle };
      default:
        return { state };
    }
  }

  root.wordPress = Object.freeze({ LONG_PRESS_MS, pressStep });
})(globalThis);
