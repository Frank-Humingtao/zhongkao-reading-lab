// The 生词 board page. Word rules live in vocab-core.js (shared with
// scripts/daily-words.mjs); this file only reads storage, syncs and draws.
// The demo preview is fictional and stays in memory. It is never stored or synced.

import { loadManifest, vocabSources } from "./content.js";
import { loadWordCatalog } from "./vocab-context.js";
import {
  PROGRESS_API,
  TOKEN_KEY,
  aggregateVocab,
  dayCopyText,
  decodeGithubContent,
  demoSources,
  emptyNote,
  hasVocabPayload,
  isDemoSearch,
  mergeRecords,
  presentDetails,
  shanghaiDateKey,
  syncErrorMessage
} from "./vocab-core.js";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const SVG_NS = "http://www.w3.org/2000/svg";

// Site files, read fresh so a collection published a minute ago shows up.
async function readSiteFile(path) {
  const response = await fetch(path, { cache: "no-cache" });
  return response.ok ? response.text() : null;
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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", "#i-" + name);
  svg.append(use);
  return svg;
}

// "presync" stays 更早; real days read as 今天 / 昨天 / 11月18日 with a weekday.
function dayNames(key, now = Date.now()) {
  if (key === "presync") return { short: "更早", long: "更早", weekday: "" };
  const [year, month, day] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const date = month + "月" + day + "日";
  const today = shanghaiDateKey(now);
  const yesterday = shanghaiDateKey(now - 864e5);
  const relative = key === today ? "今天" : key === yesterday ? "昨天" : "";
  return { short: relative || date, long: relative ? relative + " · " + date : date, weekday };
}

async function boot() {
  const progressSources = vocabSources((await loadManifest(readSiteFile)).collections);
  const demoMode = isDemoSearch(location.search);
  const recordOverlays = new Map();
  let githubToken = "";
  let syncing = false;
  let syncedAt = 0;
  let storageFailed = false;
  let syncGeneration = 0;
  let syncTask = null;
  let selectedDay = "all";
  let catalog = null;
  let catalogTask = null;
  let currentPronunciation;

  const $ = id => document.getElementById(id);
  const dayList = $("day-list");
  const picker = $("day-picker");

  try {
    githubToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
    if (githubToken && window.zhongkaoApp) localStorage.setItem(TOKEN_KEY, githubToken);
  } catch {
    githubToken = "";
  }

  function setStatus(text) {
    $("board-status").textContent = text;
    $("sync-status").textContent = text;
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
      return progressSources.some(source => hasVocabPayload(readJson(source.progressKey), readJson(source.recordsKey)));
    } catch {
      return false;
    }
  }

  function loadSources() {
    return progressSources.map(source => ({
      id: source.id,
      label: source.label,
      progress: readJson(source.progressKey),
      records: recordsFor(source)
    }));
  }

  function resolvedDetail(detail) {
    if (demoMode || !catalog) return detail;
    const title = catalog.title(detail.sourceId, detail.lessonId);
    if (detail.sentence) return { ...detail, title };
    const found = catalog.lookup(detail.sourceId, detail.lessonId, detail.word, detail.exampleIndex);
    if (!found) return { ...detail, title };
    return { ...detail, ...found, title };
  }

  function ensureCatalog() {
    if (demoMode || catalogTask) return;
    catalogTask = loadWordCatalog(readSiteFile).then(loaded => {
      catalog = loaded;
      render();
    }).catch(() => {
      catalogTask = null;
    });
  }

  function pronounceWord(text, button, status) {
    const speech = window.speechSynthesis;
    status.textContent = "";
    if (!speech || typeof window.SpeechSynthesisUtterance !== "function") {
      status.textContent = "这个浏览器不能播放发音。";
      return;
    }
    currentPronunciation?.button.classList.remove("speaking");
    currentPronunciation = undefined;
    if (speech.speaking || speech.pending) speech.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
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
        status.textContent = "暂时无法播放发音。";
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

  function sentenceNode(sentence, surface, offset) {
    const node = el("p", "example");
    node.lang = "en";
    const start = Number.isInteger(offset) && offset >= 0
      ? offset : sentence.toLowerCase().indexOf(String(surface).toLowerCase());
    const length = surface ? String(surface).length : 0;
    if (start < 0 || !length || start + length > sentence.length) {
      node.textContent = sentence;
      return node;
    }
    node.append(sentence.slice(0, start), el("mark", "", sentence.slice(start, start + length)), sentence.slice(start + length));
    return node;
  }

  function renderEntry(entry) {
    const details = presentDetails((entry.details || []).map(resolvedDetail));
    const item = el("li", "entry");
    const head = el("div", "entry-head");
    const wordBox = el("div", "entry-word");
    const shown = details.find(detail => detail.display)?.display;
    const display = shown && shown.toLocaleLowerCase("en") === entry.word.toLocaleLowerCase("en") ? shown : entry.word;
    const term = el("span", "term", display);
    term.lang = "en";

    const mainMeaning = details.find(detail => detail.meaning)?.meaning || "";
    const plain = text => String(text || "").replace(/^(?:n|v|vt|vi|adj|adv|prep|conj|pron|num)\.?\s*/i, "").trim();
    wordBox.append(term);
    if (entry.repeat) wordBox.append(el("span", "repeat", "又标了 · 首次 " + (entry.firstDay ? dayNames(entry.firstDay).short : "更早")));
    wordBox.append(el("p", "meaning", mainMeaning));

    const speak = el("button", "speak");
    speak.type = "button";
    speak.setAttribute("aria-label", "播放发音 " + display);
    speak.append(icon("speak"));
    const speakStatus = el("p", "speak-status");
    speakStatus.setAttribute("role", "status");
    speak.addEventListener("click", () => pronounceWord(display, speak, speakStatus));
    head.append(wordBox, speak);
    item.append(head, speakStatus);

    const uses = el("div", "uses");
    for (const detail of details) {
      const use = el("div", "use");
      const source = el("p", "use-source", detail.source || "");
      if (detail.title) {
        source.append(" · ");
        const lesson = el("span", "lesson", detail.title);
        lesson.lang = "en";
        source.append(lesson);
      }
      use.append(source);
      if (detail.meaning && plain(detail.meaning) !== plain(mainMeaning)) use.append(el("p", "use-meaning", detail.meaning));
      if (detail.sentence) use.append(sentenceNode(detail.sentence, detail.surface || display, detail.offset));
      if (detail.chinese) use.append(el("p", "translation", detail.chinese));
      uses.append(use);
    }
    if (uses.childElementCount) item.append(uses);
    return item;
  }

  async function copyDay(day, button, section) {
    const text = dayCopyText(day.fresh);
    let fallback = section.querySelector(".copy-fallback");
    const label = button.querySelector("span");
    try {
      await navigator.clipboard.writeText(text);
      fallback?.remove();
      button.dataset.done = "";
      button.querySelector("use").setAttribute("href", "#i-check");
      label.textContent = "已复制";
      setTimeout(() => {
        if (!button.isConnected) return;
        delete button.dataset.done;
        button.querySelector("use").setAttribute("href", "#i-copy");
        label.textContent = "复制";
      }, 1800);
    } catch {
      if (!fallback) {
        fallback = el("textarea", "copy-fallback");
        fallback.readOnly = true;
        fallback.setAttribute("aria-label", dayNames(day.key).long + "的生词");
        section.querySelector(".day-head").after(fallback);
      }
      fallback.value = text;
      fallback.focus();
      fallback.select();
      label.textContent = "请手动复制";
    }
  }

  function renderDay(day) {
    const names = dayNames(day.key);
    const section = el("section", "day");
    section.setAttribute("aria-label", names.long);
    const head = el("div", "day-head");
    const title = el("h2", "day-title", names.long);
    title.append(el("span", "weekday", names.weekday));
    const repeats = day.words.length - day.fresh.length;
    const count = el("span", "day-count", day.fresh.length + " 个新词" + (repeats ? " · 又标 " + repeats : ""));
    const copy = el("button", "copy");
    copy.type = "button";
    copy.setAttribute("aria-label", "复制" + names.long + "的新词");
    copy.hidden = !day.fresh.length;
    copy.append(icon("copy"), el("span", "", "复制"));
    copy.addEventListener("click", () => copyDay(day, copy, section));
    head.append(title, count, copy);
    const list = el("ul", "entries");
    list.append(...day.words.map(renderEntry));
    section.append(head, list);
    return section;
  }

  function chip(label, amount, key) {
    const button = el("button", "chip", label);
    button.type = "button";
    button.append(el("small", "", String(amount)));
    button.setAttribute("aria-pressed", String(selectedDay === key));
    button.addEventListener("click", () => {
      selectedDay = key;
      render();
      const top = picker.getBoundingClientRect().top + scrollY - 1;
      if (scrollY > top) scrollTo({ top });
    });
    return button;
  }

  function render() {
    const state = aggregateVocab(demoMode ? demoSources() : loadSources(), { known: catalog?.headwords });
    if (selectedDay !== "all" && !state.days.some(day => day.key === selectedDay)) selectedDay = "all";

    $("word-count").textContent = String(state.count);
    $("demo-banner").hidden = !demoMode;
    $("empty-note").hidden = demoMode || state.count !== 0;
    $("demo-entry").hidden = demoMode || state.count !== 0 || Boolean(githubToken);
    if (!demoMode && state.count === 0) {
      $("empty-text").textContent = emptyNote({ syncing, hasToken: Boolean(githubToken), hasStoredPayload: hasStoredPayload() });
    }

    picker.hidden = state.days.length < 2;
    picker.replaceChildren(
      chip("全部", state.count, "all"),
      ...state.days.map(day => chip(dayNames(day.key).short, day.words.length, day.key))
    );
    const shown = selectedDay === "all" ? state.days : state.days.filter(day => day.key === selectedDay);
    dayList.replaceChildren(...shown.map(renderDay));
    if (!demoMode && state.count) ensureCatalog();
  }

  function showConnection() {
    const connected = Boolean(githubToken);
    $("sync-form").hidden = connected;
    $("sync-actions").hidden = !connected;
    $("sync-dot").hidden = !connected || !syncedAt;
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
        throw new Error("暂时连不上 GitHub，显示的是这台设备上的进度。");
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
    await Promise.all(progressSources.map(async source => {
      try {
        const remote = await fetchRemoteRecords(token, source.file);
        if (!remote || token !== githubToken || generation !== syncGeneration) return;
        rememberRecords(source, mergeRecords(recordsFor(source), remote));
      } catch (error) {
        if (error?.message === "invalid progress file") invalid = true;
        else failures.push(error);
      }
    }));
    syncing = false;
    if (token !== githubToken || generation !== syncGeneration) return;
    const auth = failures.find(error => error.message.includes("令牌已失效"));
    const denied = failures.find(error => error.message.includes("读写私有进度仓库"));
    let message;
    if (auth) message = auth.message;
    else if (denied) message = denied.message;
    else if (failures.length) message = failures[0].message;
    else {
      syncedAt = Date.now();
      const time = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }).format(syncedAt);
      message = "已同步 · " + time;
      if (invalid) message += "（有进度文件格式不对，已跳过）";
    }
    if (storageFailed) message += " 无法保存到本地。";
    setStatus(message);
    showConnection();
    render();
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

  $("open-sync").addEventListener("click", () => $("sync-dialog").showModal());
  $("close-sync").addEventListener("click", () => $("sync-dialog").close());
  $("sync-dialog").addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  $("sync-form").addEventListener("submit", event => {
    event.preventDefault();
    const field = $("sync-token");
    const entered = field.value.trim();
    if (!/^github_pat_[A-Za-z0-9_]+$/.test(entered)) {
      setStatus("请输入 GitHub 细粒度令牌（github_pat_ 开头）。");
      return;
    }
    githubToken = entered;
    try {
      // Every launch of the app is a new browser session, so the app always remembers the token.
      if (window.zhongkaoApp || $("remember-sync").checked) localStorage.setItem(TOKEN_KEY, entered);
      else sessionStorage.setItem(TOKEN_KEY, entered);
    } catch {
      // The token remains usable in memory for this page.
    }
    field.value = "";
    showConnection();
    if (demoMode) setStatus("示例不会写入或同步进度。");
    else requestSync();
  });
  $("sync-now").addEventListener("click", () => requestSync());
  $("disconnect-sync").addEventListener("click", () => {
    githubToken = "";
    syncedAt = 0;
    syncGeneration += 1;
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // The current page is still disconnected.
    }
    syncing = false;
    setStatus("");
    showConnection();
    render();
  });
  window.addEventListener("online", () => requestSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestSync();
  });

  showConnection();
  render();
  if (!demoMode && githubToken) requestSync();
}

if (typeof document !== "undefined") boot();
