#!/usr/bin/env python3
"""Upsert a researcher-reported child-visibility review for an Ego4D candidate."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Sequence


DEFAULT_MANIFEST = Path(r"E:\VPrivCal_pre_expert\candidate_video_manifest.json")
DEFAULT_OUTPUT_ROOT = Path(r"E:\VPrivCal_pre_expert")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Record a manual child-visibility review.")
    parser.add_argument("--video-uid", required=True)
    parser.add_argument("--child-visible", choices=("yes", "no", "uncertain"), required=True)
    parser.add_argument("--appearance-start-sec", type=float)
    parser.add_argument("--appearance-end-sec", type=float)
    parser.add_argument("--note", default="")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.appearance_start_sec is not None and args.appearance_start_sec < 0:
        raise ValueError("Appearance start must be non-negative.")
    if args.appearance_end_sec is not None and args.appearance_end_sec < 0:
        raise ValueError("Appearance end must be non-negative.")
    if (
        args.appearance_start_sec is not None
        and args.appearance_end_sec is not None
        and args.appearance_end_sec < args.appearance_start_sec
    ):
        raise ValueError("Appearance end must not precede appearance start.")

    with args.manifest.open(encoding="utf-8") as handle:
        manifest = json.load(handle)
    matches = [row for row in manifest if row.get("video_uid") == args.video_uid]
    if len(matches) != 1:
        raise ValueError(f"Expected one manifest row for {args.video_uid}; found {len(matches)}.")
    source = matches[0]
    record: dict[str, Any] = {
        "videoUid": args.video_uid,
        "candidateId": source["candidate_id"],
        "videoPath": source["output_path"],
        "childVisible": {"yes": True, "no": False, "uncertain": None}[args.child_visible],
        "appearanceStartSec": args.appearance_start_sec,
        "appearanceEndSec": args.appearance_end_sec,
        "timestampStatus": (
            "recorded"
            if args.appearance_start_sec is not None
            else "confirmed_visibility_timestamp_pending"
            if args.child_visible == "yes"
            else "not_applicable"
        ),
        "evidenceSource": "researcher_manual_review",
        "reviewNote": args.note,
        "fhoAnnotationAvailable": source.get("fho_annotation_available") == "yes",
        "originalReviewRound": source.get("review_round"),
    }

    args.output_root.mkdir(parents=True, exist_ok=True)
    json_path = args.output_root / "manual_child_visibility_reviews.json"
    csv_path = args.output_root / "manual_child_visibility_reviews.csv"
    if json_path.is_file():
        with json_path.open(encoding="utf-8") as handle:
            document = json.load(handle)
    else:
        document = {
            "schemaVersion": "vprivcal-manual-child-visibility-review-1.0.0",
            "manualEvidence": True,
            "reviews": [],
        }
    reviews = [item for item in document.get("reviews") or [] if item.get("videoUid") != args.video_uid]
    reviews.append(record)
    reviews.sort(key=lambda item: item["videoUid"])
    document["reviews"] = reviews
    with json_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        fieldnames = list(record)
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(reviews)
    print(f"Manual child review JSON: {json_path}")
    print(f"Manual child review CSV:  {csv_path}")
    print(json.dumps(record, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

