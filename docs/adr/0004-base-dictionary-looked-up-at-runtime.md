# Any tapped word falls back to a base dictionary looked up in the page

The reader taps words the writer agent never glossed, and about 1,580 of the 4,119 distinct words in the published stories showed no meaning. We decided the page itself looks up a **base dictionary** — roughly 20,000–25,000 everyday words cut from ECDICT (MIT licence), committed as `content/base-dictionary.json` and loaded in the background once a story is shown — whenever the collection, the word list and the extra meanings have nothing, after first trying the word's base form. The collection's own meanings and the word list always win, because they are written for these stories; base-dictionary meanings are shortened and marked so the reader can tell them apart.

## Considered options

- **Fill meanings at publish time**: a script or the content check looks up every unglossed word in new stories and writes the meaning into the data. Much smaller, and meanings could be edited by hand, but it adds a step to every publish, and ADR-0003 keeps content agents from changing anything but their own material, so a missed run would leave words blank again.
- **Ship all of ECDICT**: covers everything, but hundreds of megabytes, almost all rare words and phrases.

## Consequences

- The site carries one extra data file of a few hundred kilobytes, regenerated only by `scripts/base-dictionary.mjs` from a downloaded ECDICT; the ECDICT source itself is not in the repository.
- Capitalised words no source explains are shown as 专有名词, so names are never given a wrong dictionary sense (Bill → 账单).
- The content check only reports words still unexplained; it never fails a batch for them, so writers are never blocked by the dictionary.
