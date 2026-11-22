// 生词 rules shared by the board (vocab.html) and scripts/daily-words.mjs.
// No DOM, no network: callers pass in progress records, so the board and the
// daily 墨墨 export always agree on which words are current and on which day.
//
// A mark record is [clock, writer, value]: an integer value is the chosen example
// sentence (the word is a current 生词), null means the mark was cleared.
// A word's day is the Beijing calendar day of its earliest current mark across all
// sets. Clock 0 means the mark predates sync, so it has no reliable day.
// Words are grouped and shown by their base form (原型, see base-form.js).

import { baseForm } from "./base-form.js";

export { baseForm };

export const TOKEN_KEY = "zhongkao-github-sync-token-v1";
export const PROGRESS_API = "https://api.github.com/repos/Frank-Humingtao/zhongkao-reading-progress/contents/";
export const PRESYNC_LABEL = "更早";

export const VOCAB_SOURCES = [
  {
    id: "screening",
    label: "筛选",
    file: "progress.json",
    progressKey: "zhongkao-reading-lab-v3",
    recordsKey: "zhongkao-github-sync-records-v1"
  },
  {
    id: "reading-01",
    label: "01",
    file: "progress-reading-01.json",
    progressKey: "zhongkao-reading-lab-reading-01",
    recordsKey: "zhongkao-github-sync-records-reading-01-v1"
  },
  {
    id: "reading-02-v3",
    label: "02",
    file: "progress-reading-02-v3.json",
    progressKey: "zhongkao-reading-lab-reading-02-v3",
    recordsKey: "zhongkao-github-sync-records-reading-02-v3-v1"
  },
  {
    id: "reading-02-v2",
    label: "02",
    file: "progress-reading-02-v2.json",
    progressKey: "zhongkao-reading-lab-reading-02-v2",
    recordsKey: "zhongkao-github-sync-records-reading-02-v2-v1"
  },
  {
    id: "reading-02",
    label: "02",
    file: "progress-reading-02.json",
    progressKey: "zhongkao-reading-lab-reading-02",
    recordsKey: "zhongkao-github-sync-records-reading-02-v1"
  },
  {
    id: "reading-03",
    label: "03",
    file: "progress-reading-03.json",
    progressKey: "zhongkao-reading-lab-reading-03",
    recordsKey: "zhongkao-github-sync-records-reading-03-v1"
  },
  {
    id: "reading-03-v2",
    label: "03",
    file: "progress-reading-03-v2.json",
    progressKey: "zhongkao-reading-lab-reading-03-v2",
    recordsKey: "zhongkao-github-sync-records-reading-03-v2-v1"
  },
  {
    id: "reading-04",
    label: "04",
    file: "progress-reading-04.json",
    progressKey: "zhongkao-reading-lab-reading-04",
    recordsKey: "zhongkao-github-sync-records-reading-04-v1"
  },
  {
    id: "daily-news-01",
    label: "daily news 01",
    file: "progress-daily-news-01.json",
    progressKey: "zhongkao-reading-lab-daily-news-01",
    recordsKey: "zhongkao-github-sync-records-daily-news-01-v1"
  }
];

const VISITOR_NOTE = "还没有生词";
const EMPTY_NOTE = "还没有生词";
const SYNCING_NOTE = "正在同步…";

export function decodeRecords(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
  const records = raw.version === 1 && raw.records && typeof raw.records === "object" && !Array.isArray(raw.records)
    ? raw.records
    : raw;
  return new Map(Object.entries(records).filter(([, record]) => validRecord(record)));
}

function validRecord(record) {
  return Array.isArray(record) && record.length === 3
    && Number.isSafeInteger(record[0]) && record[0] >= 0
    && typeof record[1] === "string";
}

export function mergeRecords(left, right) {
  const merged = left instanceof Map ? new Map(left) : decodeRecords(left);
  const incoming = right instanceof Map ? right : decodeRecords(right);
  for (const [field, record] of incoming) {
    if (!validRecord(record)) continue;
    const existing = merged.get(field);
    if (!existing || record[0] > existing[0]
      || (record[0] === existing[0] && record[1] > existing[1])) {
      merged.set(field, record);
    }
  }
  return merged;
}

export function decodeGithubContent(content) {
  let data;
  try {
    const binary = atob(String(content).replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("invalid progress file");
  }
  if (!data || data.version !== 1 || !data.records || typeof data.records !== "object" || Array.isArray(data.records)) {
    throw new Error("invalid progress file");
  }
  return decodeRecords(data.records);
}

export function shanghaiDateKey(timestamp) {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const value = type => parts.find(part => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function formatShanghaiDate(key) {
  const [year, month, day] = key.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function parseMark(field, record) {
  if (typeof field !== "string" || !validRecord(record)) return null;
  const parts = field.split("/");
  if (parts.length !== 3 || parts[0] !== "mark" || !parts[1] || !parts[2]) return null;
  const value = record[2];
  if (value !== null && !(Number.isInteger(value) && value >= 0)) return null;
  return { lessonId: parts[1], word: parts[2], timestamp: record[0], value };
}

function acceptWord(word) {
  return typeof word === "string" && word.trim() !== "";
}

// Every current integer mark, including the same word in more than one lesson.
export function currentMarkList(progress, records) {
  const recordMap = records instanceof Map ? records : decodeRecords(records);
  const listed = [];
  for (const [field, record] of recordMap) {
    const parsed = parseMark(field, record);
    if (!parsed || parsed.value === null || !acceptWord(parsed.word)) continue;
    listed.push({
      word: parsed.word,
      timestamp: parsed.timestamp,
      lessonId: parsed.lessonId,
      exampleIndex: parsed.value
    });
  }
  const lessons = progress && typeof progress === "object" && !Array.isArray(progress) ? progress.marks : null;
  if (lessons && typeof lessons === "object" && !Array.isArray(lessons)) {
    for (const [lessonId, pairs] of Object.entries(lessons)) {
      if (typeof lessonId !== "string" || !lessonId || lessonId.includes("/") || !Array.isArray(pairs)) continue;
      for (const pair of pairs) {
        if (!Array.isArray(pair) || !acceptWord(pair[0]) || !Number.isInteger(pair[1]) || pair[1] < 0) continue;
        if (recordMap.has(`mark/${lessonId}/${pair[0]}`)) continue;
        listed.push({ word: pair[0], timestamp: 0, lessonId, exampleIndex: pair[1] });
      }
    }
  }
  return listed;
}

// Current 生词 in one set. An integer value (including 0) is a mark; null is cleared.
// A missing sync record falls back to local progress with timestamp 0 (较早/同步前).
export function currentMarks(progress, records) {
  const best = new Map();
  for (const mark of currentMarkList(progress, records)) {
    const id = mark.word.toLocaleLowerCase("en");
    const previous = best.get(id);
    if (!previous || mark.timestamp < previous.timestamp) best.set(id, { word: mark.word, timestamp: mark.timestamp });
  }
  return best;
}

function glossFor(source, word) {
  const table = source.glosses;
  if (!table || typeof word !== "string") return null;
  return table[word] || table[word.toLocaleLowerCase("en")] || null;
}

export function presentDetails(details) {
  const unique = [];
  const seen = new Set();
  for (const detail of details) {
    const key = [detail.meaning, detail.sentence, detail.chinese, detail.surface].join("\0");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(detail);
  }
  return unique.map(detail => ({ ...detail, showSource: unique.length > 1 }));
}

export function dayCopyText(words) {
  return words.map(word => word.word).join("\n");
}

function wordId(word, known) {
  return baseForm(word, known).toLocaleLowerCase("en");
}

function detailFor(source, mark) {
  const gloss = glossFor(source, mark.word);
  return {
    sourceId: source.id || "",
    source: source.label,
    lessonId: mark.lessonId,
    exampleIndex: mark.exampleIndex,
    word: mark.word,
    timestamp: mark.timestamp,
    meaning: gloss?.meaning ?? "",
    sentence: gloss?.sentence ?? "",
    chinese: gloss?.chinese ?? "",
    surface: gloss?.surface ?? mark.word,
    offset: Number.isInteger(gloss?.offset) ? gloss.offset : -1
  };
}

// All current marks of every set, grouped by base form. Each word keeps every mark
// (one per article it is marked in) and the earliest mark's time.
function collectWords(sources, known) {
  const byWord = new Map();
  for (const source of sources) {
    for (const mark of currentMarkList(source.progress, source.records)) {
      const id = wordId(mark.word, known);
      let entry = byWord.get(id);
      if (!entry) {
        entry = { word: baseForm(mark.word, known), firstTimestamp: mark.timestamp, sources: [], details: [] };
        byWord.set(id, entry);
      } else if (mark.timestamp < entry.firstTimestamp) {
        entry.firstTimestamp = mark.timestamp;
        entry.word = baseForm(mark.word, known);
      }
      if (!entry.sources.includes(source.label)) entry.sources.push(source.label);
      entry.details.push(detailFor(source, mark));
    }
  }
  return byWord;
}

const byWordName = (left, right) => left.word.localeCompare(right.word, "en", { sensitivity: "base" });

export function aggregateVocab(sources, { known = null } = {}) {
  const byWord = collectWords(sources, known);
  const words = [...byWord.values()].sort(byWordName);
  const grouped = new Map();
  for (const word of words) {
    const key = shanghaiDateKey(word.firstTimestamp) ?? "";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(word);
  }
  const days = [...grouped.keys()].sort((left, right) => {
    if (left === "") return 1;
    if (right === "") return -1;
    return right.localeCompare(left);
  }).map(key => ({
    key: key || "presync",
    label: key ? formatShanghaiDate(key) : PRESYNC_LABEL,
    words: grouped.get(key)
  }));
  return { count: words.length, words, days };
}

export function syncErrorMessage(status) {
  if (status === 401) return "令牌已失效，请断开后重新连接。";
  if (status === 403) return "请检查令牌是否能读写私有进度仓库。";
  return "同步失败（GitHub " + status + "），进度已保留在设备上。";
}

export function hasVocabPayload(progress, records) {
  const recordMap = records instanceof Map ? records : decodeRecords(records);
  if (recordMap.size > 0) return true;
  const lessons = progress && typeof progress === "object" && !Array.isArray(progress) ? progress.marks : null;
  if (!lessons || typeof lessons !== "object" || Array.isArray(lessons)) return false;
  return Object.values(lessons).some(pairs => Array.isArray(pairs) && pairs.some(pair =>
    Array.isArray(pair) && typeof pair[0] === "string" && Number.isInteger(pair[1]) && pair[1] >= 0
  ));
}

export function isDemoSearch(search) {
  return new URLSearchParams(search).get("demo") === "1";
}

function demoGloss(meaning, sentence, chinese, surface) {
  const offset = sentence.toLowerCase().indexOf(surface.toLowerCase());
  return { meaning, sentence, chinese, surface, offset };
}

// Fictional preview only. These words are not reading progress.
export function demoSources() {
  const nov18 = Date.parse("2026-11-17T16:00:00.000Z");
  const nov19 = Date.parse("2026-11-18T16:00:00.000Z");
  const nov20 = Date.parse("2026-11-19T16:00:00.000Z");
  const writer = "demo";
  return [
    {
      id: "screening",
      label: "筛选",
      progress: null,
      glosses: {
        glowbug: demoGloss("萤火虫", "A tiny glowbug rested on the notebook.", "一只小萤火虫停在笔记本上。", "glowbug"),
        paperfox: demoGloss("纸狐狸", "The paperfox wore a red scarf in the story.", "故事里的纸狐狸围着红围巾。", "paperfox")
      },
      records: {
        "mark/preview/glowbug": [0, writer, 1],
        "mark/preview/paperfox": [0, writer, 0],
        "mark/preview/dustnote": [nov20, writer, null]
      }
    },
    {
      id: "reading-01",
      label: "01",
      progress: null,
      glosses: {
        paperfox: demoGloss("纸狐狸", "The paperfox wore a red scarf in the story.", "故事里的纸狐狸围着红围巾。", "paperfox"),
        moonpear: demoGloss("月亮梨", "She saved the moonpear for the last bite.", "她把月亮梨留到最后一口。", "moonpear")
      },
      records: {
        "mark/preview/paperfox": [nov20, writer, 1],
        "mark/preview/moonpear": [nov19, writer, 2]
      }
    },
    {
      id: "reading-02-v2",
      label: "02",
      progress: null,
      glosses: {
        riverbell: demoGloss("河铃", "A riverbell rang when the boat reached the dock.", "船靠码头时，河铃响了。", "riverbell")
      },
      records: {
        "mark/preview/riverbell": [nov18, writer, 0]
      }
    },
    {
      id: "reading-02-v3",
      label: "02",
      progress: null,
      glosses: {
        riverbell: demoGloss("河铃", "The second riverbell was quieter than the first.", "第二只河铃比第一只更轻。", "riverbell"),
        cloudmint: demoGloss("云薄荷", "He tasted cloudmint in the cold tea.", "他在凉茶里尝到了云薄荷。", "cloudmint")
      },
      records: {
        "mark/preview/riverbell": [nov20, writer, 1],
        "mark/preview/cloudmint": [nov20, writer, 0]
      }
    },
    {
      id: "reading-03",
      label: "03",
      progress: null,
      glosses: {
        velvetkey: demoGloss("丝绒钥匙", "The velvetkey opened a quiet blue door.", "丝绒钥匙打开了一扇安静的蓝门。", "velvetkey")
      },
      records: {
        "mark/preview/velvetkey": [nov20, writer, 1]
      }
    }
  ];
}

export function emptyNote({ syncing, hasToken, hasStoredPayload }) {
  if (syncing) return SYNCING_NOTE;
  if (!hasToken && !hasStoredPayload) return VISITOR_NOTE;
  return EMPTY_NOTE;
}

// Words whose first current mark falls on dateKey ("YYYY-MM-DD", Beijing time).
// This is the list the daily 墨墨 export adds; pre-sync words never belong to a day.
export function wordsForDay(sources, dateKey, options) {
  const day = aggregateVocab(sources, options).days.find(item => item.key === dateKey);
  return day ? day.words : [];
}

// Every word marked in any article between fromKey and toKey (Beijing days, inclusive),
// counted once per base form. Unlike wordsForDay, an old word marked again in a new
// article counts too: each article's mark has its own time. `details` holds only the
// marks inside the range; `firstDay` is the word's earliest mark anywhere (null if that
// predates sync) and `repeat` says it was already marked before the range.
// A mark's time is its last change, so clearing and re-marking (or picking another
// example) in the same article moves it to the later day. Pre-sync marks have no day.
export function wordsInRange(sources, fromKey, toKey = fromKey, { known = null } = {}) {
  const words = [];
  for (const entry of collectWords(sources, known).values()) {
    const inRange = entry.details.filter(detail => {
      const key = shanghaiDateKey(detail.timestamp);
      return key !== null && key >= fromKey && key <= toKey;
    });
    if (!inRange.length) continue;
    const firstDay = shanghaiDateKey(entry.firstTimestamp);
    words.push({
      word: entry.word,
      firstDay,
      repeat: firstDay === null || firstDay < fromKey,
      sources: [...new Set(inRange.map(detail => detail.source))],
      details: inRange
    });
  }
  return words.sort(byWordName);
}

export function previousShanghaiDay(now = Date.now()) {
  return shanghaiDateKey(now - 24 * 60 * 60 * 1000);
}
