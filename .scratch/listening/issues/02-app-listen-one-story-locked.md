# 02: The app: listen to a story with the phone locked

**What to build:** A new private repository holds an iPhone app, installed on the reader's iPhone through TestFlight, that shows the live site in a web view with everything working as on the web (sync token entered once and remembered, themes, Huiwen Zhengkai for any native text). Inside the app only, the reading page shows the 听 control in the view bar before 中英 and 目录. Tapping it plays the current story in interleaved narration at 1.0× (English, 0.5 s, Chinese, 0.9 s), and playback continues with the screen locked, the lock screen showing the story title and set name with play/pause. The player bar appears along the bottom (page background, no border, progress line, pause/play) and the 听 pill turns solid. With the screen on, the spoken sentence is highlighted and kept in view, Chinese renderings show while listening and the prior 中英 state returns on stop, and tapping a sentence continues from there. Tapping 听 again stops. Calls and headphone unplugging pause like any audio app. See the spec's Shape, Bridge, Player, Player bar and App shell decisions, ADR-0001, and the approved mockup.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The site in an ordinary browser is unchanged: no 听 control, nothing else different
- [ ] In the app, reading, 中英, 目录, the vocabulary list, the 生词 board, marking words, 标为已读 and the set switcher all work, and the sync token survives an app restart
- [ ] Tapping 听 on a reading set 01 story plays interleaved narration with the specified pauses
- [ ] Player tests (XCTest, fake clock and audio) cover the interleaved clip order and pauses, and seeking to a sentence
- [ ] Highlight, scrolling, Chinese shown and 中英 restored, and tap-to-seek work on the page
- [ ] Player bar and 听 pill match the mockup in light and dark themes at phone width, with no explanatory text
- [ ] Listening never marks a story read
- [ ] The reader confirms on their iPhone: playback continues locked, lock screen shows title and set name, play/pause works there, a call and a headphone unplug both pause
