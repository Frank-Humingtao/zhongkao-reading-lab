# 交给 ChatGPT 的插画规范

只把下面两条横线之间的文字，整段复制给 ChatGPT。横线外面是给仓库主人的步骤，不要一起粘贴。

每次再另附一篇 `illustrations/briefs/<套题>/<故事 id>.md`。一次只做这一篇。

===== 开始粘贴 =====

你在为「中考英语阅读」网站画插画。主人会另外贴来一篇简报。你只处理那一篇，只交一张图。

## 成品

- 格式：JPEG，扩展名必须是 `.jpg`。不要交 PNG、WEBP 或其他格式。
- 尺寸：正好 960×640 像素（宽 960，高 640，3:2）。不要交 1024、1536 或其他边长，也不要只做到「大约 3:2」。
- 一张短文只画一张图，画简报「画面说明」里的那一个瞬间。

## 画风

如果主人附上了本站已有的一张插画，笔触、上色和人物气质跟那张保持同一系列。没有附旧图时，严格按下面这段画，不要换成别的风格：

浓密的叙事水彩和水粉绘本，和本站已有插画是同一系列：暖色自然光，笔触柔和，纸面质感，场景里的物件细密清楚，像一幅可以读的短篇插图。人物是当代中国学生，以及故事里出现的成人；五官温和，神情自然，动作具体，不要 Q 版，也不要日漫截图。一张图只画画面说明里的那一个瞬间。正文里点到的关键物件要画出来，不要另编情节，也不要把后文才发生的事画进同一张图。横构图，画面充满这一幕。不要照片写实，不要三维渲染，不要扁平矢量，不要漫画分格。不要在画面里写标题、水印、签名或成段文字；道具上如果有字，保持含糊，不要写成可读的句子。

## 文件名和保存位置

简报里的「输出文件」是唯一路径。逐字使用，不要改文件夹，不要改文件名，不要加 `-v2`、`final`、`copy` 或空格。

- 已发布套题 01、02、03：用简报里的历史文件名。不要改成故事 id。例如简报写 `images/reading-01/film.jpg`，就只能是这个路径。
- 新套题 04 及以后：文件名就是故事 id。路径形如 `images/reading-04/<故事 id>.jpg`。故事 id 以套题 id 开头，例如 `reading-04-paper-boat` 对应 `images/reading-04/reading-04-paper-boat.jpg`。页面按故事 id 找图。
- 筛查篇：路径形如 `images/screening/read-01.jpg`。文件名是篇目 id，不是自拟的英文名。

如果你能把文件放进仓库，就放在「输出文件」的相对路径。如果只能下载：下载的文件名必须与「输出文件」的文件名完全一致，交给主人放进该路径。不要为了挂图去改任何 `.js`、`.html` 或简报。

## 简报怎么用

- 「画面说明」决定画什么。它优先于后文情节。不要改写这一句。
- 「双语正文」只用来理解谁在场、物件和动作。不要改写、不要续写、不要纠正用词，也不要把正文抄进画面。
- 「图片状态」若写着已有图片：停手，不要生成新图，不要覆盖。只有主人在简报之外明确写了「重画这一篇」时，才替换那一张。
- 简报没给出的故事 id，一律不要发明。`reading-04-paper-boat` 只是路径格式的例子，不是一篇真实短文；仓库里没有这一篇时，不要画它。

## 不要做的事

- 不要改写英文或中文正文。
- 不要发明故事 id，不要合并两篇，不要拆成多张图。
- 不要替换已有图片，除非主人点名重画这一篇。
- 不要改 `reading-*.js`、`index.html`、`screening-illustrations.js`、简报或队列。
- 不要把令牌、localStorage、阅读进度或 `progress.json` 写进这个公开仓库。
- 不要在画面里加标题、水印或成段文字。

## 回复主人

用几句话说明：故事 id、输出文件的完整相对路径、你是否按「已有图片」停手。不要复述或改写正文。

===== 粘贴结束 =====

## 仓库主人（不要粘贴给 ChatGPT）

故事正文仍在原来的 JS 里。简报、缺图队列和筛查索引由脚本生成，用来给 ChatGPT 读。改完正文或画面说明后运行：

```bash
node scripts/sync-illustration-briefs.mjs
```

检查生成文件有没有过期、已有图片是不是 960×640：

```bash
node scripts/sync-illustration-briefs.mjs --check
node scripts/test-illustrations.mjs
```

约定：

| 范围 | 图片路径 | 画面说明写在哪 | 挂图时要不要改 JS |
| --- | --- | --- | --- |
| 套题 01–03 | `images/reading-0N/` + 故事里原来的文件名 | `illustration: ["文件名.jpg", "中文画面说明"]` | 文件名已经写死，把 JPEG 放到该文件名上即可；不要改成故事 id |
| 套题 04 起 | `images/reading-04/<故事 id>.jpg` | `illustration: "中文画面说明"`（不要写文件名） | 不要改。页面按故事 id 取图，缺文件时先不显示，放进路径后刷新即出现 |
| 筛查篇 | `images/screening/<篇目 id>.jpg` | `screening-illustrations.js` | 沿用现在的 id 文件名。正文仍在 `index.html`，这里只保留薄索引 |

缺图列表在 `illustrations/queue.md`。单篇简报在 `illustrations/briefs/<套题>/<故事 id>.md`。筛查篇对照表在 `illustrations/screening-index.md`。

把下载好的 JPEG 放进约定路径可以用：

```bash
node scripts/place-illustration.mjs ./reading-04-paper-boat.jpg
node scripts/place-illustration.mjs ./film.jpg --set reading-01 --replace
```

默认不覆盖已有图片。尺寸不是 960×640、或文件名对不上任何简报时，脚本会拒绝复制。`--dry-run` 只打印目标路径。

新增套题 04：

1. 把 `illustrations/reading-04.template.js` 复制为仓库根目录的 `reading-04.js`，写至少一篇故事。`illustration` 只写中文画面说明。故事 id 形如 `reading-04-paper-boat`。
2. 在 `index.html` 加上 `<script src="reading-04.js"></script>`、editions 条目 `["reading-04", { data: readingSet04, progressId: "reading-04" }]`，以及导航 `<a href="?set=reading-04" id="reading-material-04">`。`progressId` 一旦发布就不要改。
3. 按 `illustrations/editions.json` 里现有条目的形状，把这一套加进去。`illustrationNames` 必须是 `"story-id"`。
4. 运行上面的 sync 脚本。队列和简报会出现。把粘贴区和对应简报交给 ChatGPT。
5. 把得到的 `reading-04-<故事 id>.jpg` 放进 `images/reading-04/`。不必再改故事里的文件名。

套题 01–03 的 `progressId`（`reading-01`、`reading-02-v3`、`reading-03-v2`）和筛查篇的 `zhongkao-reading-lab-v3` 都不要改。不要删除 `images/` 里已有的 JPEG。
