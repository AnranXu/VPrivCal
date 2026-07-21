import argparse
import tempfile
import unittest
from pathlib import Path

from filter_candidate_videos import (
    DEFAULT_CONTINUOUS_VLM_ROOT,
    DEFAULT_EGO4D_ROOT,
    DEFAULT_OUTPUT_ROOT,
    PREVIOUS_WINDOWS,
    ManifestRow,
    build_detection_document,
    load_fho_video_uids,
    locate_story_video,
    materialize_fho_first_round,
    parse_args,
)


class CandidateVideoFilterTests(unittest.TestCase):
    def test_research_drive_locations_are_overridable_defaults(self) -> None:
        args = parse_args([])
        self.assertEqual(args.ego4d_root, DEFAULT_EGO4D_ROOT)
        self.assertEqual(args.continuous_vlm_root, DEFAULT_CONTINUOUS_VLM_ROOT)
        self.assertEqual(args.output_root, DEFAULT_OUTPUT_ROOT)

    def test_home_altar_uses_the_audited_legacy_clip_fallback(self) -> None:
        altar = next(
            window for window in PREVIOUS_WINDOWS if window.candidate_id == "previous_04_home_altar"
        )
        with tempfile.TemporaryDirectory() as temporary:
            documents = Path(temporary)
            story_root = documents / "12 stories final"
            story_root.mkdir()
            legacy = documents / "story_clips_old" / "story_02_pid_104"
            legacy.mkdir(parents=True)
            expected = legacy / "story_02_pid_104_clip05_test.mp4"
            expected.write_bytes(b"video")

            selected, matches = locate_story_video(story_root, altar)

        self.assertEqual(selected, expected)
        self.assertEqual(matches, [expected])

    def test_fho_uid_scan_streams_across_chunk_boundaries(self) -> None:
        expected = {
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
        }
        with tempfile.TemporaryDirectory() as temporary:
            annotation_path = Path(temporary) / "fho_main.json"
            annotation_path.write_text(
                '{"videos": ['
                '{"video_uid": "00000000-0000-0000-0000-000000000001"},'
                '{"video_uid":"00000000-0000-0000-0000-000000000002"}'
                ']}',
                encoding="utf-8",
            )
            actual = load_fho_video_uids(annotation_path, chunk_size=31)

        self.assertEqual(actual, expected)

    def test_detection_document_separates_policy_cues_negative_and_pending_ego4d(self) -> None:
        rows = [
            ManifestRow(
                selection_group="previous_selected",
                candidate_id=window.candidate_id,
                story_id=window.story_id,
                clip_id=window.clip_id,
                start_sec=window.start_sec,
                end_sec=window.end_sec,
                source_path=f"source/{window.candidate_id}.mp4",
                output_path=f"output/{window.candidate_id}.mp4",
                status="copied",
            )
            for window in PREVIOUS_WINDOWS
        ]
        rows.append(
            ManifestRow(
                selection_group="ego4d_child_care",
                candidate_id="ego4d_test",
                video_uid="test",
                scenarios="Household management - caring for kids",
                fho_annotation_available="yes",
                review_round=1,
                source_path="source/test.mp4",
                output_path="output/test.mp4",
                status="copied",
            )
        )
        args = argparse.Namespace(
            skip_ego4d=False,
            skip_previous=False,
            ego4d_root=DEFAULT_EGO4D_ROOT,
            continuous_vlm_root=DEFAULT_CONTINUOUS_VLM_ROOT,
            output_root=DEFAULT_OUTPUT_ROOT,
        )

        document = build_detection_document(args, rows)

        self.assertEqual(document["counts"]["configuredPolicyCandidates"], 4)
        self.assertEqual(document["counts"]["configuredNegativeControls"], 1)
        self.assertEqual(document["counts"]["configuredRejectedFalsePositives"], 2)
        self.assertEqual(document["counts"]["ego4dPendingManualReview"], 1)
        self.assertEqual(document["counts"]["ego4dFhoAnnotatedFirstRound"], 1)
        negative = next(
            item
            for item in document["configuredDetections"]
            if item["detectionId"] == "previous_07_hot_glue_negative"
        )
        self.assertIsNone(negative["policyCandidate"])
        rejected = next(
            item
            for item in document["configuredDetections"]
            if item["detectionId"] == "previous_01_wearer_face"
        )
        self.assertEqual(rejected["manualReviewStatus"], "rejected_false_positive")
        self.assertIsNone(rejected["policyCandidate"])
        pending = document["ego4dManualReviewCandidates"][0]
        self.assertIsNone(pending["childVisible"])
        self.assertIsNone(pending["policyCandidate"])

    def test_materializes_only_fho_first_round_videos(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            annotated_source = root / "annotated.mp4"
            annotated_source.write_bytes(b"annotated-video")
            later_source = root / "later.mp4"
            later_source.write_bytes(b"later-video")
            rows = [
                ManifestRow(
                    selection_group="ego4d_child_care",
                    candidate_id="ego4d_annotated",
                    video_uid="00000000-0000-0000-0000-000000000001",
                    fho_annotation_available="yes",
                    review_round=1,
                    source_path=str(annotated_source),
                ),
                ManifestRow(
                    selection_group="ego4d_child_care",
                    candidate_id="ego4d_later",
                    video_uid="00000000-0000-0000-0000-000000000002",
                    fho_annotation_available="no",
                    review_round=2,
                    source_path=str(later_source),
                ),
            ]

            materialize_fho_first_round(root, rows, overwrite=False)

            folder = root / "fho_annotated_first_round_videos"
            copied = list(folder.glob("*.mp4"))
            self.assertEqual(len(copied), 1)
            self.assertEqual(copied[0].read_bytes(), b"annotated-video")


if __name__ == "__main__":
    unittest.main()
