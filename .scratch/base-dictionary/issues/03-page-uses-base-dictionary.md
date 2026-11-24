# 03: The page falls back to the base dictionary

**What to build:** Fill the base-dictionary seam from 01 with the file from 02. The page loads it in the background once a story is shown; a tap before it arrives waits for it rather than flashing 暂无. Base-dictionary meanings show a faint 词典 mark in the popup and inline gloss, and marked words keep that meaning on the vocabulary board and in exports. See the spec's Solution, "Loading" and user stories 7–10.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] algorithms, astronomer and can't show a short meaning with the 词典 mark, in light and dark themes
- [ ] The first tap after opening a story shows a meaning, never 暂无 first
- [ ] Marking algorithms shows its meaning on the board and in the export
- [ ] Coverage test: across all published stories, no lowercase word is left without a meaning beyond a short named allowance
- [ ] Works the same inside the app's web view
