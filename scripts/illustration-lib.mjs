import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");

const GENERATED = {
  catalog: "illustrations/catalog.json",
  queueJson: "illustrations/queue.json",
  queueMd: "illustrations/queue.md",
  screeningMd: "illustrations/screening-index.md"
};

export function loadEditions() {
  const editions = JSON.parse(fs.readFileSync(path.join(repoRoot, "illustrations/editions.json"), "utf8"));
  if (!Number.isInteger(editions.imageWidth) || !Number.isInteger(editions.imageHeight)) {
    throw new Error("illustrations/editions.json 缺少图片尺寸");
  }
  if (!Number.isInteger(editions.derivedNamesFromSet)) {
    throw new Error("illustrations/editions.json 缺少 derivedNamesFromSet");
  }
  const seen = new Set();
  for (const set of editions.sets) {
    if (seen.has(set.setId)) throw new Error(`重复的套题 ${set.setId}`);
    seen.add(set.setId);
    const number = setNumber(set.setId);
    if (!number) throw new Error(`套题 id 必须是 reading-数字：${set.setId}`);
    if (set.imageDirectory !== set.setId) {
      throw new Error(`${set.setId} 的图片目录必须等于套题 id，页面使用 images/<setId>/`);
    }
    const derived = number >= editions.derivedNamesFromSet;
    const expectedNames = derived ? "story-id" : "explicit";
    if (set.illustrationNames !== expectedNames) {
      throw new Error(`${set.setId} 的 illustrationNames 应为 ${expectedNames}`);
    }
    if (set.progressId === set.setId) {
      if (set.htmlEntry.includes("progressId")) {
        throw new Error(`${set.setId} 的 progressId 与套题相同，index.html 里不要重复写 progressId`);
      }
    } else if (!set.htmlEntry.includes(`progressId: "${set.progressId}"`)) {
      throw new Error(`${set.setId} 的 htmlEntry 没有写上 progressId ${set.progressId}`);
    }
    if (!set.htmlEntry.includes(`data: ${set.exportName}`)) {
      throw new Error(`${set.setId} 的 htmlEntry 与 exportName 不一致`);
    }
    const scriptPath = path.join(repoRoot, set.script);
    if (!fs.existsSync(scriptPath)) throw new Error(`找不到套题脚本 ${set.script}`);
  }
  return editions;
}

export function assertSiteConventions(html, editions) {
  const resolver = fs.readFileSync(path.join(repoRoot, "illustrations/resolve-illustration.js"), "utf8");
  const derived = resolver.match(/var DERIVED_FROM = (\d+);/);
  if (!derived || Number(derived[1]) !== editions.derivedNamesFromSet) {
    throw new Error("resolve-illustration.js 的 DERIVED_FROM 与 editions.json 的 derivedNamesFromSet 不一致");
  }
  const required = [
    '<script src="illustrations/resolve-illustration.js"></script>',
    "resolveStoryIllustration(story, setId)",
    'const storageKey = edition ? "zhongkao-reading-lab-" + progressId : "zhongkao-reading-lab-v3";',
    "const { data: edition, progressId = setId } = editions.get(setId) ?? {};",
    'const illustrationDirectory = edition ? setId : "screening";',
    'const illustration = [lesson.id + ".jpg", screeningIllustrations[lesson.id]];',
    "readingIllustration.onerror"
  ];
  for (const snippet of required) {
    if (!html.includes(snippet)) throw new Error(`index.html 缺少约定片段：${snippet}`);
  }
  for (const set of editions.sets) {
    if (!html.includes(`<script src="${set.script}"></script>`)) {
      throw new Error(`index.html 没有加载 ${set.script}`);
    }
    if (!html.includes(set.htmlEntry)) {
      throw new Error(`index.html 的 editions 与 illustrations/editions.json 不一致：${set.setId}`);
    }
  }
  const style = fs.readFileSync(path.join(repoRoot, "illustrations/style-notes.zh.md"), "utf8").trim();
  const spec = fs.readFileSync(path.join(repoRoot, "illustrations/CHATGPT.md"), "utf8");
  const pasteStart = spec.indexOf("===== 开始粘贴 =====");
  const pasteEnd = spec.indexOf("===== 粘贴结束 =====");
  if (pasteStart < 0 || pasteEnd < pasteStart) throw new Error("CHATGPT.md 缺少粘贴起止标记");
  const paste = spec.slice(pasteStart, pasteEnd);
  for (const snippet of [style, "960×640", "images/reading-04/<故事 id>.jpg", "不要改写", "不要发明故事 id", "不要替换已有图片"]) {
    if (!paste.includes(snippet)) throw new Error(`粘贴规范缺少：${snippet}`);
  }
}

export function loadConst(relativeFile, exportName) {
  const filename = path.join(repoRoot, relativeFile);
  const code = `${fs.readFileSync(filename, "utf8")}\nglobalThis.__loaded = ${exportName};\n`;
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context, { filename });
  if (!context.__loaded) throw new Error(`${relativeFile} 没有导出 ${exportName}`);
  return context.__loaded;
}

export function readJsonScript(html, id) {
  const marker = `<script type="application/json" id="${id}">`;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`index.html 缺少 JSON 脚本 ${id}`);
  const jsonStart = html.indexOf(">", start) + 1;
  const end = html.indexOf("</script>", jsonStart);
  if (end < 0) throw new Error(`JSON 脚本 ${id} 没有结束`);
  return JSON.parse(html.slice(jsonStart, end));
}

export function loadResolver() {
  const filename = path.join(repoRoot, "illustrations/resolve-illustration.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  if (typeof context.resolveStoryIllustration !== "function") {
    throw new Error("resolve-illustration.js 没有提供 resolveStoryIllustration");
  }
  return context.resolveStoryIllustration;
}

export function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("不是 JPEG");
  }
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("JPEG 标记损坏");
    while (buffer[offset] === 0xff && offset < buffer.length) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) throw new Error("JPEG 段长度损坏");
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  throw new Error("JPEG 里没有尺寸");
}

function setNumber(setId) {
  const match = /^reading-(\d+)$/.exec(setId || "");
  return match ? Number(match[1]) : 0;
}

function inspectImage(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolute)) return { present: false, width: null, height: null };
  const size = jpegSize(fs.readFileSync(absolute));
  return { present: true, width: size.width, height: size.height };
}

function assertStoryId(story, set) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.id || "")) {
    throw new Error(`${set.setId} 的故事 id 只能用小写字母、数字和连字符：${story.id}`);
  }
}

function captionText(illustration) {
  if (typeof illustration === "string") return illustration.trim();
  if (Array.isArray(illustration) && illustration.length >= 2) return String(illustration[1] || "").trim();
  return "";
}

function paragraphText(story, paragraph, paragraphIndex) {
  if (!Array.isArray(paragraph) || paragraph.length === 0) {
    throw new Error(`${story.id} 第 ${paragraphIndex + 1} 段是空的`);
  }
  return paragraph.map((sentence, sentenceIndex) => {
    if (!Array.isArray(sentence) || sentence.length < 2
      || typeof sentence[0] !== "string" || typeof sentence[1] !== "string") {
      throw new Error(`${story.id} 第 ${paragraphIndex + 1} 段第 ${sentenceIndex + 1} 句必须是 [英文, 中文]`);
    }
    return `${sentenceIndex + 1}. ${sentence[0]}\n   ${sentence[1]}`;
  }).join("\n\n");
}

function statusLine(present) {
  return present
    ? "已有图片。不要重画，不要替换，除非主人在这份任务之外明确写了「重画这一篇」。"
    : "还没有这张图。请做成规定尺寸的 JPEG，保存到输出文件。页面会按这个路径显示；不要为了挂图去改 JS 或 HTML。";
}

function renderBrief(story, set, style) {
  const naming = set.illustrationNames === "story-id"
    ? `文件名就是故事 id，即 \`${story.fileName}\`。文件夹是 \`images/${set.setId}/\`。`
    : `这是已发布套题，使用历史文件名 \`${story.fileName}\`，不是故事 id。不要改名。`;
  const paragraphs = story.paragraphs.map((paragraph, index) =>
    `### 第 ${index + 1} 段\n\n${paragraphText(story, paragraph, index)}`
  ).join("\n\n");
  return `# 插画简报：${story.id}

> 由 \`node scripts/sync-illustration-briefs.mjs\` 从 \`${set.script}\` 生成。正文和画面说明以该文件为准。不要手改本文件。

- 套题：${set.setId}
- 故事 id：\`${story.id}\`
- 英文标题：${story.title}
- 中文题目：${story.topic}
- 输出文件：\`${story.output}\`
- 尺寸：${story.widthRequired}×${story.heightRequired} 像素（宽 ${story.widthRequired}，高 ${story.heightRequired}，3:2）
- 格式：JPEG（.jpg）
- 命名：${naming}
- 图片状态：${statusLine(story.present)}

## 风格

${style}

## 画面说明

只画下面这一句所写的瞬间。这一句优先于后文情节。不要改写这一句。

${story.caption}

## 双语正文

正文只用来理解画面。不要改写、不要续写、不要纠正用词。

${paragraphs}

## 不要做的事

- 不要改故事 id，不要发明新的 id。
- 不要改输出文件名或文件夹。
- 不要改英文或中文正文。
- 不要替换已有图片，除非主人点名重画这一篇。
- 不要在画面里加标题或水印。
`;
}

function renderQueue(missing, editions, storyCount, screeningCount) {
  const derivedLabel = String(editions.derivedNamesFromSet).padStart(2, "0");
  const header = `# 缺图队列

一幅短文对应一张图。新套题（${derivedLabel} 起）的路径是 \`images/<套题 id>/<故事 id>.jpg\`。把 ${editions.imageWidth}×${editions.imageHeight} 的 JPEG 放到简报写明的输出文件后，文章会显示这张图，不必再改 JS 里的文件名。

更新本文件：\`node scripts/sync-illustration-briefs.mjs\`

规范：\`illustrations/CHATGPT.md\`
`;
  if (missing.length === 0) {
    return `${header}
当前没有缺图。

- 套题短文：${storyCount} 篇，都有图
- 筛查篇：${screeningCount} 篇，都有图
- 要求尺寸：${editions.imageWidth}×${editions.imageHeight} JPEG
`;
  }
  const blocks = missing.map(item => {
    const where = item.brief
      ? `- 简报：\`${item.brief}\``
      : `- 索引：\`${item.index}\`\n- 正文仍在 index.html 的 screening-data 里，篇目 id 为 \`${item.id}\`。不要改写正文。`;
    return `## ${item.setId}/${item.id}

- 输出文件：\`${item.output}\`
${where}
- 中文题目：${item.topic || "（无）"}
- 画面说明：${item.caption || "（没有画面说明，先补说明再画）"}
- 尺寸：${editions.imageWidth}×${editions.imageHeight} JPEG
`;
  });
  return `${header}
共 ${missing.length} 张缺图。

${blocks.join("\n")}`;
}

function renderScreeningIndex(items) {
  const blocks = items.map(item => `## ${item.id}

- 主题：${item.topic}
- 英文标题：${item.title}
- 中文标题：${item.titleZh || "（无）"}
- 画面说明：${item.caption || "（screening-illustrations.js 里没有这一篇）"}
- 输出文件：\`${item.output}\`
- 状态：${item.present ? "已有图片" : "缺图"}
`);
  return `# 筛查篇插画索引

薄索引。这 ${items.length} 篇的正文仍在 \`index.html\` 的 \`screening-data\` 里，画面说明仍在 \`screening-illustrations.js\`。这里不复制正文。

路径规则：\`images/screening/<篇目 id>.jpg\`，尺寸 960×640 JPEG。不要把文件名改成别的英文词。

${blocks.join("\n")}`;
}

function assertNoStraySet(editions) {
  for (const name of fs.readdirSync(repoRoot)) {
    const match = /^reading-(\d+)\.js$/.exec(name);
    if (!match) continue;
    const number = Number(match[1]);
    if (number < editions.derivedNamesFromSet) continue;
    if (!editions.sets.some(set => set.script === name)) {
      throw new Error(`${name} 还没有同时写进 illustrations/editions.json 和 index.html`);
    }
  }
}

export function buildIllustrationModel() {
  const editions = loadEditions();
  const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  assertSiteConventions(html, editions);
  assertNoStraySet(editions);
  const resolveStoryIllustration = loadResolver();
  const style = fs.readFileSync(path.join(repoRoot, "illustrations/style-notes.zh.md"), "utf8").trim();
  const titles = readJsonScript(html, "bilingual-titles");
  const screening = readJsonScript(html, "screening-data");
  const screeningCaptions = loadConst("screening-illustrations.js", "screeningIllustrations");
  const files = new Map();
  const stories = [];
  const seenIds = new Set();

  for (const set of editions.sets) {
    const data = loadConst(set.script, set.exportName);
    if (!Array.isArray(data.stories)) throw new Error(`${set.script} 没有 stories 数组`);
    const filenames = new Set();
    for (const source of data.stories) {
      assertStoryId(source, set);
      if (seenIds.has(source.id)) throw new Error(`故事 id 重复：${source.id}`);
      seenIds.add(source.id);
      if (set.illustrationNames === "story-id") {
        if (!source.id.startsWith(`${set.setId}-`)) {
          throw new Error(`${source.id} 必须以 ${set.setId}- 开头`);
        }
        if (typeof source.illustration !== "string" || !source.illustration.trim()) {
          throw new Error(`${source.id} 的 illustration 必须是一句中文画面说明，不要写文件名`);
        }
      } else if (!Array.isArray(source.illustration) || source.illustration.length < 2
        || typeof source.illustration[0] !== "string" || !source.illustration[1]) {
        throw new Error(`${source.id} 必须保留 illustration: [文件名.jpg, 中文画面说明]`);
      }
      const resolved = resolveStoryIllustration(source, set.setId);
      if (!resolved) throw new Error(`无法决定 ${source.id} 的插画路径`);
      const [fileName, alt] = resolved;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(fileName)) {
        throw new Error(`${source.id} 的图片文件名不合法：${fileName}`);
      }
      if (filenames.has(fileName)) throw new Error(`${set.setId} 里图片文件名重复：${fileName}`);
      filenames.add(fileName);
      const output = `images/${set.imageDirectory}/${fileName}`;
      const image = inspectImage(output);
      const caption = captionText(source.illustration) || alt;
      const story = {
        setId: set.setId,
        id: source.id,
        title: source.title,
        topic: source.topic,
        caption,
        brief: `illustrations/briefs/${set.setId}/${source.id}.md`,
        output,
        fileName,
        names: set.illustrationNames,
        source: set.script,
        present: image.present,
        width: image.width,
        height: image.height,
        widthRequired: editions.imageWidth,
        heightRequired: editions.imageHeight,
        paragraphs: source.paragraphs
      };
      stories.push(story);
      files.set(story.brief, renderBrief(story, set, style));
    }
  }

  if (!Array.isArray(screening.lessons)) throw new Error("screening-data 没有 lessons");
  const screeningItems = screening.lessons.map(lesson => {
    if (!/^read-\d+$/.test(lesson.id)) throw new Error(`筛查篇 id 不符合 read-数字：${lesson.id}`);
    const output = `images/screening/${lesson.id}.jpg`;
    const image = inspectImage(output);
    return {
      setId: "screening",
      id: lesson.id,
      title: lesson.title,
      topic: lesson.topic,
      titleZh: titles[lesson.id] || "",
      caption: screeningCaptions[lesson.id] || "",
      output,
      fileName: `${lesson.id}.jpg`,
      present: image.present,
      width: image.width,
      height: image.height,
      brief: null,
      index: GENERATED.screeningMd
    };
  });

  const missing = [...stories, ...screeningItems].filter(item => !item.present).map(item => ({
    setId: item.setId,
    id: item.id,
    title: item.title,
    topic: item.topic,
    caption: item.caption,
    brief: item.brief,
    index: item.index ?? null,
    output: item.output,
    width: editions.imageWidth,
    height: editions.imageHeight
  }));

  const catalog = {
    version: 1,
    imageWidth: editions.imageWidth,
    imageHeight: editions.imageHeight,
    derivedNamesFromSet: editions.derivedNamesFromSet,
    stories: stories.map(stripParagraphs),
    screening: screeningItems
  };
  files.set(GENERATED.catalog, `${JSON.stringify(catalog, null, 2)}\n`);
  files.set(GENERATED.queueJson, `${JSON.stringify({
    imageWidth: editions.imageWidth,
    imageHeight: editions.imageHeight,
    missing
  }, null, 2)}\n`);
  files.set(GENERATED.queueMd, renderQueue(missing, editions, stories.length, screeningItems.length));
  files.set(GENERATED.screeningMd, renderScreeningIndex(screeningItems));

  const dimensionProblems = [...stories, ...screeningItems].filter(item =>
    item.present && (item.width !== editions.imageWidth || item.height !== editions.imageHeight)
  ).map(item => `${item.output} 是 ${item.width}×${item.height}，必须是 ${editions.imageWidth}×${editions.imageHeight}`);

  return { files, catalog, missing, dimensionProblems, editions };
}

function stripParagraphs(story) {
  const { paragraphs, widthRequired, heightRequired, ...rest } = story;
  return rest;
}

export function listBriefFiles() {
  const directory = path.join(repoRoot, "illustrations/briefs");
  if (!fs.existsSync(directory)) return [];
  const found = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) found.push(path.relative(repoRoot, absolute).split(path.sep).join("/"));
    }
  };
  walk(directory);
  return found.sort();
}

export function decidePlacement({ catalog, fileName, setId, replace, destinationExists, width, height }) {
  const expectedWidth = catalog.imageWidth;
  const expectedHeight = catalog.imageHeight;
  const pool = [
    ...catalog.stories,
    ...catalog.screening
  ].filter(item => item.fileName === fileName && (!setId || setId === item.setId));
  if (pool.length === 0) {
    return {
      ok: false,
      code: 1,
      message: `没有名为 ${fileName} 的插画登记。04 及以后的套题请使用「故事 id.jpg」，并且故事要先写进套题。`
    };
  }
  if (pool.length > 1) {
    const sets = pool.map(item => item.setId).join("、");
    return {
      ok: false,
      code: 1,
      message: `文件名 ${fileName} 对应多篇（${sets}）。请加上 --set，例如 --set ${pool[0].setId}。`
    };
  }
  const match = pool[0];
  if (!match.output.startsWith("images/") || match.output.includes("..")) {
    return { ok: false, code: 1, message: `拒绝写到约定路径之外：${match.output}` };
  }
  if (width !== expectedWidth || height !== expectedHeight) {
    return {
      ok: false,
      code: 3,
      message: `尺寸必须是 ${expectedWidth}×${expectedHeight}，这张是 ${width}×${height}。`
    };
  }
  if (destinationExists && !replace) {
    return {
      ok: false,
      code: 2,
      message: `已有图片 ${match.output}。默认不替换。主人点名重画时再加 --replace。`
    };
  }
  return { ok: true, code: 0, message: match.output, output: match.output, setId: match.setId, id: match.id };
}
