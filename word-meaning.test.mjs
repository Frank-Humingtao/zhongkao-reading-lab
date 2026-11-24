import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addTerm, atSentenceStart, collectionGlossary, createWordMeaning, refreshTerms } from "./word-meaning.js";
import { buildCatalog, loadWordCatalog, unexplainedNotice, unexplainedWords } from "./vocab-context.js";
import { checkLibrary, loadBaseDictionary } from "./content.js";

const wordList = JSON.parse(readFileSync("content/dictionary.json", "utf8"));
const meanings = createWordMeaning(wordList);
const listMeaning = word => wordList.dictionary[word][1];

test("word-list headwords count as their own form", () => {
  const lookup = meanings.forLesson().lookup;
  for (const word of ["car", "build", "begin", "act", "close"]) {
    assert.deepEqual(lookup(word), { key: word, display: word, meaning: listMeaning(word), source: "word-list" }, word);
  }
});

test("an inflected word with no meaning of its own shows its base form's meaning", () => {
  const lookup = meanings.forLesson().lookup;
  for (const [word, base] of [["books", "book"], ["kites", "kite"], ["going", "go"], ["studied", "study"]]) {
    const found = lookup(word);
    assert.equal(found.meaning, listMeaning(base), word);
    assert.equal(found.source, "word-list", word);
    // The key stays the word as written, so marks saved before keep working.
    assert.equal(found.key, word, word);
  }
});

test("the word list's own forms and extra meanings still come first", () => {
  const lookup = meanings.forLesson().lookup;
  assert.equal(lookup("acts").key, "act");
  assert.equal(lookup("acts").meaning, listMeaning("act"));
  assert.equal(lookup("added").meaning, wordList.extraMeanings.added);
});

test("a collection's own meaning wins over the word list", () => {
  const words = { car: ["小汽车", "cars"] };
  const { lookup } = meanings.forLesson({ collection: collectionGlossary(words), targets: words });
  assert.deepEqual(lookup("car"), { key: "car", display: "car", meaning: "小汽车", source: "collection" });
  assert.deepEqual(lookup("cars"), { key: "car", display: "car", meaning: "小汽车", source: "collection" });
  assert.equal(lookup("Cars").meaning, "小汽车");
});

test("a capitalised word no source explains is a proper noun", () => {
  const lookup = meanings.forLesson().lookup;
  for (const word of ["Amy", "Guangzhou", "Darwin"]) {
    assert.deepEqual(lookup(word), { key: word.toLowerCase(), display: word, meaning: "专有名词", source: "proper-noun" }, word);
  }
  // A sentence-initial ordinary word is still explained by the word list.
  assert.equal(lookup("The").source, "word-list");
  assert.equal(lookup("Books").meaning, listMeaning("book"));
  // Lowercase words no source explains stay blank.
  assert.deepEqual(lookup("zzyzx"), { key: "zzyzx", display: "zzyzx", meaning: "", source: "" });
});

test("the base dictionary is the last source, before and after the base form", () => {
  const withBase = createWordMeaning({ ...wordList, baseDictionary: { algorithm: "n. 算法", aboard: "ad. 在船上", car: "n. 车" } });
  const { lookup } = withBase.forLesson();
  assert.deepEqual(lookup("aboard"), { key: "aboard", display: "aboard", meaning: "ad. 在船上", source: "base-dictionary" });
  assert.equal(lookup("algorithms").meaning, "n. 算法");
  assert.equal(lookup("algorithms").source, "base-dictionary");
  assert.equal(lookup("car").source, "word-list");
  // Without base-dictionary data the step finds nothing.
  assert.equal(meanings.forLesson().lookup("aboard").meaning, "");
});

test("a lesson override points a word at another word-list entry", () => {
  const { lookup } = meanings.forLesson({ overrides: { close: "book" } });
  assert.deepEqual(lookup("close"), { key: "book", display: "book", meaning: listMeaning("book"), source: "word-list" });
});

test("a term first seen as a proper noun takes a real meaning from a later occurrence", () => {
  const terms = new Map();
  const proper = { key: "zzyzx", display: "Zzyzx", meaning: "专有名词", source: "proper-noun" };
  const real = { key: "zzyzx", display: "zzyzx", meaning: "n. 地名", source: "base-dictionary" };
  addTerm(terms, proper).examples.push(1);
  addTerm(terms, real).examples.push(2);
  assert.deepEqual(terms.get("zzyzx"), { display: "zzyzx", meaning: "n. 地名", source: "base-dictionary", examples: [1, 2] });
});

test("the vocabulary board gets the same meanings as the reading page", () => {
  const edition = {
    words: { travel: ["旅行", "travelled"] },
    stories: [{
      id: "s1",
      title: "Amy's car",
      paragraphs: [[["Amy travelled to Guangzhou by car with her books.", ""], ["Books were everywhere.", ""]]]
    }]
  };
  const catalog = buildCatalog({
    screening: { dictionary: wordList.dictionary, forms: wordList.forms },
    extraMeanings: wordList.extraMeanings,
    editions: { e1: edition }
  });
  assert.equal(catalog.lookup("e1", "s1", "car", 0).meaning, listMeaning("car"));
  assert.equal(catalog.lookup("e1", "s1", "books", 0).meaning, listMeaning("book"));
  assert.equal(catalog.lookup("e1", "s1", "amy", 0).meaning, "专有名词");
  assert.equal(catalog.lookup("e1", "s1", "guangzhou", 0).meaning, "专有名词");
  assert.equal(catalog.lookup("e1", "s1", "travel", 0).meaning, "旅行");
});

test("the reading page and the board share the one meaning module", () => {
  for (const file of ["reading-page.js", "vocab-context.js"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /from "\.\/word-meaning\.js"/, file);
    assert.doesNotMatch(source, /extraMeanings\??\.?\[normalized\]/, file);
  }
});

test("short -ing forms reduce to their verb", async () => {
  const { baseForm } = await import("./base-form.js");
  assert.equal(baseForm("going"), "go");
  assert.equal(baseForm("doing"), "do");
  assert.equal(baseForm("being"), "be");
  for (const word of ["bring", "thing", "sting", "swing"]) assert.equal(baseForm(word), word);
});

const fixtureBase = { algorithm: "n. 算法", amy: "n. 艾米（女子名）", mike: "vi. 偷懒", suddenly: "adv. 突然", delete: "vt. 删除" };

test("forms base-form.js leaves alone still find their word", () => {
  const { lookup } = createWordMeaning({ ...wordList, baseDictionary: fixtureBase }).forLesson();
  for (const [word, base] of [["happier", "happy"], ["bigger", "big"], ["wider", "wide"], ["taller", "tall"],
    ["safest", "safe"], ["fishermen", "fisherman"], ["menus", "menu"], ["mini-bus", "minibus"]]) {
    assert.equal(lookup(word).meaning, listMeaning(base), word);
    assert.equal(lookup(word).key, word, word);
  }
  // The base-form retry knows base-dictionary words: "deleted" is "delete", not "delet".
  assert.equal(lookup("deleted").meaning, "vt. 删除");
  // A hyphenated compound is never glossed part by part.
  assert.equal(lookup("second-floor").meaning, "");
});

test("a word starts a sentence at the beginning, after an opening quote or after a full stop", () => {
  const text = 'Amy said, "Mike is here." Then Mike left with Amy: Suddenly it rained.';
  const startOf = word => atSentenceStart(text, text.indexOf(word));
  assert.equal(startOf("Amy said"), true);
  assert.equal(startOf("Mike is"), true);
  assert.equal(startOf("Then"), true);
  assert.equal(startOf("Mike left"), false);
  assert.equal(startOf("Amy:"), false);
  assert.equal(startOf("Suddenly"), true);
});

test("a capitalised word mid-sentence is a name before it is a base-dictionary word", () => {
  const { lookup } = createWordMeaning({ ...wordList, baseDictionary: fixtureBase }).forLesson();
  assert.equal(lookup("Mike", { sentenceStart: false }).meaning, "专有名词");
  // At a sentence start the base dictionary is a guess, which a name or a lowercase use outranks.
  assert.deepEqual(lookup("Suddenly", { sentenceStart: true }),
    { key: "suddenly", display: "suddenly", meaning: "adv. 突然", source: "base-dictionary", guess: true });
  assert.equal(lookup("suddenly", { sentenceStart: false }).guess, undefined);
  // I'm, I've and I'd are capitalised everywhere and are no names.
  const withContractions = createWordMeaning({ ...wordList, baseDictionary: { "i've": "= I have 我已经" } }).forLesson();
  assert.equal(withContractions.lookup("I’ve", { sentenceStart: false }).meaning, "= I have 我已经");

  const terms = new Map();
  addTerm(terms, lookup("Amy", { sentenceStart: true }));
  addTerm(terms, lookup("Amy", { sentenceStart: false }));
  addTerm(terms, lookup("Algorithms", { sentenceStart: true }));
  addTerm(terms, lookup("algorithms", { sentenceStart: false }));
  assert.equal(terms.get("amy").meaning, "专有名词");
  assert.deepEqual(terms.get("algorithms"), { display: "algorithms", meaning: "n. 算法", source: "base-dictionary", examples: [] });
});

test("terms looked up before the base dictionary arrives are filled in place when it does", () => {
  const sentences = ["Algorithms help.", "She met Amy and Mike.", "Amy liked algorithms and books."];
  const tokens = sentences.flatMap(sentence => [...sentence.matchAll(/[\p{L}]+/gu)].map(match => ({
    text: match[0], sentenceStart: atSentenceStart(sentence, match.index)
  })));
  const build = lookup => {
    const terms = new Map();
    for (const token of tokens) addTerm(terms, lookup(token.text, token)).examples.push(token);
    return terms;
  };
  const terms = build(meanings.forLesson().lookup);
  const before = new Map([...terms].map(([key, term]) => [key, term.examples]));
  assert.equal(terms.get("algorithms").meaning, "专有名词");
  assert.equal(terms.get("books").meaning, listMeaning("book"));

  const { lookup } = createWordMeaning({ ...wordList, baseDictionary: fixtureBase }).forLesson();
  refreshTerms(terms, token => lookup(token.text, token));
  // Same keys, same examples, so saved marks still point where they did.
  assert.deepEqual(new Map([...terms].map(([key, term]) => [key, term.examples])), before);
  assert.equal(terms.get("algorithms").meaning, "n. 算法");
  assert.equal(terms.get("algorithms").source, "base-dictionary");
  assert.equal(terms.get("amy").meaning, "专有名词");
  assert.equal(terms.get("mike").meaning, "专有名词");
  assert.deepEqual(terms, build(lookup));
});

test("the vocabulary board shows base-dictionary meanings too", () => {
  const edition = { words: {}, stories: [{ id: "s1", title: "Notes", paragraphs: [[["They studied algorithms.", ""]]] }] };
  const catalog = buildCatalog({
    screening: { dictionary: wordList.dictionary, forms: wordList.forms },
    extraMeanings: wordList.extraMeanings,
    baseDictionary: fixtureBase,
    editions: { e1: edition }
  });
  assert.equal(catalog.lookup("e1", "s1", "algorithms", 0).meaning, "n. 算法");
});

test("a missing or broken base dictionary is no base dictionary", async () => {
  assert.deepEqual(await loadBaseDictionary(async () => null), {});
  assert.deepEqual(await loadBaseDictionary(async () => "{"), {});
  assert.deepEqual(await loadBaseDictionary(async () => "[1]"), {});
  assert.deepEqual(await loadBaseDictionary(async () => '{"car": "n. 车"}'), { car: "n. 车" });
});

// Lowercase words in the collections published by 2026-11-24 that no source explains.
// Keep this short: a new word here means a story uses a word the base dictionary does not have.
const UNEXPLAINED = {
  // Hyphenated compounds: never glossed part by part (second-floor is not 秒＋地面), and
  // multi-word expressions are out of the base dictionary's scope.
  compounds: `computer-created cross-subject deep-sea environmental-friendly fast-moving grown-up
    hard-and-fast hard-to-reach high-achieving high-five human-like human-machine human-made laid-back
    long-term machine-person modern-day modern-thinking money-raising multi-step non-procrastinators
    one-metre one-on-one pie-making quick-growing ready-made real-life second-floor seed-to-seed
    super-cold super-fast top-selling two-legged two-way up-to-now year-old`,
  // Pieces of web addresses in exam passages (www.youthnews.com).
  web: "com https www sunshineschoolweekly youthnews yourview",
  // In ECDICT but outside the base dictionary's selection (scripts/base-dictionary.mjs).
  rare: `chrysalises downhearted fishhooks gameplay hexagon hexagons lifelike lychee noticeboard pewee
    procrastinators refashion repurposed sleeplessness undone unopened upcycle upcycled upcycling`,
  // Typos and foreign words in the source passages.
  typos: "line-just restaurer science-from"
};

const readText = async path => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

// The collections that existed when the allowance was written. Later ones are left to the
// content check's notice, so an ordinary content push never turns these tests red.
const PUBLISHED = ["content/screening.json", "content/placement-02.json", "content/reading-01.json",
  "content/reading-02-v3.json", "content/reading-03-v2.json", "content/reading-04.json",
  "content/daily-news-01.json", "content/review-2026-11-24.json"];

test("every lowercase word in the published stories has a meaning, beyond a named allowance", async () => {
  const allowed = new Set(Object.values(UNEXPLAINED).flatMap(words => words.trim().split(/\s+/)));
  let count = 0;
  for (const _ of (await loadWordCatalog(readText)).terms()) count++;
  assert.ok(count > 20000, "the catalog holds every published story");
  const blank = (await unexplainedWords(readText))
    .filter(({ file }) => PUBLISHED.includes(file))
    .flatMap(({ file, words }) => words.filter(word => !allowed.has(word)).map(word => file + " " + word));
  assert.deepEqual(blank, []);
});

// A new three-story batch, `sentence` in its first story, on top of the real word list
// and base dictionary. Its word repeats enough, so the batch itself is fine.
const withCollection = sentence => async path => {
  if (path === "content/index.json") return JSON.stringify({ collections: [{ id: "review-2026-12-01", kind: "review" }] });
  if (path === "content/review-2026-12-01.json") return JSON.stringify({
    words: { lamp: ["灯", "lamps"] },
    stories: [sentence, "The lamp was on.", "The lamp was old."].map((english, index) => ({
      id: "review-2026-12-01-0" + (index + 1), title: "The Lamp", topic: "那盏灯", picture: "一盏旧台灯。",
      paragraphs: [[[english, "灯亮着。"]]]
    }))
  });
  return readText(path);
};

test("the content check names the file and the word no source explains, and still passes", async () => {
  const files = withCollection("Mia saw the lamps and a zzyzxq near Guangzhou.");
  const { problems, repetition } = await checkLibrary(files, async () => true);
  assert.deepEqual(problems, []);
  assert.deepEqual(repetition, []);
  const unexplained = await unexplainedWords(files);
  assert.deepEqual(unexplained, [{ file: "content/review-2026-12-01.json", words: ["zzyzxq"] }]);
  const notice = unexplainedNotice(unexplained[0]);
  assert.match(notice, /^content\/review-2026-12-01\.json：1 个/);
  assert.match(notice, /zzyzxq/);
});

test("a collection every word of which has a meaning gets no notice", async () => {
  assert.deepEqual(await unexplainedWords(withCollection("Mia saw the lamps, the books and the algorithms.")), []);
});
