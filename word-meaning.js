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

// Words that end in the same key share one term; the first occurrence sets its
// meaning, except that a proper-noun guess gives way to a real meaning found later
// (a word seen first at the start of a sentence).
export function addTerm(terms, found) {
  const { key, display, meaning, source } = found;
  const term = terms.get(key);
  if (!term) {
    const created = { display, meaning, source, examples: [] };
    terms.set(key, created);
    return created;
  }
  if (term.source === "proper-noun" && source !== "proper-noun" && meaning) {
    Object.assign(term, { display, meaning, source });
  }
  return term;
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

  // Steps 2–4 for one word, ignoring the collection.
  function fromWordList(word) {
    const entry = Object.hasOwn(glossary, word) ? glossary[word] : null;
    if (entry?.[1]) return { meaning: entry[1], source: "word-list" };
    if (Object.hasOwn(extraMeanings, word) && extraMeanings[word]) return { meaning: extraMeanings[word], source: "word-list" };
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

      function lookup(surface) {
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
        const listed = fromWordList(normalized);
        if (listed) return found(listed);
        const base = baseForm(normalized.replace(/'s$/, ""), headwords).toLocaleLowerCase("en");
        const fromBaseForm = base !== normalized ? fromWordList(base) : null;
        if (fromBaseForm) return found(fromBaseForm);
        if (/^\p{Lu}/u.test(surface)) return { key, display: surface, meaning: PROPER_NOUN, source: "proper-noun" };
        return found({ meaning: "", source: "" });
      }

      return { phrasePatterns, lookup };
    }
  };
}
