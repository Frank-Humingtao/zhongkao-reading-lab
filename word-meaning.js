// The meaning of a tapped word. The reading page (popup and inline gloss) and the
// vocabulary board (board and exports) both look words up here, so the order lives
// in one place. A word is looked up in this order, stopping at the first hit:
//
//   1. the collection's own meaning (its words / targets, matched as written);
//   2. the word list (content/dictionary.json): its forms, then its headwords;
//   3. the word list's extra meanings;
//   4. the base dictionary (filled by a later step; empty for now);
//   5. steps 2–4 again for the word's base form (base-form.js);
//   6. 专有名词 if the word is capitalised; otherwise no meaning.
//
// See docs/adr/0004-base-dictionary-looked-up-at-runtime.md.

import { baseForm } from "./base-form.js";

export const PROPER_NOUN = "专有名词";

// Forms base-form.js leaves alone, tried only when they lead to a meaning:
// comparatives and superlatives (taller, wider, bigger, happier, safest),
// -men plurals (fishermen), plurals of words ending in -u (menus), and a hyphenated
// word written as one (mini-bus → minibus). A hyphenated compound is never glossed
// part by part: "second-floor" is not 秒＋地面.
function looseForms(word) {
  const forms = word.includes("-") ? [word.replaceAll("-", "")] : [];
  const degree = /^(.{2,}?)(er|est)$/.exec(word);
  if (degree) {
    const stem = degree[1];
    forms.push(stem, stem + "e");
    if (stem.at(-1) === stem.at(-2)) forms.push(stem.slice(0, -1));
    if (stem.endsWith("i")) forms.push(stem.slice(0, -1) + "y");
  }
  if (word.endsWith("men") && word.length > 4) forms.push(word.slice(0, -3) + "man");
  if (/us$/.test(word) && word.length > 4) forms.push(word.slice(0, -1));
  return forms;
}

function escapePattern(text) {
  return text.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
}

// A collection's words, { key: [meaning, ...forms] }, as a glossary:
// surface → [key, meaning, display].
export function collectionGlossary(words) {
  const glossary = {};
  for (const [key, value] of Object.entries(words || {})) {
    const [meaning, ...forms] = Array.isArray(value) ? value : [""];
    for (const form of [key, ...forms]) glossary[form] = [key, meaning, key];
  }
  return glossary;
}

// Whether a word at `offset` in `text` begins a sentence or a quotation, where
// any word is capitalised.
export function atSentenceStart(text, offset) {
  const before = String(text).slice(0, offset);
  return /^[^\p{L}\p{N}]*$/u.test(before) || /(?:["“‘:—]|\s-|[.!?]["”’)]*\s)\s*$/u.test(before);
}

// How firmly a lookup settles a term. A capitalised word at a sentence start that only
// the base dictionary explains is a guess (Suddenly → 突然, but Mike → 偷懒); the same word
// capitalised mid-sentence is a name (专有名词) and outranks it; a lowercase occurrence
// with no meaning anywhere is never a name; any other meaning settles the term.
function rank({ meaning, source, guess }) {
  if (guess) return 1;
  if (source === "proper-noun" || !meaning) return 2;
  return 3;
}

// Words that end in the same key share one term; the first occurrence sets its
// meaning, unless a later one settles it more firmly (see `rank`): a name seen
// first at the start of a sentence, then lowercase elsewhere, takes the real meaning.
export function addTerm(terms, found) {
  const { key, display, meaning, source, guess } = found;
  const term = terms.get(key);
  if (!term) {
    const created = { display, meaning, source, examples: [] };
    if (guess) created.guess = true;
    terms.set(key, created);
    return created;
  }
  if (rank(found) > rank(term)) {
    Object.assign(term, { display, meaning, source });
    delete term.guess;
    if (guess) term.guess = true;
  }
  return term;
}

// Whether a term may still change once the base dictionary arrives: it has no
// meaning yet, or only a proper-noun guess the base dictionary could replace.
export function awaitsBaseDictionary(term) {
  return !term.meaning || term.source === "proper-noun";
}

// Looks a lesson's terms up again, in place, after the base dictionary arrives.
// Keys never depend on the base dictionary, so marks keep pointing at the same
// term and example; only terms that `awaitsBaseDictionary` change. `lookupExample`
// looks one of the term's examples up again.
export function refreshTerms(terms, lookupExample) {
  for (const [key, term] of terms) {
    if (!awaitsBaseDictionary(term)) continue;
    const fresh = new Map();
    for (const example of term.examples) addTerm(fresh, lookupExample(example));
    const found = fresh.get(key);
    if (!found) continue;
    Object.assign(term, { display: found.display, meaning: found.meaning, source: found.source });
    if (found.guess) term.guess = true;
  }
}

export function createWordMeaning({ dictionary = {}, forms = {}, extraMeanings = {}, baseDictionary = {} } = {}) {
  // The word list as a glossary: every form, and every headword as its own form.
  const glossary = {};
  for (const [surface, key] of Object.entries(forms)) {
    if (dictionary[key]) glossary[surface] = [key, dictionary[key][1], dictionary[key][0]];
  }
  for (const [key, [display, meaning]] of Object.entries(dictionary)) {
    if (!Object.hasOwn(glossary, key)) glossary[key] = [key, meaning, display];
  }
  // Headwords, so base-form.js can tell a real word ("building") from an inflected one.
  const headwords = new Set(Object.keys(dictionary).filter(word => !word.includes(" "))
    .map(word => word.toLocaleLowerCase("en")));
  const fromBase = word => Object.hasOwn(baseDictionary || {}, word) ? baseDictionary[word] : "";
  // The base-form retry also knows the base dictionary's words, so "deleted" finds
  // "delete" even though the word list has no "delete".
  const known = new Set([...headwords, ...Object.keys(baseDictionary || {})]);

  // Steps 2–4 for one word, ignoring the collection.
  function fromWordList(word, useBase = true) {
    const entry = Object.hasOwn(glossary, word) ? glossary[word] : null;
    if (entry?.[1]) return { meaning: entry[1], source: "word-list" };
    if (Object.hasOwn(extraMeanings, word) && extraMeanings[word]) return { meaning: extraMeanings[word], source: "word-list" };
    if (!useBase) return null;
    const base = fromBase(word);
    if (base) return { meaning: base, source: "base-dictionary" };
    return null;
  }

  return {
    glossary,
    // One lesson's lookup. `collection` is the collection's surface → [key, meaning, display];
    // `targets` its { key: [meaning, ...forms] }; `overrides` its surface → word-list headword.
    // Keys and phrases come from the collection over the word list, as they always have; a
    // lesson with `useWordList: false` (Placement 01's older lessons) takes keys and phrases
    // from its own glossary only, and uses the word list for meanings alone.
    forLesson({ collection = {}, targets = {}, overrides = {}, useWordList = true } = {}) {
      const definitions = useWordList ? { ...glossary, ...collection } : collection;
      const targetKeys = new Map();
      const phrases = new Set(Object.keys(definitions).filter(key => key.includes(" ")));
      for (const [key, value] of Object.entries(targets)) {
        const forms = Array.isArray(value) ? value.slice(1) : [];
        for (const form of [key, ...forms]) targetKeys.set(form, key);
        if (key.includes(" ")) phrases.add(key);
      }
      const phrasePatterns = [...phrases].sort((left, right) => right.length - left.length)
        .map(phrase => escapePattern(phrase) + "(?![\\p{L}])");

      // `sentenceStart` says whether the word begins a sentence (atSentenceStart); a
      // capitalised word that does not is taken for a name before the base dictionary.
      function lookup(surface, { sentenceStart = true } = {}) {
        const normalized = surface.toLowerCase().replaceAll("’", "'");
        const matched = Object.hasOwn(definitions, surface) ? surface
          : Object.hasOwn(definitions, normalized) ? normalized : null;
        let entry = matched === null ? undefined : definitions[matched];
        let entrySource = matched !== null && collection[matched] === entry ? "collection" : "word-list";
        const override = overrides?.[normalized];
        if (override && dictionary[override]) {
          const [display, meaning] = dictionary[override];
          entry = [override, meaning, display];
          entrySource = "word-list";
        }
        const key = targetKeys.get(normalized) ?? entry?.[0] ?? normalized;
        const display = entry?.[2] ?? key;
        const found = meaning => ({ key, display, ...meaning });

        const target = targets[key];
        if (Array.isArray(target) && target[0]) return found({ meaning: target[0], source: "collection" });
        if (entry?.[1]) return found({ meaning: entry[1], source: entrySource });
        const capitalised = /^\p{Lu}/u.test(surface) && !/^I(?:['’]|$)/.test(surface);
        const useBase = !capitalised || sentenceStart;
        const settle = meaning => found(capitalised && meaning.source === "base-dictionary" ? { ...meaning, guess: true } : meaning);
        const listed = fromWordList(normalized, useBase);
        if (listed) return settle(listed);
        const base = baseForm(normalized.replace(/'s$/, ""), known).toLocaleLowerCase("en");
        const fromBaseForm = (base !== normalized ? fromWordList(base, useBase) : null)
          ?? looseForms(normalized).map(form => fromWordList(form, useBase)).find(Boolean);
        if (fromBaseForm) return settle(fromBaseForm);
        if (/^\p{Lu}/u.test(surface)) return { key, display: surface, meaning: PROPER_NOUN, source: "proper-noun" };
        return found({ meaning: "", source: "" });
      }

      return { phrasePatterns, lookup };
    }
  };
}
