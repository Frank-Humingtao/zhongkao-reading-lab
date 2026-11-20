# zhongkao-reading-lab

A mobile-friendly English reading lab.

## Illustrations

Each article has one 960×640 JPEG. For a new set (04 onward), the file is `images/reading-04/<story-id>.jpg`. Putting that file in place shows it on the article; the story JS does not need a filename edit.

Standing ChatGPT instructions, taught once: [illustrations/CHATGPT.md](illustrations/CHATGPT.md). ChatGPT then reads [illustrations/queue.md](illustrations/queue.md) and [illustrations/queue.json](illustrations/queue.json) and draws every missing image. Each queue item points at its brief under `illustrations/briefs/<set>/<story-id>.md`.
