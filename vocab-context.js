// Lesson lookup for the 生词 board. Tokenization matches the reading page so a
// mark's example index points at the same sentence.

import { loadBaseDictionary, loadCollection, loadDictionary, loadManifest } from "./content.js";
import { addTerm, atSentenceStart, collectionGlossary, createWordMeaning } from "./word-meaning.js";

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

// One lesson's words, keyed by their term key. `meanings` is the lesson's lookup from
// word-meaning.js, which gives every word its key and meaning.
function buildIndexedLesson(lesson, meanings, wordPattern) {
  const terms = new Map();
  const pattern = new RegExp([...meanings.phrasePatterns, wordPattern.source].join("|"), "giu");

  // A title is title-cased, so each of its words counts as a sentence start.
  function tokenize(text, chinese, isTitle = false) {
    text = readingPlainText(text);
    for (const match of text.matchAll(pattern)) {
      const surface = match[0];
      const sentenceStart = isTitle || atSentenceStart(text, match.index);
      addTerm(terms, meanings.lookup(surface, { sentenceStart })).examples.push({
        surface,
        sentence: text,
        offset: match.index,
        chinese: chinese || ""
      });
    }
  }

  tokenize(readingPlainText(lesson.title || ""), "", true);
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

// Full-width parenthetical glosses, like spacecraft（航天器）, are reading aids.
// They are removed before tokenization so Chinese does not become a word and
// does not shift example indexes. Text with no gloss is returned unchanged.
export function readingPlainText(text) {
  const source = String(text);
  if (!source.includes("（")) return source;
  return source.replace(/（[^）]*）/g, " ").replace(/[ \t]{2,}/g, " ").replace(/ ([.,;:!?])/g, "$1");
}

export function buildCatalog({
  screening,
  bilingual = {},
  extraMeanings = {},
  baseDictionary = {},
  editions = {},
  trialLessons = [],
  trialGlossary = null
} = {}) {
  const dictionary = screening?.dictionary || {};
  const wordPattern = wordPatternFromDictionary(dictionary);
  const meanings = createWordMeaning({ dictionary, forms: screening?.forms || {}, extraMeanings, baseDictionary });
  const bySource = new Map();
  const titles = new Map();
  // Headwords of the site's own word lists, so base-form.js can tell a real word
  // ("building", "tired") from an inflected one.
  const headwords = new Set();
  const addHeadword = word => {
    if (typeof word === "string" && word && !word.includes(" ")) headwords.add(word.toLocaleLowerCase("en"));
  };
  Object.keys(dictionary).forEach(addHeadword);
  Object.values(screening?.forms || {}).forEach(addHeadword);
  Object.keys(trialGlossary || {}).forEach(addHeadword);

  if (screening?.lessons) {
    const lessons = new Map();
    for (const lesson of screening.lessons) {
      const targets = Object.fromEntries([...(lesson.primary || []), ...(lesson.review || [])].map(key => [key, []]));
      const sentences = (lesson.paragraphs || []).map(splitSentences);
      const chinese = sentences.map((paragraph, index) => alignedChinese(paragraph, bilingual?.[lesson.id]?.[index]));
      titles.set("screening/" + lesson.id, lesson.title || "");
      lessons.set(lesson.id, buildIndexedLesson({
        ...lesson, sentences, chinese
      }, meanings.forLesson({ targets, overrides: lesson.overrides }), wordPattern));
    }
    if (trialLessons.length && trialGlossary) {
      for (const lesson of trialLessons) {
        const sentences = (lesson.paragraphs || []).map(splitSentences);
        lessons.set(lesson.id, buildIndexedLesson({
          ...lesson, sentences, chinese: []
        }, meanings.forLesson({
          collection: trialGlossary, targets: lesson.targets, overrides: lesson.overrides, useWordList: false
        }), wordPattern));
      }
    }
    bySource.set("screening", lessons);
  }

  for (const [sourceId, edition] of Object.entries(editions)) {
    if (!edition?.stories || !edition?.words) continue;
    Object.keys(edition.words).forEach(addHeadword);
    const lessonMeanings = meanings.forLesson({ collection: collectionGlossary(edition.words), targets: edition.words });
    const lessons = new Map();
    for (const story of edition.stories) {
      const sentences = (story.paragraphs || []).map(paragraph => paragraph.map(([english]) => english));
      const chinese = (story.paragraphs || []).map(paragraph => paragraph.map(([, translated]) => translated || ""));
      titles.set(sourceId + "/" + story.id, story.title || "");
      lessons.set(story.id, buildIndexedLesson({
        id: story.id,
        title: story.title,
        sentences,
        chinese
      }, lessonMeanings, wordPattern));
    }
    bySource.set(sourceId, lessons);
  }

  return {
    sources: [...bySource.keys()],
    headwords,
    // Every lesson's words: [sourceId, lessonId, key, { display, meaning, source, examples }].
    *terms() {
      for (const [sourceId, lessons] of bySource) {
        for (const [lessonId, terms] of lessons) {
          for (const [key, term] of terms) yield [sourceId, lessonId, key, term];
        }
      }
    },
    title(sourceId, lessonId) {
      return titles.get(sourceId + "/" + lessonId) || "";
    },
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

// Every collection's words and stories, keyed the way marks are stored: by
// version id. A collection whose file is missing or malformed is left out; its
// words still show, only without their sentence.
export async function loadWordCatalog(readText) {
  const [dictionary, { collections }, baseDictionary] = await Promise.all([
    loadDictionary(readText), loadManifest(readText), loadBaseDictionary(readText)
  ]);
  const editions = {};
  let placement = null;
  await Promise.all(collections.map(async collection => {
    const { data } = await loadCollection(readText, collection);
    if (!data) return;
    if (collection.legacyScreening) placement = data;
    else editions[collection.version] = data;
  }));
  return buildCatalog({
    screening: { dictionary: dictionary.dictionary, forms: dictionary.forms, lessons: placement?.lessons },
    bilingual: placement?.chinese || {},
    extraMeanings: dictionary.extraMeanings || {},
    baseDictionary,
    trialLessons: placement?.legacy?.trialLessons || [],
    trialGlossary: placement?.legacy?.trialGlossary || null,
    editions
  });
}
