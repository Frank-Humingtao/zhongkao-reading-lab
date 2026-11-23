"""Tests for the parts of generate.py that decide things (not Kokoro itself).

    uv run --project scripts/tracks python -m unittest discover -s scripts/tracks
"""

import unittest

import generate


def chinese(text):
    return f"<zh:{text}>"


def english(text):
    return f"<en:{text}>"


class ChineseWithLatinWords(unittest.TestCase):
    def test_a_latin_acronym_inside_a_chinese_sentence_is_spoken_by_the_english_phonemizer(self):
        self.assertEqual(generate.mixed_phonemes("美国宇航局（NASA）在第二天收到信号。", chinese, english),
                         "<zh:美国宇航局（> <en:NASA> <zh:）在第二天收到信号。>")

    def test_a_phrase_of_latin_words_stays_together_and_digits_stay_chinese(self):
        self.assertEqual(generate.mixed_phonemes("关于 Unreal Engine 6（简称 UE6）的更新", chinese, english),
                         "<zh:关于> <en:Unreal Engine> <zh:6（简称> <en:UE> <zh:6）的更新>")

    def test_a_sentence_without_latin_letters_is_all_chinese(self):
        self.assertEqual(generate.mixed_phonemes("我看见了一台收音机。", chinese, english), "<zh:我看见了一台收音机。>")


class ReleaseRotation(unittest.TestCase):
    def test_a_month_of_thirty_stories_a_day_keeps_every_release_under_the_asset_limit(self):
        shelf = generate.ReleaseShelf(number=1, count=30)  # tracks-001 as published by ticket 01
        assets = {"tracks-001": 30}
        for day in range(31):
            for story in range(30):
                tag = shelf.place(generate.ASSETS_PER_STORY)
                assets[tag] = assets.get(tag, 0) + generate.ASSETS_PER_STORY
        self.assertTrue(all(count <= 900 for count in assets.values()), assets)
        self.assertEqual(sum(assets.values()), 30 + 31 * 30 * 3)
        self.assertEqual(sorted(assets), ["tracks-001", "tracks-002", "tracks-003", "tracks-004"])
        self.assertEqual(assets["tracks-001"], 900)

    def test_a_story_that_would_overflow_the_current_release_starts_the_next(self):
        shelf = generate.ReleaseShelf(number=7, count=898)
        self.assertEqual(shelf.place(3), "tracks-008")
        self.assertEqual(shelf.place(3), "tracks-008")


class FailingStories(unittest.TestCase):
    def story(self, name):
        return {"key": name * 4, "edition": "reading-09", "id": name}

    def test_a_failing_story_is_skipped_and_reported_while_the_others_publish(self):
        published, lines = [], []

        def make(story):
            if story["id"] == "bad":
                raise RuntimeError("no audio for zh sentence: ''")
            return {"story": story["id"]}

        made, failures = generate.make_stories(
            [self.story("one"), self.story("bad"), self.story("two")], make,
            lambda story, entry: published.append(story["id"]), lines.append)
        self.assertEqual(published, ["one", "two"])
        self.assertEqual(made, 2)
        self.assertEqual(failures, ["reading-09/bad"])
        self.assertTrue(any("FAILED badbadbadbad reading-09/bad" in line for line in lines), lines)
        self.assertTrue(any("no audio for zh sentence" in line for line in lines), lines)

    def test_the_job_summary_names_each_failed_story(self):
        text = generate.summary(planned=12, skipped=9, made=2, failures=["reading-09/bad"])
        self.assertIn("2 made", text)
        self.assertIn("9 already published", text)
        self.assertIn("reading-09/bad", text)
        self.assertNotIn("failed", generate.summary(planned=3, skipped=3, made=0, failures=[]).lower())


if __name__ == "__main__":
    unittest.main()
