"""Make listening tracks with Kokoro and, optionally, publish them to GitHub Releases.

Reads the narration plan (node scripts/narration-plan.mjs), skips every narration
key the catalog already has, and for each remaining story writes

    <key>.en.m4a   English track (am_michael), mono AAC
    <key>.zh.m4a   Chinese track (zm_yunjian), mono AAC
    <key>.json     timings: each sentence's [start, end] in seconds in each track

Each sentence is synthesized on its own and the sentences are joined with a short
silence inside the track; timings exclude that silence, so the player can cut
exact clips and add its own pauses.

    node scripts/narration-plan.mjs --set reading-01 > plan.json
    uv run --project scripts/tracks python scripts/tracks/generate.py --plan plan.json --out out
    uv run --project scripts/tracks python scripts/tracks/generate.py --plan plan.json --out out \
        --publish --repo Frank-Humingtao/zhongkao-reading-lab

With --publish, tracks go to rotating prerelease releases tracks-001, tracks-002, …
and catalog.json to the release tracks-catalog. Nothing is ever committed. One
story failing is logged and skipped; the rest are still published, and the run
exits non-zero at the end so the failure is visible.
"""

import argparse
import ctypes.util
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import traceback

import numpy as np

SAMPLE_RATE = 24000
GAP_SECONDS = 0.25  # silence between sentences inside a track (not part of any sentence)
EDGE_PAD_SECONDS = 0.04  # kept around each sentence after trimming Kokoro's own silence
BITRATE = "48k"
REPO_ID = "hexgrad/Kokoro-82M"
CATALOG_TAG = "tracks-catalog"
CATALOG_ASSET = "catalog.json"
TRACKS_PREFIX = "tracks-"
MAX_ASSETS_PER_RELEASE = 900  # GitHub allows 1000; leave room for retries
ASSETS_PER_STORY = 3
CATALOG_EVERY = 10  # stories between catalog uploads during a long run


def log(*parts):
    print(*parts, flush=True)


# --- espeak-ng -------------------------------------------------------------
# misaki's English fallback uses espeak-ng through espeakng_loader. Its bundled
# data is not used: point it at the system espeak-ng (Homebrew on macOS,
# apt's espeak-ng on Linux), or at ESPEAK_LIBRARY / ESPEAK_DATA.

def system_espeak():
    library = os.environ.get("ESPEAK_LIBRARY")
    data = os.environ.get("ESPEAK_DATA")
    if sys.platform == "darwin":
        library = library or "/opt/homebrew/lib/libespeak-ng.dylib"
        data = data or "/opt/homebrew/share/espeak-ng-data"
    else:
        library = library or ctypes.util.find_library("espeak-ng")
        if not data:
            for candidate in ["/usr/lib/x86_64-linux-gnu/espeak-ng-data",
                              "/usr/lib/aarch64-linux-gnu/espeak-ng-data",
                              "/usr/share/espeak-ng-data"]:
                if os.path.isdir(candidate):
                    data = candidate
                    break
    if not library or not data:
        raise SystemExit("espeak-ng not found: install it or set ESPEAK_LIBRARY and ESPEAK_DATA")
    return library, data


def kokoro_voices(voices):
    library, data = system_espeak()
    import espeakng_loader
    espeakng_loader.get_library_path = lambda: library
    espeakng_loader.get_data_path = lambda: data
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(library)
    EspeakWrapper.set_data_path(data)

    from kokoro import KModel, KPipeline
    model = KModel(repo_id=REPO_ID).eval()
    english = KPipeline(lang_code="a", repo_id=REPO_ID, model=model)

    def english_phonemes(text):
        return english.g2p(text)[0]

    # Kokoro-82M's Chinese phonemizer ignores en_callable and passes Latin
    # letters through as they are, so （NASA） came out as "EZ" and CD or X
    # were dropped. Latin words get English phonemes instead (acronyms are
    # spelled letter by letter by the English phonemizer, NASA said as a word).
    chinese = KPipeline(lang_code="z", repo_id=REPO_ID, model=model)
    chinese_g2p = chinese.g2p
    chinese.g2p = lambda text: (mixed_phonemes(text, lambda part: chinese_g2p(part)[0], english_phonemes), None)
    pipelines = {"en": (english, voices["en"]), "zh": (chinese, voices["zh"])}

    def speak(language, text):
        pipeline, voice = pipelines[language]
        chunks = [np.asarray(result.audio, dtype=np.float32) for result in pipeline(text, voice=voice)
                  if result.audio is not None]
        if not chunks:
            raise RuntimeError(f"no audio for {language} sentence: {text!r}")
        return trim(np.concatenate(chunks))

    return speak


LATIN_RUN = re.compile(r"[A-Za-z]+(?:[ '\-]+[A-Za-z]+)*")


def mixed_phonemes(text, chinese, english):
    """Phonemes for a Chinese sentence: Latin words (NASA, Unreal Engine, CD)
    through `english`, everything else (Chinese, digits, punctuation) through
    `chinese`, joined by spaces."""
    parts, cursor = [], 0
    for match in LATIN_RUN.finditer(text):
        parts.append(("zh", text[cursor:match.start()]))
        parts.append(("en", match.group()))
        cursor = match.end()
    parts.append(("zh", text[cursor:]))
    speak = {"zh": chinese, "en": english}
    return " ".join(speak[language](part.strip()) for language, part in parts if part.strip())


def trim(audio, threshold=0.004):
    loud = np.flatnonzero(np.abs(audio) > threshold)
    if not len(loud):
        return audio
    pad = int(EDGE_PAD_SECONDS * SAMPLE_RATE)
    return audio[max(0, loud[0] - pad):min(len(audio), loud[-1] + pad + 1)]


# --- tracks ------------------------------------------------------------------

def assemble(clips):
    """Join sentence clips with a gap; return the audio and each sentence's [start, end]."""
    gap = np.zeros(int(GAP_SECONDS * SAMPLE_RATE), dtype=np.float32)
    parts, spans, cursor = [], [], 0
    for index, clip in enumerate(clips):
        if index:
            parts.append(gap)
            cursor += len(gap)
        spans.append([round(cursor / SAMPLE_RATE, 3), round((cursor + len(clip)) / SAMPLE_RATE, 3)])
        parts.append(clip)
        cursor += len(clip)
    return np.concatenate(parts), spans, round(cursor / SAMPLE_RATE, 3)


def encode(audio, path):
    import imageio_ffmpeg
    import soundfile
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
        wav = handle.name
    try:
        soundfile.write(wav, audio, SAMPLE_RATE, subtype="PCM_16")
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", wav,
                        "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "aac", "-b:a", BITRATE,
                        "-movflags", "+faststart", path], check=True)
    finally:
        os.unlink(wav)


def make_tracks(story, plan, speak, out):
    key = story["key"]
    tracks = {}
    for language in ("en", "zh"):
        clips = [speak(language, pair[language]) for pair in story["pairs"]]
        audio, spans, duration = assemble(clips)
        encode(audio, os.path.join(out, f"{key}.{language}.m4a"))
        tracks[language] = (spans, duration)
    timings = {
        "key": key,
        "generatorVersion": plan["generatorVersion"],
        "voices": plan["voices"],
        "durationEn": tracks["en"][1],
        "durationZh": tracks["zh"][1],
        "sentences": [{"en": en, "zh": zh} for en, zh in zip(tracks["en"][0], tracks["zh"][0])],
    }
    with open(os.path.join(out, f"{key}.json"), "w", encoding="utf-8") as handle:
        json.dump(timings, handle, ensure_ascii=False)
    return timings


# --- GitHub Releases ---------------------------------------------------------

def gh(*args, check=True):
    return subprocess.run(["gh", *args], check=check, capture_output=True, text=True)


def empty_catalog():
    return {"version": 1, "generatedAt": None, "tracks": {}}


def fetch_catalog(repo):
    with tempfile.TemporaryDirectory() as folder:
        result = gh("release", "download", CATALOG_TAG, "-R", repo, "-p", CATALOG_ASSET, "-D", folder, check=False)
        if result.returncode:
            if "release not found" in result.stderr.lower() or "no assets" in result.stderr.lower():
                return empty_catalog()
            raise SystemExit(f"could not read the catalog: {result.stderr.strip()}")
        with open(os.path.join(folder, CATALOG_ASSET), encoding="utf-8") as handle:
            return json.load(handle)


def release_exists(repo, tag):
    return gh("release", "view", tag, "-R", repo, "--json", "tagName", check=False).returncode == 0


def ensure_release(repo, tag, title, notes):
    if not release_exists(repo, tag):
        gh("release", "create", tag, "-R", repo, "--prerelease", "--title", title, "--notes", notes)


def publish_catalog(repo, catalog):
    ensure_release(repo, CATALOG_TAG, "Listening tracks catalog",
                   "catalog.json maps each narration key to its track files. Made by scripts/tracks/generate.py.")
    catalog["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    with tempfile.TemporaryDirectory() as folder:
        path = os.path.join(folder, CATALOG_ASSET)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(catalog, handle, ensure_ascii=False, indent=1, sort_keys=True)
        gh("release", "upload", CATALOG_TAG, path, "-R", repo, "--clobber")


class ReleaseShelf:
    """Which tracks-NNN release the next story's files go into: the current one
    while it stays within MAX_ASSETS_PER_RELEASE, else the next one."""

    def __init__(self, number, count):
        self.number = number
        self.count = count

    @property
    def tag(self):
        return f"{TRACKS_PREFIX}{self.number:03d}"

    def place(self, assets):
        if self.count + assets > MAX_ASSETS_PER_RELEASE:
            self.number += 1
            self.count = 0
        self.count += assets
        return self.tag


class Releases:
    """The rotating track releases on GitHub: tracks-001, tracks-002, …"""

    def __init__(self, repo, catalog):
        self.repo = repo
        listed = gh("release", "list", "-R", repo, "--limit", "1000", "--json", "tagName").stdout
        tags = {item["tagName"] for item in json.loads(listed or "[]")}
        tags |= {entry["release"] for entry in catalog["tracks"].values()}
        numbers = [int(tag[len(TRACKS_PREFIX):]) for tag in tags
                   if tag.startswith(TRACKS_PREFIX) and tag[len(TRACKS_PREFIX):].isdigit()]
        number = max(numbers, default=1)
        tag = f"{TRACKS_PREFIX}{number:03d}"
        self.shelf = ReleaseShelf(number, self.assets(tag) if release_exists(repo, tag) else 0)

    def assets(self, tag):
        release = gh("api", f"repos/{self.repo}/releases/tags/{tag}", "--jq", ".id").stdout.strip()
        result = gh("api", "--paginate", f"repos/{self.repo}/releases/{release}/assets?per_page=100", "--jq", "length")
        return sum(int(line) for line in result.stdout.split())

    def upload(self, paths):
        tag = self.shelf.place(len(paths))
        ensure_release(self.repo, tag, f"Listening tracks {self.shelf.number:03d}",
                       "Kokoro tracks for listening in the app. Indexed by catalog.json in tracks-catalog.")
        gh("release", "upload", tag, *paths, "-R", self.repo, "--clobber")
        return tag


# --- run ---------------------------------------------------------------------

def make_stories(todo, make, publish, log):
    """make(story) -> catalog entry, then publish(story, entry), for each story.
    A story that fails is logged with its traceback and skipped; the others
    still publish. Returns (made, failed story names)."""
    failures, made = [], 0
    for story in todo:
        name = f"{story['edition']}/{story['id']}"
        try:
            publish(story, make(story))
            made += 1
        except Exception:
            failures.append(name)
            log(f"FAILED {story['key']} {name}\n{traceback.format_exc()}")
    return made, failures


def summary(planned, skipped, made, failures):
    """Markdown for the Action's job summary."""
    lines = ["### Listening tracks", "",
             f"{planned} stories in the plan, {skipped} already published, {made} made."]
    if failures:
        lines += ["", f"**{len(failures)} failed** and were skipped (tracebacks in the log):", ""]
        lines += [f"- `{name}`" for name in failures]
    return "\n".join(lines) + "\n"


def write_summary(text):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", required=True, help="JSON from node scripts/narration-plan.mjs")
    parser.add_argument("--out", required=True, help="folder for the generated files")
    parser.add_argument("--publish", action="store_true", help="upload to GitHub Releases and update the catalog")
    parser.add_argument("--repo", default="Frank-Humingtao/zhongkao-reading-lab")
    parser.add_argument("--catalog", help="local catalog.json to skip against (without --publish)")
    parser.add_argument("--limit", type=int, help="make at most this many stories")
    args = parser.parse_args()

    with open(args.plan, encoding="utf-8") as handle:
        plan = json.load(handle)
    os.makedirs(args.out, exist_ok=True)

    if args.publish:
        catalog = fetch_catalog(args.repo)
    elif args.catalog and os.path.exists(args.catalog):
        with open(args.catalog, encoding="utf-8") as handle:
            catalog = json.load(handle)
    else:
        catalog = empty_catalog()

    todo, seen = [], set(catalog["tracks"])
    for story in plan["stories"]:
        if story["key"] not in seen:
            seen.add(story["key"])
            todo.append(story)
    planned, skipped = len(plan["stories"]), len(plan["stories"]) - len(todo)
    log(f"{planned} stories in the plan, {skipped} already published, {len(todo)} to make")
    if args.limit is not None:
        todo = todo[:args.limit]
    if not todo:
        write_summary(summary(planned, skipped, 0, []))
        return 0

    speak = kokoro_voices(plan["voices"])
    releases = Releases(args.repo, catalog) if args.publish else None
    published = 0

    def make(story):
        timings = make_tracks(story, plan, speak, args.out)
        return {
            "story": f"{story['edition']}/{story['id']}",
            "en": f"{story['key']}.en.m4a",
            "zh": f"{story['key']}.zh.m4a",
            "timings": f"{story['key']}.json",
            "durationEn": timings["durationEn"],
            "durationZh": timings["durationZh"],
            "sentences": len(timings["sentences"]),
        }

    def publish(story, entry):
        nonlocal published
        if releases:
            entry["release"] = releases.upload([os.path.join(args.out, entry[field])
                                                for field in ("en", "zh", "timings")])
        catalog["tracks"][story["key"]] = entry
        published += 1
        log(f"ok {story['key']} {entry['story']} ({entry['sentences']} sentences, "
            f"{entry['durationEn']:.0f}s en, {entry['durationZh']:.0f}s zh)")
        if releases and published % CATALOG_EVERY == 0:
            publish_catalog(args.repo, catalog)

    made, failures = make_stories(todo, make, publish, log)

    if releases and made:
        publish_catalog(args.repo, catalog)
    elif not releases:
        with open(os.path.join(args.out, CATALOG_ASSET), "w", encoding="utf-8") as handle:
            json.dump(catalog, handle, ensure_ascii=False, indent=1, sort_keys=True)
    log(f"made {made}, failed {len(failures)}" + (": " + ", ".join(failures) if failures else ""))
    write_summary(summary(planned, skipped, made, failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
