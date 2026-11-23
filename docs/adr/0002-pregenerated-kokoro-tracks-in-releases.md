# Tracks are pre-generated with Kokoro and published as GitHub Releases

Listening uses two pre-generated tracks per story (English and Chinese, with per-sentence timings) rather than speaking on the device, because the reader found the iPhone's built-in voices too synthetic. After a blind listen to five free options the reader chose Kokoro-82M (`am_michael` for English, `zm_yunjian` for Chinese): free, open, runs offline in CI with no account or key, and never fails mid-story the way the unofficial Edge read-aloud voices did during the trial (Edge's Ava and 晓晓 remain the fallback choice). A GitHub Action generates tracks whenever a story file changes and uploads them to GitHub Releases, not into the repository, so the repository stays small as stories pile up, the agents that write stories never touch audio, and the app can cache tracks by release asset.

## Considered options

- **Paid cloud voices** (Azure, ElevenLabs, OpenAI): better or similar quality, but the expected volume (up to ~30 short stories a day) exceeds free tiers and needs keys.
- **Audio committed under `audio/`**: simplest, but grows the Pages repository by hundreds of MB a year.
