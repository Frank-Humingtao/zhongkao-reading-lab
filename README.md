# zhongkao-reading-lab
A mobile-friendly English reading lab

## 生词看板

`vocab.html` shows every current 生词 from the screening passages and the 01/02/03 sets, grouped by the Beijing day each word first became current. Progress stays in the browser and the private progress repo; this repo holds no word lists.

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

Run the tests with `node --test vocab.test.mjs`.

## Adding a reading set

Add the set to the `editions` map in `index.html` (as before) and one line to `READING_SETS` in `site-nav.js`; the set switcher on every page picks it up. Shared styles live in `site.css`.
