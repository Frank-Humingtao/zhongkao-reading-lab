#!/usr/bin/env node
// The base dictionary (docs/adr/0004): everyday words cut from ECDICT, so that
// any word the reader taps has a meaning when the collection and the word list
// have none. ECDICT (https://github.com/skywind3000/ECDICT) is MIT-licensed; its
// csv is downloaded by hand and never committed.
//
//   node scripts/base-dictionary.mjs <path to ecdict.csv>
//
// writes content/base-dictionary.json, { word: "n. 书；书籍 v. 预订" }, one word
// per line (formatContent) so a rerun's diff shows which words changed. Rerun it
// only to change the selection below.
//
// Selection: single words tagged zk, gk, cet4, cet6 or ky, plus the most frequent
// words (FREQUENT, by COCA `frq` or BNC `bnc` rank); a Chinese translation is
// required. Meanings keep at most two parts of speech and three senses each.
// Keys are lowercase with a straight apostrophe, as the page looks words up.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatContent } from "../content.js";

export const OUTPUT = "content/base-dictionary.json";
export const TAGS = ["zk", "gk", "cet4", "cet6", "ky"];
export const FREQUENT = 20000;
const PARTS = 2;
const SENSES = 3;

// Contractions ECDICT leaves out or explains poorly, written by hand.
export const CONTRACTIONS = {
  "i'm": "= I am 我是",
  "i've": "= I have 我已经；我有",
  "i'll": "= I will 我将；我会",
  "i'd": "= I would / I had 我会；我已经",
  "you're": "= you are 你是；你们是",
  "you've": "= you have 你已经；你有",
  "you'll": "= you will 你将；你会",
  "you'd": "= you would / you had 你会；你已经",
  "he's": "= he is / he has 他是；他已经",
  "she's": "= she is / she has 她是；她已经",
  "it's": "= it is / it has 它是；它已经",
  "we're": "= we are 我们是",
  "we've": "= we have 我们已经；我们有",
  "we'll": "= we will 我们将；我们会",
  "they're": "= they are 他们是",
  "they've": "= they have 他们已经；他们有",
  "they'll": "= they will 他们将；他们会",
  "he'd": "= he would / he had 他会；他已经",
  "she'd": "= she would / she had 她会；她已经",
  "it'll": "= it will 它将；它会",
  "we'd": "= we would / we had 我们会；我们已经",
  "they'd": "= they would / they had 他们会；他们已经",
  "who'd": "= who would / who had 谁会；谁已经",
  "cannot": "= can not 不能；不会",
  "that's": "= that is 那是",
  "there's": "= there is 有；那里有",
  "what's": "= what is 什么是",
  "let's": "= let us 让我们",
  "can't": "= cannot 不能；不会",
  "couldn't": "= could not 不能；不会",
  "won't": "= will not 将不；不会",
  "wouldn't": "= would not 不会；不愿",
  "don't": "= do not 不",
  "doesn't": "= does not 不",
  "didn't": "= did not 没有",
  "isn't": "= is not 不是",
  "aren't": "= are not 不是",
  "wasn't": "= was not 不是",
  "weren't": "= were not 不是",
  "haven't": "= have not 没有",
  "hasn't": "= has not 没有",
  "hadn't": "= had not 没有",
  "shouldn't": "= should not 不应该",
  "mustn't": "= must not 禁止；不可以"
};

// ECDICT's csv: a header row, quoted fields with "" escapes. Translations keep
// their line breaks as a literal backslash-n.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.filter(cells => cells.length > 1)
    .map(cells => Object.fromEntries(header.map((name, column) => [name, cells[column] ?? ""])));
}

// Split on commas and semicolons, but not inside brackets: 使(马,鹰等)戴头罩.
function senses(text) {
  const parts = [];
  let depth = 0, current = "";
  for (const char of text) {
    if ("(（[【".includes(char)) depth++;
    if (")）]】".includes(char)) depth = Math.max(0, depth - 1);
    if (depth === 0 && ",，;；".includes(char)) { parts.push(current); current = ""; }
    else current += char;
  }
  parts.push(current);
  return [...new Set(parts.map(part => part.trim()).filter(Boolean))];
}

const PART = /^((?:[a-z]+\.\s*(?:[&/,]\s*)?)+)\s*(.*)$/;
const CHINESE = /[㐀-鿿]/;

// "n. 书, 书籍, 帐簿\nv. 登记, 预订\n[计] 工作簿" → "n. 书；书籍；帐簿 v. 登记；预订".
// Lines tagged [计], [网络] and the like are subject labels, used only when no
// line names a part of speech.
export function shortenTranslation(translation) {
  const lines = translation.split(/\\r\\n|\\n|\\r|\r?\n/).map(line => line.trim()).filter(line => CHINESE.test(line));
  const plain = lines.filter(line => !line.startsWith("["));
  const chosen = (plain.length ? plain : lines.map(line => line.replace(/^\[[^\]]*\]\s*/, ""))).slice(0, PARTS);
  return chosen.map(line => {
    const [, part = "", rest = line] = line.match(PART) || [];
    const text = rest.replace(/^(?:\[[^\]]*\]\s*)+/, "");
    const kept = senses(text).filter(sense => CHINESE.test(sense)).slice(0, SENSES).join("；");
    return kept ? (part ? part.trim().replace(/\s+/g, " ") + " " : "") + kept : "";
  }).filter(Boolean).join(" ");
}

const WORD = /^[a-z][a-z'-]*$/;
const rank = entry => {
  const ranks = [Number(entry.frq), Number(entry.bnc)].filter(value => value > 0);
  return ranks.length ? Math.min(...ranks) : Infinity;
};

// ECDICT rows → { word: meaning }, sorted by word. A lowercase entry wins over
// a capitalised one (may over May).
export function buildBaseDictionary(rows, { frequent = FREQUENT } = {}) {
  const candidates = new Map();
  for (const entry of rows) {
    const key = entry.word.toLowerCase().replaceAll("’", "'");
    if (!WORD.test(key)) continue;
    const meaning = shortenTranslation(entry.translation || "");
    if (!meaning) continue;
    const exact = entry.word === key;
    const known = candidates.get(key);
    if (known && (known.exact || !exact)) continue;
    const tags = (entry.tag || "").split(/\s+/);
    candidates.set(key, { key, meaning, exact, tagged: TAGS.some(tag => tags.includes(tag)), rank: rank(entry) });
  }
  const all = [...candidates.values()];
  const chosen = new Set(all.filter(entry => entry.tagged).map(entry => entry.key));
  all.filter(entry => entry.rank < Infinity).sort((left, right) => left.rank - right.rank)
    .slice(0, frequent).forEach(entry => chosen.add(entry.key));
  const result = {};
  for (const entry of all) if (chosen.has(entry.key)) result[entry.key] = entry.meaning;
  Object.assign(result, CONTRACTIONS);
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage: node scripts/base-dictionary.mjs <path to ecdict.csv>");
    process.exit(1);
  }
  const dictionary = buildBaseDictionary(parseCsv(await readFile(source, "utf8")));
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  await writeFile(join(root, OUTPUT), formatContent(dictionary));
  console.log(`✓ ${OUTPUT}: ${Object.keys(dictionary).length} words.`);
}
