import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { checkCollection, checkLibrary, findCollection, formatContent, loadCollection, readManifest, storyPicture,
  switcherGroups } from "./content.js";

const manifest = collections => readManifest(JSON.stringify({ collections }));
const readText = async path => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

// The smallest batch the writer agent can publish.
const batch = () => ({
  words: { lamp: ["灯", "lamps"] },
  stories: [{
    id: "review-2026-11-24-01", title: "The Lamp", topic: "那盏灯", picture: "书桌上亮着一盏旧台灯。",
    paragraphs: [[["The lamp was on（亮着）.", "灯亮着。"], ["Mia read under it.", "米娅在灯下读书。"]]]
  }]
});
const dated = () => manifest([{ id: "review-2026-11-24", kind: "review" }]).collections[0];

test("a new review batch needs only an id and a kind; everything else is derived", () => {
  const { collections, problems } = manifest([{ id: "review-2026-11-24", kind: "review" }]);
  assert.deepEqual(problems, []);
  const [batch] = collections;
  assert.equal(batch.label, "Review 11-24");
  assert.equal(batch.name, "生词复现");
  assert.equal(batch.file, "content/review-2026-11-24.json");
  assert.equal(batch.href, "./?set=review-2026-11-24");
  assert.equal(batch.imageDir, "images/review-2026-11-24/");
  assert.equal(batch.storageKey, "zhongkao-reading-lab-review-2026-11-24");
  assert.equal(batch.progressFile, "progress-review-2026-11-24.json");
  assert.equal(batch.recordsKey, "zhongkao-github-sync-records-review-2026-11-24-v1");
});

test("the published collections keep the ids, labels and progress they had", () => {
  const { collections, problems } = readManifest(readFileSync("content/index.json", "utf8"));
  assert.deepEqual(problems, []);
  assert.deepEqual(collections.map(collection => collection.label),
    ["Placement 01", "Review 01", "Review 02", "Review 03", "Review 04", "News 01"]);
  const placement = findCollection(collections, null);
  assert.equal(placement.id, "screening");
  assert.equal(placement.href, "./");
  assert.equal(placement.storageKey, "zhongkao-reading-lab-v3");
  const two = findCollection(collections, "reading-02");
  assert.equal(two.file, "content/reading-02-v3.json");
  assert.equal(two.storageKey, "zhongkao-reading-lab-reading-02-v3");
  assert.equal(two.imageDir, "images/reading-02/");
  assert.equal(two.progressFile, "progress-reading-02-v3.json");
  assert.equal(findCollection(collections, "reading-09"), null);
});

test("the switcher lists placement, then review, then news, newest first", () => {
  const { collections } = manifest([
    { id: "screening", kind: "placement", number: "01" },
    { id: "reading-01", kind: "review", number: "01" },
    { id: "review-2026-11-24", kind: "review" },
    { id: "daily-news-01", kind: "news", number: "01" }
  ]);
  assert.deepEqual(switcherGroups(collections).map(group => group.map(collection => collection.id)),
    [["screening"], ["review-2026-11-24", "reading-01"], ["daily-news-01"]]);
});

test("a bad manifest entry is left out with a reason; the others still show", () => {
  const { collections, problems } = manifest([
    { id: "review-2026-11-24", kind: "review" },
    { id: "review-2026-11-24", kind: "review" },
    { id: "Review 25", kind: "review" },
    { id: "review-25", kind: "review" },
    { id: "review-2026-11-26", kind: "story" },
    { id: "review-2026-11-27", kind: "review", file: "x.json" }
  ]);
  assert.deepEqual(collections.map(collection => collection.id), ["review-2026-11-24"]);
  assert.equal(problems.length, 5);
  assert.match(problems[0], /第 2 项.*已经登记过/);
  assert.match(problems[1], /id 只能用小写字母/);
  assert.match(problems[2], /review-年-月-日/);
  assert.match(problems[3], /kind 只能是/);
  assert.match(problems[4], /不认识的字段 file/);
  assert.match(readManifest("{ collections: [").problems[0], /不是合法的 JSON/);
});

test("a well-formed batch passes the check", () => {
  assert.deepEqual(checkCollection(dated(), batch()), []);
});

test("the check names the file, the story and the field to fix", () => {
  const cases = [
    [data => { delete data.stories[0].picture; }, /第 1 篇（review-2026-11-24-01）：缺少 picture/],
    [data => { data.stories[0].pictures = "x"; }, /不认识的字段 pictures/],
    [data => { data.stories[0].topic = ""; }, /topic（中文标题）/],
    [data => { data.stories.push(structuredClone(data.stories[0])); }, /第 2 篇.*id 和前面的篇重复了/],
    [data => { data.stories[0].paragraphs[0][1] = ["Mia read.", ""]; }, /第 1 段第 2 句：中文翻译是空的/],
    [data => { data.stories[0].paragraphs[0][1] = ["Mia 读书。", "米娅读书。"]; }, /英文句子里有中文/],
    [data => { data.stories[0].paragraphs[0][1] = "Mia read."; }, /句对必须是/],
    [data => { data.words.lamp = ["lamp"]; }, /words 里的 "lamp"/],
    [data => { data.stories[0].image = "../x.jpg"; }, /image 只能是一个图片文件名/],
    [data => { data.extra = 1; }, /最外层不认识的字段 extra/]
  ];
  for (const [change, message] of cases) {
    const data = batch();
    change(data);
    const problems = checkCollection(dated(), data);
    assert.equal(problems.length, 1, String(change));
    assert.match(problems[0], message);
    assert.match(problems[0], /content\/review-2026-11-24\.json/);
  }
});

test("a malformed collection is not loaded, so pages skip it instead of breaking", async () => {
  const files = { "content/review-2026-11-24.json": "{ \"words\": " };
  const broken = await loadCollection(async path => files[path] ?? null, dated());
  assert.equal(broken.data, null);
  assert.match(broken.problems[0], /不是合法的 JSON/);
  const missing = await loadCollection(async () => null, dated());
  assert.match(missing.problems[0], /找不到这个文件/);
});

test("a story's picture is named after it, unless an older story names its own file", () => {
  const collection = dated();
  assert.deepEqual(storyPicture(collection, batch().stories[0]),
    { src: "images/review-2026-11-24/review-2026-11-24-01.jpg", alt: "书桌上亮着一盏旧台灯。" });
  assert.equal(storyPicture(collection, { id: "a" }), null);
  const [one] = readManifest(readFileSync("content/index.json", "utf8")).collections.filter(item => item.id === "reading-01");
  const film = JSON.parse(readFileSync("content/reading-01.json", "utf8")).stories[0];
  assert.equal(storyPicture(one, film).src, "images/reading-01/film.jpg");
});

test("everything published passes the content check, and every picture it names is there", async () => {
  const { problems, missingPictures } = await checkLibrary(readText, async path => existsSync(path));
  assert.deepEqual(problems, []);
  assert.deepEqual(missingPictures, []);
});

test("a batch whose pictures are not drawn yet lists them for the illustrator agent", async () => {
  const files = {
    "content/index.json": JSON.stringify({ collections: [{ id: "review-2026-11-24", kind: "review" }] }),
    "content/review-2026-11-24.json": JSON.stringify(batch())
  };
  const { problems, missingPictures } = await checkLibrary(async path => files[path] ?? null, async () => false);
  assert.deepEqual(problems, []);
  assert.deepEqual(missingPictures, [{ collection: "review-2026-11-24", story: "review-2026-11-24-01",
    src: "images/review-2026-11-24/review-2026-11-24-01.jpg", description: "书桌上亮着一盏旧台灯。" }]);
});

test("content files are written in one format: short lists on one line", () => {
  assert.equal(formatContent({ words: { lamp: ["灯", "lamps"] }, stories: [] }),
    '{\n  "words": {\n    "lamp": ["灯", "lamps"]\n  },\n  "stories": []\n}\n');
  for (const name of readdirSync("content")) {
    const text = readFileSync("content/" + name, "utf8");
    if (name !== "index.json") assert.equal(formatContent(JSON.parse(text)), text, name);
  }
});
