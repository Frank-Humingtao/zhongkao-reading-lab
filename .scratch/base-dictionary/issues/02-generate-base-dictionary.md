# 02: Generate the base dictionary from ECDICT

**What to build:** `scripts/base-dictionary.mjs <ecdict.csv>` writes `content/base-dictionary.json`: ECDICT single words tagged zk/gk/cet4/cet6/ky plus the 20,000 most frequent, Chinese translation required, shortened to two parts of speech and three senses each, with about 30 hand-written contractions. Commit the output, not the csv. The content check accepts the new file. See the spec's "Base dictionary contents" and "Generation", and ADR-0004.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Downloading ECDICT needs the reader's go-ahead first (state file name, source and size).

- [ ] Generator tested on a tiny ECDICT-shaped csv: tag/frequency filter, phrase exclusion, truncation, contractions
- [ ] `content/base-dictionary.json` has 20,000–25,000 entries and is a few hundred KB gzipped
- [ ] `node scripts/check-content.mjs` passes with the file present
- [ ] ECDICT's MIT licence and source are credited (README)
