# The app shows the live site; only listening is native

Listening has to keep going with the iPhone locked, and in Safari the browser's speech synthesis stops at lock while background `<audio>` is not dependable. So listening lives in an iPhone app, installed on the reader's own iPhone straight from Xcode (development signing; no TestFlight or App Store Connect), where it shows on the home screen as iReading. The app is a native shell around this very site (a web view), not a rewrite: reading, the vocabulary board, marking stories read and progress sync all stay in the web code, and a new story published here appears in the app with no app change. Only the audio itself (background playback, lock-screen controls, sleep timer) is native; the 听 control and player bar are drawn by the site, shown only inside the app, and talk to the native player over a small bridge.

## Considered options

- **Web only.** No install, but lock-screen playback on iPhone is unreliable, which defeats listening in bed.
- **Full native rewrite.** Best feel, but every daily change to the site would have to be repeated in Swift.

## Consequences

- The site must keep working inside a web view, and the 听 control must stay hidden in ordinary browsers.
- The app has its own private repository; this repository holds the web side of the bridge.
