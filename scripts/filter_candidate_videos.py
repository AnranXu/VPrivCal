#!/usr/bin/env python3
"""Collect the video candidates used by the VPrivCal evaluation.

The utility handles two independent source collections:

1. Ego4D full-scale videos. Every video whose metadata contains the exact
   ``Household management - caring for kids`` scenario is copied in full so a
   researcher can screen it manually for actual child visibility.
2. The continuous-VLM story videos. Seven previously selected short windows
   are extracted with FFmpeg (or their complete source clips can be copied).

Nothing is written unless ``--execute`` is supplied. Source files are never
modified. The real video roots deliberately have no defaults because they are
expected to live on an external research drive.

Example (PowerShell)::

    py scripts/filter_candidate_videos.py `
      --ego4d-root "E:\\ego4d_data\\v2\\full_scale" `
      --continuous-vlm-root "E:\\continuous-vlm-privacy-data" `
      --output-root "E:\\VPrivCal_candidates" `
      --execute

Use ``--skip-previous`` or ``--skip-ego4d`` when only one collection is
available. Use ``--previous-mode copy-full`` if FFmpeg is unavailable.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EGO4D_METADATA = REPOSITORY_ROOT / "source materials" / "ego4d.json"
CHILD_CARE_SCENARIO = "Household management - caring for kids"
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"}


@dataclass(frozen=True)
class PreviousWindow:
    candidate_id: str
    story_id: str
    clip_id: str
    start_sec: float
    end_sec: float
    vprivcal_categories: tuple[str, ...]
    purpose: str

    @property
    def duration_sec(self) -> float:
        return self.end_sec - self.start_sec

    @property
    def expected_relative_path(self) -> Path:
        return Path("stories") / self.story_id / f"{self.clip_id}.mp4"


PREVIOUS_WINDOWS: tuple[PreviousWindow, ...] = (
    PreviousWindow(
        "previous_01_wearer_face",
        "story_12",
        "clip_05",
        63.0,
        75.0,
        ("biometric_data",),
        "Wearer's face; direct, private, high-severity biometric cue.",
    ),
    PreviousWindow(
        "previous_02_basketball_bystanders",
        "story_12",
        "clip_02",
        0.0,
        12.0,
        ("background_individuals", "biometric_data"),
        "Multiple basketball players in a public/social setting.",
    ),
    PreviousWindow(
        "previous_03_pay_slip",
        "story_06",
        "clip_05",
        4.0,
        16.0,
        ("pii",),
        "Financial document/pay slip; clear direct PII cue.",
    ),
    PreviousWindow(
        "previous_04_home_altar",
        "story_02",
        "clip_05",
        0.0,
        12.0,
        ("legal_sensitivity_information", "personal_life"),
        "Home altar; culturally sensitive inference and personal-life cue.",
    ),
    PreviousWindow(
        "previous_05_lab_screen",
        "story_12",
        "clip_03",
        45.0,
        57.0,
        ("pii",),
        "Laboratory system screen; task-irrelevant/confidential workplace cue.",
    ),
    PreviousWindow(
        "previous_06_gabriele_name",
        "story_04",
        "clip_05",
        9.0,
        21.0,
        ("pii", "children_images"),
        "Name on a child-related activity book; PII positive and child-image negative/inference control.",
    ),
    PreviousWindow(
        "previous_07_hot_glue_negative",
        "story_04",
        "clip_05",
        94.0,
        106.0,
        (),
        "Expert-rejected hot-glue-gun privacy cue; negative control.",
    ),
)


@dataclass
class ManifestRow:
    selection_group: str
    candidate_id: str
    video_uid: str = ""
    story_id: str = ""
    clip_id: str = ""
    start_sec: float | str = ""
    end_sec: float | str = ""
    duration_sec: float | str = ""
    scenarios: str = ""
    vprivcal_categories: str = ""
    purpose: str = ""
    source_path: str = ""
    output_path: str = ""
    status: str = ""
    message: str = ""


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Copy all Ego4D caring-for-kids videos and collect the previously "
            "selected continuous-VLM excerpts."
        )
    )
    parser.add_argument(
        "--ego4d-root",
        type=Path,
        help="Root containing downloaded Ego4D full-scale video files (searched recursively).",
    )
    parser.add_argument(
        "--continuous-vlm-root",
        type=Path,
        help=(
            "Root containing continuous-VLM story videos, normally with paths "
            "such as stories/story_12/clip_05.mp4."
        ),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        required=True,
        help="Destination root for collected videos and manifests.",
    )
    parser.add_argument(
        "--ego4d-metadata",
        type=Path,
        default=DEFAULT_EGO4D_METADATA,
        help=f"Ego4D metadata JSON (default: {DEFAULT_EGO4D_METADATA}).",
    )
    parser.add_argument(
        "--child-scenario",
        default=CHILD_CARE_SCENARIO,
        help="Exact Ego4D scenario label to select.",
    )
    parser.add_argument(
        "--skip-ego4d",
        action="store_true",
        help="Do not collect Ego4D child-care candidates.",
    )
    parser.add_argument(
        "--skip-previous",
        action="store_true",
        help="Do not collect the seven previously selected story windows.",
    )
    parser.add_argument(
        "--previous-mode",
        choices=("extract", "copy-full"),
        default="extract",
        help=(
            "Extract the configured windows with FFmpeg (default), or copy each "
            "complete source story clip."
        ),
    )
    parser.add_argument(
        "--ffmpeg",
        default="ffmpeg",
        help="FFmpeg executable name or path used by --previous-mode extract.",
    )
    parser.add_argument(
        "--ffmpeg-mode",
        choices=("transcode", "stream-copy"),
        default="transcode",
        help=(
            "Transcode for accurate boundaries (default) or stream-copy for speed "
            "with potentially keyframe-shifted boundaries."
        ),
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace destination files that already exist.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Perform copies/extractions. Without this flag the command is a dry run.",
    )
    args = parser.parse_args(argv)

    if args.skip_ego4d and args.skip_previous:
        parser.error("Both collections are disabled; remove at least one --skip option.")
    if not args.skip_ego4d and args.ego4d_root is None:
        parser.error("--ego4d-root is required unless --skip-ego4d is used.")
    if not args.skip_previous and args.continuous_vlm_root is None:
        parser.error("--continuous-vlm-root is required unless --skip-previous is used.")
    return args


def normalized_text(value: Any) -> str:
    return " ".join(str(value).split()).casefold()


def load_child_care_metadata(metadata_path: Path, scenario: str) -> list[dict[str, Any]]:
    if not metadata_path.is_file():
        raise FileNotFoundError(f"Ego4D metadata not found: {metadata_path}")
    with metadata_path.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)

    videos = metadata.get("videos")
    if not isinstance(videos, list):
        raise ValueError("Ego4D metadata must contain a top-level 'videos' list")

    wanted = normalized_text(scenario)
    selected: list[dict[str, Any]] = []
    for video in videos:
        scenarios = video.get("scenarios") or []
        if any(normalized_text(item) == wanted for item in scenarios):
            uid = video.get("video_uid")
            if not isinstance(uid, str) or not uid.strip():
                continue
            selected.append(video)
    return sorted(selected, key=lambda item: (float(item.get("duration_sec") or 0), item["video_uid"]))


def iter_video_files(root: Path) -> Iterable[Path]:
    if not root.is_dir():
        raise NotADirectoryError(f"Video root is not a directory: {root}")
    for directory, _, filenames in os.walk(root):
        parent = Path(directory)
        for filename in filenames:
            path = parent / filename
            if path.suffix.casefold() in VIDEO_EXTENSIONS:
                yield path


def build_uid_index(root: Path) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for path in iter_video_files(root):
        index.setdefault(path.stem.casefold(), []).append(path)
    for paths in index.values():
        paths.sort(key=video_path_preference)
    return index


def video_path_preference(path: Path) -> tuple[int, int, str]:
    suffix_priority = {".mp4": 0, ".m4v": 1, ".mov": 2, ".mkv": 3, ".webm": 4, ".avi": 5}
    try:
        negative_size = -path.stat().st_size
    except OSError:
        negative_size = 0
    return (suffix_priority.get(path.suffix.casefold(), 99), negative_size, str(path).casefold())


def locate_story_video(root: Path, window: PreviousWindow) -> tuple[Path | None, list[Path]]:
    direct_candidates = (
        root / window.expected_relative_path,
        root / window.story_id / f"{window.clip_id}.mp4",
    )
    for candidate in direct_candidates:
        if candidate.is_file():
            return candidate, [candidate]

    filename = f"{window.clip_id}.mp4".casefold()
    story_name = window.story_id.casefold()
    matches = [
        path
        for path in iter_video_files(root)
        if path.name.casefold() == filename
        and any(part.casefold() == story_name for part in path.parts)
    ]
    matches.sort(key=video_path_preference)
    return (matches[0] if matches else None), matches


def ensure_destination_available(destination: Path, overwrite: bool) -> str | None:
    if not destination.exists():
        return None
    if overwrite:
        if destination.is_file() or destination.is_symlink():
            destination.unlink()
            return None
        raise IsADirectoryError(f"Destination is a directory: {destination}")
    return "destination already exists; skipped"


def copy_video(source: Path, destination: Path, overwrite: bool) -> tuple[str, str]:
    skip_reason = ensure_destination_available(destination, overwrite)
    if skip_reason:
        return "skipped", skip_reason
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return "copied", ""


def ffmpeg_command(
    executable: str,
    source: Path,
    destination: Path,
    start_sec: float,
    duration_sec: float,
    mode: str,
) -> list[str]:
    command = [
        executable,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_sec:g}",
        "-i",
        str(source),
        "-t",
        f"{duration_sec:g}",
    ]
    if mode == "stream-copy":
        command.extend(("-c", "copy"))
    else:
        command.extend(
            (
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
            )
        )
    command.append(str(destination))
    return command


def extract_window(
    ffmpeg: str,
    source: Path,
    destination: Path,
    start_sec: float,
    duration_sec: float,
    mode: str,
    overwrite: bool,
) -> tuple[str, str]:
    skip_reason = ensure_destination_available(destination, overwrite)
    if skip_reason:
        return "skipped", skip_reason
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = ffmpeg_command(ffmpeg, source, destination, start_sec, duration_sec, mode)
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        destination.unlink(missing_ok=True)
        detail = (completed.stderr or completed.stdout or "unknown FFmpeg error").strip()
        return "error", detail
    if not destination.is_file() or destination.stat().st_size == 0:
        destination.unlink(missing_ok=True)
        return "error", "FFmpeg returned success but produced no non-empty file"
    return "extracted", ""


def format_second(value: float) -> str:
    return f"{value:06.1f}".replace(".", "p")


def collect_ego4d(args: argparse.Namespace, rows: list[ManifestRow]) -> None:
    assert args.ego4d_root is not None
    selected = load_child_care_metadata(args.ego4d_metadata, args.child_scenario)
    print(f"Ego4D metadata matches: {len(selected)}")
    print(f"Indexing video files under: {args.ego4d_root}")
    uid_index = build_uid_index(args.ego4d_root)

    found = 0
    for video in selected:
        uid = str(video["video_uid"])
        matches = uid_index.get(uid.casefold(), [])
        source = matches[0] if matches else None
        suffix = source.suffix.casefold() if source else ".mp4"
        destination = args.output_root / "ego4d_children_manual_review" / f"{uid}{suffix}"
        scenarios = " | ".join(str(item) for item in (video.get("scenarios") or []))
        duration = video.get("duration_sec", "")
        row = ManifestRow(
            selection_group="ego4d_child_care",
            candidate_id=f"ego4d_{uid}",
            video_uid=uid,
            duration_sec=duration,
            scenarios=scenarios,
            vprivcal_categories="children_images",
            purpose="Manual verification of whether a child is actually visible.",
            source_path=str(source or ""),
            output_path=str(destination),
        )
        if source is None:
            row.status = "missing"
            row.message = "no local video filename matched this video_uid"
        else:
            found += 1
            duplicate_note = f"; {len(matches)} local matches, preferred first" if len(matches) > 1 else ""
            if args.execute:
                row.status, row.message = copy_video(source, destination, args.overwrite)
                row.message += duplicate_note
            else:
                row.status = "would_copy"
                row.message = duplicate_note.lstrip("; ")
        rows.append(row)
    print(f"Ego4D source files found: {found}/{len(selected)}")


def collect_previous(args: argparse.Namespace, rows: list[ManifestRow]) -> None:
    assert args.continuous_vlm_root is not None
    ffmpeg_path = shutil.which(args.ffmpeg)
    if args.previous_mode == "extract" and ffmpeg_path is None:
        print(
            f"Warning: FFmpeg was not found as '{args.ffmpeg}'. "
            "Extraction rows will be marked as errors during --execute.",
            file=sys.stderr,
        )

    located_cache: dict[tuple[str, str], tuple[Path | None, list[Path]]] = {}
    for window in PREVIOUS_WINDOWS:
        cache_key = (window.story_id, window.clip_id)
        if cache_key not in located_cache:
            located_cache[cache_key] = locate_story_video(args.continuous_vlm_root, window)
        source, matches = located_cache[cache_key]

        if args.previous_mode == "extract":
            filename = (
                f"{window.candidate_id}_{format_second(window.start_sec)}-"
                f"{format_second(window.end_sec)}.mp4"
            )
            destination = args.output_root / "previous_selected_windows" / filename
        else:
            source_suffix = source.suffix.casefold() if source else ".mp4"
            filename = f"{window.story_id}_{window.clip_id}{source_suffix}"
            destination = args.output_root / "previous_selected_full_clips" / filename

        row = ManifestRow(
            selection_group="previous_selected",
            candidate_id=window.candidate_id,
            story_id=window.story_id,
            clip_id=window.clip_id,
            start_sec=window.start_sec,
            end_sec=window.end_sec,
            duration_sec=window.duration_sec,
            vprivcal_categories=" | ".join(window.vprivcal_categories),
            purpose=window.purpose,
            source_path=str(source or ""),
            output_path=str(destination),
        )
        if source is None:
            row.status = "missing"
            row.message = "source story video was not found"
        elif not args.execute:
            row.status = "would_extract" if args.previous_mode == "extract" else "would_copy_full"
            if len(matches) > 1:
                row.message = f"{len(matches)} local matches; preferred first"
        elif args.previous_mode == "copy-full":
            row.status, row.message = copy_video(source, destination, args.overwrite)
            if len(matches) > 1:
                row.message += f"; {len(matches)} local matches, preferred first"
        elif ffmpeg_path is None:
            row.status = "error"
            row.message = f"FFmpeg executable not found: {args.ffmpeg}"
        else:
            row.status, row.message = extract_window(
                ffmpeg_path,
                source,
                destination,
                window.start_sec,
                window.duration_sec,
                args.ffmpeg_mode,
                args.overwrite,
            )
        rows.append(row)


def write_manifests(output_root: Path, rows: Sequence[ManifestRow]) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    csv_path = output_root / "candidate_video_manifest.csv"
    json_path = output_root / "candidate_video_manifest.json"
    fieldnames = list(asdict(rows[0]).keys()) if rows else list(ManifestRow.__dataclass_fields__)
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)
    with json_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump([asdict(row) for row in rows], handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Manifest CSV:  {csv_path}")
    print(f"Manifest JSON: {json_path}")


def print_summary(rows: Sequence[ManifestRow], execute: bool) -> None:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
    mode = "EXECUTE" if execute else "DRY RUN"
    print(f"\n{mode} summary")
    for status, count in sorted(counts.items()):
        print(f"  {status}: {count}")
    missing = [row for row in rows if row.status in {"missing", "error"}]
    if missing:
        print("\nMissing/error examples:")
        for row in missing[:10]:
            print(f"  {row.candidate_id}: {row.message}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more (see the execute manifest)")


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    rows: list[ManifestRow] = []
    try:
        if not args.skip_ego4d:
            collect_ego4d(args, rows)
        if not args.skip_previous:
            collect_previous(args, rows)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    print_summary(rows, args.execute)
    if args.execute:
        write_manifests(args.output_root, rows)
    else:
        print("\nNo files were written. Re-run with --execute after checking the dry-run summary.")

    return 1 if any(row.status == "error" for row in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
