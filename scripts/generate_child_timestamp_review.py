#!/usr/bin/env python3
"""Generate an annotation-based child-appearance timestamp review file.

Only narration text that explicitly uses an age-related child term is treated
as a timestamp candidate. Generic ``#O``/person references are retained in a
separate audit field and never promoted to child evidence.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any, Sequence


DEFAULT_QUEUE = Path(r"E:\VPrivCal_pre_expert\fho_annotated_first_round_manifest.json")
DEFAULT_NARRATIONS = Path(r"E:\ego4d_data\v2\annotations\narration.json")
DEFAULT_OUTPUT_ROOT = Path(r"E:\VPrivCal_pre_expert")
CHILD_TERMS = (
    "baby",
    "babies",
    "child",
    "children",
    "kid",
    "kids",
    "toddler",
    "toddlers",
    "infant",
    "infants",
    "boy",
    "boys",
    "girl",
    "girls",
    "son",
    "sons",
    "daughter",
    "daughters",
    "teen",
    "teens",
    "teenager",
    "teenagers",
)
CHILD_PATTERN = re.compile(
    r"\b(" + "|".join(map(re.escape, CHILD_TERMS)) + r")\b",
    re.IGNORECASE,
)
OTHER_PERSON_PATTERN = re.compile(
    r"(^|\s)#O\b|\b(man|woman|lady|person|people|guy)\b",
    re.IGNORECASE,
)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a child-timestamp review CSV/JSON from the 62-video queue and narrations."
    )
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--narrations", type=Path, default=DEFAULT_NARRATIONS)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--window-before-sec",
        type=float,
        default=3.0,
        help="Seconds before an explicit child narration to include in its review window.",
    )
    parser.add_argument(
        "--window-after-sec",
        type=float,
        default=5.0,
        help="Seconds after an explicit child narration to include in its review window.",
    )
    return parser.parse_args(argv)


def unique_narrations(video: Any) -> list[dict[str, Any]]:
    if not isinstance(video, dict):
        return []
    rows: list[dict[str, Any]] = []
    seen: set[tuple[float | None, str]] = set()
    for pass_name, pass_data in video.items():
        if not isinstance(pass_data, dict):
            continue
        for narration in pass_data.get("narrations") or []:
            text = narration.get("narration_text")
            timestamp = narration.get("timestamp_sec")
            if not isinstance(text, str):
                continue
            numeric_timestamp = float(timestamp) if isinstance(timestamp, (int, float)) else None
            key = (numeric_timestamp, text)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "timestampSec": numeric_timestamp,
                    "text": text,
                    "narrationPass": pass_name,
                }
            )
    return sorted(
        rows,
        key=lambda row: (
            float("inf") if row["timestampSec"] is None else row["timestampSec"],
            row["text"],
        ),
    )


def timestamp_evidence(
    video: Any,
    duration_sec: float,
    window_before_sec: float,
    window_after_sec: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    child_hits: list[dict[str, Any]] = []
    other_person_hits: list[dict[str, Any]] = []
    for narration in unique_narrations(video):
        text = narration["text"]
        timestamp = narration["timestampSec"]
        terms = sorted({match.group(0).casefold() for match in CHILD_PATTERN.finditer(text)})
        if terms:
            start = None if timestamp is None else max(0.0, timestamp - window_before_sec)
            end = (
                None
                if timestamp is None
                else min(duration_sec, timestamp + window_after_sec)
            )
            child_hits.append(
                {
                    **narration,
                    "matchedTerms": terms,
                    "reviewStartSec": start,
                    "reviewEndSec": end,
                }
            )
        elif OTHER_PERSON_PATTERN.search(text):
            other_person_hits.append(narration)
    return child_hits, other_person_hits


def joined(items: list[Any]) -> str:
    return " | ".join(str(item) for item in items)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.window_before_sec < 0 or args.window_after_sec < 0:
        raise ValueError("Review-window offsets must be non-negative.")
    with args.queue.open(encoding="utf-8") as handle:
        queue = json.load(handle)
    with args.narrations.open(encoding="utf-8") as handle:
        narrations = json.load(handle)

    results: list[dict[str, Any]] = []
    for candidate in queue.get("candidates") or []:
        uid = candidate["videoUid"]
        duration = float(candidate.get("durationSec") or 0)
        child_hits, other_person_hits = timestamp_evidence(
            narrations.get(uid),
            duration,
            args.window_before_sec,
            args.window_after_sec,
        )
        results.append(
            {
                "videoUid": uid,
                "videoPath": candidate.get("videoPath"),
                "durationSec": duration,
                "narrationAvailable": uid in narrations,
                "childTimestampStatus": (
                    "explicit_child_term_timestamp_candidates"
                    if child_hits
                    else "not_identified_in_annotations"
                ),
                "explicitChildTimestampCandidates": child_hits,
                "otherPersonMentionsNotChildConfirmed": other_person_hits,
                "manualVisualReviewRequired": True,
            }
        )

    args.output_root.mkdir(parents=True, exist_ok=True)
    json_path = args.output_root / "child_appearance_timestamp_review.json"
    csv_path = args.output_root / "child_appearance_timestamp_review.csv"
    document = {
        "schemaVersion": "vprivcal-child-timestamp-review-1.0.0",
        "nonEmpirical": True,
        "sourceQueue": str(args.queue),
        "sourceNarrations": str(args.narrations),
        "interpretation": (
            "Only explicit age-related narration terms create child timestamp candidates. "
            "Empty timestamps mean the annotations did not identify a child, not that no child appears."
        ),
        "counts": {
            "videos": len(results),
            "videosWithNarration": sum(item["narrationAvailable"] for item in results),
            "videosWithExplicitChildTimestampCandidates": sum(
                bool(item["explicitChildTimestampCandidates"]) for item in results
            ),
            "videosWithOtherPersonMentionsNotChildConfirmed": sum(
                bool(item["otherPersonMentionsNotChildConfirmed"]) for item in results
            ),
        },
        "videos": results,
    }
    with json_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        fieldnames = [
            "video_uid",
            "video_path",
            "duration_sec",
            "narration_available",
            "child_timestamp_status",
            "explicit_child_mention_count",
            "child_timestamps_sec",
            "child_review_windows_sec",
            "child_mention_texts",
            "other_person_mention_count_not_child_confirmed",
            "other_person_timestamps_sec_not_child_confirmed",
            "other_person_examples_not_child_confirmed",
            "manual_visual_review_required",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in results:
            child_hits = item["explicitChildTimestampCandidates"]
            other_hits = item["otherPersonMentionsNotChildConfirmed"]
            writer.writerow(
                {
                    "video_uid": item["videoUid"],
                    "video_path": item["videoPath"],
                    "duration_sec": item["durationSec"],
                    "narration_available": item["narrationAvailable"],
                    "child_timestamp_status": item["childTimestampStatus"],
                    "explicit_child_mention_count": len(child_hits),
                    "child_timestamps_sec": joined(
                        [hit["timestampSec"] for hit in child_hits]
                    ),
                    "child_review_windows_sec": joined(
                        [f'{hit["reviewStartSec"]}-{hit["reviewEndSec"]}' for hit in child_hits]
                    ),
                    "child_mention_texts": joined([hit["text"] for hit in child_hits]),
                    "other_person_mention_count_not_child_confirmed": len(other_hits),
                    "other_person_timestamps_sec_not_child_confirmed": joined(
                        [hit["timestampSec"] for hit in other_hits]
                    ),
                    "other_person_examples_not_child_confirmed": joined(
                        [hit["text"] for hit in other_hits[:5]]
                    ),
                    "manual_visual_review_required": True,
                }
            )
    print(f"Child timestamp review CSV:  {csv_path}")
    print(f"Child timestamp review JSON: {json_path}")
    print(json.dumps(document["counts"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

