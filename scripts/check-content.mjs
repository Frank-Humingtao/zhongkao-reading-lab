#!/usr/bin/env node
// The content check (CONTENT.md): is everything under content/ and images/
// well formed? Run it before every push; GitHub runs it again after.
//
//   node scripts/check-content.mjs              # problems, in plain words; exit 1 if any
//                                               # (including words a batch repeats too few times),
//                                               # then, as a notice only, the words no source explains
//   node scripts/check-content.mjs --pictures   # the pictures still to draw, as JSON
//
// It only reads files. A picture that is not drawn yet is not a problem: the
// illustrator agent draws it later, and the page shows the story without it.

import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_DICTIONARY, DICTIONARY, checkLibrary, loadCollection, storyImages, storyPicture } from "../content.js";
import { unexplainedNotice, unexplainedWords } from "../vocab-context.js";

const MAX_PICTURE = 1.5 * 1024 * 1024;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readText = async path => {
  try {
    return await readFile(join(root, path), "utf8");
  } catch {
    return null;
  }
};
const exists = async path => existsSync(join(root, path));

const { collections, problems, repetition, missingPictures } = await checkLibrary(readText, exists);

if (process.argv.includes("--pictures")) {
  process.stdout.write(JSON.stringify(missingPictures.map(({ collection, story, src, description }) =>
    ({ collection, story, file: src, description })), null, 1) + "\n");
  process.exit(0);
}

// A picture uploaded under the wrong name never shows, so every file in a
// collection's images must belong to one of its stories.
let stories = 0;
for (const collection of collections) {
  const { data } = await loadCollection(readText, collection);
  if (!data) continue;
  const list = collection.legacyScreening ? data.lessons : data.stories;
  stories += list.length;
  const wanted = new Set(list.flatMap(story => [storyPicture(collection, story)?.src,
    ...(collection.legacyScreening ? [] : storyImages(collection, story))]).filter(Boolean));
  const folder = join(root, collection.imageDir);
  if (!existsSync(folder)) continue;
  for (const name of readdirSync(folder)) {
    if (name.startsWith(".")) continue;
    if (statSync(join(folder, name)).size > MAX_PICTURE) {
      problems.push(`${collection.imageDir}${name}：图片太大（超过 1.5 MB），手机上会加载很慢。请存成 960×640 的 jpg。`);
    }
    if (!wanted.has(collection.imageDir + name)) {
      problems.push(`${collection.imageDir}${name}：不属于任何一篇。图片文件名必须是“篇的 id + .jpg”，例如 ${collection.imageDir}${list[0]?.id ?? "id"}.jpg。`);
    }
  }
}

// A collection written but not listed in content/index.json never shows.
const listed = new Set(["index.json", basename(DICTIONARY), basename(BASE_DICTIONARY), ...collections.map(collection => collection.version + ".json")]);
for (const name of readdirSync(join(root, "content"))) {
  if (name.endsWith(".json") && !listed.has(name)) {
    problems.push(`content/${name}：没有在 content/index.json 里登记，网站看不到它。在 collections 末尾加一行 {"id": "${name.slice(0, -5)}", "kind": "review"}。`);
  }
}

const failed = problems.length + repetition.length;
const lines = failed
  ? [`内容检查没有通过，共 ${failed} 个问题：`,
    ...problems.map(problem => "✗ " + problem),
    ...(repetition.length ? ["", `生词复现次数不对（写文 agent 改文章；配图 agent 不用管，照常上传图片）：`] : []),
    ...repetition.map(problem => "✗ " + problem),
    "", "改好后再运行一次 node scripts/check-content.mjs。"]
  : [`✓ 内容检查通过：${collections.length} 个合集，${stories} 篇。`,
    ...(missingPictures.length ? [`还有 ${missingPictures.length} 张图没画（配图 agent 会补上，不算问题）。`] : [])];
// Words a reader taps and gets no meaning for: a notice, never a failure.
// Without content/dictionary.json there is nothing to look words up in.
const unexplained = await unexplainedWords(readText).catch(() => []);
if (unexplained.length) lines.push("", "提醒（不影响检查结果）：", ...unexplained.map(item => "· " + unexplainedNotice(item)));
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n\n") + "\n");
}
process.exit(failed ? 1 : 0);
