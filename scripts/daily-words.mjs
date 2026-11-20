#!/usr/bin/env node
// Prints the 生词 that first became current on one Beijing calendar day, using the
// same rules as the 生词 board (vocab-core.js). Meant for the daily 墨墨 import.
//
//   node scripts/daily-words.mjs                      # yesterday (Beijing), one word per line
//   node scripts/daily-words.mjs --date 2026-11-20    # a specific day
//   node scripts/daily-words.mjs --json               # with meanings, sources and sentences
//   node scripts/daily-words.mjs --progress-dir ../zhongkao-reading-progress
//
// Progress comes from the private repo Frank-Humingtao/zhongkao-reading-progress, either
// from a local checkout (--progress-dir) or the GitHub API with GITHUB_TOKEN / GH_TOKEN.
// It never writes anything. Words cleared on the site are simply absent; nothing here
// asks anyone to delete words elsewhere.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITION_SCRIPTS, buildCatalog, editionFromSource, embeddedJson } from "../vocab-context.js";
import {
  PROGRESS_API,
  VOCAB_SOURCES,
  decodeGithubContent,
  decodeRecords,
  presentDetails,
  previousShanghaiDay,
  wordsForDay
} from "../vocab-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { date: null, json: false, progressDir: null };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--date") options.date = argv[++index];
    else if (arg === "--progress-dir") options.progressDir = argv[++index];
    else if (arg === "-h" || arg === "--help") options.help = true;
    else throw new Error("unknown option: " + arg);
  }
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error("--date must be YYYY-MM-DD");
  return options;
}

async function recordsFromDir(dir, file) {
  try {
    const data = JSON.parse(await readFile(join(dir, file), "utf8"));
    return decodeRecords(data);
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw new Error(file + ": " + error.message);
  }
}

async function recordsFromGithub(token, file) {
  const response = await fetch(PROGRESS_API + file, {
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(20000)
  });
  if (response.status === 404) return new Map();
  if (!response.ok) throw new Error(file + ": GitHub " + response.status);
  return decodeGithubContent((await response.json()).content);
}

async function loadCatalog() {
  const html = await readFile(join(root, "index.html"), "utf8");
  const editions = {};
  for (const [id, file, binding] of EDITION_SCRIPTS) {
    try {
      editions[id] = editionFromSource(await readFile(join(root, file), "utf8"), binding);
    } catch {
      // A missing historical set only loses meanings and sentences, not words.
    }
  }
  return buildCatalog({
    screening: embeddedJson(html, "screening-data"),
    bilingual: embeddedJson(html, "bilingual-text") || {},
    extraMeanings: embeddedJson(html, "supplemental-meanings") || {},
    trialLessons: embeddedJson(html, "lesson-data") || [],
    trialGlossary: embeddedJson(html, "new-glossary"),
    editions
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(readFileSyncHeader());
    return;
  }
  const date = options.date || previousShanghaiDay();
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!options.progressDir && !token) throw new Error("set GITHUB_TOKEN (read access to zhongkao-reading-progress) or pass --progress-dir");

  const sources = await Promise.all(VOCAB_SOURCES.map(async source => ({
    id: source.id,
    label: source.label,
    progress: null,
    records: options.progressDir
      ? await recordsFromDir(options.progressDir, source.file)
      : await recordsFromGithub(token, source.file)
  })));
  const words = wordsForDay(sources, date);

  if (!options.json) {
    if (words.length) console.log(words.map(word => word.word).join("\n"));
    return;
  }
  const catalog = await loadCatalog();
  const out = words.map(word => {
    const details = presentDetails(word.details.map(detail => ({
      ...detail,
      ...(catalog.lookup(detail.sourceId, detail.lessonId, detail.word, detail.exampleIndex) || {})
    })));
    return {
      word: word.word,
      meaning: details.find(detail => detail.meaning)?.meaning || "",
      sources: word.sources,
      sentences: details.filter(detail => detail.sentence).map(detail => ({
        source: detail.source,
        lesson: catalog.title(detail.sourceId, detail.lessonId),
        english: detail.sentence,
        chinese: detail.chinese || ""
      }))
    };
  });
  console.log(JSON.stringify({ date, timezone: "Asia/Shanghai", count: out.length, words: out }, null, 2));
}

function readFileSyncHeader() {
  return "usage: node scripts/daily-words.mjs [--date YYYY-MM-DD] [--json] [--progress-dir DIR]";
}

main().catch(error => {
  console.error("daily-words: " + error.message);
  process.exit(1);
});
