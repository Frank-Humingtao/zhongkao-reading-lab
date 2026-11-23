# 04: All material listenable, generated automatically, and offline

**What to build:** Whenever story data changes on the default branch, the Action generates tracks for any story whose narration key is new, so a story published overnight is listenable within about ten minutes, and a one-off manual run backfills every reading set, news edition and screening passage. Releases rotate so none exceeds its asset limit, a failed story is logged and skipped without stopping the rest, and the Action still never commits. In the app the 听 control is greyed out for a story whose tracks are not yet published, and becomes available on its own once they are. On Wi-Fi the app downloads the tracks for the whole reading set or news edition of the current story and keeps them, so listening works in airplane mode. See the spec's Generator, Publishing, Bridge (availability) and Offline cache decisions.

**Blocked by:** 01, 02

**Status:** resolved

- [ ] Pushing a change to a story file publishes tracks for just the new or changed stories, with no commit from the Action (can only be confirmed on `main` after merge; equivalent proven, see Comments)
- [ ] After the backfill, every story on the site (all reading sets, news editions, screening passages) has tracks in the catalog (backfill run 45133717418 still in progress at hand-off)
- [x] A deliberately failing story is skipped and reported while the others publish
- [x] Release rotation keeps every release under the asset limit at roughly 30 new stories a day
- [x] 听 is greyed for a story with no tracks and enabled once they exist, without an app update
- [ ] With a set downloaded on Wi-Fi, the reader can play any of its stories in airplane mode (simulator: done with simulated offline; on-device airplane mode pending with the reader)

## Comments

Resolved by the implementer (2026-11-23).

- Site repo, branch `ticket-04-all-material`: `e2a874a` Make tracks on every push to main; speak Latin words in Chinese sentences (`tracks.yml` push trigger with story-file path filters, `generate.py` `ReleaseShelf` / `make_stories` / job summary, `scripts/tracks/test_generate.py`, README); `6b0c819` Grey 听 for a story whose tracks are not published yet (`listening.js`, `listening.test.mjs`, `index.html`).
- App repo, branch `ticket-04-all-material` (pushed): `0acacfa` TrackLibrary (availability, keeping sets on Wi-Fi, playing kept files offline; Application Support/Tracks, excluded from backup; catalog refresh on foreground, on reconnect and every 2 minutes while visible); `24bf9e5` DEBUG launch arguments `-OfflineTracks` and `-PageScript` for simulator checks.
- Push trigger: the same workflow file ran from the throwaway branch `listening-tracks-backfill` through a temporary `push` trigger (run 45133717418, trigger event `push`): it planned all 180 stories, skipped the 10 already published (reading-01) and published only missing keys to releases, with no commit (the branch is unchanged by the run). On `main`, the paths filter and "skip keys already in the catalog" are the only differences; confirm with the first story push after merge.
- Backfill: run 45133717418 (https://github.com/Frank-Humingtao/zhongkao-reading-lab/actions/runs/45133717418) was still running at hand-off, publishing incrementally (130 of 180 keys in the catalog at 09:00 UTC, order: screening, reading sets, daily news). Coverage check and deleting the throwaway branch are left to the coordinator once it completes.
- Failing story: unit test (`FailingStories`) plus a local dry run with a plan holding daily-news-01-01, a deliberately broken copy of screening read-21 (empty Chinese sentence) and read-21: both real stories made, the broken one logged `FAILED … RuntimeError: no audio for zh sentence: ''`, listed in the job summary, exit 1. Nothing published or committed.
- Rotation: `ReleaseShelf` unit tests (a month at 30 stories/day from tracks-001 at 30 assets fills 001–003 to 900 and starts 004; an overflowing story starts the next release).
- Pronunciation: Kokoro-82M's Chinese phonemizer ignored `en_callable` and passed Latin letters through, so （NASA） sounded like "EZ" and CD, VCD, X, T were dropped. Latin runs in Chinese sentences now use English phonemes (acronyms spelled, NASA said as a word). Whisper (large-v3-turbo) before → after: "美国宇航局EZ" → "美国宇航局NASA", "一张和一张" → "一张CD和一张VCD", "欧洲航天局Z" → "欧洲航天局ESA". Pure-Chinese phonemes are unchanged and no published track had Latin in Chinese, so the generator version stays 1 (nothing regenerated).
- Simulator (iPhone 17e, iOS 27.0, local server of this branch, tracks from the real releases): daily news 01 opened with 听 greyed (not yet published) and a programmatic click did nothing; on Wi-Fi the app kept all 10 reading-01 stories (30 files + catalog.json, backup-excluded) within ~20 s; relaunched with `-OfflineTracks YES` (every catalog/track fetch fails as in airplane mode; the simulator shares the Mac's network so airplane mode itself can't be toggled), 听 was enabled from the kept catalog and played Thunder for a Film with the highlight advancing. Availability by itself: with the stored catalog reset to the 10-key one and fetches failing, a screening story showed 听 greyed; after fetches were allowed again, the 2-minute refresh enabled it with no reload.
- Ordinary browser: 听 and the bar stay hidden, no console errors.
- Tests: `node --test` 39 (1 pre-existing failure, reading set 04 count), generator 7, `swift test` 36.
- Pending: the backfill run's completion and coverage check; the push-on-main confirmation after merge; the reader's airplane-mode check on the iPhone.
