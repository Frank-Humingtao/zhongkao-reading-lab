# 03: Narration settings, runs and the sleep timer

**What to build:** From the player bar, single taps switch interleaved ⇄ English-only narration (0.7 s between sentences), cycle speed 0.8× / 1.0× / 1.2× (pauses divided by speed), and toggle 两遍 (each English sentence spoken twice, off by default); these persist across launches. When a story ends, listening continues with the next story of the same reading set or news edition and the page follows, stopping after the last one. The lock screen's previous/next move one sentence, and the artwork is the story's illustration or the site icon. A moon control cycles the sleep timer 本篇 / 15′ / 30′ / 60′ / off; on expiry it fades out over the last 30 seconds and stops at the end of a sentence, and 本篇 stops after the current story. See the spec's Player and Player bar decisions.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Player tests cover English-only order and pauses, 两遍, each speed's pause lengths, runs ending at the last story, previous/next sentence, and every sleep timer option (fade start, stop at sentence end, 本篇)
- [ ] Each bar control changes with one tap, with no menu, and the bar still matches the mockup in both themes
- [ ] Narration, speed and 两遍 are remembered after relaunching the app
- [ ] The page moves to the next story when a run moves on
- [ ] The reader confirms on their iPhone, locked: a run continues into the next story, previous/next sentence work, the artwork shows, and a 15′ timer fades and stops at a sentence end
