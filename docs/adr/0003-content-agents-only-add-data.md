# Content agents only add data, and push straight to main

New review batches are written by a writer agent and illustrated by an illustrator agent (Codex), with no person in the loop: the reader only reads. Both agents are good at producing material and poor at changing code, so the site takes everything it shows from data files under `content/` (and pictures under `images/`), listed in `content/index.json`, and adding a batch never touches code or tests. CONTENT.md is the whole of what an agent needs to know. The agents push directly to `main`, without pull requests: correctness comes from the content check (`node scripts/check-content.mjs`, run by the agent before pushing and by the **Content check** Action after), and from every page skipping a collection whose file is malformed instead of breaking.

## Considered options

- **Agents edit the code to register each set** (how sets 01–04 were published): every publish touched five to seven files and added hand-written tests, which drifted (a story count went stale and failed).
- **Pull requests merged when the check passes**: safer against a bad push, but needs branch protection and auto-merge set up, and the reader did not want to manage pull requests at all.

## Consequences

- The content check is the contract with the agents: its messages must say, in plain Chinese, which file and field to fix.
- A malformed batch can reach the site; it is skipped until fixed, so nothing else breaks.
- Published progress keys never change: older collections keep their ids and `version` (`reading-02-v3`) because the reader's progress is stored under them.
