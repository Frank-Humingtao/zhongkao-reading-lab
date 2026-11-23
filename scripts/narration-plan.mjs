#!/usr/bin/env node
// Prints, as JSON, every story listening can narrate: its narration key and the
// sentence pairs to speak (narration.js). scripts/tracks/generate.py reads this
// to make the tracks; it never decides what is spoken itself.
//
//   node scripts/narration-plan.mjs                      # every story the site shows
//   node scripts/narration-plan.mjs --set reading-01     # one collection (reading-01, screening, review-2026-11-24, …)

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATOR_VERSION, VOICES, narrationStories } from "../narration.js";

const SITE = "https://frank-humingtao.github.io/zhongkao-reading-lab/";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async file => {
  try {
    return await readFile(join(root, file), "utf8");
  } catch {
    return null;
  }
};

const args = process.argv.slice(2);
const setAt = args.indexOf("--set");
const only = setAt >= 0 ? args[setAt + 1] : null;
if (setAt >= 0 && !only) {
  console.error("usage: node scripts/narration-plan.mjs [--set <collection id>]");
  process.exit(2);
}

const stories = (await narrationStories(read))
  .filter(story => !only || story.set === only || story.edition === only);
if (only && !stories.length) {
  console.error(`no stories in ${only}`);
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  generatorVersion: GENERATOR_VERSION,
  voices: VOICES,
  stories: stories.map(({ key, edition, set, setName, id, title, artwork, pairs }) => ({
    key, edition, set, setName, id, title,
    artwork: artwork ? SITE + artwork : null,
    pairs
  }))
}, null, 1) + "\n");
