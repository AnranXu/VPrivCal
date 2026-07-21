import unittest

from generate_child_timestamp_review import timestamp_evidence


class ChildTimestampReviewTests(unittest.TestCase):
    def test_explicit_child_term_creates_bounded_review_window(self) -> None:
        video = {
            "narration_pass_1": {
                "narrations": [
                    {
                        "timestamp_sec": 2.0,
                        "narration_text": "#C C gives a toy to the child",
                    }
                ]
            }
        }

        child_hits, other_hits = timestamp_evidence(video, 20.0, 3.0, 5.0)

        self.assertEqual(len(child_hits), 1)
        self.assertEqual(child_hits[0]["matchedTerms"], ["child"])
        self.assertEqual(child_hits[0]["reviewStartSec"], 0.0)
        self.assertEqual(child_hits[0]["reviewEndSec"], 7.0)
        self.assertEqual(other_hits, [])

    def test_generic_adult_reference_is_not_promoted_to_child_evidence(self) -> None:
        video = {
            "narration_pass_1": {
                "narrations": [
                    {
                        "timestamp_sec": 10.0,
                        "narration_text": "#O A woman X stands beside C",
                    }
                ]
            }
        }

        child_hits, other_hits = timestamp_evidence(video, 20.0, 3.0, 5.0)

        self.assertEqual(child_hits, [])
        self.assertEqual(len(other_hits), 1)


if __name__ == "__main__":
    unittest.main()

