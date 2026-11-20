# zhongkao-reading-lab
A mobile-friendly English reading lab

## 生词看板

`vocab.html` shows every current 生词 from the screening passages and the 01/02/03 sets, grouped by the Beijing day each word first became current. Progress stays in the browser and the private progress repo; this repo holds no word lists.

The word rules live in `vocab-core.js` and are shared by the board and by the daily export:

```
GH_TOKEN=… node scripts/daily-words.mjs                    # yesterday (Beijing), one word per line
GH_TOKEN=… node scripts/daily-words.mjs --date 2026-11-20 --json
node scripts/daily-words.mjs --progress-dir ../zhongkao-reading-progress
```

Run the tests with `node --test vocab.test.mjs`.

## Adding a reading set

Add the set to the `editions` map in `index.html` (as before) and one line to `READING_SETS` in `site-nav.js`; the set switcher on every page picks it up. Shared styles live in `site.css`.
