import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildIllustrationModel,
  decidePlacement,
  jpegSize,
  loadConst,
  loadEditions,
  loadResolver,
  repoRoot
} from "./illustration-lib.mjs";

const resolveStoryIllustration = loadResolver();
const editions = loadEditions();

const legacy = resolveStoryIllustration({
  id: "memory-01-film",
  topic: "为电影造雷",
  illustration: ["film.jpg", "两人在家用金属托盘和厚坐垫尝试制造雷声，架子上的手机正录音。"]
}, "reading-01");
assert.deepEqual(legacy, ["film.jpg", "两人在家用金属托盘和厚坐垫尝试制造雷声，架子上的手机正录音。"]);

const derived = resolveStoryIllustration({
  id: "reading-04-paper-boat",
  topic: "纸船",
  title: "Paper Boat",
  illustration: "雨后的窗台上，一个学生把纸船放进积着水的托盘。"
}, "reading-04");
assert.equal(derived[0], "reading-04-paper-boat.jpg");
assert.equal(derived[1], "雨后的窗台上，一个学生把纸船放进积着水的托盘。");

const derivedIgnoresFilename = resolveStoryIllustration({
  id: "reading-04-paper-boat",
  topic: "纸船",
  illustration: ["other.jpg", "雨后的窗台。"]
}, "reading-04");
assert.equal(derivedIgnoresFilename[0], "reading-04-paper-boat.jpg");
assert.equal(derivedIgnoresFilename[1], "雨后的窗台。");

const derivedWithoutCaption = resolveStoryIllustration({
  id: "reading-04-paper-boat",
  topic: "纸船",
  title: "Paper Boat"
}, "reading-04");
assert.equal(derivedWithoutCaption[0], "reading-04-paper-boat.jpg");
assert.equal(derivedWithoutCaption[1], "纸船");

assert.equal(resolveStoryIllustration({ id: "memory-01-film" }, "reading-01"), null);
assert.equal(editions.derivedNamesFromSet, 4);

const film = jpegSize(fs.readFileSync(path.join(repoRoot, "images/reading-01/film.jpg")));
assert.deepEqual(film, { width: 960, height: 640 });
assert.throws(() => jpegSize(Buffer.from("not a jpeg")), /不是 JPEG/);

const catalog = {
  imageWidth: 960,
  imageHeight: 640,
  stories: [
    {
      setId: "reading-04",
      id: "reading-04-paper-boat",
      fileName: "reading-04-paper-boat.jpg",
      output: "images/reading-04/reading-04-paper-boat.jpg",
      present: false
    },
    {
      setId: "reading-01",
      id: "memory-01-film",
      fileName: "film.jpg",
      output: "images/reading-01/film.jpg",
      present: true
    }
  ],
  screening: [
    {
      setId: "screening",
      id: "read-01",
      fileName: "read-01.jpg",
      output: "images/screening/read-01.jpg",
      present: true
    }
  ]
};

const placed = decidePlacement({
  catalog,
  fileName: "reading-04-paper-boat.jpg",
  setId: null,
  replace: false,
  destinationExists: false,
  width: 960,
  height: 640
});
assert.equal(placed.ok, true);
assert.equal(placed.output, "images/reading-04/reading-04-paper-boat.jpg");

const wrongSize = decidePlacement({
  catalog,
  fileName: "reading-04-paper-boat.jpg",
  replace: false,
  destinationExists: false,
  width: 1024,
  height: 1024
});
assert.equal(wrongSize.ok, false);
assert.equal(wrongSize.code, 3);

const exists = decidePlacement({
  catalog,
  fileName: "film.jpg",
  replace: false,
  destinationExists: true,
  width: 960,
  height: 640
});
assert.equal(exists.ok, false);
assert.equal(exists.code, 2);

const replaced = decidePlacement({
  catalog,
  fileName: "film.jpg",
  setId: "reading-01",
  replace: true,
  destinationExists: true,
  width: 960,
  height: 640
});
assert.equal(replaced.ok, true);
assert.equal(replaced.output, "images/reading-01/film.jpg");

const unknown = decidePlacement({
  catalog,
  fileName: "invented.jpg",
  replace: false,
  destinationExists: false,
  width: 960,
  height: 640
});
assert.equal(unknown.ok, false);
assert.equal(unknown.code, 1);

const model = buildIllustrationModel();
assert.equal(model.dimensionProblems.length, 0, model.dimensionProblems.join("\n"));
assert.equal(model.missing.length, 0);

for (const set of editions.sets) {
  const data = loadConst(set.script, set.exportName);
  const rows = model.catalog.stories.filter(story => story.setId === set.setId);
  assert.equal(rows.length, data.stories.length, set.setId);
  for (const source of data.stories) {
    const row = rows.find(story => story.id === source.id);
    assert.ok(row, source.id);
    const [fileName] = resolveStoryIllustration(source, set.setId);
    assert.equal(row.output, `images/${set.setId}/${fileName}`);
    assert.equal(row.present, true);
    assert.equal(fs.existsSync(path.join(repoRoot, row.output)), true);
    const brief = model.files.get(row.brief);
    assert.ok(brief.includes(row.output));
    assert.ok(brief.includes(row.caption));
    assert.ok(brief.includes(source.paragraphs[0][0][0]));
    assert.ok(brief.includes(source.paragraphs[0][0][1]));
    assert.ok(brief.includes("960×640"));
  }
}

const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const screening = html.includes('"lessons"');
assert.equal(screening, true);
assert.equal(model.catalog.screening.length > 60, true);
for (const item of model.catalog.screening) {
  assert.equal(item.output, `images/screening/${item.id}.jpg`);
  assert.ok(item.caption, `${item.id} 缺少画面说明`);
  assert.equal(item.present, true);
  assert.equal(item.width, 960);
  assert.equal(item.height, 640);
}

const progressIds = ["reading-02-v3", "reading-03-v2"];
for (const progressId of progressIds) {
  assert.equal(html.includes(`progressId: "${progressId}"`), true);
}
assert.equal(html.includes('const storageKey = edition ? "zhongkao-reading-lab-" + progressId : "zhongkao-reading-lab-v3";'), true);

const check = spawnSync(process.execPath, [path.join(repoRoot, "scripts/sync-illustration-briefs.mjs"), "--check"], {
  cwd: repoRoot,
  encoding: "utf8"
});
if (check.status !== 0) {
  console.error(check.stdout);
  console.error(check.stderr);
}
assert.equal(check.status, 0);

console.log(`illustration checks passed (${model.catalog.stories.length} stories, ${model.catalog.screening.length} screening passages)`);
