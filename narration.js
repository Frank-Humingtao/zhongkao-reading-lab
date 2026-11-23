// Narration: what listening speaks for a story. Shared by the reading page and
// track generation (scripts/narration-plan.mjs), so both agree on the sentence
// pairs and on the narration key that names a story's tracks.

import { loadCollection, loadManifest, storyPicture } from "./content.js";
import { readingPlainText, splitSentences } from "./vocab-context.js";

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

// The stories of one collection (its file's contents as `data`), in reading
// order: {id, title, artwork, pairs}. artwork is a site-relative path, or null
// for a story without a picture. Placement 01 keeps its own older shape: whole
// English paragraphs with the Chinese alongside.
export function collectionStories(collection, data) {
  if (collection.legacyScreening) {
    return (data?.lessons || []).map(lesson => ({
      id: lesson.id, title: lesson.title || "",
      artwork: storyPicture(collection, lesson).src,
      pairs: screeningPairs(lesson, data.chinese?.[lesson.id])
    }));
  }
  return (data?.stories || []).map(story => ({
    id: story.id, title: story.title || "",
    artwork: storyPicture(collection, story)?.src ?? null,
    pairs: storyPairs(story)
  }));
}

// Every story the site can show, in the order the switcher lists collections
// (content/index.json): {edition, set, setName, id, title, artwork, pairs, key}.
// `edition` is the file's version id (reading-02-v3), `set` the collection id.
// A collection whose file is malformed is left out. `readText(path)` loads a
// site file, so node and the browser can each read files their own way.
export async function narrationStories(readText) {
  const stories = [];
  for (const collection of (await loadManifest(readText)).collections) {
    const { data } = await loadCollection(readText, collection);
    if (!data) continue;
    for (const story of collectionStories(collection, data)) {
      stories.push({ edition: collection.version, set: collection.id, setName: collection.label, ...story });
    }
  }
  for (const story of stories) story.key = await narrationKey(story.pairs);
  return stories;
}
