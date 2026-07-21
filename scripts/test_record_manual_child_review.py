import json
import tempfile
import unittest
from pathlib import Path

from record_manual_child_review import main


class ManualChildReviewTests(unittest.TestCase):
    def test_records_confirmed_visibility_with_pending_timestamp(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    [
                        {
                            "video_uid": "test-uid",
                            "candidate_id": "ego4d_test-uid",
                            "output_path": "test.mp4",
                            "fho_annotation_available": "no",
                            "review_round": 2,
                        }
                    ]
                ),
                encoding="utf-8",
            )

            result = main(
                [
                    "--video-uid",
                    "test-uid",
                    "--child-visible",
                    "yes",
                    "--manifest",
                    str(manifest),
                    "--output-root",
                    str(root),
                ]
            )

            self.assertEqual(result, 0)
            document = json.loads((root / "manual_child_visibility_reviews.json").read_text())
            review = document["reviews"][0]
            self.assertTrue(review["childVisible"])
            self.assertEqual(review["timestampStatus"], "confirmed_visibility_timestamp_pending")
            self.assertFalse(review["fhoAnnotationAvailable"])


if __name__ == "__main__":
    unittest.main()

