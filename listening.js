// Listening (ADR-0001): the 听 control and player bar on the reading page.
// They show only inside the app; the app owns the audio and talks to this page
// over a small bridge:
//   page → app  window.webkit.messageHandlers.listening.postMessage(message)
//               {type: "start", run, story, sentence, settings} | {type: "toggle"}
//               | {type: "seek", sentence} | {type: "stop"} | {type: "hello"}
//               | {type: "availability", keys}   (every story of the set)
//   app → page  window.zhongkaoListening.receive({type: "state", listening,
//               playing, storyId, sentence, progress})
//               | {type: "availability", available}   (again whenever it changes)
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
    progress: listening ? Math.min(1, Math.max(0, Number(update.progress) || 0)) : 0
  };
}

// ---------- The page (in the app only) ----------

function attach(win, page) {
  const doc = win.document;
  const byId = id => doc.getElementById(id);
  const pill = byId("toggle-listening");
  const bar = byId("player-bar");
  const toggle = byId("player-toggle");
  const progressLine = byId("player-progress");
  const handler = win.webkit.messageHandlers.listening;
  const post = message => handler.postMessage(message);

  let listening = false;
  let bilingualBefore = false;
  let view = pageView(null);
  let spoken = [];
  let availability = null;
  const keys = new Map(); // story id → narration key, for the whole set

  // 听 is greyed until the story's tracks are published; the app answers
  // again on its own when they appear.
  function refreshPill() {
    pill.disabled = !listenable(availability, keys.get(page.storyId()), listening);
  }

  const englishSentences = () => [...page.passage.querySelectorAll('p[lang="en"] > .aligned-sentence')];
  const chineseSentences = () => [...page.passage.querySelectorAll("p.translation > .aligned-sentence")];

  function enter() {
    if (listening) return;
    listening = true;
    bilingualBefore = page.bilingual();
    page.setBilingual(true);
    doc.body.classList.add("listening");
    page.passage.classList.add("listening");
    pill.setAttribute("aria-pressed", "true");
    bar.hidden = false;
  }

  function leave() {
    if (!listening) return;
    listening = false;
    highlight(null);
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
    const chinese = chineseSentences()[index];
    spoken = [english, chinese].filter(Boolean);
    spoken.forEach(element => element.classList.add("spoken"));
    if (english && page.inReader()) keepInView(english);
  }

  // Keep the spoken sentence clear of the sticky view bar and the player bar.
  function keepInView(element) {
    const box = element.getBoundingClientRect();
    const top = doc.querySelector(".viewbar")?.getBoundingClientRect().bottom ?? 0;
    const bottom = bar.getBoundingClientRect().top || win.innerHeight;
    if (box.top >= top + 12 && box.bottom <= bottom - 12) return;
    const target = win.scrollY + box.top - top - Math.max(24, (bottom - top - box.height) / 3);
    win.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }

  function show(next) {
    const sentenceChanged = next.sentence !== view.sentence;
    view = next;
    if (next.listening) enter(); else leave();
    refreshPill();
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
    post({ type: "start", run, story: 0, sentence: 0, settings: { narration: "interleaved" } });
    show({ listening: true, playing: true, sentence: 0, progress: 0 });
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

  // While listening, tapping a sentence continues from it. The tap does not
  // reach the words inside, so listening never marks words either.
  page.passage.addEventListener("click", event => {
    if (!listening) return;
    const sentence = event.target.closest?.(".aligned-sentence");
    if (!sentence) return;
    const index = Math.max(englishSentences().indexOf(sentence), chineseSentences().indexOf(sentence));
    if (index < 0 || view.sentence === null) return;
    event.preventDefault();
    event.stopPropagation();
    post({ type: "seek", sentence: index });
  }, true);

  // A new story on screen: keep Chinese showing and find the spoken sentence.
  page.onLessonShown = () => {
    refreshPill();
    if (!listening) return;
    page.setBilingual(true);
    spoken = [];
    view = { ...view, sentence: null };
    post({ type: "hello" });
  };

  win.zhongkaoListening = {
    receive(update) {
      if (update?.type === "availability") {
        availability = update;
        refreshPill();
      } else {
        show(pageView(update, page.storyId()));
      }
    }
  };
  post({ type: "hello" });
  refreshPill();
  listeningRun({
    edition: page.edition, setId: page.setId, screening: page.screening, bilingualText: page.bilingualText,
    setName: page.setName(), startIndex: 0, pageURL: win.location.href
  }).then(stories => {
    stories.forEach(story => keys.set(story.id, story.key));
    refreshPill();
    post(availabilityRequest(stories));
  });
}

if (inApp(globalThis.window) && globalThis.window.readingPage) attach(globalThis.window, globalThis.window.readingPage);
