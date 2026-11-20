// Aggregates private reading marks for the 生词 board.
// Reads localStorage and, when a token is already saved, the private progress repo.
// Never embed word lists, marks, or tokens in this file.

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
  return { word: parts[2], timestamp: record[0], value };
}

// Current 生词 in one set. An integer value (including 0) is a mark; null is cleared.
// A missing sync record falls back to local progress with timestamp 0 (较早/同步前).
export function currentMarks(progress, records) {
  const recordMap = records instanceof Map ? records : decodeRecords(records);
  const best = new Map();
  const consider = (word, timestamp) => {
    if (typeof word !== "string" || word.trim() === "") return;
    const id = word.toLocaleLowerCase("en");
    const previous = best.get(id);
    if (!previous || timestamp < previous.timestamp) best.set(id, { word, timestamp });
  };
  for (const [field, record] of recordMap) {
    const parsed = parseMark(field, record);
    if (parsed && parsed.value !== null) consider(parsed.word, parsed.timestamp);
  }
  const lessons = progress && typeof progress === "object" && !Array.isArray(progress) ? progress.marks : null;
  if (lessons && typeof lessons === "object" && !Array.isArray(lessons)) {
    for (const [lessonId, pairs] of Object.entries(lessons)) {
      if (typeof lessonId !== "string" || !lessonId || lessonId.includes("/") || !Array.isArray(pairs)) continue;
      for (const pair of pairs) {
        if (!Array.isArray(pair) || typeof pair[0] !== "string" || !Number.isInteger(pair[1]) || pair[1] < 0) continue;
        if (recordMap.has(`mark/${lessonId}/${pair[0]}`)) continue;
        consider(pair[0], 0);
      }
    }
  }
  return best;
}

export function aggregateVocab(sources) {
  const byWord = new Map();
  for (const source of sources) {
    for (const mark of currentMarks(source.progress, source.records).values()) {
      const id = mark.word.toLocaleLowerCase("en");
      let entry = byWord.get(id);
      if (!entry) {
        entry = { word: mark.word, firstTimestamp: mark.timestamp, sources: [] };
        byWord.set(id, entry);
      } else if (mark.timestamp < entry.firstTimestamp) {
        entry.firstTimestamp = mark.timestamp;
        entry.word = mark.word;
      }
      entry.sources.push(source.label);
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

export function emptyNote({ syncing, hasToken, hasStoredPayload }) {
  if (syncing) return SYNCING_NOTE;
  if (!hasToken && !hasStoredPayload) return VISITOR_NOTE;
  return EMPTY_NOTE;
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
  const recordOverlays = new Map();
  let githubToken = "";
  let syncing = false;
  let storageFailed = false;
  let syncGeneration = 0;
  let syncTask = null;
  const statusNodes = ["board-status", "sync-status"].map(id => document.getElementById(id));
  const wordList = document.getElementById("word-list");
  const dayList = document.getElementById("day-list");
  const daily = document.getElementById("daily");
  const empty = document.getElementById("empty-note");
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
      label: source.label,
      progress: readJson(source.progressKey),
      records: recordsFor(source)
    }));
  }

  function renderWordItems(words) {
    return words.map(entry => {
      const item = document.createElement("li");
      const term = document.createElement("span");
      term.className = "term";
      term.lang = "en";
      term.textContent = entry.word;
      const sources = document.createElement("span");
      sources.className = "sources";
      sources.textContent = "来自" + entry.sources.join("、");
      item.append(term, sources);
      return item;
    });
  }

  function render() {
    const state = aggregateVocab(loadSources());
    count.textContent = String(state.count);
    wordList.replaceChildren(...renderWordItems(state.words));
    wordList.hidden = state.count === 0;
    empty.hidden = state.count !== 0;
    if (state.count === 0) {
      empty.textContent = emptyNote({ syncing, hasToken: Boolean(githubToken), hasStoredPayload: hasStoredPayload() });
    }
    daily.hidden = state.days.length === 0;
    dayList.replaceChildren(...state.days.map(day => {
      const block = document.createElement("section");
      block.className = "day-block";
      const heading = document.createElement("h3");
      heading.textContent = day.label;
      const amount = document.createElement("span");
      amount.className = "day-count";
      amount.textContent = day.words.length + " 个";
      heading.append(amount);
      const list = document.createElement("ul");
      list.className = "word-list";
      list.append(...renderWordItems(day.words));
      block.append(heading, list);
      return block;
    }));
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
    if (!githubToken) return;
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
    requestSync();
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
  if (githubToken) requestSync();
  else render();
}

if (typeof document !== "undefined") boot();
