// The reading page (index.html): one collection's stories, word marks, local
// progress and its GitHub sync. Which collection, and its words and stories,
// come from content/ (content.js); this file never names a collection.

import { LETTERS, findCollection, loadCollection, loadDictionary, loadManifest, storyPicture } from "./content.js";
import { readingPlainText, splitSentences } from "./vocab-context.js";

// Site files, read fresh so a collection published a minute ago shows up.
async function readSiteFile(path) {
  const response = await fetch(path, { cache: "no-cache" });
  return response.ok ? response.text() : null;
}

const byId = id => document.getElementById(id);
const setId = new URLSearchParams(location.search).get("set");
const [{ collections }, dictionaryFile] = await Promise.all([loadManifest(readSiteFile), loadDictionary(readSiteFile)]);
const collection = findCollection(collections, setId);
const { data, problems } = collection
  ? await loadCollection(readSiteFile, collection)
  : { data: null, problems: [`content/index.json 里没有 ${setId}`] };
if (!data) {
  // A collection that is missing or malformed is not shown; the switcher still
  // leads everywhere else. The content check names what to fix.
  byId("reading-title").textContent = "这一组内容暂时打不开";
  byId("passage").textContent = "请从上方切换到其他内容。";
  throw new Error(problems.join("\n"));
}

// Placement 01 has its own older file shape; every other collection is words
// and stories of sentence pairs.
const edition = collection.legacyScreening ? null : data;
const legacy = collection.legacyScreening ? data.legacy : {};
const previousLessons = legacy.previousLessons ?? [];
const screening = {
  dictionary: dictionaryFile.dictionary,
  forms: dictionaryFile.forms,
  lessons: collection.legacyScreening ? data.lessons : []
};
const bilingualText = edition
  ? Object.fromEntries(edition.stories.map(story => [
    story.id, story.paragraphs.map(paragraph => paragraph.map(([, chinese]) => chinese))
  ]))
  : data.chinese;
const bilingualTitles = edition
  ? Object.fromEntries(edition.stories.map(({ id, topic }) => [id, topic]))
  : data.titles;
const extraMeanings = dictionaryFile.extraMeanings;
const originalVocabulary = edition
  ? [["重点词", Object.entries(edition.words).map(([key, [meaning]]) => [key, key, " " + meaning])]]
  : data.vocabulary;
const trialLessons = legacy.trialLessons ?? [];
const trialGlossary = legacy.trialGlossary ?? {};
const previousGlossary = legacy.previousGlossary ?? {};
const sourceWords = Object.keys(screening.dictionary);
const escapePattern = text => text.replace(/[.*+?^\u007b\u007d()|[\]\\]/g, "\\$&");
const abbreviations = sourceWords.filter(key => key.includes("."));
const abbreviatedWords = abbreviations.map(escapePattern).join("|");
const wordPattern = new RegExp(abbreviatedWords + "|[\\p{L}]+(?:['’\\-][\\p{L}]+)*", "giu");
function fixedGlossAnchors(text) {
  const anchors = [];
  const source = String(text);
  if (!source.includes("（")) return anchors;
  let plain = "";
  let cursor = 0;
  for (const match of source.matchAll(/（([^）]*)）/g)) {
    plain += source.slice(cursor, match.index);
    const surface = plain.match(/[\p{L}]+(?:['’\-][\p{L}]+)*$/u)?.[0] ?? "";
    if (match[1]) anchors.push({ after: surface, text: match[1] });
    cursor = match.index + match[0].length;
  }
  return anchors;
}
const storageKey = collection.storageKey;
const sourceGlossary = Object.fromEntries(Object.entries(screening.forms).map(([surface, key]) => {
  const [display, meaning] = screening.dictionary[key];
  return [surface, [key, meaning, display]];
}));
if (edition) {
  for (const [key, [meaning, ...forms]] of Object.entries(edition.words)) {
    for (const form of [key, ...forms]) sourceGlossary[form] = [key, meaning, key];
  }
}

function buildLesson(lesson, definitions) {
  const terms = new Map();
  const targetKeys = new Map();
  const phrases = new Set(Object.keys(definitions).filter(key => key.includes(" ")));
  for (const [key, [, ...forms]] of Object.entries(lesson.targets)) {
    for (const form of [key, ...forms]) targetKeys.set(form, key);
    if (key.includes(" ")) phrases.add(key);
  }
  const phrasePatterns = [...phrases].sort((a, b) => b.length - a.length).map(phrase =>
    escapePattern(phrase) + "(?![\\p{L}])"
  );
  const pattern = new RegExp([...phrasePatterns, wordPattern.source].join("|"), "giu");

  function tokenize(text) {
    text = readingPlainText(text);
    const segments = [];
    let position = 0;
    for (const match of text.matchAll(pattern)) {
      const surface = match[0];
      const normalized = surface.toLowerCase().replaceAll("’", "'");
      let entry = Object.hasOwn(definitions, surface) ? definitions[surface]
        : Object.hasOwn(definitions, normalized) ? definitions[normalized] : undefined;
      const override = lesson.overrides?.[normalized];
      if (override) {
        const [display, meaning] = screening.dictionary[override];
        entry = [override, meaning, display];
      }
      const key = targetKeys.get(normalized) ?? entry?.[0] ?? normalized;
      const meaning = lesson.targets[key]?.[0] ?? entry?.[1] ?? extraMeanings[normalized] ?? "";
      const display = entry?.[2] ?? key;
      if (match.index > position) segments.push({ text: text.slice(position, match.index) });
      const token = { text: surface, key, sentence: text, offset: match.index };
      segments.push(token);
      if (!terms.has(key)) terms.set(key, { display, meaning, examples: [] });
      terms.get(key).examples.push(token);
      position = match.index + surface.length;
    }
    if (position < text.length) segments.push({ text: text.slice(position) });
    return segments;
  }

  const title = tokenize(lesson.title);
  const sourceSentences = lesson.sentences ?? lesson.paragraphs.map(splitSentences);
  const fixedGlosses = sourceSentences.map(paragraph => paragraph.map(fixedGlossAnchors));
  const sentences = sourceSentences.map(paragraph => paragraph.map(readingPlainText));
  const paragraphs = sentences.map(paragraph => paragraph.map(tokenize));
  return { ...lesson, title, paragraphs, terms, fixedGlosses };
}

const readings = edition
  ? edition.stories.map(story => buildLesson({
    id: story.id,
    title: story.title,
    topic: story.topic,
    picture: storyPicture(collection, story),
    figure: story.figure,
    sources: story.sources,
    questions: story.questions ?? [],
    figures: story.figures ?? [],
    underline: story.underline ?? [],
    primary: [],
    targets: edition.words,
    sentences: story.paragraphs.map(paragraph => paragraph.map(([english]) => english))
  }, sourceGlossary))
  : screening.lessons.map(lesson => {
    const targets = Object.fromEntries([...lesson.primary, ...lesson.review].map(key => [key, []]));
    return buildLesson({ ...lesson, targets, picture: storyPicture(collection, lesson) }, sourceGlossary);
  });
const trialReadings = edition ? [] : trialLessons.map(lesson => buildLesson(lesson, trialGlossary));
const previousReadings = edition ? [] : previousLessons.map(lesson => buildLesson(lesson, previousGlossary));
const allReadings = [...readings, ...trialReadings, ...previousReadings];
const articleLocations = new Map();
const primaryLocations = new Map();
readings.forEach((lesson, index) => {
  for (const key of lesson.primary) primaryLocations.set(key, index);
  for (const key of lesson.terms.keys()) {
    if (!articleLocations.has(key)) articleLocations.set(key, []);
    articleLocations.get(key).push(index);
  }
});

function readMarks(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const savedProgress = readMarks(storageKey, {});
const trialMarks = edition ? {} : readMarks("zhongkao-reading-lab-v2", {});
const previousMarks = edition ? [] : readMarks("zhongkao-reading-lab-v1", []);
const marks = allReadings.map((lesson, index) => {
  const pairs = savedProgress.marks?.[lesson.id] ?? trialMarks[lesson.id]
    ?? previousMarks[index - readings.length - trialReadings.length];
  if (!Array.isArray(pairs)) return new Map();
  return new Map(pairs.filter(pair =>
    Array.isArray(pair) && Number.isInteger(pair[1])
    && lesson.terms.get(pair[0])?.examples[pair[1]] !== undefined
  ));
});
const readIds = new Set(readings.map(lesson => lesson.id));
const finished = new Set(Array.isArray(savedProgress.finished)
  ? savedProgress.finished.filter(id => readIds.has(id)) : []);
// Reading questions: the letter chosen for each question, and the stories whose
// answers have been checked (after which the choices stay as they were).
const questionCounts = new Map(readings.map(lesson => [lesson.id, lesson.questions?.length ?? 0]));
const answers = new Map();
for (const [id, chosen] of Object.entries(savedProgress.answers ?? {})) {
  const count = questionCounts.get(id);
  if (!count || !Array.isArray(chosen)) continue;
  answers.set(id, Array.from({ length: count }, (_, index) => LETTERS.includes(chosen[index]) ? chosen[index] : null));
}
const checked = new Set(Array.isArray(savedProgress.checked)
  ? savedProgress.checked.filter(id => questionCounts.get(id)) : []);
let activeIndex = Math.max(0, readings.findIndex(lesson => lesson.id === savedProgress.active));
let currentView = "reader";
let visibleWords = new Map();
const sentencePairs = new WeakMap();
let matchedPair;
const singleColumn = window.matchMedia("(max-width: 760px)");
let directoryClosed = singleColumn.matches || (savedProgress.directoryClosed ?? false);
let showingBilingual = false;
if (edition) {
  document.title = byId("site-title").textContent = collection.label + "｜" + collection.name;
  byId("open-vocabulary").textContent = "重点词索引";
  byId("full-vocabulary-title").textContent = "重点词索引";
}
const workspace = byId("workspace");
const reader = byId("reader");
const vocabulary = byId("full-vocabulary");
const title = byId("reading-title");
const passage = byId("passage");
const readingIllustration = byId("reading-illustration");
// A story's picture may not be drawn yet (the illustrator agent adds it after
// the story is published): until it is, the story shows without one.
readingIllustration.addEventListener("error", () => {
  byId("reading-figure").hidden = true;
  reader.classList.remove("illustrated");
});
const directory = byId("directory-panel");
const wordMenu = byId("word-menu");
let menuTrigger;
let vocabularyGroups;

function saveProgress() {
  writeLocalProgress();
  noteProgressChange();
}

function writeLocalProgress() {
  try {
    const byLesson = Object.fromEntries(allReadings.map((lesson, index) => [lesson.id, [...marks[index]]]));
    localStorage.setItem(storageKey, JSON.stringify({
      active: readings[activeIndex].id, finished: [...finished], marks: byLesson, directoryClosed,
      answers: Object.fromEntries(answers), checked: [...checked]
    }));
    byId("storage-error").hidden = true;
  } catch {
    byId("storage-error").hidden = false;
  }
}

function updateProgress() {
  readings.forEach((lesson, index) => {
    const done = finished.has(lesson.id);
    const item = directoryItems[index];
    item.lastElementChild.textContent = done ? "✓" : "";
    item.setAttribute("aria-label", (index + 1) + " " + lesson.topic + (done ? "，已读" : ""));
    item.tabIndex = index === activeIndex ? 0 : -1;
    if (index === activeIndex && currentView === "reader") item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const done = finished.has(readings[activeIndex].id);
  byId("finish-lesson").textContent = done ? "取消已读" : "标为已读";
  byId("finish-lesson").setAttribute("aria-pressed", done);
}

function updateDirectory() {
  workspace.classList.toggle("directory-closed", directoryClosed);
  directory.hidden = directoryClosed;
  const toggle = byId("directory-toggle");
  const label = directoryClosed ? "展开短文目录" : "收起短文目录";
  toggle.setAttribute("aria-expanded", !directoryClosed);
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  byId("directory-arrow").textContent = directoryClosed ? "›" : "‹";
  if (!directoryClosed) showActiveDirectoryEntry();
}

function showActiveDirectoryEntry() {
  if (directoryClosed) return;
  const item = directoryItems[activeIndex];
  const start = item.offsetTop;
  if (start < directory.scrollTop) directory.scrollTop = start;
  else if (start + item.offsetHeight > directory.scrollTop + directory.clientHeight) {
    directory.scrollTop = start + item.offsetHeight - directory.clientHeight;
  }
}

function setView(view) {
  if (view !== currentView && singleColumn.matches && !directoryClosed) {
    directoryClosed = true;
    updateDirectory();
  }
  currentView = view;
  reader.hidden = view !== "reader";
  vocabulary.hidden = view !== "vocabulary";
  byId("open-vocabulary").setAttribute("aria-expanded", view === "vocabulary");
  updateProgress();
}

function updateBilingual() {
  byId("translated-title").hidden = !showingBilingual;
  passage.classList.toggle("bilingual", showingBilingual);
  byId("toggle-bilingual").setAttribute("aria-pressed", showingBilingual);
  if (!showingBilingual) highlightSentence();
}

function highlightSentence(target) {
  const sentence = showingBilingual && target instanceof Element ? target.closest(".aligned-sentence") : null;
  const pair = sentence ? sentencePairs.get(sentence) : undefined;
  if (pair === matchedPair) return;
  matchedPair?.forEach(element => element.classList.remove("matched"));
  matchedPair = pair;
  matchedPair?.forEach(element => element.classList.add("matched"));
}

passage.addEventListener("pointerover", event => {
  if (event.pointerType !== "touch") highlightSentence(event.target);
});
passage.addEventListener("pointerout", event => {
  if (event.pointerType !== "touch") highlightSentence(event.relatedTarget);
});
passage.addEventListener("focusin", event => {
  if (event.target.matches(":focus-visible")) highlightSentence(event.target);
});
passage.addEventListener("focusout", event => {
  if (!passage.matches(":hover")) highlightSentence(event.relatedTarget);
});

let currentPronunciation;

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
  const voice = english.find(voice => voice.localService && american(voice))
    ?? english.find(voice => voice.localService) ?? english.find(american) ?? english[0];
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

function renderInlineGlosses() {
  const lesson = readings[activeIndex];
  reader.querySelectorAll(".inline-gloss:not([data-fixed-gloss])").forEach(gloss => gloss.remove());
  for (const [key, exampleIndex] of marks[activeIndex]) {
    const word = visibleWords.get(key)[exampleIndex];
    const meaning = lesson.terms.get(key).meaning || "暂无中文释义";
    const fixed = word.nextElementSibling?.hasAttribute("data-fixed-gloss") ? word.nextElementSibling : null;
    if (fixed?.textContent === "（" + meaning + "）") continue;
    const gloss = document.createElement("span");
    gloss.className = "inline-gloss";
    gloss.lang = "zh-CN";
    gloss.textContent = "（" + meaning + "）";
    (fixed || word).after(gloss);
  }
}

function insertFixedGlosses(container, anchors) {
  if (!anchors?.length) return;
  const words = [...container.querySelectorAll(".word")];
  const used = new Set();
  for (const anchor of anchors) {
    const target = words.find(word => !used.has(word) && (
      word.textContent === anchor.after || word.textContent.endsWith(" " + anchor.after)
    ));
    if (!target) continue;
    used.add(target);
    const gloss = document.createElement("span");
    gloss.className = "inline-gloss";
    gloss.dataset.fixedGloss = "true";
    gloss.lang = "zh-CN";
    gloss.textContent = "（" + anchor.text + "）";
    target.after(gloss);
  }
}

function joinMeta(parts) {
  const nodes = [];
  parts.forEach((part, index) => {
    if (index) nodes.push(document.createTextNode(" · "));
    nodes.push(part);
  });
  return nodes;
}

function renderArticleMeta(lesson) {
  const figure = byId("reading-figure");
  const credit = byId("reading-credit");
  const sources = byId("reading-sources");
  const fig = lesson.figure;
  figure.hidden = !lesson.picture;
  figure.classList.toggle("wide", Boolean(fig?.wide));
  if (lesson.picture) {
    readingIllustration.alt = lesson.picture.alt;
    readingIllustration.width = fig?.width || 960;
    readingIllustration.height = fig?.height || 640;
    readingIllustration.src = lesson.picture.src;
  }
  credit.replaceChildren();
  credit.hidden = !fig;
  if (fig) {
    const caption = document.createElement("span");
    caption.textContent = fig.caption;
    credit.append(caption);
    const parts = [];
    if (fig.note) parts.push(document.createTextNode(fig.note));
    if (fig.date) {
      const time = document.createElement("time");
      time.dateTime = fig.date;
      time.textContent = fig.date;
      parts.push(time);
    }
    if (fig.credit) parts.push(document.createTextNode(fig.credit));
    if (fig.sourceUrl) {
      const link = document.createElement("a");
      link.href = fig.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = fig.sourceLabel || "来源";
      parts.push(link);
    }
    const detail = document.createElement("span");
    detail.append(...joinMeta(parts));
    credit.append(detail);
  }
  const sourceList = lesson.sources || [];
  const showSources = Boolean(edition?.columnTitle) || sourceList.length > 0;
  sources.replaceChildren();
  sources.hidden = !showSources;
  if (!showSources) return;
  if (edition?.columnTitle) {
    const kicker = document.createElement("span");
    kicker.textContent = edition.columnTitle + (edition.editionDate ? " · " + edition.editionDate : "");
    sources.append(kicker);
  }
  if (!sourceList.length) return;
  const row = document.createElement("span");
  row.append("来源：");
  sourceList.forEach((source, index) => {
    if (index) row.append(" · ");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.label;
    row.append(link);
  });
  if (sources.childNodes.length) sources.append(document.createElement("br"));
  sources.append(row);
}

function textParts(segments, lesson) {
  const fragment = document.createDocumentFragment();
  // Punctuation kept with the word before it is skipped here, never cut from the
  // shared segments, so the story renders the same every time it is shown.
  let skip = 0;
  for (let index = 0; index < segments.length; index++) {
    const token = segments[index];
    if (!token.key) {
      const text = token.text.slice(skip);
      skip = 0;
      if (text) fragment.append(text);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word";
    button.textContent = token.text;
    button.dataset.wordKey = token.key;
    button.setAttribute("aria-pressed", marks[activeIndex].has(token.key));
    button.tabIndex = -1;
    if (!visibleWords.has(token.key)) visibleWords.set(token.key, []);
    visibleWords.get(token.key).push(button);
    button.addEventListener("click", () => {
      const group = marks[activeIndex];
      const exampleIndex = lesson.terms.get(token.key).examples.indexOf(token);
      if (group.get(token.key) === exampleIndex) group.delete(token.key);
      else group.set(token.key, exampleIndex);
      for (const occurrence of visibleWords.get(token.key)) {
        occurrence.setAttribute("aria-pressed", group.has(token.key));
      }
      saveProgress();
      renderInlineGlosses();
    });
    const next = segments[index + 1];
    const punctuation = next && !next.key ? /^[.,!?;:]+/.exec(next.text) : null;
    if (!punctuation) {
      fragment.append(button);
      continue;
    }
    skip = punctuation[0].length;
    const keep = document.createElement("span");
    keep.className = "word-keep";
    keep.append(button, punctuation[0]);
    fragment.append(keep);
  }
  return fragment;
}

const wordContainers = [title, passage];
wordContainers.forEach(container => {
  container.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !event.target.matches(".word")) return;
    const words = [...title.querySelectorAll(".word"), ...passage.querySelectorAll(".word")];
    const offset = event.key === "ArrowLeft" ? -1 : 1;
    const next = words[words.indexOf(event.target) + offset];
    if (!next) return;
    event.preventDefault();
    const nextContainer = next.closest(".passage") ?? title;
    const previousActive = nextContainer.querySelector('.word[tabindex="0"]');
    if (previousActive) previousActive.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
});

function selectLesson(index, moveFocus = true) {
  if (index !== activeIndex) showingBilingual = false;
  activeIndex = index;
  highlightSentence();
  setView("reader");
  const lesson = readings[index];
  reader.classList.toggle("illustrated", Boolean(lesson.picture));
  renderArticleMeta(lesson);
  visibleWords = new Map();
  title.replaceChildren(textParts(lesson.title, lesson));
  byId("translated-title").textContent = bilingualTitles[lesson.id];
  passage.replaceChildren(...lesson.paragraphs.map((sentences, paragraphIndex) => {
    const block = document.createElement("div");
    block.className = "passage-block";
    const englishParagraph = document.createElement("p");
    englishParagraph.lang = "en";
    const chineseParagraph = document.createElement("p");
    chineseParagraph.lang = "zh-CN";
    chineseParagraph.className = "translation";
    sentences.forEach((segments, sentenceIndex) => {
      const english = document.createElement("span");
      english.className = "aligned-sentence";
      english.append(textParts(segments, lesson));
      insertFixedGlosses(english, lesson.fixedGlosses?.[paragraphIndex]?.[sentenceIndex]);
      const chinese = document.createElement("span");
      chinese.className = "aligned-sentence";
      chinese.textContent = bilingualText[lesson.id][paragraphIndex][sentenceIndex];
      const pair = [english, chinese];
      sentencePairs.set(english, pair);
      sentencePairs.set(chinese, pair);
      if (sentenceIndex > 0) englishParagraph.append(" ");
      englishParagraph.append(english);
      chineseParagraph.append(chinese);
    });
    block.append(englishParagraph, chineseParagraph);
    for (const [at, phrase] of lesson.underline ?? []) if (at === paragraphIndex) underlinePhrase(englishParagraph, phrase);
    return block;
  }));
  // Figures from the exam paper, placed after the paragraph they follow.
  const blocks = [...passage.children];
  for (const figure of lesson.figures ?? []) {
    const node = examImage(figure.image, figure.alt, "passage-figure");
    const before = blocks[figure.after];
    if (before) passage.insertBefore(node, before);
    else passage.append(node);
  }
  updateBilingual();
  wordContainers.forEach(container => { container.querySelector(".word").tabIndex = 0; });
  showActiveDirectoryEntry();
  byId("previous").disabled = index === 0;
  byId("next").textContent = index < readings.length - 1 ? "下一篇" : "去生词看板";
  if (moveFocus) {
    title.focus();
    saveProgress();
  }
  renderInlineGlosses();
  renderQuestions();
  window.readingPage?.onLessonShown?.();
}

function examImage(file, alt, className) {
  const figure = document.createElement("figure");
  figure.className = className;
  const image = document.createElement("img");
  image.src = collection.imageDir + file;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  figure.append(image);
  return figure;
}

// The words an exam underlines, which its questions ask about.
function underlinePhrase(paragraph, phrase) {
  const wanted = phrase.toLowerCase().match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu) ?? [];
  const words = [...paragraph.querySelectorAll(".word")];
  for (let start = 0; start + wanted.length <= words.length; start++) {
    if (wanted.every((word, offset) => words[start + offset].textContent.toLowerCase() === word)) {
      for (let offset = 0; offset < wanted.length; offset++) words[start + offset].classList.add("underlined");
      return;
    }
  }
}

function chosenFor(id) {
  if (!answers.has(id)) answers.set(id, Array(questionCounts.get(id)).fill(null));
  return answers.get(id);
}

// The story's questions under the passage: tap an option to choose it, then
// 对答案 shows which were right; 重做 clears them.
const quiz = byId("quiz");
function renderQuestions() {
  const lesson = readings[activeIndex];
  const questions = lesson.questions ?? [];
  quiz.hidden = !questions.length;
  quiz.replaceChildren();
  if (!questions.length) return;
  const chosen = answers.get(lesson.id) ?? [];
  const done = checked.has(lesson.id);
  const heading = document.createElement("h3");
  heading.className = "quiz-title";
  heading.textContent = "阅读理解";
  quiz.append(heading);
  let right = 0;
  questions.forEach((question, questionIndex) => {
    const item = document.createElement("fieldset");
    item.className = "question";
    const stem = document.createElement("legend");
    stem.className = "question-stem";
    stem.lang = "en";
    stem.textContent = (questionIndex + 1) + ". " + question.stem;
    item.append(stem);
    if (question.image) item.append(examImage(question.image, question.imageAlt ?? "", "question-figure"));
    const options = document.createElement("div");
    options.className = "question-options";
    if (done && chosen[questionIndex] === question.answer) right++;
    question.options.forEach((text, optionIndex) => {
      const letter = LETTERS[optionIndex];
      const option = document.createElement("button");
      option.type = "button";
      option.className = "question-option";
      option.lang = "en";
      option.setAttribute("aria-pressed", chosen[questionIndex] === letter);
      const mark = document.createElement("span");
      mark.className = "option-letter";
      mark.textContent = letter;
      const label = document.createElement("span");
      label.textContent = text;
      option.append(mark, label);
      if (done) {
        option.disabled = true;
        if (letter === question.answer) option.classList.add("correct");
        else if (chosen[questionIndex] === letter) option.classList.add("wrong");
      } else {
        option.addEventListener("click", () => {
          const list = chosenFor(lesson.id);
          list[questionIndex] = list[questionIndex] === letter ? null : letter;
          saveProgress();
          renderQuestions();
          quiz.querySelectorAll(".question")[questionIndex]
            ?.querySelectorAll(".question-option")[optionIndex]?.focus();
        });
      }
      options.append(option);
    });
    item.append(options);
    quiz.append(item);
  });
  const foot = document.createElement("div");
  foot.className = "quiz-foot";
  const status = document.createElement("p");
  status.className = "quiz-status";
  status.setAttribute("role", "status");
  const action = document.createElement("button");
  action.type = "button";
  action.className = "foot-button quiz-action";
  if (done) {
    status.textContent = "答对 " + right + " / " + questions.length;
    status.classList.toggle("all-right", right === questions.length);
    action.textContent = "重做";
    action.addEventListener("click", () => {
      checked.delete(lesson.id);
      answers.set(lesson.id, Array(questions.length).fill(null));
      saveProgress();
      renderQuestions();
    });
  } else {
    const left = questions.length - chosen.filter(Boolean).length;
    status.textContent = left ? "还有 " + left + " 题没选" : "都选好了";
    action.textContent = "对答案";
    action.disabled = left > 0;
    action.addEventListener("click", () => {
      checked.add(lesson.id);
      finished.add(lesson.id);
      saveProgress();
      renderQuestions();
      updateProgress();
    });
  }
  foot.append(status, action);
  quiz.append(foot);
}

const directoryItems = readings.map((lesson, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "directory-lesson";
  const number = document.createElement("span");
  number.className = "directory-number";
  number.textContent = String(index + 1).padStart(2, "0");
  const topic = document.createElement("span");
  topic.textContent = lesson.topic;
  const status = document.createElement("span");
  status.className = "directory-status";
  status.setAttribute("aria-hidden", "true");
  button.append(number, topic, status);
  button.addEventListener("click", () => {
    if (singleColumn.matches) {
      directoryClosed = true;
      updateDirectory();
    }
    selectLesson(index);
  });
  return button;
});
directory.replaceChildren(...directoryItems);
directory.addEventListener("keydown", event => {
  const index = directoryItems.indexOf(event.target);
  if (index < 0) return;
  const last = directoryItems.length - 1;
  const nextIndex = { ArrowUp: Math.max(0, index - 1), ArrowDown: Math.min(last, index + 1), Home: 0, End: last }[event.key];
  if (nextIndex === undefined) return;
  event.preventDefault();
  directoryItems[nextIndex].focus();
});

function jumpToWord(index, key) {
  selectLesson(index, false);
  saveProgress();
  const elements = visibleWords.get(key) ?? [];
  const word = elements.find(element => passage.contains(element)) ?? elements[0];
  if (!word) return;
  word.classList.add("located");
  const container = passage.contains(word) ? passage : title;
  const currentTabStop = container.querySelector('.word[tabindex="0"]');
  if (currentTabStop) currentTabStop.tabIndex = -1;
  word.tabIndex = 0;
  word.focus({ preventScroll: true });
  word.scrollIntoView({ block: "center" });
}

function closeWordMenu(restoreFocus = false) {
  if (wordMenu.hidden) return;
  wordMenu.hidden = true;
  if (restoreFocus && menuTrigger?.isConnected) menuTrigger.focus({ preventScroll: true });
  menuTrigger = undefined;
}

function openWordMenu(key, trigger, point, byTouch = false) {
  const occurrences = articleLocations.get(key);
  if (!occurrences?.length) return;
  const primary = primaryLocations.get(key);
  const ordered = primary === undefined ? occurrences : [primary, ...occurrences.filter(index => index !== primary)];
  const heading = document.createElement("p");
  heading.className = "word-menu-title";
  const display = (edition && Object.hasOwn(edition.words, key))
    ? key : screening.dictionary[key]?.[0] ?? readings[activeIndex].terms.get(key)?.display ?? key;
  heading.textContent = display;
  wordMenu.setAttribute("aria-label", display + " 的出现篇目");
  const options = ordered.map(index => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "word-menu-item";
    option.textContent = (index + 1) + " " + readings[index].topic;
    option.addEventListener("click", () => {
      closeWordMenu();
      jumpToWord(index, key);
    });
    return option;
  });
  const speaker = document.createElement("button");
  speaker.type = "button";
  speaker.className = "word-menu-item";
  speaker.textContent = "播放发音";
  const status = document.createElement("p");
  status.className = "feedback";
  status.setAttribute("role", "status");
  speaker.addEventListener("click", () => pronounceWord(trigger.textContent, speaker, status));
  wordMenu.replaceChildren(heading, ...options, speaker, status);
  wordMenu.hidden = false;
  wordMenu.scrollTop = 0;
  menuTrigger = trigger;
  const anchor = trigger.getBoundingClientRect();
  const left = point?.x ?? anchor.left;
  const top = point?.y ?? anchor.bottom + 5;
  const rect = wordMenu.getBoundingClientRect();
  const viewport = document.documentElement;
  wordMenu.style.left = Math.max(8, Math.min(left, viewport.clientWidth - rect.width - 8)) + "px";
  wordMenu.style.top = Math.max(8, Math.min(top, viewport.clientHeight - rect.height - 8)) + "px";
  // A finger needs no focus ring; keyboard and mouse users start on the first option.
  if (!byTouch) options[0].focus({ preventScroll: true });
}

function menuWordAt(target) {
  const source = target?.closest?.("[data-word-key]");
  if (!source || !articleLocations.has(source.dataset.wordKey)) return null;
  const trigger = source.closest("button") ?? source.querySelector(".entry-word") ?? source;
  return { key: source.dataset.wordKey, trigger };
}

// Phones send no right-click: holding a finger on a word opens the same menu
// (word-press.js decides; the page only feeds it events and does what it says).
let pressState;
let pressTimer;
let pressWord;
function press(event) {
  const step = wordPress.pressStep(pressState, { ...event, time: performance.now() });
  pressState = step.state;
  if (pressState.phase !== "pressing") clearTimeout(pressTimer);
  return step.effect;
}
document.addEventListener("pointerdown", event => {
  if (!event.isPrimary) return;
  pressWord = menuWordAt(event.target);
  press({ type: "down", touch: event.pointerType === "touch", onWord: Boolean(pressWord), x: event.clientX, y: event.clientY });
  if (pressState.phase !== "pressing") return;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    const effect = press({ type: "timer" });
    if (effect?.open && pressWord?.trigger.isConnected) openWordMenu(pressWord.key, pressWord.trigger, effect.open, true);
  }, wordPress.LONG_PRESS_MS);
});
document.addEventListener("pointermove", event => {
  if (event.isPrimary) press({ type: "move", x: event.clientX, y: event.clientY });
}, { passive: true });
document.addEventListener("pointerup", event => { if (event.isPrimary) press({ type: "up" }); });
document.addEventListener("pointercancel", () => press({ type: "cancel" }));
window.addEventListener("scroll", () => press({ type: "scroll" }), { capture: true, passive: true });
// Capturing on the document runs before the word's own click and before
// listening's sentence tap, so a long-press neither marks nor seeks.
document.addEventListener("click", event => {
  if (press({ type: "click" })?.swallowClick) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener("contextmenu", event => {
  const word = menuWordAt(event.target);
  if (!word) return;
  event.preventDefault();
  if (press({ type: "contextmenu" })?.ignoreContextMenu) return;
  const point = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : undefined;
  openWordMenu(word.key, word.trigger, point);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !wordMenu.hidden) {
    event.preventDefault();
    closeWordMenu(true);
  }
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  const trigger = event.target.closest("button[data-word-key]");
  if (!trigger || !articleLocations.has(trigger.dataset.wordKey)) return;
  event.preventDefault();
  openWordMenu(trigger.dataset.wordKey, trigger);
});
document.addEventListener("pointerdown", event => {
  if (!wordMenu.contains(event.target)) closeWordMenu();
});
window.addEventListener("resize", () => closeWordMenu());
wordMenu.addEventListener("keydown", event => {
  const options = Array.from(wordMenu.querySelectorAll("button"));
  const index = options.indexOf(event.target);
  const last = options.length - 1;
  const nextIndex = { ArrowUp: Math.max(0, index - 1), ArrowDown: Math.min(last, index + 1), Home: 0, End: last }[event.key];
  if (nextIndex === undefined) return;
  event.preventDefault();
  options[nextIndex].focus();
});
wordMenu.addEventListener("focusout", event => {
  if (event.relatedTarget && !wordMenu.contains(event.relatedTarget)) closeWordMenu();
});

function buildVocabularyPage() {
  vocabularyGroups = originalVocabulary.map(([letter, entries]) => {
    const group = document.createElement("section");
    group.className = "vocab-letter-group";
    const heading = document.createElement("h3");
    heading.className = "vocab-letter";
    heading.textContent = letter;
    group.append(heading);
    const rows = entries.map(([key, label, rest]) => {
      const row = document.createElement("div");
      row.className = "vocab-entry";
      row.dataset.wordKey = key;
      const text = document.createElement("p");
      const word = document.createElement("button");
      word.type = "button";
      word.className = "entry-word";
      word.lang = "en";
      word.setAttribute("aria-haspopup", "dialog");
      word.textContent = label;
      word.title = "出现篇目";
      word.dataset.wordKey = key;
      word.addEventListener("click", () => openWordMenu(key, word));
      text.append(word, rest);
      row.append(text);
      group.append(row);
      return { row, searchText: (label + rest).toLowerCase() };
    });
    return { group, rows };
  });
  byId("full-vocabulary-list").replaceChildren(...vocabularyGroups.map(group => group.group));
}

function filterVocabulary() {
  const query = byId("vocab-search").value.trim().toLowerCase();
  let hasMatches = false;
  for (const { group, rows } of vocabularyGroups) {
    let groupHasMatches = false;
    for (const { row, searchText } of rows) {
      const hit = searchText.includes(query);
      row.hidden = !hit;
      groupHasMatches ||= hit;
    }
    group.hidden = !groupHasMatches;
    hasMatches ||= groupHasMatches;
  }
  byId("vocab-empty").hidden = hasMatches;
}

function openVocabulary() {
  setView("vocabulary");
  if (!vocabularyGroups) buildVocabularyPage();
  filterVocabulary();
  byId("full-vocabulary-title").focus();
}


byId("dark-mode").addEventListener("click", () => {
  preferredTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  updateTheme();
  try {
    localStorage.setItem(themeStorageKey, preferredTheme);
  } catch {
    // Keep the selected theme for the current page.
  }
});
systemTheme.addEventListener("change", updateTheme);
updateTheme();

byId("open-vocabulary").addEventListener("click", () => {
  if (currentView === "vocabulary") selectLesson(activeIndex);
  else openVocabulary();
});
byId("vocab-search").addEventListener("input", filterVocabulary);
byId("resume-vocabulary").addEventListener("click", () => selectLesson(activeIndex));
byId("directory-toggle").addEventListener("click", () => {
  directoryClosed = !directoryClosed;
  updateDirectory();
  saveProgress();
  if (!directoryClosed && singleColumn.matches) window.scrollTo({ top: 0 });
});
byId("toggle-bilingual").addEventListener("click", () => {
  showingBilingual = !showingBilingual;
  updateBilingual();
});
byId("open-reader").addEventListener("click", () => {
  if (currentView !== "reader") selectLesson(activeIndex);
});
byId("previous").addEventListener("click", () => {
  if (activeIndex > 0) selectLesson(activeIndex - 1);
});
byId("finish-lesson").addEventListener("click", () => {
  const id = readings[activeIndex].id;
  if (finished.has(id)) finished.delete(id);
  else finished.add(id);
  saveProgress();
  updateProgress();
});
byId("next").addEventListener("click", () => {
  if (activeIndex + 1 < readings.length) selectLesson(activeIndex + 1);
  else location.href = "vocab.html";
});
updateDirectory();
selectLesson(activeIndex, false);
// What listening.js needs from the page. Listening only reads the page,
// switches 中英 and follows a run to its next story; it never saves progress.
window.readingPage = {
  collection, data, passage,
  setName: () => document.querySelector("#site-switch .switch-label")?.textContent.trim() ?? "",
  storyIndex: () => activeIndex,
  storyId: () => readings[activeIndex].id,
  inReader: () => currentView === "reader",
  bilingual: () => showingBilingual,
  setBilingual(on) {
    showingBilingual = on;
    updateBilingual();
  },
  // Shows another story of this set without saving it as the one being read.
  showStory(id) {
    const index = readings.findIndex(lesson => lesson.id === id);
    if (index < 0 || index === activeIndex) return false;
    selectLesson(index, false);
    return true;
  },
  onLessonShown: null
};

// Older readers only keep records for lessons they know, so each collection has its own file.
const githubProgressFile = collection.progressFile;
const githubProgressApi = "https://api.github.com/repos/Frank-Humingtao/zhongkao-reading-progress/contents/";
const githubRecordsKey = collection.recordsKey;
const githubTokenKey = "zhongkao-github-sync-token-v1";
// Every launch of the app is a new browser session, so the app always remembers the token.
const alwaysRememberToken = Boolean(window.zhongkaoApp);
const syncIndices = new Map(allReadings.map((lesson, index) => [lesson.id, index]));
const syncWriter = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const syncDialog = byId("sync-dialog");
const syncMessage = byId("sync-status");
const { mergeRecords: mergeReadingRecords, sameRecords: sameReadingRecords } = progressSync;
let githubToken;
try {
  githubToken = sessionStorage.getItem(githubTokenKey) ?? localStorage.getItem(githubTokenKey);
  if (githubToken && alwaysRememberToken) localStorage.setItem(githubTokenKey, githubToken);
} catch {
  // A token can still be used for the current page.
}
function syncStorage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
function notePending(file, recordsKey, pending) {
  const storage = syncStorage();
  if (storage) progressSync.markPending(storage, file, recordsKey, pending);
}
// Whether this page has changes GitHub does not have yet.
let pendingHere = Boolean(syncStorage() && progressSync.pendingFiles(syncStorage())[githubProgressFile]);

function readingFields() {
  const fields = new Map([["active", readings[activeIndex].id]]);
  for (const id of finished) fields.set("read/" + id, true);
  for (const id of checked) fields.set("checked/" + id, true);
  for (const [id, chosen] of answers) {
    chosen.forEach((letter, index) => { if (letter) fields.set("answer/" + id + "/" + index, letter); });
  }
  marks.forEach((group, index) => {
    for (const [word, example] of group) fields.set("mark/" + allReadings[index].id + "/" + word, example);
  });
  return fields;
}

function validReadingField(field, value) {
  if (field === "active") return readIds.has(value);
  const [kind, id, word, extra] = field.split("/");
  if (kind === "read") return word === undefined && readIds.has(id) && typeof value === "boolean";
  if (kind === "checked") return word === undefined && Boolean(questionCounts.get(id)) && typeof value === "boolean";
  if (kind === "answer") {
    const index = Number(word);
    return extra === undefined && /^\d+$/.test(word ?? "") && index < (questionCounts.get(id) ?? 0)
      && (value === null || LETTERS.includes(value));
  }
  if (kind !== "mark" || extra !== undefined) return false;
  const term = allReadings[syncIndices.get(id)]?.terms.get(word);
  return Boolean(term && (value === null || (Number.isInteger(value) && term.examples[value] !== undefined)));
}

function decodeSyncRecords(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
  return new Map(Object.entries(raw).filter(([field, record]) =>
    Array.isArray(record) && record.length === 3 && Number.isSafeInteger(record[0])
    && record[0] >= 0 && typeof record[1] === "string" && validReadingField(field, record[2])
  ));
}

let progressRecords = decodeSyncRecords(readMarks(githubRecordsKey, {}));
let lastReadingFields = readingFields();
let readingRevision = 0;
let syncClock = 0;
let syncTimer;
let syncQueue = Promise.resolve();
for (const [field, value] of lastReadingFields) {
  if (!progressRecords.has(field) && (field !== "active" || savedProgress.active)) {
    progressRecords.set(field, [0, syncWriter, value]);
  }
}
for (const record of progressRecords.values()) syncClock = Math.max(syncClock, record[0]);

function persistSyncRecords() {
  try {
    localStorage.setItem(githubRecordsKey, JSON.stringify(Object.fromEntries(progressRecords)));
  } catch {
    byId("storage-error").hidden = false;
  }
}

function noteProgressChange() {
  const current = readingFields();
  const fields = new Set([...lastReadingFields.keys(), ...current.keys()]);
  const changed = [...fields].filter(field => lastReadingFields.get(field) !== current.get(field));
  if (!changed.length) return;
  syncClock = Math.max(Date.now(), syncClock + 1);
  for (const field of changed) {
    const value = current.has(field) ? current.get(field)
      : field.startsWith("read/") || field.startsWith("checked/") ? false : null;
    progressRecords.set(field, [syncClock, syncWriter, value]);
  }
  lastReadingFields = current;
  readingRevision++;
  persistSyncRecords();
  pendingHere = true;
  notePending(githubProgressFile, githubRecordsKey, true);
  if (githubToken) {
    syncMessage.textContent = "待同步";
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => requestSync(), 1000);
  }
}

function applySyncedProgress(remote, resume) {
  const merged = mergeReadingRecords(progressRecords, remote);
  const changed = !sameReadingRecords(merged, progressRecords);
  progressRecords = merged;
  if (changed) {
    marks.forEach(group => group.clear());
    finished.clear();
    answers.clear();
    checked.clear();
    for (const [field, [clock, , value]] of merged) {
      syncClock = Math.max(syncClock, clock);
      const [kind, id, word] = field.split("/");
      if (kind === "read" && value) finished.add(id);
      if (kind === "checked" && value) checked.add(id);
      if (kind === "answer" && value) chosenFor(id)[Number(word)] = value;
      if (kind === "mark" && value !== null) marks[syncIndices.get(id)].set(word, value);
    }
  }
  const resumeIndex = syncIndices.get(merged.get("active")?.[2]);
  if (resume && currentView === "reader" && resumeIndex !== undefined && resumeIndex !== activeIndex) {
    selectLesson(resumeIndex, false);
  } else if (changed) {
    for (const [word, buttons] of visibleWords) {
      for (const button of buttons) button.setAttribute("aria-pressed", marks[activeIndex].has(word));
    }
    renderInlineGlosses();
    renderQuestions();
    updateProgress();
  }
  lastReadingFields = readingFields();
  writeLocalProgress();
  persistSyncRecords();
}

const syncer = progressSync.createSyncer({
  fetch: (...args) => fetch(...args), url: githubProgressApi + githubProgressFile, decode: decodeSyncRecords
});
let syncAbort;
let syncStartedAt = 0;
let hiddenAt = -1;
let requestedRevision = -1;

function requestSync(resume = false) {
  const token = githubToken;
  if (!token) return;
  const revision = readingRevision;
  requestedRevision = revision;
  clearTimeout(syncTimer);
  syncQueue = syncQueue.then(async () => {
    if (token !== githubToken) return;
    syncMessage.textContent = "正在同步…";
    const controller = new AbortController();
    syncAbort = controller;
    syncStartedAt = Date.now();
    try {
      const merged = await syncer.sync(token, () => progressRecords, {
        isCurrent: () => token === githubToken, abort: controller.signal
      });
      if (!merged || token !== githubToken) return;
      const hasPendingChanges = !sameReadingRecords(mergeReadingRecords(merged, progressRecords), merged);
      applySyncedProgress(merged, resume && revision === readingRevision);
      if (!hasPendingChanges) {
        pendingHere = false;
        notePending(githubProgressFile, githubRecordsKey, false);
      }
      syncMessage.textContent = hasPendingChanges ? "待同步" : "已同步";
    } catch (error) {
      // A sync the phone froze was ended for a fresh one, which follows.
      if (token !== githubToken || controller.signal.aborted) return;
      syncMessage.textContent = error instanceof TypeError || error.name === "TimeoutError"
        ? "暂时连不上 GitHub，联网后可重试。" : error.message;
    } finally {
      if (syncAbort === controller) syncAbort = undefined;
    }
  });
  return syncQueue;
}

// Changes made on another reading set's page that left before its sync finished.
// They are merged into that set's file as they are, without reading them here.
let pushingOtherSets = false;
async function syncOtherSets() {
  const token = githubToken;
  const storage = syncStorage();
  if (!token || !storage || pushingOtherSets) return;
  pushingOtherSets = true;
  try {
    for (const [file, recordsKey] of Object.entries(progressSync.pendingFiles(storage))) {
      if (file === githubProgressFile || typeof recordsKey !== "string") continue;
      const saved = storage.getItem(recordsKey);
      const local = progressSync.wellFormedRecords(readMarks(recordsKey, {}));
      const other = progressSync.createSyncer({
        fetch: (...args) => fetch(...args), url: githubProgressApi + file, decode: progressSync.wellFormedRecords
      });
      try {
        await other.sync(token, () => local, { isCurrent: () => token === githubToken });
      } catch {
        continue;
      }
      if (token !== githubToken) return;
      // Changed again meanwhile: leave it for that set's own page.
      if (storage.getItem(recordsKey) === saved) notePending(file, recordsKey, false);
    }
  } finally {
    pushingOtherSets = false;
  }
}

// Leaving: send what is waiting now (the write uses keepalive).
function flushSync() {
  if (pendingHere && requestedRevision !== readingRevision) requestSync();
}

// Back on screen: a sync started before the phone suspended the page may be
// stuck on a request that will never answer, so it is ended and run afresh.
function resumeSync() {
  if (syncAbort && syncStartedAt <= hiddenAt) syncAbort.abort();
  requestSync(true);
  syncOtherSets();
}

function showSyncConnection() {
  byId("sync-form").hidden = Boolean(githubToken);
  byId("sync-actions").hidden = !githubToken;
}

byId("open-sync").addEventListener("click", () => syncDialog.showModal());
byId("close-sync").addEventListener("click", () => syncDialog.close());
byId("sync-form").addEventListener("submit", event => {
  event.preventDefault();
  const field = byId("sync-token");
  const entered = field.value.trim();
  if (!/^github_pat_[A-Za-z0-9_]+$/.test(entered)) {
    syncMessage.textContent = "请输入 GitHub 细粒度令牌。";
    return;
  }
  githubToken = entered;
  try {
    if (alwaysRememberToken || byId("remember-sync").checked) localStorage.setItem(githubTokenKey, entered);
    else sessionStorage.setItem(githubTokenKey, entered);
  } catch {
    // The selected credential remains usable in memory.
  }
  field.value = "";
  showSyncConnection();
  requestSync(true);
  syncOtherSets();
});
byId("sync-now").addEventListener("click", () => {
  requestSync(true);
  syncOtherSets();
});
byId("disconnect-sync").addEventListener("click", () => {
  githubToken = undefined;
  clearTimeout(syncTimer);
  try {
    sessionStorage.removeItem(githubTokenKey);
    localStorage.removeItem(githubTokenKey);
  } catch {
    // Disconnect the current page even if storage is unavailable.
  }
  syncMessage.textContent = "";
  showSyncConnection();
});
window.addEventListener("online", () => {
  requestSync(true);
  syncOtherSets();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") return resumeSync();
  hiddenAt = Date.now();
  flushSync();
});
// Safari leaving for another page or keeping this one in its back cache; Chrome freezing it.
window.addEventListener("pagehide", flushSync);
document.addEventListener("freeze", flushSync);
window.addEventListener("pageshow", event => {
  if (event.persisted) resumeSync();
});
showSyncConnection();
requestSync(true);
syncOtherSets();

// listening.js attaches once the page is ready.
window.dispatchEvent(new Event("readingpage"));
