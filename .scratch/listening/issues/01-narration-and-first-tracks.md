# 01: Narration for every story, and tracks for reading set 01

**What to build:** Every story the site can show (reading-set stories, news-edition stories and screening passages) can be turned into its ordered sentence pairs and a narration key, by one module that both the page and track generation use. A hand-triggered GitHub Action uses it to generate the English and Chinese tracks, with per-sentence timings, for every story in reading set 01 using Kokoro (`am_michael` / `zm_yunjian`), and publishes them plus a catalog to GitHub Releases without committing to the repository. Someone can download a story's tracks from the release and hear it. See the spec's Narration module, Tracks, Generator and Publishing decisions, and ADR-0002.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Sentence pairs come out right for a reading-set story, a news-edition story and a screening passage, tested with `node --test` against the real story files and the page's embedded screening data
- [x] Screening-passage sentence indexes match the page's own sentence splitting
- [x] Parenthetical Chinese glosses are absent from the English that will be spoken
- [x] The narration key is identical across runs and changes when any sentence's text changes
- [x] Enumeration covers every reading set, news edition and screening passage the site lists
- [x] A manual dispatch of the Action publishes, for each reading set 01 story, an English track, a Chinese track and timings, plus a catalog mapping narration key to those files; the repository gets no new commits
- [x] Re-running the Action skips keys already published
- [x] One downloaded story sounds right by ear: correct sentences, gloss-free English, the chosen voices

## Comments

Implemented on branch `ticket-01-narration` (commit 3d7c467): `narration.js` (+ `narration.test.mjs`), `scripts/narration-plan.mjs`, `scripts/tracks/generate.py` (uv project, Kokoro `am_michael` / `zm_yunjian`), `.github/workflows/tracks.yml` (manual dispatch, optional `edition` input).

Verification:
- `node --test narration.test.mjs`: 8 tests pass against the real story files and the page's embedded screening data (pairs for each kind of material; all 68 screening passages match the page's own inline splitter; no glosses in spoken English; key stable, pinned, and changing on any sentence edit; enumeration covers every set in site-nav.js plus screening, using the shown versions 02-v3 / 03-v2).
- The Action itself ran (the workflow is not on `main` yet, so it ran from a throwaway branch `listening-tracks-test` with a temporary `push` trigger and `edition` defaulting to `reading-01`; the branch was deleted afterwards). Run 45113666540: 10 reading set 01 stories made and published in about 7 minutes, to release `tracks-001` (30 assets: `<key>.en.m4a`, `<key>.zh.m4a`, `<key>.json`) and `catalog.json` in release `tracks-catalog`. Re-run (attempt 2): "10 stories in the plan, 10 already published, 0 to make".
- No commits: `git ls-remote` before and after shows `main` unchanged; the only new refs are the tags `tracks-001` and `tracks-catalog`, both on the existing `main` commit 371ed50.
- Downloaded `memory-01-film` (key `2a5f5df5d757c8e8`) from the release and transcribed each timed sentence clip with Whisper: all 12 English and 12 Chinese sentences match, apart from homophones in the transcription (厚/后, 她/他). A local run of `daily-news-01-01` checked the gloss case: "The spacecraft is now so far away…" is spoken with no gloss.
- Not yet checked: whether it sounds right by ear. That is for the reader to judge.

Pre-existing, not touched: `vocab.test.mjs` "reading set 04 is its own edition" expects 39 stories, but commit 36dd7a2 added a 40th (unillustrated test) story, so it already failed on the `listening` base.


- 2026-11-23: the reader listened to Thunder for a Film (English and Chinese tracks) and said "听着没问题".
