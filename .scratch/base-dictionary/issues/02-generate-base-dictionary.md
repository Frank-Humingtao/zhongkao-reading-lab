# 02: Generate the base dictionary from ECDICT

**What to build:** `scripts/base-dictionary.mjs <ecdict.csv>` writes `content/base-dictionary.json`: ECDICT single words tagged zk/gk/cet4/cet6/ky plus the 20,000 most frequent, Chinese translation required, shortened to two parts of speech and three senses each, with about 30 hand-written contractions. Commit the output, not the csv. The content check accepts the new file. See the spec's "Base dictionary contents" and "Generation", and ADR-0004.

**Blocked by:** None (can start immediately)

**Status:** resolved

Downloading ECDICT needs the reader's go-ahead first (state file name, source and size).

- [x] Generator tested on a tiny ECDICT-shaped csv: tag/frequency filter, phrase exclusion, truncation, contractions
- [x] `content/base-dictionary.json` has 20,000–25,000 entries and is a few hundred KB gzipped
- [x] `node scripts/check-content.mjs` passes with the file present
- [x] ECDICT's MIT licence and source are credited (README)

## Comments

Done in 1cf9c96 on `claude/base-dict-02-generate-dc9cb9`.

- `content/base-dictionary.json`: 20,275 entries (ECDICT rows tagged zk/gk/cet4/cet6/ky ∪ 20,000 most frequent by min(`frq`, `bnc`) rank, plus 37 contractions); 1,070,666 bytes raw, 409,874 bytes gzipped (-9). Written with `formatContent`, one word per line, keys sorted.
- Source: `ecdict.csv` (66,009,548 bytes) from `skywind3000/ECDICT` master, downloaded to a scratch directory outside the repo; not committed.
- Shortening: subject-label lines (`[计]`, `[网络]`) dropped unless nothing else has Chinese; senses split on `,，;；` outside brackets; senses with no Chinese dropped.
- Samples: book → `n. 书；书籍；帐簿 v. 登记；预订`; algorithm → `n. 算法`; astronomer → `n. 天文学家`; can't → `= cannot 不能；不会`.
- The content check reads the file if present and fails only if it is not a flat lowercase word → non-empty meaning object (`checkBaseDictionary` in `content.js`).
- Note for ticket 03: ECDICT also carries common names (bill → `n. 帐单；清单；钞票`, london → `n. 伦敦`), so a capitalised Bill hits the base dictionary at step 4 before the 专有名词 step; the spec's "Bill → 专有名词" story needs the lookup to skip the base dictionary for capitalised mid-sentence words, or accept this.
