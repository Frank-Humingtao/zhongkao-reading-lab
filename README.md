# zhongkao-reading-lab
A mobile-friendly English reading lab

## 生词看板

`vocab.html` shows every current 生词 from every collection (placement sets, review batches and news editions), grouped by the Beijing day each word first became current. Each collection keeps its own progress file, and their marks join the same word pool. Progress stays in the browser and the private progress repo; this repo holds no word lists.

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

Run the tests with `node --test`.

## Listening tracks

`narration.js` turns every story the site shows into its sentence pairs, with Chinese glosses left out of the English, and a narration key that names its tracks. The **Listening tracks** Action (`.github/workflows/tracks.yml`) runs on every push to `main` that touches `content/` and makes tracks for each story whose narration key is not yet in the catalog (new or edited stories); it can also be run by hand, optionally for one collection such as `reading-01`. It uses Kokoro (`am_michael` / `zm_yunjian`), publishes to the `tracks-NNN` releases (a new one before a release passes 900 assets), with `catalog.json` in the `tracks-catalog` release, and never commits. A story that fails is skipped and listed in the run's summary while the others publish. To make tracks locally:

```
node scripts/narration-plan.mjs --set reading-01 > plan.json
uv run --project scripts/tracks python scripts/tracks/generate.py --plan plan.json --out out   # needs espeak-ng
uv run --project scripts/tracks python -m unittest discover -s scripts/tracks                 # generator tests
```

In the iPhone app (private repository `zhongkao-reading-app`), `listening.js` adds the 听 control and the player bar to the reading page; it talks to the app's native player over the bridge described at its top, and stays hidden in ordinary browsers.

## Content

Everything the site shows lives in `content/` and `images/`, and only `content.js` reads it:

- `content/index.json` lists every collection (newest last): an `id` and a `kind` (`placement`, `review` or `news`). Older collections also carry their `number`, and 02 and 03 the `version` their file and progress are named by (`reading-02-v3`).
- `content/<version>.json` holds one collection's `words` and `stories`. Placement 01 (`screening.json`) keeps its older shape.
- `content/dictionary.json` is the word list every collection is tokenized with.
- `content/base-dictionary.json` gives any other tapped word a short meaning: about 20,000 everyday words cut from [ECDICT](https://github.com/skywind3000/ECDICT) by `node scripts/base-dictionary.mjs <path to ecdict.csv>` (see [ADR-0004](docs/adr/0004-base-dictionary-looked-up-at-runtime.md)). Rerun it only to change the selection; the downloaded csv is never committed.
- `images/<id>/<story id>.jpg` is each story's picture, described by the story's `picture`.
- A story may also carry `questions` (stem, four options A–D, `answer`; optional `image`), `figures` (exam images placed `after` a paragraph) and `underline` (`[paragraph, words]`). The reading page shows the questions under the passage; choices and 对答案 results sync with the rest of the progress. Placement 02 (`placement-02`) holds the Guangzhou 中考 reading passages 2017–2026 this way.

New review batches are written by the writer agent and illustrated by the illustrator agent, who follow [CONTENT.md](CONTENT.md) and never change code. `node scripts/check-content.mjs` checks all of it (the **Content check** Action runs it on every push), and `--pictures` lists the pictures still to draw. A malformed collection is skipped by every page rather than breaking it.

The reading page's code is `reading-page.js`; shared styles live in `site.css`. See `daily-news-01.md` for the first news edition's sources and image credits.

The base dictionary's meanings come from ECDICT by skywind3000, used under its MIT licence (Copyright (c) 2025 Linwei).
