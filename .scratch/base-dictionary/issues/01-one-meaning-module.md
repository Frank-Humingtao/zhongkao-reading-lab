# 01: One meaning lookup, with base forms, headwords and proper nouns

**What to build:** Move the meaning chain that `reading-page.js` and `vocab-context.js` each carry into one shared module, and use it from both. Add the fixes that need no new data: word-list headwords count as their own form (car, build, begin), a word with no meaning is retried by its base form (books → book), and a capitalised word no source explains is shown as 专有名词. The base-dictionary step is a seam that returns nothing for now. See the spec's Solution and "One meaning module".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Popup, inline gloss, vocabulary board and exports all get their meaning from the one module
- [ ] car, build, begin, act and close show their word-list meaning
- [ ] books, kites, going and studied show the meaning of their base form
- [ ] A collection's own meaning still wins over the word list
- [ ] Amy (mid-sentence and sentence-initial) and Guangzhou show 专有名词
- [ ] Tested with `node --test` against the real `dictionary.json`; existing tests still pass
