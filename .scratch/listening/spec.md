Status: ready-for-agent

# Listening in the app

## Problem Statement

The reader studies English through the stories on this site, but can only do so while looking at the screen. At bedtime they want to keep going by ear, with the screen off and the phone locked: either hearing each English sentence followed by its Chinese rendering, or hearing the English alone to train their ear. The browser cannot do this reliably on an iPhone: the built-in speech stops when the phone locks, and the iPhone's own voices sound too synthetic to be immersive. The reader does not know whether this is possible at all.

## Solution

An iPhone app, installed on the reader's own phone straight from Xcode (home-screen name iReading), that shows this site exactly as it is today and adds **listening**. Inside the app the reading page gains a 听 control beside 中英 and 目录. Tapping it starts listening from the current story: either **interleaved narration** (English, then Chinese, sentence by sentence) or **English-only narration**. Listening carries on with the screen locked, shows the story on the lock screen, continues through the rest of the reading set or news edition, and can be ended by a **sleep timer** that fades out at the end of a sentence. The voices are natural-sounding, pre-generated **tracks** (Kokoro: Michael for English, 云健 for Chinese) produced automatically whenever a story is published, so the agents that write stories never deal with audio. Outside the app, in an ordinary browser, the site looks and behaves exactly as before.

## User Stories

### Starting and stopping

1. As the reader, I want a 听 control in the view bar next to 中英 and 目录, so that listening sits with the other ways of viewing a story.
2. As the reader, I want the 听 control to appear only inside the app, so that the site in an ordinary browser is unchanged.
3. As the reader, I want tapping 听 to start listening from the story I am on, so that I do not have to find it again.
4. As the reader, I want the 听 control to look pressed (solid) while listening, matching how 中英 looks when it is on, so that I can tell at a glance that listening is active.
5. As the reader, I want tapping 听 again to stop listening and remove the player bar, so that there is one obvious way to turn it off.
6. As the reader, I want to tap any sentence while listening to continue from that sentence, so that I can jump back to something I missed.
7. As the reader, I want the 听 control to be greyed out for a story whose tracks are not ready yet, so that I never tap it and get silence.
8. As the reader, I want a newly published story to become listenable on its own within about ten minutes, so that stories written overnight are ready when I want them.

### Narration

9. As the reader, I want interleaved narration as the default, so that I understand every sentence at bedtime.
10. As the reader, I want to switch to English-only narration, so that I can train my ear without the Chinese.
11. As the reader, I want the app to remember which narration I used last, so that I do not have to set it every night.
12. As the reader, I want a short pause between an English sentence and its Chinese rendering (about half a second) and a longer one before the next English sentence (about 0.9 seconds), so that the rhythm feels unhurried.
13. As the reader, I want English-only narration to pause about 0.7 seconds between sentences, so that each sentence has room to land.
14. As the reader, I want three speeds (0.8×, 1.0×, 1.2×), so that I can slow down when tired or speed up when the story is easy.
15. As the reader, I want pauses to lengthen at the slow speed as well, so that slow really feels slow.
16. As the reader, I want a 两遍 option that speaks each English sentence twice before moving on, so that I can catch details by ear.
17. As the reader, I want 两遍 off by default, so that ordinary listening flows.
18. As the reader, I want Chinese glosses written inside English sentences, such as spacecraft（航天器）, to be left out of the English voice, so that the English sounds natural.
19. As the reader, I want the same natural voices for every story, so that listening feels consistent.

### Following along with the screen on

20. As the reader, I want the sentence being spoken to be gently highlighted, so that I can follow along when the screen is on.
21. As the reader, I want the page to scroll to keep the spoken sentence in view, so that I never lose my place.
22. As the reader, I want the Chinese rendering shown under each sentence while listening, so that what I see matches what I hear.
23. As the reader, I want the page to go back to how I had it (中英 on or off) when I stop listening, so that listening does not change my reading settings.
24. As the reader, I want a thin progress line at the top of the player bar showing how far through the story I am, so that I know how much is left.
25. As the reader, I want the page to move to the next story when listening moves on, so that the screen and the sound agree.

### The player bar

26. As the reader, I want the player bar along the bottom with the page's own background and no border or box, so that it feels part of the page.
27. As the reader, I want every control on the bar to change with a single tap (pause, 中英/英, speed, 两遍, sleep timer) with no menus or second layer, so that I can use it half asleep.
28. As the reader, I want the bar in both light and dark themes, using the site's colours, so that it fits whichever theme I read in.
29. As the reader, I want all Chinese in the bar and anywhere in the app shown in the site's Huiwen Zhengkai font, so that the app looks like my site.
30. As the reader, I want the bar laid out for a phone first, so that it is comfortable on my iPhone.
31. As the reader, I want no explanatory small print anywhere in the listening controls, so that the page stays clean.
32. As the reader, I want the existing 上一篇 / 标为已读 / 下一篇 buttons left as they are, so that reading still works the same.

### Screen off and locked

33. As the reader, I want listening to continue with the screen locked, so that I can listen in bed.
34. As the reader, I want the lock screen and Control Center to show the story title and its reading set's name, so that I know what is playing.
35. As the reader, I want the story's illustration as the lock-screen artwork when it has one, and the site icon otherwise, so that the lock screen looks right.
36. As the reader, I want play/pause on the lock screen, so that I can pause without unlocking.
37. As the reader, I want the lock screen's previous and next buttons to move one sentence back or forward, so that I can rehear a sentence without looking.
38. As the reader, I want listening to pause when headphones are unplugged or a call comes in, and resume like any audio app, so that it behaves normally.

### Runs and the sleep timer

39. As the reader, I want listening to continue to the next story when one ends, so that I can listen for a while without touching the phone.
40. As the reader, I want a run to stop at the end of the reading set or news edition, so that it does not wander into other material.
41. As the reader, I want a sleep timer that cycles through 本篇, 15′, 30′, 60′ and off with a single tap, so that I can fall asleep without the phone talking all night.
42. As the reader, I want the sleep timer to fade the voice out over the last 30 seconds, so that the end does not wake me.
43. As the reader, I want the sleep timer to stop at the end of a sentence, never mid-word, so that the ending is calm.
44. As the reader, I want 本篇 to stop after the current story, so that I can ask for exactly one story.

### Offline

45. As the reader, I want the app to download the tracks for the whole reading set or news edition while on Wi-Fi, so that I can listen without a connection.
46. As the reader, I want tracks I have already downloaded kept on the phone, so that listening again costs nothing.

### Everything else in the app

47. As the reader, I want everything the site does (reading, 中英, 目录, the full vocabulary list, the 生词 board, marking words, 标为已读, the set switcher, themes) to work in the app exactly as on the web, so that the app is the only place I need.
48. As the reader, I want to enter my GitHub sync token once in the app and have it remembered, so that progress keeps syncing to the private progress repository.
49. As the reader, I want listening never to mark a story read on its own, so that 标为已读 still means I read it.
50. As the reader, I want new stories published on the site to appear in the app with no app update, so that the daily routine needs nothing extra.

### All material

51. As the reader, I want every reading set to be listenable, so that all of my reading has audio.
52. As the reader, I want news editions to be listenable, so that daily news works at bedtime too.
53. As the reader, I want the screening passages to be listenable, so that nothing on the site is left out.
54. As the reader, I want a story whose text is edited to get fresh tracks, so that what I hear always matches what I read.

### The people and agents around the site

55. As an agent that writes stories, I want nothing in my workflow to change, so that audio never becomes my job.
56. As an agent that writes stories, I want track generation never to push commits to the site repository, so that my pushes never conflict with it.
57. As the maintainer, I want tracks kept outside the repository, so that the repository stays small as stories accumulate.
58. As the maintainer, I want one failed story not to stop tracks being made for the others, so that a single bad sentence does not silence a whole night's stories.
59. As the maintainer, I want to run generation for everything by hand once, so that all existing material gets tracks at launch.

## Implementation Decisions

- **Shape (ADR-0001).** The app is a native iPhone shell around a web view showing the live site; only audio is native. The 听 control and player bar are drawn by the site and shown only when the page is running inside the app. The app lives in its own new private repository; this repository holds the web side and track generation.
- **Voices (ADR-0002).** Tracks are pre-generated with Kokoro-82M, voice `am_michael` for English and `zm_yunjian` for Chinese. The reader chose these by ear in a trial; Edge's Ava and 晓晓 remain the fallback if Kokoro ever has to be replaced, but no fallback is built now.
- **Narration module (web, new).** A pure module, shared by the page and the generator, that turns any story into its ordered **sentence pairs** and a **narration key**:
  - Reading-set and news-edition stories already hold sentence pairs.
  - Screening passages hold English paragraphs plus a separate Chinese rendering per sentence; they are split with the existing sentence splitter used by the page and the 生词 board, so sentence indexes match the page's own.
  - English text is passed through the existing gloss-stripping step so parenthetical Chinese glosses are not spoken. Chinese text is spoken as written.
  - The narration key is a stable hash of the sentence pairs plus the voice and generator version. Unchanged text reuses its tracks, edited text gets new ones, and versioned story files (such as a replaced edition) are handled without special cases.
  - It can enumerate every story across all reading sets, news editions and screening passages, reusing the existing edition list that the 生词 board and export script already rely on.
- **Tracks.** Each narration key has an English track and a Chinese track (mono, speech-grade compressed audio) plus a timing manifest giving each sentence's start and end in each track. Both narrations, 两遍 and every pause are assembled from these at play time; nothing is generated per mode.
- **Generator.** A script enumerates all stories through the narration module, skips keys already published, synthesizes the missing ones with Kokoro, and writes tracks and timings. Per-story failures are logged and skipped; the run still publishes the rest.
- **Publishing.** A GitHub Action runs the generator whenever story data changes on the default branch, and on manual dispatch (used once to backfill). Tracks go to GitHub Releases, rotated so no release exceeds its asset limit, plus a catalog asset mapping each narration key to where its files are and how long it is. The Action never commits to the repository.
- **Bridge (page ↔ app).** The page detects that it is in the app and only then shows 听. Messages:
  - page → app: start a run (the stories from the current one to the end of its reading set or news edition, each with narration key, title, set name, artwork URL and sentence count; the starting story and sentence; the current settings); change a setting; seek to a sentence; stop; ask which narration keys are available.
  - app → page: playback state; current story and sentence; availability answers.
  The page never fetches tracks itself; the app does, which avoids cross-origin limits on release downloads.
- **Player (app, new).** Owns the run so it keeps going while the web view is suspended in the background. From the timings and settings it builds the clip sequence:
  - Interleaved narration: English sentence, 0.5 s pause, Chinese sentence, 0.9 s pause.
  - English-only narration: English sentence, 0.7 s pause.
  - 两遍 repeats each English sentence once more before the next step.
  - Speeds are 0.8×, 1.0× and 1.2×; pause lengths are divided by the speed, so they lengthen when slow.
  - A run ends at the last story of its reading set or news edition.
  - The sleep timer offers 本篇 / 15 / 30 / 60 minutes. On expiry it fades out over the last 30 seconds and stops at the end of the sentence in progress.
  - Lock-screen now-playing info shows title, set name and artwork. Remote commands are play/pause and previous/next sentence.
  - Settings (narration, speed, 两遍, last timer choice) persist in the app.
- **Offline cache (app).** On Wi-Fi the app prefetches tracks for the whole reading set or news edition of the current run, and keeps downloaded tracks.
- **Player bar (web).** As designed and approved:
  - A headphones pill in the view bar before 中英 and 目录 (icon-only at phone width, like its neighbours), solid while listening.
  - A bottom bar on the page background with no border, and a 2 px accent progress line at its top edge.
  - Controls left to right: pause/play, 中英⇄英, speed, 两遍 (muted when off), and a moon with the timer value, each cycling on tap.
  - The spoken sentence is highlighted with the accent-soft tint; other sentences recede to the secondary ink.
  - Chinese renderings are shown while listening, and the prior 中英 state is restored on stop.
  - Uses the existing colour tokens, light and dark themes, and the Huiwen Zhengkai and English font stacks.
- **App shell.** The web view uses persistent storage so the sync token and theme survive restarts. Any native text bundles Huiwen Zhengkai. The app is installed on the reader's iPhone straight from Xcode with development signing on the reader's own Apple Developer account; there is no TestFlight or App Store Connect. On the home screen it is called iReading.
- **Progress.** Listening never writes progress and never marks a story read.

## Testing Decisions

- Good tests exercise external behaviour through a module's public interface, using real story data where possible, and never assert on internal structure.
- **Narration module (node, `node --test`).** Prior art: the existing vocabulary tests, which load the real edition files and the page's embedded screening data and check behaviour end to end. Cover:
  - sentence pairs for each kind of material;
  - sentence indexes agreeing with the page's splitter for screening passages;
  - glosses removed from English;
  - narration keys stable across runs and changing when any sentence's text changes;
  - enumeration covering every edition the site lists.
- **Player (app, XCTest).** Driven with a fake clock and fake audio output. Cover:
  - the clip order and pause lengths for each narration, with and without 两遍, at each speed;
  - runs ending at the last story of a set;
  - seek to a sentence;
  - previous/next sentence;
  - each sleep timer option: fade start, stop at sentence end, and 本篇 stopping after the current story.
- **Not unit-tested.** The Kokoro synthesis itself, and the generator and Action, which are verified by running them on one story and listening. Lock-screen behaviour is checked by hand on the reader's iPhone: playback continues when locked, now-playing info, remote commands, interruption by a call and headphone unplug, and offline playback in airplane mode.
- Voice quality is settled: the reader already chose these voices by ear.

## Out of Scope

- Listening in ordinary browsers, Android, and an App Store release.
- Choosing voices in the app, and paid or alternative engines (Azure, ElevenLabs, CosyVoice, Edge) beyond the recorded fallback.
- Any change to how stories, illustrations or the daily 墨墨 sync are produced. Those stay with the agents that already do them, and illustrations stay with the reader.
- PR #1 (illustration workflow) and the 数学 / 数学2 projects.
- Writing progress or marking read from listening.
- Putting word lists or progress in this public repository; tracks carry only story text that is already public.

## Further Notes

- Design principles to honour throughout: no explanatory small print, each control in its natural place, no borders or boxes, phone first, light and dark both designed.
- Tracks for one story run about 1 MB at speech bitrates. The reader expects up to about 30 short stories a day, so generation and release rotation must keep up with that volume.
- The listening trial's samples and script were throwaway and are not part of this work.
