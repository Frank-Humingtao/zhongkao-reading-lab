# 03: The page falls back to the base dictionary

**What to build:** Fill the base-dictionary seam from 01 with the file from 02. The page loads it in the background once a story is shown; a tap before it arrives waits for it rather than flashing 暂无. Base-dictionary meanings show a faint 词典 mark in the popup and inline gloss, and marked words keep that meaning on the vocabulary board and in exports. See the spec's Solution, "Loading" and user stories 7–10.

**Blocked by:** 01, 02

**Status:** resolved

- [x] algorithms, astronomer and can't show a short meaning with the 词典 mark, in light and dark themes
- [x] The first tap after opening a story shows a meaning, never 暂无 first
- [x] Marking algorithms shows its meaning on the board and in the export
- [x] Coverage test: across all published stories, no lowercase word is left without a meaning beyond a short named allowance
- [ ] Works the same inside the app's web view (not checked in the app; see Comments)

## Comments

Done in `7685753` (branch `claude/base-dict-03-page-e1182e`).

**What changed**
- `content.js`: `loadBaseDictionary` (missing or broken file → `{}`).
- `reading-page.js`: after the first story renders, loads the base dictionary (`requestIdleCallback` with a 1.5 s timeout; `setTimeout` 300 ms where there is none, as in Safari / WKWebView) and re-looks-up in place every term with no meaning or a 专有名词 guess (`refreshTerms`). Keys never depend on the base dictionary, so saved marks and example indexes are untouched. Until it arrives, a marked word that may need it gets no gloss (a tap also starts the load at once); its gloss appears when the file lands.
- 词典 mark: `.gloss-source` in `index.html` next to `.inline-gloss`, using `--hair` / `--muted`. The page has no meaning popup (the word menu shows occurrences only), so the mark is on the inline gloss.
- `vocab-context.js`: `loadWordCatalog` reads the base dictionary, so the board and `scripts/daily-words.mjs --json` show the same meanings; `catalog.terms()` lists every lesson's terms (used by the coverage test; ticket 04 may want it).
- `word-meaning.js`, beyond plugging the file in, to get the blanks down:
  - the base-form retry knows base-dictionary words (deleted → delete, not "delet");
  - loose forms tried only if they lead to a meaning: comparatives/superlatives (taller, wider, bigger, happier, safest), -men (fishermen), -us plurals (menus), hyphen joined (mini-bus → minibus). Compounds are never glossed part by part (tried it: second-floor → 秒＋地面, cross-subject → 脾气不好的＋题目);
  - **names (decision for review):** with the real file, step 4 beat step 6 for capitalised words: Amy → 艾米（女子名）, but also Mike → 偷懒, Peter → 逐渐消失, Robert → 警察, Jack → 插座 (the Bill → 账单 problem). Now a capitalised word mid-sentence skips the base dictionary (专有名词), while a sentence-initial one still uses it as a *guess* (Suddenly → 突然). Per term, a lowercase/word-list meaning beats a mid-sentence 专有名词, which beats a sentence-start guess. Title words count as sentence starts. Trade-offs: places mid-sentence show 专有名词, not 巴黎 / 瑞士; title-cased headings inside a story ("Caber Toss", "2. Volume", "All Aboard the Library!") read as names; a name seen only at sentence starts keeps the base-dictionary sense (Mike → 偷懒 if never mid-sentence).
- `scripts/base-dictionary.mjs` + `content/base-dictionary.json`: added he'd, she'd, it'll, we'd, they'd, who'd, cannot to `CONTRACTIONS`; the json got exactly those 7 lines (applied as the generator's last step does, without the ECDICT csv).

**Coverage** (word-meaning.test.mjs): 0 unexpected blanks across all 8 collections. Named allowance, 66 words:
- compounds (37): computer-created cross-subject deep-sea environmental-friendly fast-moving grown-up hard-and-fast hard-to-reach high-achieving high-five human-like human-machine human-made laid-back long-term machine-person modern-day modern-thinking money-raising multi-step non-procrastinators one-metre one-on-one pie-making quick-growing ready-made real-life second-floor seed-to-seed super-cold super-fast top-selling two-legged two-way up-to-now year-old
- web-address pieces (6): com https www sunshineschoolweekly youthnews yourview
- rare, in ECDICT but outside the selection (19): chrysalises downhearted fishhooks gameplay hexagon hexagons lifelike lychee noticeboard pewee procrastinators refashion repurposed sleeplessness undone unopened upcycle upcycled upcycling
- typos/foreign (3): line-just restaurer science-from

That is longer than "short". The rare group could go by widening the generator's selection (ticket 02's call). Note: the test fails when a new story brings a new unexplained lowercase word; the content check (ticket 04) only warns.

**Verified in the browser** (local static server, Placement 02): with `base-dictionary.json` held back 4 s, tapping algorithms and can't 134 ms after load showed no gloss and no 暂无, then (n. 算法 词典) and (= cannot 不能；不会 词典). astronomer → n. 天文学家 + 词典; books and car → word-list meaning, no mark; Amy (gz-2026-b, gz-2025-a) → 专有名词. Light desktop and dark 375 px both readable, no horizontal scroll; saved marks re-render after reload. Board: algorithm → n. 算法; 复制 gives words only (as before); `daily-words.mjs --json` gives algorithm → n. 算法, can't → = cannot 不能；不会. `node --test` 108/108, `node scripts/check-content.mjs` passes.

**Pending:** not checked inside the iPhone app's web view; the `setTimeout` fallback was not exercised in a browser without `requestIdleCallback`.
