// Narration: what listening speaks for a story. Shared by the reading page and
// track generation (scripts/narration-plan.mjs), so both agree on the sentence
// pairs and on the narration key that names a story's tracks.

import { EDITION_SCRIPTS, editionFromSource, embeddedJson, readingPlainText, splitSentences } from "./vocab-context.js";

const SCREENING_NAME = "筛选短文";

// Kokoro-82M voices (ADR-0002). Bump GENERATOR_VERSION when the way tracks are
// made changes (voices, gaps, encoding), so every story gets fresh tracks.
export const VOICES = { en: "am_michael", zh: "zm_yunjian" };
export const GENERATOR_VERSION = 1;

// A stable name for a story's tracks: a hash of what is spoken and how. Same
// text, same key (tracks are reused); any edit gives a new key.
export async function narrationKey(pairs) {
  const canonical = JSON.stringify({
    version: GENERATOR_VERSION,
    voices: [VOICES.en, VOICES.zh],
    pairs: pairs.map(({ en, zh }) => [en, zh])
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

const spoken = text => readingPlainText(text).trim();

// A reading-set or news-edition story: paragraphs of [english, chinese] pairs.
export function storyPairs(story) {
  return (story.paragraphs || []).flat().map(([en, zh]) => ({ en: spoken(en), zh: String(zh || "").trim() }));
}

// A screening passage: whole English paragraphs, split the way the page splits
// them, with one Chinese rendering per sentence (the page's bilingual-text).
export function screeningPairs(lesson, chineseParagraphs = []) {
  return (lesson.paragraphs || []).flatMap((paragraph, paragraphIndex) =>
    splitSentences(paragraph).map((en, sentenceIndex) => ({
      en: spoken(en),
      zh: String(chineseParagraphs?.[paragraphIndex]?.[sentenceIndex] || "").trim()
    })));
}

// The stories of a reading set or news edition (`set`, as its script defines
// it), with their illustrations under the set id the switcher uses (reading-02
// for reading-02-v3): {id, title, artwork, pairs}. artwork is a site-relative
// path, or null for a story without an illustration.
export function setStories(set, setId) {
  return (set?.stories || []).map(story => {
    const illustration = Array.isArray(story.illustration) ? story.illustration[0] : null;
    return {
      id: story.id, title: story.title || "",
      artwork: illustration ? `images/${setId}/${illustration}` : null,
      pairs: storyPairs(story)
    };
  });
}

// The screening passages, the same way.
export function screeningStories(screening, bilingualText = {}) {
  return (screening?.lessons || []).map(lesson => ({
    id: lesson.id, title: lesson.title || "",
    artwork: `images/screening/${lesson.id}.jpg`,
    pairs: screeningPairs(lesson, bilingualText?.[lesson.id])
  }));
}

// The reading sets and news editions in the set switcher (site-nav.js), with
// the label it shows: "01 生词复现" for a reading set, the title for news.
function listedSets(siteNav) {
  const pattern = /\{ id: "([^"]+)", number: "([^"]+)", name: "([^"]+)"(?:, title: "([^"]+)")? \}/g;
  return [...String(siteNav).matchAll(pattern)].map(([, id, number, name, title]) =>
    ({ id, name: title || number + " " + name }));
}

// The edition scripts index.html actually loads, i.e. the version of each set
// the page shows (reading-02-v3, not the replaced reading-02).
function shownEditions(html) {
  const loaded = new Set([...String(html).matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]));
  return EDITION_SCRIPTS.filter(([, file]) => loaded.has(file));
}

// Every story the site can show, in the order the page lists them: screening
// passages, then each reading set and news edition. Sources are passed in so
// node and the browser can load them their own way; `load(file)` returns the
// text of an edition script.
export async function narrationStories({ html, siteNav, load }) {
  const stories = [];
  for (const story of screeningStories(embeddedJson(html, "screening-data"), embeddedJson(html, "bilingual-text") || {})) {
    stories.push({ edition: "screening", set: "screening", setName: SCREENING_NAME, ...story });
  }
  const sets = listedSets(siteNav);
  for (const [editionId, file, binding] of shownEditions(html)) {
    const set = sets.find(item => item.id === editionId || editionId.startsWith(item.id + "-v"));
    if (!set) continue;
    for (const story of setStories(editionFromSource(await load(file), binding), set.id)) {
      stories.push({ edition: editionId, set: set.id, setName: set.name, ...story });
    }
  }
  for (const story of stories) story.key = await narrationKey(story.pairs);
  return stories;
}
