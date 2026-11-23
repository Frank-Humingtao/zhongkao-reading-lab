import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { editionFromSource, embeddedJson } from "./vocab-context.js";
import { availabilityRequest, inApp, listenable, listeningRun, pageView } from "./listening.js";

const html = readFileSync("index.html", "utf8");
const edition = (file, binding) => editionFromSource(readFileSync(file, "utf8"), binding);
const PAGE = "https://frank-humingtao.github.io/zhongkao-reading-lab/?set=reading-01";

test("listening from a reading-set story runs to the end of the set, named by its published tracks", async () => {
  const set = edition("reading-01.js", "memoryReadingSet");
  const run = await listeningRun({ edition: set, setId: "reading-01", setName: "01 生词复现", startIndex: 0, pageURL: PAGE });
  assert.equal(run.length, 10);
  assert.deepEqual(run[0], {
    key: "2a5f5df5d757c8e8", // Thunder for a Film, as published in tracks-001
    id: "memory-01-film",
    title: "Thunder for a Film",
    setName: "01 生词复现",
    artwork: "https://frank-humingtao.github.io/zhongkao-reading-lab/images/reading-01/film.jpg",
    sentences: 12
  });
  const later = await listeningRun({ edition: set, setId: "reading-01", setName: "01 生词复现", startIndex: 8, pageURL: PAGE });
  assert.deepEqual(later.map(story => story.id), set.stories.slice(8).map(story => story.id));
});

test("a replaced reading set keeps its illustrations under the set id", async () => {
  const set = edition("reading-02-v3.js", "readingSet02");
  const [first] = await listeningRun({ edition: set, setId: "reading-02", setName: "02 生词复现", startIndex: 0, pageURL: PAGE });
  assert.match(first.artwork, /\/images\/reading-02\/[^/]+\.jpg$/);
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
  const update = { type: "state", listening: true, playing: true, storyId: "memory-01-film", sentence: 3, progress: 0.25 };
  assert.deepEqual(pageView(update, "memory-01-film"), { listening: true, playing: true, sentence: 3, progress: 0.25 });
  assert.deepEqual(pageView(update, "memory-01-books"), { listening: true, playing: true, sentence: null, progress: 0.25 });
  assert.deepEqual(pageView({ ...update, listening: false, playing: false, storyId: null }, "memory-01-film"),
    { listening: false, playing: false, sentence: null, progress: 0 });
  assert.equal(pageView({ ...update, progress: 1.7 }, "memory-01-film").progress, 1);
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
  const set = edition("reading-01.js", "memoryReadingSet");
  const run = await listeningRun({ edition: set, setId: "reading-01", setName: "01 生词复现", startIndex: 0, pageURL: PAGE });
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
