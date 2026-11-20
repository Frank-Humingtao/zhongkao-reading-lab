// Aggregates private reading marks for the 生词 board.
// Reads localStorage and, when a token is already saved, the private progress repo.
// The demo preview below is fictional and stays in memory. It is never stored or synced.

import { EDITION_SCRIPTS, buildCatalog, editionFromSource, embeddedJson } from "./vocab-context.js";

export const TOKEN_KEY = "zhongkao-github-sync-token-v1";
export const PROGRESS_API = "https://api.github.com/repos/Frank-Humingtao/zhongkao-reading-progress/contents/";
export const PRESYNC_LABEL = "较早/同步前";

export const VOCAB_SOURCES = [
  {
    id: "screening",
    label: "标词",
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
    label: "02 v3",
    file: "progress-reading-02-v3.json",
    progressKey: "zhongkao-reading-lab-reading-02-v3",
    recordsKey: "zhongkao-github-sync-records-reading-02-v3-v1"
  },
  {
    id: "reading-02-v2",
    label: "02 v2",
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
    label: "03 v2",
    file: "progress-reading-03-v2.json",
    progressKey: "zhongkao-reading-lab-reading-03-v2",
    recordsKey: "zhongkao-github-sync-records-reading-03-v2-v1"
  }
];

const VISITOR_NOTE = "这里还没有生词。请使用本站已有的 GitHub 同步，或在此浏览器中打开已保存的本地进度。";
const EMPTY_NOTE = "当前没有生词。";
const SYNCING_NOTE = "正在从 GitHub 读取进度…";

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

export function aggregateVocab(sources) {
  const byWord = new Map();
  for (const source of sources) {
    const grouped = new Map();
    for (const mark of currentMarkList(source.progress, source.records)) {
      const id = mark.word.toLocaleLowerCase("en");
      let group = grouped.get(id);
      if (!group) {
        group = { word: mark.word, timestamp: mark.timestamp, marks: [] };
        grouped.set(id, group);
      } else if (mark.timestamp < group.timestamp) {
        group.timestamp = mark.timestamp;
        group.word = mark.word;
      }
      group.marks.push(mark);
    }
    for (const [id, group] of grouped) {
      let entry = byWord.get(id);
      if (!entry) {
        entry = { word: group.word, firstTimestamp: group.timestamp, sources: [], details: [] };
        byWord.set(id, entry);
      } else if (group.timestamp < entry.firstTimestamp) {
        entry.firstTimestamp = group.timestamp;
        entry.word = group.word;
      }
      entry.sources.push(source.label);
      for (const mark of group.marks) {
        const gloss = glossFor(source, mark.word);
        entry.details.push({
          sourceId: source.id || "",
          source: source.label,
          lessonId: mark.lessonId,
          exampleIndex: mark.exampleIndex,
          word: mark.word,
          meaning: gloss?.meaning ?? "",
          sentence: gloss?.sentence ?? "",
          chinese: gloss?.chinese ?? "",
          surface: gloss?.surface ?? mark.word,
          offset: Number.isInteger(gloss?.offset) ? gloss.offset : -1
        });
      }
    }
  }
  const words = [...byWord.values()].sort((left, right) =>
    left.word.localeCompare(right.word, "en", { sensitivity: "base" })
  );
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
      label: "标词",
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
      label: "02 v2",
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
      label: "02 v3",
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

async function loadLessonCatalog() {
  const response = await fetch("index.html", { cache: "no-store" });
  if (!response.ok) return null;
  const html = await response.text();
  const editions = {};
  await Promise.all(EDITION_SCRIPTS.map(async ([id, file, binding]) => {
    try {
      const fileResponse = await fetch(file);
      if (!fileResponse.ok) return;
      editions[id] = editionFromSource(await fileResponse.text(), binding);
    } catch {
      // A missing historical set still leaves the word and its source.
    }
  }));
  return buildCatalog({
    screening: embeddedJson(html, "screening-data"),
    bilingual: embeddedJson(html, "bilingual-text") || {},
    extraMeanings: embeddedJson(html, "supplemental-meanings") || {},
    trialLessons: embeddedJson(html, "lesson-data") || [],
    trialGlossary: embeddedJson(html, "new-glossary"),
    editions
  });
}

function readJson(key) {
  try {
    const text = localStorage.getItem(key);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function boot() {
  const demoMode = isDemoSearch(location.search);
  const recordOverlays = new Map();
  let githubToken = "";
  let syncing = false;
  let storageFailed = false;
  let syncGeneration = 0;
  let syncTask = null;
  const statusNodes = ["board-status", "sync-status"].map(id => document.getElementById(id));
  const dayList = document.getElementById("day-list");
  const empty = document.getElementById("empty-note");
  const emptyText = document.getElementById("empty-text");
  const demoEntry = document.getElementById("demo-entry");
  const demoBanner = document.getElementById("demo-banner");
  const count = document.getElementById("word-count");

  try {
    githubToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    githubToken = "";
  }

  function setStatus(text) {
    for (const node of statusNodes) {
      if (node) node.textContent = text;
    }
  }

  function recordsFor(source) {
    if (recordOverlays.has(source.recordsKey)) return recordOverlays.get(source.recordsKey);
    return readJson(source.recordsKey);
  }

  function rememberRecords(source, records) {
    if (demoMode) return;
    recordOverlays.set(source.recordsKey, records);
    try {
      localStorage.setItem(source.recordsKey, JSON.stringify(Object.fromEntries(records)));
    } catch {
      storageFailed = true;
    }
  }

  function hasStoredPayload() {
    if ([...recordOverlays.values()].some(records => records.size > 0)) return true;
    try {
      return VOCAB_SOURCES.some(source => hasVocabPayload(readJson(source.progressKey), readJson(source.recordsKey)));
    } catch {
      return false;
    }
  }

  function loadSources() {
    return VOCAB_SOURCES.map(source => ({
      id: source.id,
      label: source.label,
      progress: readJson(source.progressKey),
      records: recordsFor(source)
    }));
  }

  let catalog = null;
  let catalogTask = null;
  let currentPronunciation;

  function resolvedDetail(detail) {
    if (detail.sentence || demoMode || !catalog) return detail;
    const found = catalog.lookup(detail.sourceId, detail.lessonId, detail.word, detail.exampleIndex);
    if (!found) return detail;
    return {
      ...detail,
      display: found.display,
      meaning: found.meaning,
      sentence: found.sentence,
      chinese: found.chinese,
      surface: found.surface,
      offset: found.offset
    };
  }

  function ensureCatalog() {
    if (demoMode || catalogTask) return;
    catalogTask = loadLessonCatalog().then(loaded => {
      catalog = loaded;
      render();
    }).catch(() => {
      catalogTask = null;
    });
  }

  function pronounceWord(surface, button, status) {
    const speech = window.speechSynthesis;
    status.textContent = "";
    if (!speech || typeof window.SpeechSynthesisUtterance !== "function") {
      status.textContent = "当前浏览器无法播放发音。";
      return;
    }
    currentPronunciation?.button.classList.remove("speaking");
    currentPronunciation = undefined;
    if (speech.speaking || speech.pending) speech.cancel();
    const utterance = new window.SpeechSynthesisUtterance(surface);
    const english = speech.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
    const american = voice => /^en[-_]us$/i.test(voice.lang);
    const voice = english.find(item => item.localService && american(item))
      ?? english.find(item => item.localService) ?? english.find(american) ?? english[0];
    utterance.lang = voice?.lang ?? "en-US";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    currentPronunciation = { utterance, button };
    button.classList.add("speaking");
    function finish(error) {
      if (currentPronunciation?.utterance !== utterance) return;
      button.classList.remove("speaking");
      currentPronunciation = undefined;
      if (error && button.isConnected && !["canceled", "interrupted"].includes(error)) {
        status.textContent = "暂时无法播放英语发音。";
      }
    }
    utterance.addEventListener("end", () => finish());
    utterance.addEventListener("error", event => finish(event.error));
    try {
      speech.speak(utterance);
    } catch {
      finish("synthesis-failed");
    }
  }

  function appendSentence(parent, sentence, surface, offset) {
    parent.lang = "en";
    parent.className = "example";
    if (!sentence) {
      parent.textContent = "—";
      return;
    }
    const start = Number.isInteger(offset) && offset >= 0 ? offset : sentence.toLowerCase().indexOf(String(surface).toLowerCase());
    const length = surface ? String(surface).length : 0;
    if (start < 0 || !length || start + length > sentence.length) {
      parent.textContent = sentence;
      return;
    }
    const mark = document.createElement("mark");
    mark.textContent = sentence.slice(start, start + length);
    parent.append(sentence.slice(0, start), mark, sentence.slice(start + length));
  }

  function renderMark(entry) {
    const details = presentDetails((entry.details || []).map(resolvedDetail));
    const item = document.createElement("li");
    item.className = "mark";
    const head = document.createElement("div");
    head.className = "mark-head";
    const term = document.createElement("span");
    term.className = "term";
    term.lang = "en";
    term.textContent = details.find(detail => detail.display)?.display || entry.word;
    const sources = document.createElement("span");
    sources.className = "sources";
    sources.textContent = "来自" + entry.sources.join("、");
    const speak = document.createElement("button");
    speak.type = "button";
    speak.className = "action speak";
    speak.textContent = "播放发音";
    const spoken = details.find(detail => detail.surface)?.surface || term.textContent;
    speak.setAttribute("aria-label", "播放发音 " + spoken);
    const speakStatus = document.createElement("p");
    speakStatus.className = "feedback speak-status";
    speakStatus.setAttribute("role", "status");
    speak.addEventListener("click", () => pronounceWord(spoken, speak, speakStatus));
    head.append(term, sources, speak, speakStatus);
    item.append(head);
    const blocks = details.length ? details : [{ meaning: "", sentence: "", chinese: "", surface: entry.word, showSource: false }];
    for (const detail of blocks) {
      const block = document.createElement("div");
      block.className = "detail";
      if (detail.showSource) {
        const where = document.createElement("p");
        where.className = "detail-source";
        where.textContent = detail.source;
        block.append(where);
      }
      const meaning = document.createElement("p");
      meaning.className = "meaning";
      const meaningLabel = document.createElement("span");
      meaningLabel.className = "field-label";
      meaningLabel.textContent = "词义";
      meaning.append(meaningLabel, " " + (detail.meaning || "—"));
      const exampleLabel = document.createElement("p");
      exampleLabel.className = "field-label";
      exampleLabel.textContent = "原句";
      const example = document.createElement("p");
      appendSentence(example, detail.sentence, detail.surface, detail.offset);
      block.append(meaning, exampleLabel, example);
      if (detail.sentence || detail.chinese) {
        const translation = document.createElement("p");
        translation.className = "translation";
        translation.textContent = detail.chinese || "暂无中文释义";
        block.append(translation);
      }
      item.append(block);
    }
    return item;
  }

  async function copyDay(words, feedback, fallback) {
    const text = [...words].map(item => item.querySelector(".term").textContent).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      feedback.textContent = "已复制";
    } catch {
      fallback.hidden = false;
      fallback.value = text;
      feedback.textContent = "按 Ctrl+C 复制";
      fallback.focus();
      fallback.select();
    }
  }

  function render() {
    const state = aggregateVocab(demoMode ? demoSources() : loadSources());
    count.textContent = state.count ? "共 " + state.count + " 个" : "0";
    empty.hidden = demoMode || state.count !== 0;
    demoBanner.hidden = !demoMode;
    if (demoEntry) demoEntry.hidden = demoMode || state.count !== 0;
    if (!demoMode && state.count === 0 && emptyText) {
      emptyText.textContent = emptyNote({ syncing, hasToken: Boolean(githubToken), hasStoredPayload: hasStoredPayload() });
    }
    dayList.replaceChildren(...state.days.map(day => {
      const block = document.createElement("section");
      block.className = "day-block";
      const head = document.createElement("div");
      head.className = "day-head";
      const heading = document.createElement("h3");
      heading.textContent = day.label;
      const amount = document.createElement("span");
      amount.className = "day-count";
      amount.textContent = day.words.length + " 个";
      heading.append(amount);
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "action day-copy";
      copy.textContent = "复制";
      const feedback = document.createElement("p");
      feedback.className = "feedback day-feedback";
      feedback.setAttribute("role", "status");
      const fallback = document.createElement("textarea");
      fallback.className = "copy-text";
      fallback.readOnly = true;
      fallback.hidden = true;
      fallback.setAttribute("aria-label", day.label + " 的生词");
      const list = document.createElement("ul");
      list.className = "word-list";
      list.append(...day.words.map(renderMark));
      copy.addEventListener("click", () => copyDay(list.children, feedback, fallback));
      head.append(heading, copy, feedback);
      block.append(head, fallback, list);
      return block;
    }));
    if (!demoMode && state.count) ensureCatalog();
  }

  function showConnection() {
    const connected = Boolean(githubToken);
    document.getElementById("sync-form").hidden = connected;
    document.getElementById("sync-actions").hidden = !connected;
  }

  async function fetchRemoteRecords(token, file) {
    let response;
    try {
      response = await fetch(PROGRESS_API + file, {
        headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout?.(15000)
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error instanceof TypeError) {
        throw new Error("暂时连不上 GitHub，已显示此设备上的进度。");
      }
      throw new Error("同步失败，进度已保留在设备上。");
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(syncErrorMessage(response.status));
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("invalid progress file");
    }
    if (!payload?.content) return null;
    return decodeGithubContent(payload.content);
  }

  async function syncAll() {
    const token = githubToken;
    const generation = ++syncGeneration;
    if (!token) return;
    syncing = true;
    setStatus("正在同步…");
    render();
    const failures = [];
    let invalid = false;
    await Promise.all(VOCAB_SOURCES.map(async source => {
      try {
        const remote = await fetchRemoteRecords(token, source.file);
        if (!remote || token !== githubToken || generation !== syncGeneration) return;
        rememberRecords(source, mergeRecords(recordsFor(source), remote));
      } catch (error) {
        if (error?.message === "invalid progress file") invalid = true;
        else failures.push(error);
      }
    }));
    if (token !== githubToken || generation !== syncGeneration) {
      syncing = false;
      return;
    }
    syncing = false;
    render();
    const auth = failures.find(error => error.message.includes("令牌已失效"));
    const denied = failures.find(error => error.message.includes("读写私有进度仓库"));
    let message = "已同步";
    if (auth) message = auth.message;
    else if (denied) message = denied.message;
    else if (failures.length) message = failures[0].message;
    else if (invalid) message = "有进度文件格式不正确，已跳过。";
    if (storageFailed) message += " 无法保存到本地。";
    setStatus(message);
  }

  function requestSync() {
    if (demoMode || !githubToken) return;
    if (!syncTask) {
      syncTask = syncAll().finally(() => {
        syncTask = null;
      });
    }
    return syncTask;
  }

  document.getElementById("dark-mode").setAttribute("aria-pressed", document.documentElement.dataset.theme === "dark");
  document.getElementById("open-sync").addEventListener("click", () => {
    document.getElementById("sync-dialog").showModal();
  });
  document.getElementById("close-sync").addEventListener("click", () => {
    document.getElementById("sync-dialog").close();
  });
  document.getElementById("sync-form").addEventListener("submit", event => {
    event.preventDefault();
    const field = document.getElementById("sync-token");
    const entered = field.value.trim();
    if (!/^github_pat_[A-Za-z0-9_]+$/.test(entered)) {
      setStatus("请输入 GitHub 细粒度令牌。");
      return;
    }
    githubToken = entered;
    try {
      if (document.getElementById("remember-sync").checked) localStorage.setItem(TOKEN_KEY, entered);
      else sessionStorage.setItem(TOKEN_KEY, entered);
    } catch {
      // The token remains usable in memory for this page.
    }
    field.value = "";
    showConnection();
    if (demoMode) setStatus("示例预览不会写入或同步进度。");
    else requestSync();
  });
  document.getElementById("sync-now").addEventListener("click", () => requestSync());
  document.getElementById("disconnect-sync").addEventListener("click", () => {
    githubToken = "";
    syncGeneration += 1;
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // The current page is still disconnected.
    }
    setStatus("");
    showConnection();
    syncing = false;
    render();
  });
  window.addEventListener("online", () => requestSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestSync();
  });
  showConnection();
  if (demoMode) render();
  else if (githubToken) requestSync();
  else render();
}

if (typeof document !== "undefined") boot();
