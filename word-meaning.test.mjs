import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addTerm, collectionGlossary, createWordMeaning } from "./word-meaning.js";
import { buildCatalog } from "./vocab-context.js";

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
