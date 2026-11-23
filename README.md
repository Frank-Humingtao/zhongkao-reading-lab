# zhongkao-reading-lab
A mobile-friendly English reading lab

## 生词看板

`vocab.html` shows every current 生词 from the screening passages, the 01/02/03/04 sets, and daily news editions, grouped by the Beijing day each word first became current. News editions keep their own numbers and progress files, and their marks join the same word pool. Progress stays in the browser and the private progress repo; this repo holds no word lists.

Words are grouped and shown in their base form (原型): "slipped" and "slip" are one word, "sleeves" shows as "sleeve" (`base-form.js`).

The word rules live in `vocab-core.js` and are shared by the board and by the export script. It has two modes:

```
# 墨墨 import: words that first became current on one day
GH_TOKEN=… node scripts/daily-words.mjs                    # yesterday (Beijing), one word per line
GH_TOKEN=… node scripts/daily-words.mjs --date 2026-11-20 --json

# Article generation: every word marked in any article in a range, old words marked again included, each once
GH_TOKEN=… node scripts/daily-words.mjs --from 2026-11-19 --to 2026-11-20
GH_TOKEN=… node scripts/daily-words.mjs --from 2026-11-20 --json   # adds firstDay / repeat per word

node scripts/daily-words.mjs --progress-dir ../zhongkao-reading-progress …
```

A mark's time is its last change, so clearing and re-marking a word, or picking another example, in the same article moves it to that later day. Marks from before sync have no day and never fall in a range.

Run the tests with `node --test vocab.test.mjs narration.test.mjs`.

## Listening tracks

`narration.js` turns every story the site shows (screening passages, reading sets, news editions) into its sentence pairs, with Chinese glosses left out of the English, and a narration key that names its tracks. The **Listening tracks** Action (`.github/workflows/tracks.yml`, run by hand, optionally for one set such as `reading-01`) makes the missing tracks with Kokoro (`am_michael` / `zm_yunjian`) and publishes them to the `tracks-NNN` releases, with `catalog.json` in the `tracks-catalog` release. It never commits. To make tracks locally:

```
node scripts/narration-plan.mjs --edition reading-01 > plan.json
uv run --project scripts/tracks python scripts/tracks/generate.py --plan plan.json --out out   # needs espeak-ng
```

## Adding a reading set

Add the set to the `editions` map in `index.html` (as before), one line to `READING_SETS` in `site-nav.js`, and its file to `EDITION_SCRIPTS` in `vocab-context.js` (listening finds stories there; `narration.test.mjs` fails if a listed set has none); the set switcher on every page picks it up. Shared styles live in `site.css`.

A news edition goes in `NEWS_EDITIONS` instead, with its own id such as `daily-news-01`. Add the same id to `VOCAB_SOURCES` in `vocab-core.js` and `EDITION_SCRIPTS` in `vocab-context.js` so the 生词 board and `scripts/daily-words.mjs` discover its marks. See `daily-news-01.md` for the first edition's sources and image credits.
