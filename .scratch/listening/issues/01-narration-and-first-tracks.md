# 01: Narration for every story, and tracks for reading set 01

**What to build:** Every story the site can show (reading-set stories, news-edition stories and screening passages) can be turned into its ordered sentence pairs and a narration key, by one module that both the page and track generation use. A hand-triggered GitHub Action uses it to generate the English and Chinese tracks, with per-sentence timings, for every story in reading set 01 using Kokoro (`am_michael` / `zm_yunjian`), and publishes them plus a catalog to GitHub Releases without committing to the repository. Someone can download a story's tracks from the release and hear it. See the spec's Narration module, Tracks, Generator and Publishing decisions, and ADR-0002.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Sentence pairs come out right for a reading-set story, a news-edition story and a screening passage, tested with `node --test` against the real story files and the page's embedded screening data
- [ ] Screening-passage sentence indexes match the page's own sentence splitting
- [ ] Parenthetical Chinese glosses are absent from the English that will be spoken
- [ ] The narration key is identical across runs and changes when any sentence's text changes
- [ ] Enumeration covers every reading set, news edition and screening passage the site lists
- [ ] A manual dispatch of the Action publishes, for each reading set 01 story, an English track, a Chinese track and timings, plus a catalog mapping narration key to those files; the repository gets no new commits
- [ ] Re-running the Action skips keys already published
- [ ] One downloaded story sounds right by ear: correct sentences, gloss-free English, the chosen voices
