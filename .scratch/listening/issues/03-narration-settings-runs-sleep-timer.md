# 03: Narration settings, runs and the sleep timer

**What to build:** From the player bar, single taps switch interleaved ⇄ English-only narration (0.7 s between sentences), cycle speed 0.8× / 1.0× / 1.2× (pauses divided by speed), and toggle 两遍 (each English sentence spoken twice, off by default); these persist across launches. When a story ends, listening continues with the next story of the same reading set or news edition and the page follows, stopping after the last one. The lock screen's previous/next move one sentence, and the artwork is the story's illustration or the site icon. A moon control cycles the sleep timer 本篇 / 15′ / 30′ / 60′ / off; on expiry it fades out over the last 30 seconds and stops at the end of a sentence, and 本篇 stops after the current story. See the spec's Player and Player bar decisions.

**Blocked by:** 02

**Status:** resolved

- [x] Player tests cover English-only order and pauses, 两遍, each speed's pause lengths, runs ending at the last story, previous/next sentence, and every sleep timer option (fade start, stop at sentence end, 本篇)
- [x] Each bar control changes with one tap, with no menu, and the bar still matches the mockup in both themes
- [x] Narration, speed and 两遍 are remembered after relaunching the app
- [x] The page moves to the next story when a run moves on
- [ ] The reader confirms on their iPhone, locked: a run continues into the next story, previous/next sentence work, the artwork shows, and a 15′ timer fades and stops at a sentence end

## Comments

Resolved by the implementer (2026-11-23).

- Site repo, branch `ticket-03-settings`: `4e913f4` Player bar settings, runs and the sleep timer on the page; `3faeba9` Keep the spaces between sentences when listening stops.
- App repo `Frank-Humingtao/zhongkao-reading-app`, branch `ticket-03-settings` (pushed): `85d863d` Narration settings, runs, lock-screen previous/next and the sleep timer; `613ba4a` merge of `origin/listening`.
- Player and session tests (`swift test --package-path ListeningCore`, 61 tests, fake clock and fake audio): English-only order and 0.7 s pauses; 两遍 in both narrations; pauses at 0.8×/1.0×/1.2× (e.g. 0.625/1.125 s and 0.875 s at 0.8×); settings changed mid-sentence; runs continuing to the next story with the same settings and stopping after the last; previous/next sentence; 15′/30′/60′ fade start, faded volume at expiry, stop at the sentence end; paused at expiry; timer changed or turned off mid-run; 本篇 stopping after the current story; settings remembered for the next launch.
- Decisions: 两遍 puts 0.7 s (÷ speed) between the two English readings. The fade runs from full volume to 0.1 over the timer's last 30 s; the sentence in progress (English and its Chinese) is finished at 0.1, then listening stops. A minutes timer starts when listening starts or when it is chosen while listening, carries across the stories of a run, and counts wall time (if paused when it runs out, listening stops at once). The settings live in the app (UserDefaults); the page sends taps and shows what the app reports. Previous at the first sentence restarts it; next at the last sentence stays there. A next story without tracks ends the run (availability is ticket 04).
- Also fixed against the mockup: each sentence's Chinese now sits right under it while listening (paragraph translations hidden), non-current sentences recede to `--ink-2` with their Chinese `--muted`, the current one on `--accent-soft` with `--ink` and its Chinese `--ink-2`; stopping restores the page exactly. In the app the status-bar strip shows the page's own background (light and dark) and content no longer scrolls under it.
- Verified in the iOS Simulator (iPhone Air) against a local server of this branch, tracks from `tracks-001`: every bar control changing on one tap, a run moving from "Thunder for a Film" to the next story with the page following, settings remembered after relaunch, a 15′ timer (debug `-TimerMinuteSeconds 1`) stopping at a sentence end, 本篇 stopping after the story; bar in light and dark. In an ordinary browser 听 and the bar stay hidden.
- Pending: the reader's on-device check (last box); lock-screen previous/next and the artwork were not seen in the simulator (covered by the session tests and the code only).
- `node --test` keeps the one pre-existing failure ("reading set 04 ... 39 stories").
