#!/usr/bin/env node
// Prints, as JSON, every story listening can narrate: its narration key and the
// sentence pairs to speak (narration.js). scripts/tracks/generate.py reads this
// to make the tracks; it never decides what is spoken itself.
//
//   node scripts/narration-plan.mjs                      # every story the site shows
//   node scripts/narration-plan.mjs --edition reading-01 # one reading set / news edition / screening

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATOR_VERSION, VOICES, narrationStories } from "../narration.js";

const SITE = "https://frank-humingtao.github.io/zhongkao-reading-lab/";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFile(join(root, file), "utf8");

const args = process.argv.slice(2);
const editionAt = args.indexOf("--edition");
const only = editionAt >= 0 ? args[editionAt + 1] : null;
if (editionAt >= 0 && !only) {
  console.error("usage: node scripts/narration-plan.mjs [--edition <set or edition id>]");
  process.exit(2);
}

const stories = (await narrationStories({ html: await read("index.html"), siteNav: await read("site-nav.js"), load: read }))
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
