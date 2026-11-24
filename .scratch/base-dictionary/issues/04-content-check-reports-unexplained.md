# 04: The content check reports words still unexplained

**What to build:** For each new or changed collection, the content check lists, as a notice in plain Chinese, the lowercase words no source (including the base dictionary) explains. It never fails the check for them. See the spec's "Content check" and ADR-0003.

**Blocked by:** 01, 02

**Status:** resolved

- [x] A collection with an unexplained word passes and names the word and file
- [x] A collection with none prints nothing extra

## Comments

Done in `26083c1` (branch `claude/base-dict-04-check-071f06`).

**What changed**
- `vocab-context.js`: `unexplainedWords(readText)` → `[{ file, words }]`, per collection in `content/index.json` order, words sorted, collections with none left out. Built on ticket 03's `loadWordCatalog` / `catalog.terms()`, so tokenization and the lookup order are exactly the page's (real word list + base dictionary). `unexplainedNotice(item)` writes the line.
- `scripts/check-content.mjs`: after the pass/fail lines (and in the GitHub job summary), a `提醒（不影响检查结果）：` block, one line per collection with blanks. The exit code is unchanged; without `content/dictionary.json` the notice is skipped rather than crashing the check. It lists every collection, not only new or changed ones: the script has no git view, and the list is short.
- `CONTENT.md` step 4: says the notice is only a reminder, and not to add words to `words` for it (that would trip the repetition rule).

**Coverage test (ticket 03's problem).** I kept the named allowance but limited the assertion to the eight collection files published today, listed by name in `word-meaning.test.mjs` (`PUBLISHED`). It still proves the lookup order covers every published word, and it now uses the same `unexplainedWords` the notice does, so the two cannot drift apart. A new story with a new unexplained word shows up in the content check's notice and leaves `node --test` green. I chose this over a ceiling on the total count: a ceiling still turns red on new content once enough words build up, and it no longer says which words are allowed. A change to the code or to the base dictionary that blanks a published word still fails the test.

**Tests:** in `word-meaning.test.mjs`, a fixture three-story batch on top of the real dictionaries. One unexplained word (`zzyzxq`, with Guangzhou as 专有名词 and lamps as a form): `checkLibrary` gives no problems and no repetition issues, the word and `content/review-2026-12-01.json` are named. With none (lamps, books, algorithms): no notice. `node --test` 110/110; `node scripts/check-content.mjs` exits 0.

**Sample output against today's content:**
```
✓ 内容检查通过：8 个合集，265 篇。

提醒（不影响检查结果）：
· content/placement-02.json：60 个小写词点开没有中文释义（合集、词表、基础词典里都没有）：chrysalises、com、computer-created、…、youthnews。只是提醒，不算问题。
· content/reading-01.json：1 个小写词点开没有中文释义（合集、词表、基础词典里都没有）：second-floor。只是提醒，不算问题。
· content/daily-news-01.json：3 个小写词点开没有中文释义（合集、词表、基础词典里都没有）：gameplay、human-made、multi-step。只是提醒，不算问题。
```
(placement-02's line is shortened here; the real one lists all 60 words.)
