import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { editionFromSource, embeddedJson } from "./vocab-context.js";
import { DEFAULT_SETTINGS, NARRATIONS, SPEEDS, TIMERS, availabilityRequest, barView, inApp, listenable, listeningRun, nextSetting,
  pageView, storyToFollow, tapOnSentence } from "./listening.js";

const html = readFileSync("index.html", "utf8");
const readSet = (file, binding) => editionFromSource(readFileSync(file, "utf8"), binding);
const PAGE = "https://frank-humingtao.github.io/zhongkao-reading-lab/?set=reading-01";

test("listening from a reading-set story runs to the end of the set, named by its published tracks", async () => {
  const set = readSet("reading-01.js", "memoryReadingSet");
  const run = await listeningRun({ set, setId: "reading-01", setName: "01 生词复现", startIndex: 0, pageURL: PAGE });
  assert.equal(run.length, 10);
  assert.deepEqual(run[0], {
    key: "2a5f5df5d757c8e8", // Thunder for a Film, as published in tracks-001
    id: "memory-01-film",
    title: "Thunder for a Film",
    setName: "01 生词复现",
    artwork: "https://frank-humingtao.github.io/zhongkao-reading-lab/images/reading-01/film.jpg",
    sentences: 12
  });
  const later = await listeningRun({ set, setId: "reading-01", setName: "01 生词复现", startIndex: 8, pageURL: PAGE });
  assert.deepEqual(later.map(story => story.id), set.stories.slice(8).map(story => story.id));
});

test("a replaced reading set keeps its illustrations under the set id", async () => {
  const set = readSet("reading-02-v3.js", "readingSet02");
  const [first] = await listeningRun({ set, setId: "reading-02", setName: "02 生词复现", startIndex: 0, pageURL: PAGE });
  assert.match(first.artwork, /\/images\/reading-02\/[^/]+\.jpg$/);
});

test("a story without an illustration has no artwork", async () => {
  const set = { stories: [
    { id: "a", title: "A", paragraphs: [[["One.", "一。"]]] },
    { id: "b", title: "B", illustration: [], paragraphs: [[["Two.", "二。"]]] }
  ] };
  const run = await listeningRun({ set, setId: "reading-09", setName: "09", startIndex: 0, pageURL: PAGE });
  assert.deepEqual(run.map(story => story.artwork), [null, null]);
});

test("screening passages run with sentences counted the way the page splits them", async () => {
  const screening = embeddedJson(html, "screening-data");
  const bilingualText = embeddedJson(html, "bilingual-text");
  const run = await listeningRun({ screening, bilingualText, setName: "筛选短文", startIndex: 66, pageURL: PAGE });
  assert.equal(run.length, 2);
  const lesson = screening.lessons[66];
  assert.equal(run[0].id, lesson.id);
  assert.equal(run[0].artwork, `https://frank-humingtao.github.io/zhongkao-reading-lab/images/screening/${lesson.id}.jpg`);
  assert.equal(run[0].sentences, bilingualText[lesson.id].flat().length);
});

test("the page knows it is in the app only when the app has said so and can be reached", () => {
  assert.equal(inApp({}), false);
  assert.equal(inApp({ zhongkaoApp: { version: 1 } }), false);
  assert.equal(inApp({ webkit: { messageHandlers: { listening: { postMessage() {} } } } }), false);
  assert.equal(inApp({ zhongkaoApp: { version: 1 }, webkit: { messageHandlers: { listening: { postMessage() {} } } } }), true);
});

test("an update highlights the spoken sentence only on the story being heard", () => {
  const update = { type: "state", listening: true, playing: true, storyId: "memory-01-film", sentence: 3, position: 0.25 };
  assert.deepEqual(pageView(update, "memory-01-film"), { listening: true, playing: true, sentence: 3, position: 0.25 });
  assert.deepEqual(pageView(update, "memory-01-books"), { listening: true, playing: true, sentence: null, position: 0.25 });
  assert.deepEqual(pageView({ ...update, listening: false, playing: false, storyId: null }, "memory-01-film"),
    { listening: false, playing: false, sentence: null, position: 0 });
  assert.equal(pageView({ ...update, position: 1.7 }, "memory-01-film").position, 1);
});

test("the 听 control is in the view bar before 中英 and 目录, hidden until the app shows it", () => {
  const viewbar = html.slice(html.indexOf('<div class="viewbar-end">'), html.indexOf('id="directory-toggle"'));
  const listen = viewbar.indexOf('id="toggle-listening"');
  assert.ok(listen > 0 && listen < viewbar.indexOf('id="toggle-bilingual"'));
  assert.match(viewbar, /<button[^>]*id="toggle-listening"[^>]*\bhidden\b/);
  assert.match(html, /<div class="player-bar" id="player-bar"[^>]*\bhidden\b/);
  assert.match(html, /<script type="module" src="listening\.js"><\/script>/);
});

test("the page asks the app which stories of the whole set have tracks", async () => {
  const set = readSet("reading-01.js", "memoryReadingSet");
  const run = await listeningRun({ set, setId: "reading-01", setName: "01 生词复现", startIndex: 0, pageURL: PAGE });
  const request = availabilityRequest(run);
  assert.equal(request.type, "availability");
  assert.equal(request.keys.length, 10);
  assert.equal(request.keys[0], "2a5f5df5d757c8e8");
});

test("听 is greyed for a story whose tracks are not published, and stays usable while listening", () => {
  const answer = { type: "availability", available: ["2a5f5df5d757c8e8"] };
  assert.equal(listenable(answer, "2a5f5df5d757c8e8", false), true);
  assert.equal(listenable(answer, "0000000000000000", false), false);
  assert.equal(listenable(null, "2a5f5df5d757c8e8", false), false);
  assert.equal(listenable(null, "0000000000000000", true), true);
});

const DEFAULTS = { narration: "interleaved", speed: 1, doubleRead: false, timer: "off" };

test("the setting values are the ones the app uses (fixtures/listening-settings.json)", () => {
  const shared = JSON.parse(readFileSync("fixtures/listening-settings.json", "utf8"));
  assert.deepEqual(NARRATIONS, shared.narrations);
  assert.deepEqual(SPEEDS, shared.speeds);
  assert.deepEqual(TIMERS, shared.timers);
  assert.deepEqual(DEFAULT_SETTINGS, shared.defaults);
});

test("a sentence tapped before the app has said what is playing is kept until it does", () => {
  const heard = { listening: true, playing: true, sentence: 2, position: 0.1 };
  assert.deepEqual(tapOnSentence(heard, 5, false), { seek: 5 }, "the story on screen is being heard");
  assert.deepEqual(tapOnSentence({ ...heard, sentence: null }, 5, true), { queue: 5 }, "a story just shown, the app not heard from yet");
  assert.equal(tapOnSentence({ ...heard, sentence: null }, 5, false), null, "another story than the one being heard");
  assert.equal(tapOnSentence(heard, -1, false), null, "not a sentence");
});

test("each bar control changes with one tap, cycling through its choices", () => {
  const cycle = (control, settings, taps) => {
    const seen = [];
    for (let i = 0; i < taps; i += 1) {
      settings = { ...settings, ...nextSetting(control, settings) };
      seen.push(settings[control]);
    }
    return seen;
  };
  assert.deepEqual(cycle("narration", DEFAULTS, 2), ["englishOnly", "interleaved"]);
  assert.deepEqual(cycle("speed", DEFAULTS, 3), [1.2, 0.8, 1]);
  assert.deepEqual(cycle("doubleRead", DEFAULTS, 2), [true, false]);
  assert.deepEqual(cycle("timer", DEFAULTS, 5), ["story", "15", "30", "60", "off"]);
  assert.deepEqual(nextSetting("speed", DEFAULTS), { speed: 1.2 }, "a tap sends only what it changes");
});

test("the bar shows each setting the way the mockup draws it", () => {
  assert.deepEqual(barView(DEFAULTS), { narration: "中英", speed: "1.0×", doubleRead: false, timer: "", timerOn: false });
  assert.deepEqual(barView({ narration: "englishOnly", speed: 0.8, doubleRead: true, timer: "30" }),
    { narration: "英", speed: "0.8×", doubleRead: true, timer: "30′", timerOn: true });
  assert.equal(barView({ ...DEFAULTS, timer: "story" }).timer, "本篇");
  assert.equal(barView({ ...DEFAULTS, speed: 1.2 }).speed, "1.2×");
  assert.deepEqual(barView(undefined), barView(DEFAULTS), "before the app has said, the defaults");
});

test("the page follows a run onto the next story, but leaves a story the reader picked alone", () => {
  const update = { listening: true, storyId: "memory-01-books" };
  assert.equal(storyToFollow(update, "memory-01-film", "memory-01-film"), "memory-01-books", "the run moved on");
  assert.equal(storyToFollow(update, null, "memory-01-film"), "memory-01-books", "the page reloaded mid-run");
  assert.equal(storyToFollow(update, "memory-01-books", "memory-01-pen"), null, "the reader looked at another story");
  assert.equal(storyToFollow(update, "memory-01-film", "memory-01-books"), null, "already on screen");
  assert.equal(storyToFollow({ listening: false, storyId: null }, "memory-01-film", "memory-01-film"), null);
});

test("while listening the Chinese sits under each sentence, and the bar has every control", () => {
  const bar = html.slice(html.indexOf('<div class="player-bar"'), html.indexOf("</div>", html.indexOf('<div class="player-bar"')));
  const order = ["player-toggle", "player-narration", "player-speed", "player-double", "player-timer"].map(id => bar.indexOf(`id="${id}"`));
  assert.ok(order.every(index => index > 0), "every control is on the bar");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "left to right as approved");
  assert.match(html, /\.passage\.listening \.translation \{[^}]*display: none/);
  assert.match(html, /\.listening-zh \{[^}]*display: block/);
});
