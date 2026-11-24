Status: ready-for-agent

# A meaning for every tapped word

## Problem Statement

When the reader taps a word in a story, the page shows its Chinese meaning only if the writer agent glossed it for that collection or it is on the word list. Anything else shows 暂无中文释义. Across the published stories (2026-11-24), 1,580 of the 4,119 distinct words show nothing:

- about 516 are inflected forms whose base form is on the word list (books, kites, going, studied);
- 108 are word-list headwords themselves (car, build, begin, act, close), because the word list's forms table maps acts → act but never act → act;
- about 1,000 are words outside the word list (algorithms, astronomer, aboard) or proper nouns (Amy, Guangzhou, Darwin).

## Solution

Every tapped word gets a basic meaning. The page looks a word up in this order and stops at the first hit:

1. the collection's own meaning for the word (its `words` / targets);
2. the **word list** (`content/dictionary.json`: forms, then headwords themselves);
3. the word list's extra meanings;
4. the **base dictionary** (`content/base-dictionary.json`);
5. the same steps 2–4 again for the word's base form (`base-form.js`);
6. if the word is capitalised, **专有名词**; otherwise 暂无中文释义.

Base-dictionary meanings are shortened and carry a faint 词典 mark. Marked words keep the meaning they were shown with on the vocabulary board and in exports. See ADR-0004.

## User Stories

1. As the reader, I want a meaning for any word I tap, so that I never stop reading to look it up elsewhere.
2. As the reader, I want books, studied and going to show the meaning of book, study and go, so that inflected forms are never blank.
3. As the reader, I want car, build and begin to show their word-list meaning, so that the word list's own words always work.
4. As the reader, I want the meaning written for this collection to win over any dictionary meaning, so that I see the sense that fits the story.
5. As the reader, I want Amy, Guangzhou and Darwin shown as 专有名词, so that names never get a wrong sense (Bill → 账单).
6. As the reader, I want can't, I've and you're explained, so that contractions are not blank.
7. As the reader, I want base-dictionary meanings kept short (at most two parts of speech, three senses each), so that the gloss stays readable on a phone.
8. As the reader, I want a faint 词典 mark on base-dictionary meanings, so that I know the meaning is general rather than written for this story.
9. As the reader, I want the first tap to show the meaning at once, so that there is no flash of 暂无 while the dictionary loads.
10. As the reader, I want a word I marked from the base dictionary to show the same meaning on the vocabulary board and in exports, so that my word list is never blank.

## Implementation Decisions

- **One meaning module.** `reading-page.js` (popup and inline gloss) and `vocab-context.js` (board, exports) each carry their own copy of the meaning chain today. Both move to one shared module exposing a single lookup — word in, `{ key, display, meaning, source }` out, where `source` is collection, word list, base dictionary or proper noun — so the order above lives in one place and is tested once.
- **Word-list headwords** count as their own form, fixing the 108 blank headwords.
- **Base form** retry uses `baseForm(word, headwords)` and only for steps 2–4; a collection meaning is matched only as written (collections already list their own forms).
- **Proper noun**: any word with a capital first letter, including at the start of a sentence, that no source explains. A rare ordinary word at a sentence start may be mislabelled; accepted.
- **Base dictionary contents**: ECDICT entries tagged zk, gk, cet4, cet6 or ky, plus the 20,000 most frequent by `frq`/`bnc`; single words only (no spaces); entries with no Chinese translation dropped; about 30 hand-written contractions added. Expected 20,000–25,000 entries. Shape: `{ "word": "n. 书；书籍 v. 预订" }`, already shortened at generation time.
- **Generation**: `scripts/base-dictionary.mjs <path to ecdict.csv>` writes `content/base-dictionary.json`; the output is committed, the ECDICT csv is not. Rerun only to change the selection.
- **Loading**: fetched with `requestIdleCallback` (or a timeout fallback) after the story renders; if a word is tapped before it arrives, the lookup awaits it rather than showing 暂无.
- **Content check** accepts `base-dictionary.json` as a known file, and for new collections lists how many words no source explains as a notice, never a failure.

## Testing Decisions

- The meaning module is tested with `node --test` against the real `dictionary.json` and a small fixture base dictionary: each step of the order, base-form retry, headword-as-form, proper noun at sentence start and mid-sentence, collection meaning overriding the base dictionary.
- A coverage test runs every published story through the module with the real base dictionary and asserts that no lowercase word is left with 暂无 beyond a short, named allowance (answer letters, typos).
- The generator is tested on a tiny ECDICT-shaped csv: filtering, truncation, contractions.
- In the browser: tap books, car, algorithms, Amy and can't in a published story; check the 词典 mark and the board after marking algorithms.

## Out of Scope

- Telling names from places (人名 / 地名), or the writer agent tagging proper nouns.
- Phrases and multi-word expressions from the base dictionary.
- Offline use: the site is not cached offline today.
- Editing or overriding base-dictionary meanings by hand.
