// Listening (ADR-0001): the 听 control and player bar on the reading page.
// They show only inside the app; the app owns the audio and talks to this page
// over a small bridge:
//   page → app  window.webkit.messageHandlers.listening.postMessage(message)
//               {type: "start", run, story, sentence} | {type: "toggle"}
//               | {type: "seek", sentence} | {type: "stop"} | {type: "hello"}
//               | {type: "setting", narration? | speed? | doubleRead? | timer?}
//   app → page  window.zhongkaoListening.receive({type: "state", listening,
//               playing, storyId, sentence, progress,
//               settings: {narration, speed, doubleRead, timer}})
// The app remembers the settings; the page only shows them and sends taps.
// Listening never writes progress and never marks a story read.

import { narrationKey, screeningPairs, storyPairs } from "./narration.js";

export function inApp(win) {
  return Boolean(win?.zhongkaoApp && win.webkit?.messageHandlers?.listening);
}

// The run listening starts: the stories from `startIndex` to the end of the
// reading set or news edition (`edition`), or of the screening passages.
export async function listeningRun({ edition, setId, screening, bilingualText, setName, startIndex, pageURL }) {
  const stories = edition
    ? edition.stories.map(story => ({
      id: story.id, title: story.title, pairs: storyPairs(story),
      artwork: Array.isArray(story.illustration) ? `images/${setId}/${story.illustration[0]}` : null
    }))
    : screening.lessons.map(lesson => ({
      id: lesson.id, title: lesson.title, pairs: screeningPairs(lesson, bilingualText[lesson.id]),
      artwork: `images/screening/${lesson.id}.jpg`
    }));
  return Promise.all(stories.slice(startIndex).map(async story => ({
    key: await narrationKey(story.pairs),
    id: story.id,
    title: story.title,
    setName,
    artwork: story.artwork && new URL(story.artwork, pageURL).href,
    sentences: story.pairs.length
  })));
}

// What the page shows for an app update while `storyId` is on screen.
export function pageView(update, storyId) {
  const listening = Boolean(update?.listening);
  return {
    listening,
    playing: listening && Boolean(update.playing),
    sentence: listening && update.storyId === storyId && Number.isInteger(update.sentence) ? update.sentence : null,
    progress: listening ? Math.min(1, Math.max(0, Number(update.progress) || 0)) : 0
  };
}

// ---------- The player bar's settings ----------

const DEFAULT_SETTINGS = { narration: "interleaved", speed: 1, doubleRead: false, timer: "off" };
const SPEEDS = [0.8, 1, 1.2];
const TIMERS = ["story", "15", "30", "60", "off"];
const after = (list, value) => list[(list.indexOf(value) + 1) % list.length];

// One tap on a bar control: the change to send, the next of its choices.
export function nextSetting(control, settings = DEFAULT_SETTINGS) {
  const current = { ...DEFAULT_SETTINGS, ...settings };
  switch (control) {
    case "narration": return { narration: current.narration === "interleaved" ? "englishOnly" : "interleaved" };
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
  const progressLine = byId("player-progress");
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
    underSentences().forEach(element => element.remove());
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
    if (next.listening) enter(); else leave();
    if (!listening) return;
    toggle.setAttribute("aria-label", next.playing ? "暂停" : "播放");
    toggle.querySelector("use").setAttribute("href", next.playing ? "#i-pause" : "#i-play");
    toggle.querySelector("svg").classList.toggle("filled", !next.playing);
    progressLine.style.transform = `scaleX(${next.progress})`;
    if (sentenceChanged || !spoken.length) highlight(next.sentence);
  }

  async function start() {
    const run = await listeningRun({
      edition: page.edition, setId: page.setId, screening: page.screening, bilingualText: page.bilingualText,
      setName: page.setName(), startIndex: page.storyIndex(), pageURL: win.location.href
    });
    heardStory = page.storyId();
    post({ type: "start", run, story: 0, sentence: 0 });
    show({ listening: true, playing: true, storyId: heardStory, sentence: 0, progress: 0, settings });
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
    if (index < 0 || view.sentence === null) return;
    event.preventDefault();
    event.stopPropagation();
    post({ type: "seek", sentence: index });
  }, true);

  // A new story on screen: Chinese under its sentences, and find the spoken one.
  page.onLessonShown = () => {
    if (!listening) return;
    page.setBilingual(true);
    addChineseUnderSentences();
    spoken = [];
    view = { ...view, sentence: null };
    post({ type: "hello" });
  };

  win.zhongkaoListening = { receive: show };
  showSettings(settings);
  post({ type: "hello" });
}

if (inApp(globalThis.window) && globalThis.window.readingPage) attach(globalThis.window, globalThis.window.readingPage);
