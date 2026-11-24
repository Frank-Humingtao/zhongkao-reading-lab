import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRESYNC_LABEL,
  aggregateVocab,
  currentMarks,
  decodeGithubContent,
  decodeRecords,
  dayCopyText,
  demoSources,
  emptyNote,
  hasVocabPayload,
  isDemoSearch,
  mergeRecords,
  presentDetails,
  previousShanghaiDay,
  wordsForDay,
  wordsInRange,
  shanghaiDateKey,
  baseForm
} from "./vocab-core.js";
import { readManifest, vocabSources } from "./content.js";
import { buildCatalog, loadWordCatalog, readingPlainText } from "./vocab-context.js";

const { collections } = readManifest(readFileSync("content/index.json", "utf8"));
const progressSources = vocabSources(collections);
const readText = async path => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const NOV_20 = Date.parse("2026-11-19T16:00:00.000Z");
const NOV_19_END = NOV_20 - 1;
const NOV_18 = Date.parse("2026-11-17T16:00:00.000Z");

test("Shanghai calendar day changes at midnight, not UTC", () => {
  assert.equal(shanghaiDateKey(NOV_20), "2026-11-20");
  assert.equal(shanghaiDateKey(NOV_19_END), "2026-11-19");
  assert.equal(shanghaiDateKey(0), null);
  assert.equal(shanghaiDateKey(-1), null);
});

test("integer marks are current and null marks are not", () => {
  const marks = currentMarks({
    marks: {
      "lesson-a": [["kept-local", 1], ["cleared", 0], ["bad", 1.5], ["negative", -1]]
    }
  }, {
    "mark/lesson-a/kept-local": [NOV_20, "writer", 2],
    "mark/lesson-a/cleared": [NOV_20, "writer", null],
    "mark/lesson-a/indexed-zero": [NOV_18, "writer", 0],
    "mark/lesson-a/negative": [NOV_20, "writer", -3],
    "read/lesson-a": [NOV_20, "writer", true]
  });
  assert.deepEqual([...marks.keys()].sort(), ["indexed-zero", "kept-local"]);
  assert.equal(marks.get("kept-local").timestamp, NOV_20);
  assert.equal(marks.get("indexed-zero").timestamp, NOV_18);
});

test("local marks without a sync record are pre-sync", () => {
  const marks = currentMarks({ marks: { "lesson-a": [["quill", 0]] } }, {});
  assert.equal(marks.get("quill").timestamp, 0);
});

test("a null record hides a stale local mark", () => {
  const marks = currentMarks(
    { marks: { "lesson-a": [["quill", 1]] } },
    { "mark/lesson-a/quill": [NOV_20, "writer", null] }
  );
  assert.equal(marks.size, 0);
});

test("same word in one set counts once, and shows again as a repeat on a later day", () => {
  const state = aggregateVocab([{
    label: "02 v2",
    progress: null,
    records: {
      "mark/story-a/quill": [NOV_20, "writer", 1],
      "mark/story-b/quill": [NOV_18, "writer", 0]
    }
  }]);
  assert.equal(state.count, 1);
  assert.deepEqual(state.words[0].sources, ["02 v2"]);
  assert.equal(state.words[0].firstTimestamp, NOV_18);
  assert.deepEqual(state.days.map(day => day.label), ["2026年11月20日", "2026年11月18日"]);
  assert.equal(state.days[0].words[0].repeat, true);
  assert.equal(state.days[0].words[0].details.length, 1);
  assert.deepEqual(state.days[0].fresh, []);
  assert.deepEqual(state.days[1].fresh.map(word => word.word), ["quill"]);
});

test("dedupes across sets and prefers the earliest first mark", () => {
  const state = aggregateVocab([
    {
      label: "标词",
      progress: null,
      records: { "mark/read-01/quill": [NOV_20, "writer", 1] }
    },
    {
      label: "02 v2",
      progress: null,
      records: { "mark/story/Quill": [NOV_18, "writer", 0] }
    },
    {
      label: "02 v3",
      progress: { marks: {} },
      records: {}
    }
  ]);
  assert.equal(state.count, 1);
  assert.equal(state.words[0].word, "Quill");
  assert.deepEqual(state.words[0].sources, ["标词", "02 v2"]);
  assert.deepEqual(state.days.map(day => day.key), ["2026-11-20", "2026-11-18"]);
  assert.deepEqual(state.days[0].words.map(word => [word.word, word.repeat, word.firstDay]), [["Quill", true, "2026-11-18"]]);
});

test("timestamp 0 is 较早/同步前 and sorts after real days", () => {
  const state = aggregateVocab([
    {
      label: "标词",
      progress: { marks: { "read-01": [["amber", 1]] } },
      records: {}
    },
    {
      label: "01",
      progress: null,
      records: { "mark/story/bramble": [NOV_19_END, "writer", 1] }
    },
    {
      label: "02 v2",
      progress: null,
      records: { "mark/story/cedar": [NOV_20, "writer", 2] }
    }
  ]);
  assert.deepEqual(state.days.map(day => day.label), ["2026年11月20日", "2026年11月19日", PRESYNC_LABEL]);
  assert.deepEqual(state.days[0].words.map(word => word.word), ["cedar"]);
  assert.deepEqual(state.days[2].words.map(word => word.word), ["amber"]);
  assert.equal(state.words.map(word => word.word).join(","), "amber,bramble,cedar");
});

test("a pre-sync mark is earlier than a later mark of the same word", () => {
  const state = aggregateVocab([
    { label: "标词", progress: { marks: { "read-01": [["amber", 0]] } }, records: {} },
    { label: "01", progress: null, records: { "mark/story/amber": [NOV_20, "writer", 1] } }
  ]);
  assert.equal(state.words[0].firstTimestamp, 0);
  assert.deepEqual(state.words[0].sources, ["标词", "01"]);
  assert.deepEqual(state.days.map(day => day.label), ["2026年11月20日", PRESYNC_LABEL]);
  assert.equal(state.days[0].words[0].repeat, true);
  assert.deepEqual(state.days[1].fresh.map(word => word.word), ["amber"]);
});

test("merge keeps the newer record and breaks timestamp ties by writer id", () => {
  const newer = mergeRecords(
    { "mark/lesson/quill": [10, "bbb", 1] },
    { "mark/lesson/quill": [11, "aaa", 0] }
  );
  assert.deepEqual(newer.get("mark/lesson/quill"), [11, "aaa", 0]);
  const tie = mergeRecords(
    { "mark/lesson/quill": [11, "mmm", 1] },
    { "mark/lesson/quill": [11, "aaa", 0] }
  );
  assert.deepEqual(tie.get("mark/lesson/quill"), [11, "mmm", 1]);
});

test("github file bytes decode without keeping invalid records", () => {
  const payload = {
    version: 1,
    records: {
      "mark/lesson/quill": [NOV_20, "writer", 1],
      "mark/lesson/nope": [NOV_20, "writer"],
      active: [NOV_20, "writer", "lesson"]
    }
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const records = decodeGithubContent(btoa(binary).replace(/(.{40})/g, "$1\n"));
  assert.equal(records.get("mark/lesson/quill")[2], 1);
  assert.equal(records.has("mark/lesson/nope"), false);
  assert.equal(records.get("active")[2], "lesson");
  assert.throws(() => decodeGithubContent(btoa("[]")), /invalid progress file/);
  assert.equal(decodeRecords(null).size, 0);
});

test("visitors with no token and no stored progress get the empty note", () => {
  assert.match(emptyNote({ syncing: false, hasToken: false, hasStoredPayload: false }), /生词/);
  assert.match(emptyNote({ syncing: false, hasToken: false, hasStoredPayload: false }), /生词/);
  assert.equal(emptyNote({ syncing: false, hasToken: true, hasStoredPayload: false }), "还没有生词");
  assert.match(emptyNote({ syncing: true, hasToken: true, hasStoredPayload: false }), /正在同步/);
  assert.equal(hasVocabPayload({ marks: { "read-01": [] }, active: "read-01", finished: [] }, {}), false);
  assert.equal(hasVocabPayload(null, null), false);
  assert.equal(hasVocabPayload({ marks: { "read-01": [["quill", 0]] } }, {}), true);
  assert.equal(hasVocabPayload(null, { "mark/read-01/quill": [NOV_20, "writer", null] }), true);
});

test("demo preview is labeled fixture data and does not keep a cleared mark", () => {
  assert.equal(isDemoSearch("?demo=1"), true);
  assert.equal(isDemoSearch(""), false);
  assert.equal(isDemoSearch("?set=reading-02"), false);
  const state = aggregateVocab(demoSources());
  assert.equal(state.count, state.words.length);
  assert.equal(state.words.some(word => word.word === "dustnote"), false);
  const sharedEarly = state.words.find(word => word.word === "paperfox");
  assert.deepEqual(sharedEarly.sources, ["筛选", "01"]);
  assert.equal(sharedEarly.firstTimestamp, 0);
  const sharedDay = state.words.find(word => word.word === "riverbell");
  assert.deepEqual(sharedDay.sources, ["02"]);
  assert.equal(shanghaiDateKey(sharedDay.firstTimestamp), "2026-11-18");
  assert.deepEqual(state.days.map(day => day.label), [
    "2026年11月20日", "2026年11月19日", "2026年11月18日", PRESYNC_LABEL
  ]);
  assert.deepEqual(state.days[0].words.map(word => word.word), ["cloudmint", "paperfox", "riverbell", "velvetkey"]);
  assert.deepEqual(state.days[0].fresh.map(word => word.word), ["cloudmint", "velvetkey"]);
  assert.deepEqual(state.days.at(-1).words.map(word => word.word), ["glowbug", "paperfox"]);
  const labels = new Set(state.words.flatMap(word => word.sources));
  for (const label of ["筛选", "01", "02", "03"]) assert.equal(labels.has(label), true);
  assert.equal(state.words.map(word => word.word).join(","), "cloudmint,glowbug,moonpear,paperfox,riverbell,velvetkey");
  const paperfox = presentDetails(state.words.find(word => word.word === "paperfox").details);
  assert.equal(paperfox.length, 1);
  assert.equal(paperfox[0].meaning, "纸狐狸");
  assert.match(paperfox[0].sentence, /paperfox/);
  assert.match(paperfox[0].chinese, /纸狐狸/);
  const riverbell = presentDetails(state.words.find(word => word.word === "riverbell").details);
  assert.equal(riverbell.length, 2);
  assert.deepEqual(riverbell.map(detail => detail.source), ["02", "02"]);
  assert.equal(dayCopyText(state.days[0].fresh), "cloudmint\nvelvetkey");
  assert.doesNotMatch(dayCopyText(state.words), /词义|萤火虫/);
  for (const word of state.words) {
    assert.ok(word.details.some(detail => detail.meaning && detail.sentence));
  }
});

test("the word catalog built from content/ finds marked sentences in every collection", async () => {
  const catalog = await loadWordCatalog(readText);
  const screeningHit = catalog.lookup("screening", "read-01", "bang", 0);
  assert.ok(screeningHit.meaning);
  assert.match(screeningHit.sentence, /\bbang\b/i);
  assert.ok(screeningHit.chinese);

  const bang = catalog.lookup("reading-01", "memory-01-film", "bang", 0);
  assert.equal(bang.meaning, "砰的一声");
  assert.match(bang.sentence, /bang/i);
  assert.ok(bang.chinese);
  assert.equal(catalog.title("reading-01", "memory-01-film"), "Thunder for a Film");

  assert.deepEqual([...catalog.sources].sort(), ["daily-news-01", "reading-01", "reading-02-v3", "reading-03-v2", "reading-04", "screening"]);
  const two = JSON.parse(readFileSync("content/reading-02-v3.json", "utf8"));
  const word = Object.keys(two.words).find(key => catalog.lookup("reading-02-v3", two.stories[0].id, key, 0)?.sentence);
  assert.ok(word, "reading-02-v3 should resolve a marked example");

  const spacecraft = catalog.lookup("daily-news-01", "daily-news-01-01", "spacecraft", 0);
  assert.equal(spacecraft.meaning, "航天器");
  assert.doesNotMatch(spacecraft.sentence, /\p{Script=Han}/u);
  assert.equal(spacecraft.offset, spacecraft.sentence.toLowerCase().indexOf("spacecraft"));
});

test("progress keys stay where the reading page has always kept them", () => {
  const source = id => progressSources.find(item => item.id === id);
  assert.deepEqual(source("screening"), { id: "screening", label: "Placement 01", file: "progress.json",
    progressKey: "zhongkao-reading-lab-v3", recordsKey: "zhongkao-github-sync-records-v1" });
  assert.deepEqual(source("reading-02-v3"), { id: "reading-02-v3", label: "Review 02", file: "progress-reading-02-v3.json",
    progressKey: "zhongkao-reading-lab-reading-02-v3", recordsKey: "zhongkao-github-sync-records-reading-02-v3-v1" });
  assert.deepEqual(progressSources.map(item => item.id), ["screening", "reading-01", "reading-02-v3", "reading-02-v2", "reading-02",
    "reading-03-v2", "reading-03", "reading-04", "daily-news-01"]);
  // Marks made in a replaced version still count, under the collection's label.
  assert.deepEqual(source("reading-02-v2"), { id: "reading-02-v2", label: "Review 02", file: "progress-reading-02-v2.json",
    progressKey: "zhongkao-reading-lab-reading-02-v2", recordsKey: "zhongkao-github-sync-records-reading-02-v2-v1" });
});

test("the public page does not ship tokens or progress contents", () => {
  const page = readFileSync("vocab.html", "utf8");
  const script = readFileSync("vocab-board.js", "utf8") + readFileSync("vocab-core.js", "utf8");
  const bundle = page + script;
  assert.doesNotMatch(bundle, /github_pat_[A-Za-z0-9_]{8}/);
  assert.doesNotMatch(page, /glowbug|paperfox|riverbell|cloudmint|velvetkey|dustnote/);
  assert.match(page, /vocab\.html\?demo=1/);
  assert.match(page, /看看示例/);
  assert.match(page, /示例数据/);
  const index = readFileSync("index.html", "utf8");
  assert.match(index, /href="vocab\.html"/);
  assert.doesNotMatch(index + readFileSync("content/index.json", "utf8"), /github_pat_[A-Za-z0-9_]{8}/);
});

test("wordsForDay returns only words first marked on that Beijing day", () => {
  const sources = [
    { label: "筛选", records: {
      "mark/read-01/early": [0, "w", 0],
      "mark/read-01/both": [NOV_18, "w", 1],
      "mark/read-02/today": [NOV_20 + 3600e3, "w", 0],
      "mark/read-02/gone": [NOV_20, "w", null]
    } },
    { label: "01", records: { "mark/memory-01-film/both": [NOV_20, "w", 0] } }
  ];
  assert.deepEqual(wordsForDay(sources, "2026-11-20").map(word => word.word), ["today"]);
  assert.deepEqual(wordsForDay(sources, "2026-11-18").map(word => word.word), ["both"]);
  assert.deepEqual(wordsForDay(sources, "2026-11-19"), []);
  assert.equal(previousShanghaiDay(Date.parse("2026-11-20T18:00:00.000Z")), "2026-11-20");
  assert.equal(previousShanghaiDay(Date.parse("2026-11-20T15:59:00.000Z")), "2026-11-19");
});

test("marked words are shown in their base form", () => {
  const pairs = {
    slipped: "slip", tucked: "tuck", spotted: "spot", spots: "spot", sleeves: "sleeve",
    sacks: "sack", counts: "count", belonged: "belong", overflowed: "overflow",
    shook: "shake", flown: "fly", studies: "study", watches: "watch", baked: "bake",
    travelled: "travel", running: "run", making: "make", changed: "change", lying: "lie"
  };
  for (const [word, base] of Object.entries(pairs)) assert.equal(baseForm(word), base, word);
  for (const word of ["news", "glasses", "morning", "leftover", "tin", "bus"]) assert.equal(baseForm(word), word);
  const known = new Set(["building", "tired", "excite", "travel"]);
  assert.equal(baseForm("building", known), "building");
  assert.equal(baseForm("tired", known), "tired");
  assert.equal(baseForm("excited", known), "excite");
});

test("inflected marks of one word count once under the base form", () => {
  const state = aggregateVocab([
    { id: "screening", label: "筛选", progress: null, records: { "mark/read-19/slipped": [NOV_18, "w", 0] } },
    { id: "reading-01", label: "01", progress: null, records: { "mark/memory-01-light/slip": [NOV_20, "w", 1] } }
  ]);
  assert.deepEqual(state.words.map(word => word.word), ["slip"]);
  assert.equal(state.words[0].details.length, 2);
  assert.deepEqual(state.days.map(day => day.key), ["2026-11-20", "2026-11-18"]);
  assert.equal(state.days[0].words[0].repeat, true);
});

test("wordsInRange counts an old word marked again in a new article", () => {
  const NOV_19 = Date.parse("2026-11-18T16:00:00.000Z");
  const sources = [
    {
      id: "screening", label: "筛选", progress: null,
      records: {
        "mark/read-04/chart": [NOV_18, "w", 0],
        "mark/read-38/chart": [NOV_20 + 5000, "w", 1],
        "mark/read-38/fresh": [NOV_20, "w", 0],
        "mark/read-38/gone": [NOV_20, "w", null],
        "mark/read-01/early": [0, "w", 0]
      }
    },
    {
      id: "reading-02-v2", label: "02", progress: null,
      records: { "mark/memory-02/charts": [NOV_20, "w", 0], "mark/memory-02/middle": [NOV_19, "w", 0] }
    }
  ];
  assert.deepEqual(wordsForDay(sources, "2026-11-20").map(word => word.word), ["fresh"]);
  const day = wordsInRange(sources, "2026-11-20");
  assert.deepEqual(day.map(word => word.word), ["chart", "fresh"]);
  const chart = day.find(word => word.word === "chart");
  assert.equal(chart.repeat, true);
  assert.equal(chart.firstDay, "2026-11-18");
  assert.deepEqual(chart.details.map(detail => detail.lessonId), ["read-38", "memory-02"]);
  assert.deepEqual(chart.sources, ["筛选", "02"]);
  assert.equal(day.find(word => word.word === "fresh").repeat, false);
  assert.deepEqual(wordsInRange(sources, "2026-11-19", "2026-11-20").map(word => word.word), ["chart", "fresh", "middle"]);
  assert.deepEqual(wordsInRange(sources, "2026-11-01", "2026-12-31").map(word => word.word), ["chart", "fresh", "middle"]);
});

test("inline Chinese glosses are not English tokens and do not move example offsets", () => {
  const samples = [
    ["The spacecraft（航天器）is now so far away that a radio signal takes 24 hours to reach it.",
      "The spacecraft is now so far away that a radio signal takes 24 hours to reach it."],
    ["Now it is coming home with science samples（样品）.", "Now it is coming home with science samples."],
    ["Plasma（等离子体）is a kind of gas made of charged particles（带电粒子）.",
      "Plasma is a kind of gas made of charged particles."],
    ["A light-day is the distance light can travel in one day.", "A light-day is the distance light can travel in one day."]
  ];
  for (const [source, plain] of samples) {
    assert.equal(readingPlainText(source), plain);
    assert.doesNotMatch(plain, /\p{Script=Han}/u);
  }

  const edition = {
    words: { spacecraft: ["航天器"], signal: ["信号"] },
    stories: [{
      id: "gloss-check",
      title: "Gloss Check",
      paragraphs: [[
        ["The spacecraft（航天器）is now so far away that a radio signal takes 24 hours to reach it.", "它发出信号。"]
      ]]
    }]
  };
  const catalog = buildCatalog({ editions: { "daily-news-01": edition } });
  const signal = catalog.lookup("daily-news-01", "gloss-check", "signal", 0);
  assert.equal(signal.sentence, samples[0][1]);
  assert.equal(signal.offset, signal.sentence.toLowerCase().indexOf("signal"));
  assert.equal(signal.sentence.slice(signal.offset, signal.offset + signal.surface.length).toLowerCase(), "signal");
  assert.equal(catalog.lookup("daily-news-01", "gloss-check", "航天器", 0), null);
  const craft = catalog.lookup("daily-news-01", "gloss-check", "spacecraft", 0);
  assert.equal(craft.offset, craft.sentence.toLowerCase().indexOf("spacecraft"));
  assert.equal(craft.meaning, "航天器");
});
