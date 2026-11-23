import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitSentences } from "./vocab-context.js";
import { narrationKey, narrationStories, screeningPairs, storyPairs } from "./narration.js";

const PINNED_FILM_KEY = "2a5f5df5d757c8e8";
const content = name => JSON.parse(readFileSync("content/" + name + ".json", "utf8"));
const readText = async path => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

test("a reading-set story narrates its sentence pairs in reading order", () => {
  const story = content("reading-01").stories[0];
  const pairs = storyPairs(story);
  assert.equal(pairs.length, 12);
  assert.deepEqual(pairs[0], {
    en: "My cousin and I made a film about two astronauts who hear thunder inside their spacecraft.",
    zh: "我和表亲拍了一部短片，讲的是两名宇航员在航天器里听见雷声的故事。"
  });
  assert.deepEqual(pairs[1], {
    en: "Our script called for a loud bang, but we had no proper sound equipment.",
    zh: "剧本需要一声巨响，可我们没有合适的录音设备。"
  });
});

test("a news-edition story speaks its English without the Chinese glosses", () => {
  const news = content("daily-news-01");
  const story = news.stories.find(item => item.id === "daily-news-01-01");
  const pairs = storyPairs(story);
  assert.ok(pairs.some(pair => pair.en === "The spacecraft is now so far away that a radio signal takes 24 hours to reach it."));
  const samples = storyPairs(news.stories.find(item => item.id === "daily-news-01-02"));
  assert.ok(samples.some(pair => pair.en === "Now it is coming home with science samples."));
  assert.ok(samples.some(pair => pair.zh === "现在它正把科学样品带回地球。"));
  for (const item of news.stories) {
    for (const pair of storyPairs(item)) {
      assert.doesNotMatch(pair.en, /[（）\p{Script=Han}]/u, pair.en);
      assert.ok(pair.zh, "every sentence has its Chinese rendering");
    }
  }
});


test("a screening passage pairs each page sentence with its Chinese rendering", () => {
  const { lessons, chinese: bilingual } = content("screening");
  const lesson = lessons.find(item => item.id === "read-01");
  const pairs = screeningPairs(lesson, bilingual["read-01"]);
  assert.deepEqual(pairs[0], {
    en: "Our school theatre and art club planned a play about a foolish king who loses his crown.",
    zh: "学校的戏剧与艺术社团排了一出戏，讲的是一个糊涂国王弄丢了王冠。"
  });
  assert.deepEqual(pairs[5], {
    en: "The actor playing a detective opened a cupboard and found only a broom.",
    zh: "扮演侦探的演员打开橱柜，却只找到一把扫帚。"
  });
});

test("screening sentence indexes match the reading page's sentence splitting", () => {
  // The page splits with the same splitSentences narration uses.
  assert.match(readFileSync("reading-page.js", "utf8"), /import \{ readingPlainText, splitSentences \} from "\.\/vocab-context\.js";/);
  const { lessons, chinese: bilingual } = content("screening");
  assert.equal(lessons.length, 68);
  for (const lesson of lessons) {
    const pageSentences = lesson.paragraphs.flatMap(paragraph => splitSentences(paragraph));
    const pairs = screeningPairs(lesson, bilingual[lesson.id]);
    assert.deepEqual(pairs.map(pair => pair.en), pageSentences, lesson.id);
    assert.ok(pairs.every(pair => pair.zh), lesson.id + " has every Chinese rendering");
  }
});

test("the narration key is stable and changes when any sentence's text changes", async () => {
  const story = content("reading-01").stories[0];
  const pairs = storyPairs(story);
  const key = await narrationKey(pairs);
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.equal(await narrationKey(storyPairs(story)), key);
  assert.equal(await narrationKey(structuredClone(pairs)), key);
  for (const index of [0, 5, pairs.length - 1]) {
    for (const language of ["en", "zh"]) {
      const edited = structuredClone(pairs);
      edited[index][language] += "!";
      assert.notEqual(await narrationKey(edited), key, `${language} ${index}`);
    }
  }
  assert.notEqual(await narrationKey(pairs.slice(0, -1)), key);
  const moved = structuredClone(pairs);
  moved[1].en = pairs[0].en + " " + pairs[1].en;
  moved[0].en = "";
  assert.notEqual(await narrationKey(moved), key, "moving text between sentences changes the key");
});

test("a gloss added to the English does not change the narration key", async () => {
  const story = content("daily-news-01").stories[0];
  const plain = structuredClone(story);
  for (const paragraph of plain.paragraphs) for (const pair of paragraph) pair[0] = pair[0].replace(/（[^）]*）/g, " ").replace(/ +/g, " ").replace(/ ([.,])/g, "$1");
  assert.equal(await narrationKey(storyPairs(plain)), await narrationKey(storyPairs(story)));
});

test("published narration keys do not drift between runs or machines", async () => {
  // Tracks already published are found by this key; changing it would orphan them.
  const story = content("reading-01").stories[0];
  assert.equal(await narrationKey(storyPairs(story)), PINNED_FILM_KEY);
});

test("enumeration covers every collection content/index.json lists, at the version it shows", async () => {
  const stories = await narrationStories(readText);
  const { collections } = JSON.parse(readFileSync("content/index.json", "utf8"));
  assert.deepEqual([...new Set(stories.map(story => story.set))], collections.map(collection => collection.id));

  assert.deepEqual(stories.filter(story => story.set === "screening").map(story => story.id),
    content("screening").lessons.map(lesson => lesson.id));
  for (const { id, version = id } of collections.filter(collection => collection.id !== "screening")) {
    assert.deepEqual(stories.filter(story => story.set === id).map(story => story.id),
      content(version).stories.map(story => story.id), id);
    assert.ok(stories.filter(story => story.set === id).every(story => story.edition === version), id);
  }
  assert.equal(stories.find(story => story.set === "reading-02").edition, "reading-02-v3");

  const film = stories.find(story => story.id === "memory-01-film");
  assert.equal(film.title, "Thunder for a Film");
  assert.equal(film.setName, "Review 01");
  assert.equal(film.artwork, "images/reading-01/film.jpg");
  assert.equal(film.key, PINNED_FILM_KEY);
  assert.equal(film.pairs.length, 12);
  assert.ok(stories.find(story => story.set === "reading-02").artwork.startsWith("images/reading-02/"));
  assert.equal(stories.find(story => story.set === "daily-news-01").setName, "News 01");
  const missingCostume = stories.find(story => story.id === "read-01");
  assert.equal(missingCostume.setName, "Placement 01");
  assert.equal(missingCostume.title, "The Missing Costume");
  assert.equal(missingCostume.artwork, "images/screening/read-01.jpg");
  for (const story of stories) {
    assert.ok(story.pairs.length && story.pairs.every(pair => pair.en && pair.zh), story.id);
    assert.match(story.key, /^[0-9a-f]{16}$/);
  }
});

test("a new review batch is narrated with its pictures named after its stories", async () => {
  const files = {
    "content/index.json": JSON.stringify({ collections: [{ id: "review-2026-11-24", kind: "review" }] }),
    "content/review-2026-11-24.json": JSON.stringify({
      words: { lamp: ["灯"] },
      stories: [{ id: "review-2026-11-24-01", title: "The Lamp", topic: "灯", picture: "桌上的一盏灯。",
        paragraphs: [[["The lamp was on.", "灯亮着。"]]] }]
    })
  };
  const [story] = await narrationStories(async path => files[path] ?? null);
  assert.deepEqual({ set: story.set, edition: story.edition, setName: story.setName, artwork: story.artwork }, {
    set: "review-2026-11-24", edition: "review-2026-11-24", setName: "Review 11-24",
    artwork: "images/review-2026-11-24/review-2026-11-24-01.jpg"
  });
});
