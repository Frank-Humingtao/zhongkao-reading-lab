# 02: The app: listen to a story with the phone locked

**What to build:** A new private repository holds an iPhone app, installed on the reader's iPhone through TestFlight, that shows the live site in a web view with everything working as on the web (sync token entered once and remembered, themes, Huiwen Zhengkai for any native text). Inside the app only, the reading page shows the 听 control in the view bar before 中英 and 目录. Tapping it plays the current story in interleaved narration at 1.0× (English, 0.5 s, Chinese, 0.9 s), and playback continues with the screen locked, the lock screen showing the story title and set name with play/pause. The player bar appears along the bottom (page background, no border, progress line, pause/play) and the 听 pill turns solid. With the screen on, the spoken sentence is highlighted and kept in view, Chinese renderings show while listening and the prior 中英 state returns on stop, and tapping a sentence continues from there. Tapping 听 again stops. Calls and headphone unplugging pause like any audio app. See the spec's Shape, Bridge, Player, Player bar and App shell decisions, ADR-0001, and the approved mockup.

**Blocked by:** 01

**Status:** resolved

- [x] The site in an ordinary browser is unchanged: no 听 control, nothing else different
- [x] In the app, reading, 中英, 目录, the vocabulary list, the 生词 board, marking words, 标为已读 and the set switcher all work, and the sync token survives an app restart
- [x] Tapping 听 on a reading set 01 story plays interleaved narration with the specified pauses
- [x] Player tests (XCTest, fake clock and audio) cover the interleaved clip order and pauses, and seeking to a sentence
- [x] Highlight, scrolling, Chinese shown and 中英 restored, and tap-to-seek work on the page
- [x] Player bar and 听 pill match the mockup in light and dark themes at phone width, with no explanatory text
- [x] Listening never marks a story read
- [ ] The reader confirms on their iPhone: playback continues locked, lock screen shows title and set name, play/pause works there, a call and a headphone unplug both pause

## Comments

Resolved by the implementer (2026-11-23).

- Site repo, branch `ticket-02-app`: `cc07502` Show 听 and the player bar inside the app (`listening.js`, `listening.test.mjs`, `index.html`, README).
- App repo `Frank-Humingtao/zhongkao-reading-app`, branch `ticket-02-app` (pushed): `8137432` Add the app: the site in a web view, and listening to one story locked.
- Verified in the iOS Simulator (iPhone 17, iOS 27.0) against a local `python3 -m http.server` of this branch with tracks from the published `tracks-001` release: 听 plays "Thunder for a Film" in interleaved narration, the highlight follows and scrolls, Chinese shows and 中英 returns to off on stop, tapping a sentence continues from it, pause/play, lock screen shows title and "01 生词复现" while playback carries on locked; light and dark bars match the mockup. In a regular browser 听 and the bar stay hidden. Theme in localStorage survived an app relaunch and a simulator reboot (the sync token uses the same store when 记住令牌 is ticked; no real token was entered).
- While listening, a tap on a sentence seeks and does not mark the word under it (listening never writes progress); when another story is on screen, taps mark words as usual.
- Chinese shows in the site's existing 中英 layout (per-paragraph rendering under each paragraph), with the spoken Chinese sentence in `--ink-2` and the rest `--muted`, rather than the mockup's line under each sentence.
- Pending: the reader's on-device check (last box). TestFlight needs the reader to sign in to Xcode with the team's Apple ID and create the App Store Connect record; the archive builds, export stops at "No Accounts".
- `node --test` has the one pre-existing failure ("reading set 04 ... 39 stories", from 36dd7a2).

Note (2026-11-23): the install path changed. The app is installed on the reader's iPhone straight from Xcode (development signing, home-screen name iReading), not through TestFlight; the TestFlight mentions above are kept as written at the time. See ADR-0001 and the app README.
