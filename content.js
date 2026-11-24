// Content: every collection the site shows, where its files live, and whether
// they are well formed. The reading page, the set switcher, the 生词 board,
// narration and the scripts all read content through this module, so adding a
// collection never means changing code.
//
//   content/index.json         the list of collections (newest last)
//   content/<version>.json     one collection's words and stories
//   content/dictionary.json    the word list every collection is tokenized with
//   images/<id>/<story>.jpg    one picture per story
//
// CONTENT.md is the guide the writer agent and the illustrator agent follow.
// `readText(path)` is how callers load a file: fetch in the browser, fs in node.
// It returns the text, or null when the file does not exist.

import { readingPlainText } from "./vocab-context.js";

export const MANIFEST = "content/index.json";
export const DICTIONARY = "content/dictionary.json";

const KINDS = {
  placement: { label: "Placement", name: "摸底短文" },
  review: { label: "Review", name: "生词复现" },
  news: { label: "News", name: "新闻" }
};

// A review batch named by its date, the way the writer agent names new ones.
const DATED = /^review-(\d{4})-(\d{2})-(\d{2})$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/;
const HAN = /\p{Script=Han}/u;

// The placement passages from before content/ existed: their own file shape and
// their own progress keys, kept so the reader's marks stay where they are.
const LEGACY_SCREENING = "screening";
const LEGACY_PROGRESS = {
  screening: {
    storageKey: "zhongkao-reading-lab-v3",
    progressFile: "progress.json",
    recordsKey: "zhongkao-github-sync-records-v1"
  }
};

const MANIFEST_FIELDS = new Set(["id", "kind", "number", "version", "earlier"]);
const COLLECTION_FIELDS = new Set(["words", "stories", "columnTitle", "editionDate"]);
const STORY_FIELDS = new Set(["id", "title", "topic", "picture", "image", "figure", "sources", "paragraphs"]);

function progressFor(version) {
  return LEGACY_PROGRESS[version] ?? {
    storageKey: "zhongkao-reading-lab-" + version,
    progressFile: "progress-" + version + ".json",
    recordsKey: "zhongkao-github-sync-records-" + version + "-v1"
  };
}

function describe(entry, kind) {
  const dated = DATED.exec(entry.id);
  const number = entry.number ?? (dated ? dated[2] + "-" + dated[3] : "");
  const label = KINDS[kind].label + " " + number;
  const version = entry.version ?? entry.id;
  return {
    id: entry.id,
    kind,
    number,
    label,
    kindLabel: KINDS[kind].label,
    name: KINDS[kind].name,
    version,
    file: "content/" + version + ".json",
    href: entry.id === LEGACY_SCREENING ? "./" : "./?set=" + entry.id,
    imageDir: "images/" + entry.id + "/",
    legacyScreening: entry.id === LEGACY_SCREENING,
    ...progressFor(version),
    // Versions this collection replaced: their stories are gone, but the 生词
    // marked in them still count on the board.
    earlier: (entry.earlier ?? []).map(old => ({ version: old, ...progressFor(old) }))
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The collections content/index.json lists, in its order, and a problem for
// every entry that had to be left out.
export function readManifest(text) {
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    return { collections: [], problems: [`${MANIFEST}：不是合法的 JSON（${error.message}）。检查逗号、引号和括号。`] };
  }
  if (!isObject(manifest) || !Array.isArray(manifest.collections)) {
    return { collections: [], problems: [`${MANIFEST}：最外层必须是 {"collections": [...]}。`] };
  }
  const collections = [];
  const seen = new Set();
  manifest.collections.forEach((entry, index) => {
    const where = `${MANIFEST} 第 ${index + 1} 项${isObject(entry) && typeof entry.id === "string" ? "（" + entry.id + "）" : ""}`;
    const fail = message => problems.push(`${where}：${message}`);
    if (!isObject(entry)) return fail("必须是一个 {...} 对象。");
    const unknown = Object.keys(entry).filter(key => !MANIFEST_FIELDS.has(key));
    if (unknown.length) return fail(`不认识的字段 ${unknown.join("、")}。只能有 id、kind（老合集还有 number、version、earlier）。`);
    if (typeof entry.id !== "string" || !ID.test(entry.id)) return fail("id 只能用小写字母、数字和连字符，例如 review-2026-11-24。");
    if (!Object.hasOwn(KINDS, entry.kind)) return fail("kind 只能是 placement、review 或 news。");
    if (entry.kind === "review" && entry.number === undefined && !DATED.test(entry.id)) {
      return fail("新的生词复现批次的 id 必须是 review-年-月-日，例如 review-2026-11-24。");
    }
    if (entry.kind !== "review" && entry.number === undefined) return fail("需要 number，例如 \"02\"。");
    if (entry.number !== undefined && (typeof entry.number !== "string" || !entry.number)) return fail("number 必须是文字，例如 \"02\"。");
    if (entry.version !== undefined && (typeof entry.version !== "string" || !ID.test(entry.version))) return fail("version 只能是 id。");
    if (entry.earlier !== undefined && (!Array.isArray(entry.earlier)
      || !entry.earlier.every(old => typeof old === "string" && ID.test(old)))) return fail("earlier 只能是旧版本 id 的列表。");
    if (seen.has(entry.id)) return fail("这个 id 前面已经登记过了，不要重复登记。");
    seen.add(entry.id);
    collections.push(describe(entry, entry.kind));
  });
  return { collections, problems };
}

export async function loadManifest(readText) {
  const text = await readText(MANIFEST);
  if (text === null || text === undefined) return { collections: [], problems: [`${MANIFEST}：找不到这个文件。`] };
  return readManifest(text);
}

// The collection a page shows for its ?set= value; no value is Placement 01.
export function findCollection(collections, setParam) {
  return collections.find(collection => collection.id === (setParam || LEGACY_SCREENING)) ?? null;
}

// The set switcher: placement first, then review batches and news, newest first.
export function switcherGroups(collections) {
  return ["placement", "review", "news"]
    .map(kind => collections.filter(collection => collection.kind === kind).reverse())
    .filter(group => group.length);
}

// What one story's picture is: the file under the collection's images, and the
// description that is both the picture's alt text and what the illustrator
// agent draws from. A story without a description has no picture.
export function storyPicture(collection, story) {
  if (collection.legacyScreening) {
    return { src: collection.imageDir + story.id + ".jpg", alt: story.picture || "" };
  }
  if (typeof story.picture !== "string" || !story.picture) return null;
  return { src: collection.imageDir + (story.image || story.id + ".jpg"), alt: story.picture };
}

function checkPairs(story, where, fail) {
  if (!Array.isArray(story.paragraphs) || !story.paragraphs.length) {
    return fail(`${where}：paragraphs 必须是非空数组（段落的数组）。`);
  }
  story.paragraphs.forEach((paragraph, paragraphIndex) => {
    const at = `${where} 第 ${paragraphIndex + 1} 段`;
    if (!Array.isArray(paragraph) || !paragraph.length) return fail(`${at}：每一段必须是非空数组（句对的数组）。`);
    paragraph.forEach((pair, pairIndex) => {
      const here = `${at}第 ${pairIndex + 1} 句`;
      if (!Array.isArray(pair) || pair.length !== 2) return fail(`${here}：句对必须是 ["英文句子", "中文翻译"]。`);
      const [english, chinese] = pair;
      if (typeof english !== "string" || !english.trim()) return fail(`${here}：英文句子是空的。`);
      if (typeof chinese !== "string" || !chinese.trim()) return fail(`${here}：中文翻译是空的。`);
      if (HAN.test(readingPlainText(english))) return fail(`${here}：英文句子里有中文。中文注释只能写在全角括号里，例如 spacecraft（航天器）。`);
      if (!HAN.test(chinese)) fail(`${here}：中文翻译里没有中文。`);
    });
  });
}

function checkStory(story, index, collection, ids, fail) {
  const where = `${collection.file} 第 ${index + 1} 篇${isObject(story) && typeof story.id === "string" ? "（" + story.id + "）" : ""}`;
  if (!isObject(story)) return fail(`${where}：必须是一个 {...} 对象。`);
  const unknown = Object.keys(story).filter(key => !STORY_FIELDS.has(key));
  if (unknown.length) fail(`${where}：不认识的字段 ${unknown.join("、")}。能用的字段是 ${[...STORY_FIELDS].join("、")}。`);
  if (typeof story.id !== "string" || !ID.test(story.id)) fail(`${where}：id 只能用小写字母、数字和连字符，例如 ${collection.id}-01。`);
  else if (ids.has(story.id)) fail(`${where}：id 和前面的篇重复了。`);
  else ids.add(story.id);
  if (typeof story.title !== "string" || !story.title.trim()) fail(`${where}：title（英文标题）是空的。`);
  if (typeof story.topic !== "string" || !HAN.test(story.topic)) fail(`${where}：topic（中文标题）是空的或没有中文。`);
  if (story.picture !== undefined && (typeof story.picture !== "string" || !story.picture.trim())) {
    fail(`${where}：picture（画面描述）必须是一段中文文字。`);
  }
  if (story.picture === undefined && DATED.test(collection.id)) fail(`${where}：缺少 picture（画面描述），配图 agent 要靠它画图。`);
  if (story.image !== undefined && (typeof story.image !== "string" || !IMAGE.test(story.image))) {
    fail(`${where}：image 只能是一个图片文件名，例如 ${story.id}.jpg。新文章不要写 image。`);
  }
  if (story.figure !== undefined && !isObject(story.figure)) fail(`${where}：figure 必须是 {...} 对象。`);
  if (story.sources !== undefined && (!Array.isArray(story.sources) || story.sources.some(source =>
    !isObject(source) || typeof source.label !== "string" || typeof source.url !== "string" || !/^https:\/\//.test(source.url)))) {
    fail(`${where}：sources 必须是 [{"label": "...", "url": "https://..."}]。`);
  }
  checkPairs(story, where, fail);
}

// Problems with one collection's file, in words the writer agent can act on.
// An empty list means the page can show it.
export function checkCollection(collection, data) {
  const problems = [];
  const fail = message => problems.push(message);
  if (!isObject(data)) return [`${collection.file}：最外层必须是 {"words": {...}, "stories": [...]}。`];
  if (collection.legacyScreening) {
    if (!Array.isArray(data.lessons) || !isObject(data.chinese) || !isObject(data.titles)) {
      fail(`${collection.file}：摸底短文 01 的文件结构被改坏了。`);
    }
    return problems;
  }
  const unknown = Object.keys(data).filter(key => !COLLECTION_FIELDS.has(key));
  if (unknown.length) fail(`${collection.file}：最外层不认识的字段 ${unknown.join("、")}。只能有 words 和 stories。`);
  if (!isObject(data.words) || !Object.keys(data.words).length) {
    fail(`${collection.file}：words（这一批的生词表）必须是非空的 {"单词": ["中文释义", ...变形]}。`);
  } else {
    for (const [word, value] of Object.entries(data.words)) {
      if (!word.trim() || HAN.test(word)) fail(`${collection.file} words 里的 "${word}"：单词必须是英文。`);
      if (!Array.isArray(value) || typeof value[0] !== "string" || !HAN.test(value[0])) {
        fail(`${collection.file} words 里的 "${word}"：必须是 ["中文释义", ...变形]，第一项是中文释义。`);
      } else if (value.slice(1).some(form => typeof form !== "string" || !form.trim() || HAN.test(form))) {
        fail(`${collection.file} words 里的 "${word}"：释义后面只能写英文变形，例如 ["跑", "ran", "running"]。`);
      }
    }
  }
  if (!Array.isArray(data.stories) || !data.stories.length) {
    fail(`${collection.file}：stories 必须是非空数组。`);
  } else {
    const ids = new Set();
    data.stories.forEach((story, index) => checkStory(story, index, collection, ids, fail));
  }
  return problems;
}

// One collection's words and stories, or null with the problems when the file
// is missing or malformed. Pages skip a collection that fails rather than
// breaking.
export async function loadCollection(readText, collection) {
  const { file } = collection;
  const text = await readText(file);
  if (text === null || text === undefined) return { data: null, problems: [`${file}：找不到这个文件。`] };
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { data: null, problems: [`${file}：不是合法的 JSON（${error.message}）。检查逗号、引号和括号。`] };
  }
  const problems = checkCollection(collection, data);
  return { data: problems.length ? null : data, problems };
}

export async function loadDictionary(readText) {
  const text = await readText(DICTIONARY);
  if (!text) throw new Error(DICTIONARY + " is missing");
  return JSON.parse(text);
}

// The progress sources the 生词 board and the daily export read, one per
// collection, labelled the way the board shows where a word was marked.
export function vocabSources(collections) {
  return collections.flatMap(collection => [collection, ...collection.earlier].map(version => ({
    id: version.version, label: collection.label, file: version.progressFile,
    progressKey: version.storageKey, recordsKey: version.recordsKey
  })));
}

// The whole library, for the content check: every problem, plus every picture
// a story describes that is not there yet (not a problem: the illustrator agent
// draws it later). `exists(path)` says whether a file is in the repository.
export async function checkLibrary(readText, exists) {
  const { collections, problems } = await loadManifest(readText);
  const missingPictures = [];
  for (const collection of collections) {
    const shown = await loadCollection(readText, collection);
    problems.push(...shown.problems);
    if (!shown.data) continue;
    const stories = collection.legacyScreening ? shown.data.lessons : shown.data.stories;
    for (const story of stories) {
      const picture = storyPicture(collection, story);
      if (picture && !(await exists(picture.src))) missingPictures.push({ collection: collection.id, story: story.id, src: picture.src, description: picture.alt });
    }
  }
  return { collections, problems, missingPictures };
}

// Content files are written the same way every time: two-space indents, with a
// sentence pair, a word's meanings or any other short list kept on one line.
export function formatContent(value) {
  const inline = item => Array.isArray(item) && item.every(cell => cell === null || typeof cell !== "object");
  function format(item, indent) {
    if (inline(item)) return "[" + item.map(cell => JSON.stringify(cell)).join(", ") + "]";
    const inner = indent + "  ";
    if (Array.isArray(item)) {
      if (!item.length) return "[]";
      return "[\n" + item.map(cell => inner + format(cell, inner)).join(",\n") + "\n" + indent + "]";
    }
    if (item && typeof item === "object") {
      const entries = Object.entries(item);
      if (!entries.length) return "{}";
      return "{\n" + entries.map(([key, cell]) => inner + JSON.stringify(key) + ": " + format(cell, inner)).join(",\n") + "\n" + indent + "}";
    }
    return JSON.stringify(item);
  }
  return format(value, "") + "\n";
}
