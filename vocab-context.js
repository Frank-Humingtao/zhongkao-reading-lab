// Lesson lookup for the 生词 board. Tokenization matches the reading page so a
// mark's example index points at the same sentence.

const sentencePattern = /[^.!?]+[.!?]+(?:["”'’])?|[^.!?]+$/g;

function escapePattern(text) {
  return text.replace(/[.*+?^\u007b\u007d()|[\]\\]/g, "\\$&");
}

export function splitSentences(text) {
  const masked = text.replace(/\b(?:[A-Za-z]\.){2,}|\b(?:Mr|Mrs|Ms)\.(?=\s+[A-Z])|\bNo\.(?=\s*\d)/g,
    (abbreviation, offset) => {
      const dots = abbreviation.replaceAll(".", "∙");
      const next = text.slice(offset + abbreviation.length);
      const hasSeveralDots = abbreviation.indexOf(".") !== abbreviation.lastIndexOf(".");
      return hasSeveralDots && /^\s+(?:I|He|She|It|We|They|The|A|An)\b/.test(next)
        ? dots.slice(0, -1) + "." : dots;
    }
  );
  const sentences = [];
  for (const match of masked.matchAll(sentencePattern)) {
    const sentence = text.slice(match.index, match.index + match[0].length).trim();
    if (/^[a-z]/.test(sentence) && /[!?]["”]$/.test(sentences.at(-1) ?? "")) {
      sentences[sentences.length - 1] += " " + sentence;
    } else {
      sentences.push(sentence);
    }
  }
  return sentences;
}

export function wordPatternFromDictionary(dictionary) {
  const abbreviations = Object.keys(dictionary || {}).filter(key => key.includes(".")).map(escapePattern);
  const prefix = abbreviations.length ? abbreviations.join("|") + "|" : "";
  return new RegExp(prefix + "[\\p{L}]+(?:['’\\-][\\p{L}]+)*", "giu");
}

export function glossaryFromScreening(screening) {
  return Object.fromEntries(Object.entries(screening?.forms || {}).map(([surface, key]) => {
    const [display, meaning] = screening.dictionary?.[key] || [key, ""];
    return [surface, [key, meaning, display]];
  }));
}

function buildIndexedLesson(lesson, definitions, wordPattern, extraMeanings, dictionary) {
  const terms = new Map();
  const targetKeys = new Map();
  const phrases = new Set(Object.keys(definitions).filter(key => key.includes(" ")));
  for (const [key, value] of Object.entries(lesson.targets || {})) {
    const forms = Array.isArray(value) ? value.slice(1) : [];
    for (const form of [key, ...forms]) targetKeys.set(form, key);
    if (key.includes(" ")) phrases.add(key);
  }
  const phrasePatterns = [...phrases].sort((left, right) => right.length - left.length)
    .map(phrase => escapePattern(phrase) + "(?![\\p{L}])");
  const pattern = new RegExp([...phrasePatterns, wordPattern.source].join("|"), "giu");

  function tokenize(text, chinese) {
    for (const match of text.matchAll(pattern)) {
      const surface = match[0];
      const normalized = surface.toLowerCase().replaceAll("’", "'");
      let entry = Object.hasOwn(definitions, surface) ? definitions[surface]
        : Object.hasOwn(definitions, normalized) ? definitions[normalized] : undefined;
      const override = lesson.overrides?.[normalized];
      if (override && dictionary?.[override]) {
        const [display, meaning] = dictionary[override];
        entry = [override, meaning, display];
      }
      const key = targetKeys.get(normalized) ?? entry?.[0] ?? normalized;
      const meaning = lesson.targets?.[key]?.[0] ?? entry?.[1] ?? extraMeanings?.[normalized] ?? "";
      const display = entry?.[2] ?? key;
      if (!terms.has(key)) terms.set(key, { display, meaning, examples: [] });
      terms.get(key).examples.push({
        surface,
        sentence: text,
        offset: match.index,
        chinese: chinese || ""
      });
    }
  }

  tokenize(lesson.title || "", "");
  const paragraphs = lesson.sentences || (lesson.paragraphs || []).map(splitSentences);
  paragraphs.forEach((sentences, paragraphIndex) => {
    sentences.forEach((sentence, sentenceIndex) => {
      tokenize(sentence, lesson.chinese?.[paragraphIndex]?.[sentenceIndex] || "");
    });
  });
  return terms;
}

function alignedChinese(sentences, chineseSentences) {
  if (!Array.isArray(chineseSentences) || chineseSentences.length !== sentences.length) {
    return sentences.map(() => "");
  }
  return chineseSentences;
}

export function embeddedJson(html, id) {
  const match = String(html).match(new RegExp(
    `<script type="application/json" id="${id}">\\s*([\\s\\S]*?)\\s*</script>`
  ));
  if (!match) return null;
  return JSON.parse(match[1]);
}

export function editionFromSource(source, binding) {
  if (!/^[A-Za-z_$][\w$]*$/.test(binding)) throw new Error("invalid binding");
  return new Function(`${source}\nreturn ${binding};`)();
}

export function buildCatalog({
  screening,
  bilingual = {},
  extraMeanings = {},
  editions = {},
  trialLessons = [],
  trialGlossary = null
} = {}) {
  const dictionary = screening?.dictionary || {};
  const wordPattern = wordPatternFromDictionary(dictionary);
  const baseGlossary = glossaryFromScreening(screening);
  const bySource = new Map();

  if (screening?.lessons) {
    const lessons = new Map();
    for (const lesson of screening.lessons) {
      const targets = Object.fromEntries([...(lesson.primary || []), ...(lesson.review || [])].map(key => [key, []]));
      const sentences = (lesson.paragraphs || []).map(splitSentences);
      const chinese = sentences.map((paragraph, index) => alignedChinese(paragraph, bilingual?.[lesson.id]?.[index]));
      lessons.set(lesson.id, buildIndexedLesson({
        ...lesson, targets, sentences, chinese
      }, baseGlossary, wordPattern, extraMeanings, dictionary));
    }
    if (trialLessons.length && trialGlossary) {
      for (const lesson of trialLessons) {
        const sentences = (lesson.paragraphs || []).map(splitSentences);
        lessons.set(lesson.id, buildIndexedLesson({
          ...lesson, sentences, chinese: []
        }, trialGlossary, wordPattern, extraMeanings, dictionary));
      }
    }
    bySource.set("screening", lessons);
  }

  for (const [sourceId, edition] of Object.entries(editions)) {
    if (!edition?.stories || !edition?.words) continue;
    const definitions = { ...baseGlossary };
    for (const [key, value] of Object.entries(edition.words)) {
      const [meaning, ...forms] = Array.isArray(value) ? value : [""];
      for (const form of [key, ...forms]) definitions[form] = [key, meaning, key];
    }
    const lessons = new Map();
    for (const story of edition.stories) {
      const sentences = (story.paragraphs || []).map(paragraph => paragraph.map(([english]) => english));
      const chinese = (story.paragraphs || []).map(paragraph => paragraph.map(([, translated]) => translated || ""));
      lessons.set(story.id, buildIndexedLesson({
        id: story.id,
        title: story.title,
        targets: edition.words,
        sentences,
        chinese
      }, definitions, wordPattern, extraMeanings, dictionary));
    }
    bySource.set(sourceId, lessons);
  }

  return {
    sources: [...bySource.keys()],
    lookup(sourceId, lessonId, word, exampleIndex) {
      const terms = bySource.get(sourceId)?.get(lessonId);
      if (!terms || typeof word !== "string") return null;
      const term = terms.get(word) || terms.get(word.toLocaleLowerCase("en"));
      if (!term) return null;
      const example = term.examples[exampleIndex];
      if (!example) {
        return { display: term.display || word, meaning: term.meaning || "", surface: term.display || word, sentence: "", offset: -1, chinese: "" };
      }
      return {
        display: term.display || word,
        meaning: term.meaning || "",
        surface: example.surface,
        sentence: example.sentence,
        offset: example.offset,
        chinese: example.chinese || ""
      };
    }
  };
}

export const EDITION_SCRIPTS = [
  ["reading-01", "reading-01.js", "memoryReadingSet"],
  ["reading-02-v2", "reading-02-v2.js", "readingSet02"],
  ["reading-02-v3", "reading-02-v3.js", "readingSet02"],
  ["reading-02", "reading-02.js", "readingSet02"],
  ["reading-03", "reading-03.js", "readingSet03"],
  ["reading-03-v2", "reading-03-v2.js", "readingSet03"]
];
