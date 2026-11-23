# 04: All material listenable, generated automatically, and offline

**What to build:** Whenever story data changes on the default branch, the Action generates tracks for any story whose narration key is new, so a story published overnight is listenable within about ten minutes, and a one-off manual run backfills every reading set, news edition and screening passage. Releases rotate so none exceeds its asset limit, a failed story is logged and skipped without stopping the rest, and the Action still never commits. In the app the 听 control is greyed out for a story whose tracks are not yet published, and becomes available on its own once they are. On Wi-Fi the app downloads the tracks for the whole reading set or news edition of the current story and keeps them, so listening works in airplane mode. See the spec's Generator, Publishing, Bridge (availability) and Offline cache decisions.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Pushing a change to a story file publishes tracks for just the new or changed stories, with no commit from the Action
- [ ] After the backfill, every story on the site (all reading sets, news editions, screening passages) has tracks in the catalog
- [ ] A deliberately failing story is skipped and reported while the others publish
- [ ] Release rotation keeps every release under the asset limit at roughly 30 new stories a day
- [ ] 听 is greyed for a story with no tracks and enabled once they exist, without an app update
- [ ] With a set downloaded on Wi-Fi, the reader can play any of its stories in airplane mode
