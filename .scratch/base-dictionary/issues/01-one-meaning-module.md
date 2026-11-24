# 01: One meaning lookup, with base forms, headwords and proper nouns

**What to build:** Move the meaning chain that `reading-page.js` and `vocab-context.js` each carry into one shared module, and use it from both. Add the fixes that need no new data: word-list headwords count as their own form (car, build, begin), a word with no meaning is retried by its base form (books → book), and a capitalised word no source explains is shown as 专有名词. The base-dictionary step is a seam that returns nothing for now. See the spec's Solution and "One meaning module".

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Popup, inline gloss, vocabulary board and exports all get their meaning from the one module
- [x] car, build, begin, act and close show their word-list meaning
- [x] books, kites, going and studied show the meaning of their base form
- [x] A collection's own meaning still wins over the word list
- [x] Amy (mid-sentence and sentence-initial) and Guangzhou show 专有名词
- [x] Tested with `node --test` against the real `dictionary.json`; existing tests still pass

## Comments

**2026-11-24, branch `claude/base-dict-01-meaning-module-e34ece`** — commits 712857c, ff39942.

- `word-meaning.js`: `createWordMeaning({ dictionary, forms, extraMeanings, baseDictionary })` → `.forLesson({ collection, targets, overrides, useWordList })` → `{ phrasePatterns, lookup(surface) }`, where `lookup` returns `{ key, display, meaning, source }` and `source` is `collection`, `word-list`, `base-dictionary`, `proper-noun` or `""`. `addTerm` merges a later real meaning over an earlier proper-noun guess. `reading-page.js` and `vocab-context.js` both use it; `glossaryFromScreening` is gone.
- Base dictionary seam: `baseDictionary` (a plain `{ word: meaning }`, default `{}`) is checked after extra meanings and again for the base form. Ticket 03 only needs to pass the loaded file in (and await it before the first tap).
- Keys are unchanged: a base-form or proper-noun hit keeps the word as written as its key (books stays `books`), so saved marks keep matching. Checked by diffing old vs new catalogs over every published lesson: same keys and example counts everywhere, no existing meaning changed, blank terms 2,531 → 960 (363 now 专有名词).
- Placement 01's older lessons (trial / previous) keep their own glossary for keys and phrases (`useWordList: false`) but now fall back to the word list for meanings.
- `base-form.js`: the -ing rule needed 6+ letters, so going/doing/being never reduced; now 5+.
- Tests: `word-meaning.test.mjs` (11 tests, real `dictionary.json` plus a fixture base dictionary); `node --test` 91/91 pass, no pre-existing failures.
- Browser (local static server, Placement 02): car → n. 汽车，小卧车; books → n. 书；本子…; Amy and Guangzhou (title) → 专有名词; the vocabulary board showed the same four meanings.
- Not done / noted: a capitalised word the word list explains keeps that meaning (sentence-initial "Bill" → 账单), as the spec's proper-noun rule says. Proper nouns show lowercase on the board (`amy`), since the board shows the key. Possessives are retried without 's ("Amy's" → 专有名词, "car's" → car).
