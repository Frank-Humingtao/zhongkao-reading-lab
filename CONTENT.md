# 内容投放说明（给写文 agent 和配图 agent）

这个仓库是一个英语阅读网站。你的工作只有一件事：**生成内容，放到指定位置，上传。**
不需要读代码，也不要改代码。网站、生词板、导航、朗读音轨都会根据你放的内容自动更新。

## 你能动的文件

| 谁 | 能新建或修改 | 内容 |
|---|---|---|
| 写文 agent | `content/review-年-月-日.json` | 一批生词复现文章 |
| 写文 agent | `content/index.json` | 在末尾登记一行 |
| 配图 agent | `images/review-年-月-日/<篇 id>.jpg` | 每篇一张图 |

**除此之外的任何文件都不要动**，包括 `.js`、`.html`、`.css`、`.mjs`、测试文件，以及别人写的内容。
如果你觉得必须改别的文件才能完成任务，停下来，把原因告诉主人。

## 写文 agent：发布一批生词复现

### 1. 拿到生词

用你自己的方法拿到主人最近的生词（例如 `node scripts/daily-words.mjs --from 2026-11-22 --json`，需要进度仓库的令牌）。
生词够了，或者隔了两天，就写一批。

### 2. 新建这一批的文件

文件名用今天的日期（北京时间）：`content/review-2026-11-24.json`。这个名字去掉 `.json`，就是这一批的 **id**。

```json
{
  "words": {
    "lamp": ["台灯；灯", "lamps"],
    "borrow": ["借（入）", "borrowed", "borrowing"],
    "pick up": ["捡起；接（某人）"]
  },
  "stories": [
    {
      "id": "review-2026-11-24-01",
      "title": "The Borrowed Lamp",
      "topic": "借来的台灯",
      "picture": "夜里的小书桌上，一盏旧台灯照着摊开的作业本，窗外是城市的灯光。",
      "paragraphs": [
        [
          ["Mia borrowed a lamp from her neighbour.", "米娅从邻居那里借了一盏台灯。"],
          ["It was old, but the light was warm.", "它很旧，但灯光很温暖。"]
        ],
        [
          ["She picked up her pen and began to write.", "她拿起笔，开始写字。"]
        ]
      ]
    }
  ]
}
```

| 字段 | 必填 | 写什么 |
|---|---|---|
| `words` | 是 | 这一批要复现的生词。键是英文原型（可以是词组），值是 `["中文释义", 变形1, 变形2, …]`，变形是文章里出现的其他写法 |
| `stories` | 是 | 这一批的文章，按阅读顺序排 |
| `id` | 是 | `批 id-两位序号`：`review-2026-11-24-01`、`review-2026-11-24-02`……只用小写字母、数字和连字符 |
| `title` | 是 | 英文标题 |
| `topic` | 是 | 中文标题，显示在目录里 |
| `picture` | 是 | 一句中文画面描述。配图 agent 照它画图，它也是图片的说明文字。写清楚场景、人物和动作 |
| `paragraphs` | 是 | 段落的数组；每段是句对的数组；每个句对是 `["一句英文", "这句的中文翻译"]` |

写作规则：

- **一句英文对应一句中文**，不要把两句英文放进一个句对。
- 英文句子里不能出现中文。需要提示时，只能在单词后面加全角括号注释，例如 `spacecraft（航天器）`。这种注释会显示在页面上，但不会被朗读。
- 不要写 `image` 字段，图片的文件名会根据篇 id 自动对应。
- 文件必须是合法的 JSON：用双引号，最后一项后面不要加逗号。

### 3. 登记

打开 `content/index.json`，在 `collections` 数组的**最后**加一行，注意给上一行末尾补上逗号：

```json
    {"id": "review-2026-11-24", "kind": "review"}
```

### 4. 检查

```bash
node scripts/check-content.mjs
```

- 看到 `✓ 内容检查通过` 才能上传。
- 看到 `✗` 时，每一条都会写明是哪个文件、第几篇、第几段第几句、哪个字段出了问题，照着改，然后再运行一次。
- 它说“还有 N 张图没画”是正常的，配图 agent 会补上。

### 5. 上传

```bash
git add content/
git commit -m "Add review 2026-11-24"
git pull --rebase
git push
```

直接推到 `main`，不需要开 PR。推送后：

- 网站在一两分钟内就能看到这一批。
- GitHub 会再做一次检查（Actions 里的 **Content check**）。如果它变红，打开那次运行，摘要里写着要改什么，改好后再推一次。
- 朗读音轨由 GitHub 自动生成，你不用管。

### 修改已经发布的批

发现错误可以直接改自己写的批，改完同样要检查、上传。

已经发布的文章，**没有必要就不要改英文原句**：主人可能已经在这些句子里标了生词，改动句子可能让标记挪到别处。改错别字、改中文翻译、改画面描述都没有影响。

## 配图 agent：给文章配图

### 1. 找出要画的图

先拉取最新的 `main`，然后运行：

```bash
node scripts/check-content.mjs --pictures
```

它会列出所有“有画面描述、但还没有图”的文章：

```json
[
 {
  "collection": "review-2026-11-24",
  "story": "review-2026-11-24-01",
  "file": "images/review-2026-11-24/review-2026-11-24-01.jpg",
  "description": "夜里的小书桌上，一盏旧台灯照着摊开的作业本，窗外是城市的灯光。"
 }
]
```

如果列表是 `[]`，说明没有要画的图，结束。

（没法运行 node 时也可以手动找：看 `content/index.json` 里每个 `review-…` 批，打开对应的 `content/<批 id>.json`，凡是有 `picture` 但 `images/<批 id>/<篇 id>.jpg` 还不存在的，就是要画的。）

### 2. 画图

- 照 `description` 画。风格和网站已有的插图保持一致，可以参考 `images/reading-04/` 里的图：细致、偏写实的暖色调插画，光线柔和，画面里不要出现文字。
- 横版 3:2，存成 **960×640 的 jpg**，大小不超过 1.5 MB。
- 保存到列表里 `file` 写的路径，**文件名一个字都不能改**。文件夹不存在就新建。

### 3. 检查并上传

```bash
node scripts/check-content.mjs
git add images/
git commit -m "Add pictures for review 2026-11-24"
git pull --rebase
git push
```

只提交 `images/` 下的图片，**不要修改任何 `.json` 文件**。图片推上去以后，页面会自动显示出来。

## 其他内容

- 摸底短文（Placement）和新闻（News）目前不走这个流程，不要改它们的文件。
- 词汇表和这些名字的含义见 `GLOSSARY.md` 的 Reading material 和 Publishing 两节。
