"""Make listening tracks with Kokoro and, optionally, publish them to GitHub Releases.

Reads the narration plan (node scripts/narration-plan.mjs), skips every narration
key the catalog already has, and for each remaining story writes

    <key>.en.m4a   English track (am_michael), mono AAC
    <key>.zh.m4a   Chinese track (zm_yunjian), mono AAC
    <key>.json     timings: each sentence's [start, end] in seconds in each track

Each sentence is synthesized on its own and the sentences are joined with a short
silence inside the track; timings exclude that silence, so the player can cut
exact clips and add its own pauses.

    node scripts/narration-plan.mjs --edition reading-01 > plan.json
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

    # English words inside Chinese sentences (Genie 4, SynthID, 3D) are spoken
    # with the English phonemizer instead of being dropped.
    def english_phonemes(text):
        return next(english(text)).phonemes

    chinese = KPipeline(lang_code="z", repo_id=REPO_ID, model=model, en_callable=english_phonemes)
    pipelines = {"en": (english, voices["en"]), "zh": (chinese, voices["zh"])}

    def speak(language, text):
        pipeline, voice = pipelines[language]
        chunks = [np.asarray(result.audio, dtype=np.float32) for result in pipeline(text, voice=voice)
                  if result.audio is not None]
        if not chunks:
            raise RuntimeError(f"no audio for {language} sentence: {text!r}")
        return trim(np.concatenate(chunks))

    return speak


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


class Releases:
    """The rotating track releases: tracks-001, tracks-002, … each under the asset limit."""

    def __init__(self, repo, catalog):
        self.repo = repo
        listed = gh("release", "list", "-R", repo, "--limit", "1000", "--json", "tagName").stdout
        tags = {item["tagName"] for item in json.loads(listed or "[]")}
        tags |= {entry["release"] for entry in catalog["tracks"].values()}
        numbers = [int(tag[len(TRACKS_PREFIX):]) for tag in tags
                   if tag.startswith(TRACKS_PREFIX) and tag[len(TRACKS_PREFIX):].isdigit()]
        self.number = max(numbers, default=1)
        self.count = self.assets(self.tag) if release_exists(repo, self.tag) else 0

    @property
    def tag(self):
        return f"{TRACKS_PREFIX}{self.number:03d}"

    def assets(self, tag):
        release = gh("api", f"repos/{self.repo}/releases/tags/{tag}", "--jq", ".id").stdout.strip()
        result = gh("api", "--paginate", f"repos/{self.repo}/releases/{release}/assets?per_page=100", "--jq", "length")
        return sum(int(line) for line in result.stdout.split())

    def upload(self, paths):
        if self.count + len(paths) > MAX_ASSETS_PER_RELEASE:
            self.number += 1
            self.count = 0
        ensure_release(self.repo, self.tag, f"Listening tracks {self.number:03d}",
                       "Kokoro tracks for listening in the app. Indexed by catalog.json in tracks-catalog.")
        gh("release", "upload", self.tag, *paths, "-R", self.repo, "--clobber")
        self.count += len(paths)
        return self.tag


# --- run ---------------------------------------------------------------------

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
    log(f"{len(plan['stories'])} stories in the plan, {len(plan['stories']) - len(todo)} already published, "
        f"{len(todo)} to make")
    if args.limit is not None:
        todo = todo[:args.limit]
    if not todo:
        return 0

    speak = kokoro_voices(plan["voices"])
    releases = Releases(args.repo, catalog) if args.publish else None
    failures, made = [], 0
    for story in todo:
        name = f"{story['edition']}/{story['id']}"
        try:
            timings = make_tracks(story, plan, speak, args.out)
            entry = {
                "story": name,
                "en": f"{story['key']}.en.m4a",
                "zh": f"{story['key']}.zh.m4a",
                "timings": f"{story['key']}.json",
                "durationEn": timings["durationEn"],
                "durationZh": timings["durationZh"],
                "sentences": len(timings["sentences"]),
            }
            if releases:
                entry["release"] = releases.upload([os.path.join(args.out, entry[field])
                                                    for field in ("en", "zh", "timings")])
            catalog["tracks"][story["key"]] = entry
            made += 1
            log(f"ok {story['key']} {name} ({entry['sentences']} sentences, "
                f"{entry['durationEn']:.0f}s en, {entry['durationZh']:.0f}s zh)")
            if releases and made % CATALOG_EVERY == 0:
                publish_catalog(args.repo, catalog)
        except Exception:
            failures.append(name)
            log(f"FAILED {story['key']} {name}")
            traceback.print_exc()
            sys.stdout.flush()

    if releases and made:
        publish_catalog(args.repo, catalog)
    elif not releases:
        with open(os.path.join(args.out, CATALOG_ASSET), "w", encoding="utf-8") as handle:
            json.dump(catalog, handle, ensure_ascii=False, indent=1, sort_keys=True)
    log(f"made {made}, failed {len(failures)}" + (": " + ", ".join(failures) if failures else ""))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
