// Listening (ADR-0001): the 听 control and player bar on the reading page.
// They show only inside the app; the app owns the audio and talks to this page
// over a small bridge:
//   page → app  window.webkit.messageHandlers.listening.postMessage(message)
//               {type: "start", run, story, sentence} | {type: "toggle"}
//               | {type: "seek", sentence} | {type: "stop"} | {type: "hello"}
//               | {type: "setting", narration? | speed? | doubleRead? | timer?}
//               | {type: "availability", keys}   (every story of the set)
//   app → page  window.zhongkaoListening.receive({type: "state", listening,
//               playing, storyId, sentence, position,
//               settings: {narration, speed, doubleRead, timer}})
//               | {type: "availability", available}   (again whenever it changes)
// The app remembers the settings; the page only shows them and sends taps.
// `position` is how far through the story the audio is (0...1), not reading
// progress: listening never writes progress and never marks a story read.

import { collectionStories, narrationKey } from "./narration.js";

export function inApp(win) {
  return Boolean(win?.zhongkaoApp && win.webkit?.messageHandlers?.listening);
}

// The run listening starts: the stories from `startIndex` to the end of the
// collection (content.js), whose file holds `data`.
export async function listeningRun({ collection, data, setName, startIndex = 0, pageURL }) {
  const stories = collectionStories(collection, data);
  return Promise.all(stories.slice(startIndex).map(async story => ({
    key: await narrationKey(story.pairs),
    id: story.id,
    title: story.title,
    setName,
    artwork: story.artwork && new URL(story.artwork, pageURL).href,
    sentences: story.pairs.length
  })));
}

// Which of these stories have published tracks? Asked for the whole reading
// set or news edition, so the app can also keep all of it for offline use.
export function availabilityRequest(stories) {
  return { type: "availability", keys: stories.map(story => story.key) };
}

// Whether 听 can be tapped: the story's tracks are published (per the app's
// latest availability answer), or listening is on and 听 would stop it.
export function listenable(answer, key, listening) {
  return Boolean(listening || (Array.isArray(answer?.available) && answer.available.includes(key)));
}

// What the page shows for an app update while `storyId` is on screen.
export function pageView(update, storyId) {
  const listening = Boolean(update?.listening);
  return {
    listening,
    playing: listening && Boolean(update.playing),
    sentence: listening && update.storyId === storyId && Number.isInteger(update.sentence) ? update.sentence : null,
    position: listening ? Math.min(1, Math.max(0, Number(update.position) || 0)) : 0
  };
}

// A tap on sentence `index` while listening: seek to it when the story on
// screen is the one being heard; keep it for the app's next update when a story
// has just been shown and the app has not said yet (`waitingForApp`).
export function tapOnSentence(view, index, waitingForApp) {
  if (index < 0) return null;
  if (view.sentence !== null) return { seek: index };
  return waitingForApp ? { queue: index } : null;
}

// ---------- The player bar's settings ----------

// The values the app uses too (fixtures/listening-settings.json).
export const NARRATIONS = ["interleaved", "englishOnly"];
export const SPEEDS = [0.8, 1, 1.2];
export const TIMERS = ["story", "15", "30", "60", "off"];
export const DEFAULT_SETTINGS = { narration: "interleaved", speed: 1, doubleRead: false, timer: "off" };
const after = (list, value) => list[(list.indexOf(value) + 1) % list.length];

// One tap on a bar control: the change to send, the next of its choices.
export function nextSetting(control, settings = DEFAULT_SETTINGS) {
  const current = { ...DEFAULT_SETTINGS, ...settings };
  switch (control) {
    case "narration": return { narration: after(NARRATIONS, current.narration) };
    case "speed": return { speed: after(SPEEDS, Number(current.speed)) };
    case "doubleRead": return { doubleRead: !current.doubleRead };
    case "timer": return { timer: after(TIMERS, current.timer) };
    default: return {};
  }
}

// What the bar's controls read: 中英/英, 1.0×, 两遍 (muted when off), moon + 30′.
export function barView(settings) {
  const current = { ...DEFAULT_SETTINGS, ...settings };
  const timer = current.timer === "story" ? "本篇" : current.timer === "off" ? "" : `${current.timer}′`;
  return {
    narration: current.narration === "englishOnly" ? "英" : "中英",
    speed: `${Number(current.speed).toFixed(1)}×`,
    doubleRead: Boolean(current.doubleRead),
    timer,
    timerOn: current.timer !== "off"
  };
}

// When a run moves on (or the page reloads mid-run) the page shows the story
// being heard; a story the reader opened themselves is left on screen.
export function storyToFollow(update, heardBefore, onScreen) {
  if (!update?.listening || !update.storyId) return null;
  if (update.storyId === heardBefore || update.storyId === onScreen) return null;
  return update.storyId;
}

// ---------- The page (in the app only) ----------

function attach(win, page) {
  const doc = win.document;
  const byId = id => doc.getElementById(id);
  const pill = byId("toggle-listening");
  const bar = byId("player-bar");
  const toggle = byId("player-toggle");
  const positionLine = byId("player-position");
  const controls = {
    narration: byId("player-narration"),
    speed: byId("player-speed"),
    doubleRead: byId("player-double"),
    timer: byId("player-timer")
  };
  const handler = win.webkit.messageHandlers.listening;
  const post = message => handler.postMessage(message);

  let listening = false;
  let bilingualBefore = false;
  let view = pageView(null);
  let settings = { ...DEFAULT_SETTINGS };
  let heardStory = null;
  let spoken = [];
  let availability = null;
  const keys = new Map(); // story id → narration key, for the whole set
  // A story was just shown and the app has not said what is playing yet; a
  // sentence tapped meanwhile waits in `queuedSeek` for its answer.
  let waitingForApp = false;
  let queuedSeek = null;

  // 听 is greyed until the story's tracks are published; the app answers
  // again on its own when they appear.
  function refreshPill() {
    pill.disabled = !listenable(availability, keys.get(page.storyId()), listening);
  }

  const englishSentences = () => [...page.passage.querySelectorAll('p[lang="en"] > .aligned-sentence')];
  const chineseSentences = () => [...page.passage.querySelectorAll("p.translation > .aligned-sentence")];
  const underSentences = () => [...page.passage.querySelectorAll(".listening-zh")];

  // Each sentence's Chinese goes right under it while listening (the
  // paragraph-wide translations are hidden), and is taken away again on stop.
  function addChineseUnderSentences() {
    if (page.passage.querySelector(".listening-zh")) return;
    const chinese = chineseSentences();
    englishSentences().forEach((english, index) => {
      const under = doc.createElement("span");
      under.className = "listening-zh";
      under.lang = "zh-CN";
      under.textContent = chinese[index]?.textContent ?? "";
      english.after(under);
    });
  }

  function removeChineseUnderSentences() {
    underSentences().forEach(element => {
      // WebKit keeps the space after a removed block collapsed ("spacecraft.Our"),
      // so the space is put back as a fresh text node.
      const space = element.nextSibling;
      element.remove();
      if (space?.nodeType === 3) space.replaceWith(doc.createTextNode(space.data));
    });
  }

  function enter() {
    if (listening) return;
    listening = true;
    bilingualBefore = page.bilingual();
    page.setBilingual(true);
    addChineseUnderSentences();
    doc.body.classList.add("listening");
    page.passage.classList.add("listening");
    pill.setAttribute("aria-pressed", "true");
    bar.hidden = false;
  }

  function leave() {
    if (!listening) return;
    listening = false;
    heardStory = null;
    highlight(null);
    removeChineseUnderSentences();
    doc.body.classList.remove("listening");
    page.passage.classList.remove("listening");
    pill.setAttribute("aria-pressed", "false");
    bar.hidden = true;
    page.setBilingual(bilingualBefore);
  }

  function highlight(index) {
    spoken.forEach(element => element.classList.remove("spoken"));
    spoken = [];
    if (index === null) return;
    const english = englishSentences()[index];
    const under = underSentences()[index];
    spoken = [english, under].filter(Boolean);
    spoken.forEach(element => element.classList.add("spoken"));
    if (english && page.inReader()) keepInView(under ?? english, english);
  }

  // Keep the spoken sentence (and its Chinese) clear of the sticky view bar
  // and the player bar.
  function keepInView(last, first) {
    const box = { top: first.getBoundingClientRect().top, bottom: last.getBoundingClientRect().bottom };
    const top = doc.querySelector(".viewbar")?.getBoundingClientRect().bottom ?? 0;
    const bottom = bar.getBoundingClientRect().top || win.innerHeight;
    if (box.top >= top + 12 && box.bottom <= bottom - 12) return;
    const height = box.bottom - box.top;
    const target = win.scrollY + box.top - top - Math.max(24, (bottom - top - height) / 3);
    win.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }

  function showSettings(next) {
    settings = { ...DEFAULT_SETTINGS, ...next };
    const labels = barView(settings);
    controls.narration.textContent = labels.narration;
    controls.speed.textContent = labels.speed;
    controls.doubleRead.setAttribute("aria-pressed", String(labels.doubleRead));
    controls.timer.querySelector(".player-timer-value").textContent = labels.timer;
    controls.timer.setAttribute("aria-pressed", String(labels.timerOn));
    controls.timer.setAttribute("aria-label", labels.timerOn ? `睡眠定时 ${labels.timer}` : "睡眠定时");
  }

  function show(update) {
    if (update?.settings) showSettings(update.settings);
    const follow = storyToFollow(update, heardStory, page.storyId());
    if (update?.listening) heardStory = update.storyId ?? null;
    if (follow) page.showStory(follow);
    const next = pageView(update, page.storyId());
    const sentenceChanged = next.sentence !== view.sentence;
    view = next;
    waitingForApp = false;
    if (queuedSeek !== null) {
      if (next.listening && next.sentence !== null) post({ type: "seek", sentence: queuedSeek });
      queuedSeek = null;
    }
    if (next.listening) enter(); else leave();
    refreshPill();
    if (!listening) return;
    toggle.setAttribute("aria-label", next.playing ? "暂停" : "播放");
    toggle.querySelector("use").setAttribute("href", next.playing ? "#i-pause" : "#i-play");
    toggle.querySelector("svg").classList.toggle("filled", !next.playing);
    positionLine.style.transform = `scaleX(${next.position})`;
    if (sentenceChanged || !spoken.length) highlight(next.sentence);
  }

  // Every story of the set with its narration key, worked out once. If the
  // keys can't be worked out, 听 stays greyed.
  const wholeSet = listeningRun({
    collection: page.collection, data: page.data,
    setName: page.setName(), pageURL: win.location.href
  });

  async function start() {
    let run;
    try {
      run = (await wholeSet).slice(page.storyIndex());
    } catch {
      return refreshPill();
    }
    if (!run.length) return refreshPill();
    heardStory = page.storyId();
    post({ type: "start", run, story: 0, sentence: 0 });
    show({ listening: true, playing: true, storyId: heardStory, sentence: 0, position: 0, settings });
  }

  pill.hidden = false;
  pill.addEventListener("click", () => {
    if (listening) {
      post({ type: "stop" });
      show(pageView(null));
    } else {
      start();
    }
  });
  toggle.addEventListener("click", () => post({ type: "toggle" }));
  for (const [control, button] of Object.entries(controls)) {
    button.addEventListener("click", () => {
      const change = nextSetting(control, settings);
      showSettings({ ...settings, ...change });
      post({ type: "setting", ...change });
    });
  }

  // While listening, tapping a sentence (or its Chinese) continues from it.
  // The tap does not reach the words inside, so listening never marks words.
  page.passage.addEventListener("click", event => {
    if (!listening) return;
    const target = event.target.closest?.(".aligned-sentence, .listening-zh");
    if (!target) return;
    const index = Math.max(englishSentences().indexOf(target), underSentences().indexOf(target),
      chineseSentences().indexOf(target));
    const tap = tapOnSentence(view, index, waitingForApp);
    if (!tap) return;
    event.preventDefault();
    event.stopPropagation();
    if (tap.queue !== undefined) queuedSeek = tap.queue;
    else post({ type: "seek", sentence: tap.seek });
  }, true);

  // A new story on screen: Chinese under its sentences, and find the spoken one.
  page.onLessonShown = () => {
    refreshPill();
    if (!listening) return;
    page.setBilingual(true);
    addChineseUnderSentences();
    spoken = [];
    view = { ...view, sentence: null };
    waitingForApp = true;
    queuedSeek = null;
    post({ type: "hello" });
  };

  win.zhongkaoListening = {
    receive(update) {
      if (update?.type === "availability") {
        availability = update;
        refreshPill();
      } else {
        show(update);
      }
    }
  };
  showSettings(settings);
  post({ type: "hello" });
  refreshPill();
  wholeSet.then(stories => {
    stories.forEach(story => keys.set(story.id, story.key));
    refreshPill();
    post(availabilityRequest(stories));
  }, () => refreshPill());
}

// The reading page loads its collection before it can be read, and says so
// with a "readingpage" event once window.readingPage is there.
if (inApp(globalThis.window)) {
  const win = globalThis.window;
  if (win.readingPage) attach(win, win.readingPage);
  else win.addEventListener("readingpage", () => attach(win, win.readingPage), { once: true });
}
