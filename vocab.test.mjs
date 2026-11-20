import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRESYNC_LABEL,
  VOCAB_SOURCES,
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
  shanghaiDateKey
} from "./vocab-core.js";
import { buildCatalog, editionFromSource, embeddedJson } from "./vocab-context.js";

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

test("same word in one set keeps the earliest mark and one label", () => {
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
  assert.equal(state.days[0].label, "2026年11月18日");
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
  assert.equal(state.days[0].key, "2026-11-18");
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
  assert.equal(state.days[0].label, PRESYNC_LABEL);
});

test("legacy 02 v2 is included when live 02 v3 is empty", () => {
  const legacy = VOCAB_SOURCES.find(source => source.id === "reading-02-v2");
  assert.equal(legacy.file, "progress-reading-02-v2.json");
  assert.equal(legacy.progressKey, "zhongkao-reading-lab-reading-02-v2");
  assert.equal(legacy.recordsKey, "zhongkao-github-sync-records-reading-02-v2-v1");
  const state = aggregateVocab(VOCAB_SOURCES.map(source => ({
    label: source.label,
    progress: source.id === "reading-02-v3" ? { marks: {} } : null,
    records: source.id === "reading-02-v2"
      ? { "mark/story-a/quill": [NOV_20, "writer-a", 0] }
      : {}
  })));
  assert.equal(state.count, 1);
  assert.equal(state.words[0].word, "quill");
  assert.deepEqual(state.words[0].sources, ["02"]);
  assert.equal(state.days[0].label, "2026年11月20日");
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
  assert.deepEqual(state.days[0].words.map(word => word.word), ["cloudmint", "velvetkey"]);
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
  assert.equal(dayCopyText(state.days[0].words), "cloudmint\nvelvetkey");
  assert.doesNotMatch(dayCopyText(state.words), /词义|萤火虫/);
  for (const word of state.words) {
    assert.ok(word.details.some(detail => detail.meaning && detail.sentence));
  }
});

test("lesson lookup finds the marked sentence in 01 and historical 02 v2", () => {
  const html = readFileSync("index.html", "utf8");
  const screening = buildCatalog({
    screening: embeddedJson(html, "screening-data"),
    bilingual: embeddedJson(html, "bilingual-text"),
    extraMeanings: embeddedJson(html, "supplemental-meanings")
  });
  const screeningHit = screening.lookup("screening", "read-01", "bang", 0);
  assert.ok(screeningHit.meaning);
  assert.match(screeningHit.sentence, /\bbang\b/i);
  assert.ok(screeningHit.chinese);

  const edition01 = editionFromSource(readFileSync("reading-01.js", "utf8"), "memoryReadingSet");
  const set01 = buildCatalog({ editions: { "reading-01": edition01 } });
  const bang = set01.lookup("reading-01", "memory-01-film", "bang", 0);
  assert.equal(bang.meaning, "砰的一声");
  assert.match(bang.sentence, /bang/i);
  assert.ok(bang.chinese);

  const edition02 = editionFromSource(readFileSync("reading-02-v2.js", "utf8"), "readingSet02");
  const set02 = buildCatalog({
    screening: embeddedJson(html, "screening-data"),
    extraMeanings: embeddedJson(html, "supplemental-meanings"),
    editions: { "reading-02-v2": edition02 }
  });
  let historical = null;
  for (const story of edition02.stories) {
    for (const word of Object.keys(edition02.words)) {
      const hit = set02.lookup("reading-02-v2", story.id, word, 0);
      if (hit?.sentence && hit.meaning) {
        historical = hit;
        break;
      }
    }
    if (historical) break;
  }
  assert.ok(historical, "reading-02-v2 should resolve a marked example");
  assert.equal(set02.sources.includes("reading-02-v2"), true);
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
  assert.equal(bundle.includes("progress-reading-02-v2.json"), true);
  const index = readFileSync("index.html", "utf8");
  assert.match(index, /href="vocab\.html"/);
  assert.match(index, /progressId: "reading-02-v3"/);
  assert.match(index, /progressId: "reading-03-v2"/);
  assert.doesNotMatch(index, /reading-02-v2\.js/);
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
