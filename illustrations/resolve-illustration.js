// Image file for one reading-set story.
// Sets 01–03 keep the filename stored on the story (illustration[0]).
// Set 04 and later always use <story id>.jpg inside images/<set id>/.
// derivedNamesFromSet in illustrations/editions.json must stay in step with DERIVED_FROM.
(function (root) {
  var DERIVED_FROM = 4;

  function setNumber(setId) {
    var match = /^reading-(\d+)$/.exec(setId || "");
    return match ? Number(match[1]) : 0;
  }

  function captionOf(illustration) {
    if (typeof illustration === "string") return illustration.trim();
    if (Array.isArray(illustration) && illustration.length >= 2) return String(illustration[1] || "").trim();
    return "";
  }

  function resolveStoryIllustration(story, setId) {
    var illustration = story && story.illustration;
    if (setNumber(setId) >= DERIVED_FROM) {
      var caption = captionOf(illustration);
      if (!caption) caption = (story && (story.topic || story.title)) || "";
      return [story.id + ".jpg", caption];
    }
    if (Array.isArray(illustration) && illustration.length >= 2 && illustration[0]) return illustration;
    return null;
  }

  root.resolveStoryIllustration = resolveStoryIllustration;
  root.derivedIllustrationSetNumber = DERIVED_FROM;
})(typeof globalThis !== "undefined" ? globalThis : this);
