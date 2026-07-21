#!/usr/bin/env python3
"""Collect the video candidates used by the VPrivCal evaluation.

The utility handles two independent source collections:

1. Ego4D full-scale videos. Every video whose metadata contains the exact
   ``Household management - caring for kids`` scenario is copied in full so a
   researcher can screen it manually for actual child visibility.
2. The continuous-VLM story videos. Seven previously selected short windows
   are extracted with FFmpeg (or their complete source clips can be copied).

Nothing is written unless ``--execute`` is supplied. Source files are never
modified. The repository is currently paired with the research collection
under ``E:\\ego4d_data``. Those paths are defaults only: every location remains
overridable from the command line.

Example (PowerShell)::

    py scripts/filter_candidate_videos.py `
      --ego4d-root "E:\\ego4d_data\\v2\\full_scale" `
      --continuous-vlm-root "E:\\ego4d_data\\documents\\12 stories final" `
      --output-root "E:\\VPrivCal_pre_expert" `
      --previous-mode copy-full `
      --execute

Use ``--skip-previous`` or ``--skip-ego4d`` when only one collection is
available. Use ``--previous-mode copy-full`` if FFmpeg is unavailable.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EGO4D_METADATA = REPOSITORY_ROOT / "source materials" / "ego4d.json"
DEFAULT_EGO4D_ROOT = Path(r"E:\ego4d_data\v2\full_scale")
DEFAULT_CONTINUOUS_VLM_ROOT = Path(r"E:\ego4d_data\documents\12 stories final")
DEFAULT_OUTPUT_ROOT = Path(r"E:\VPrivCal_pre_expert")
DEFAULT_FHO_MAIN = Path(r"E:\ego4d_data\v2\annotations\fho_main.json")
CHILD_CARE_SCENARIO = "Household management - caring for kids"
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"}
DETECTION_SCHEMA_VERSION = "vprivcal-pre-expert-candidate-detections-1.1.0"
FHO_VIDEO_UID_PATTERN = re.compile(rb'"video_uid"\s*:\s*"([0-9a-fA-F-]{36})"')


@dataclass(frozen=True)
class PreviousWindow:
    candidate_id: str
    story_id: str
    clip_id: str
    start_sec: float
    end_sec: float
    vprivcal_categories: tuple[str, ...]
    purpose: str
    scenario_type: str
    is_inference: bool
    is_uncertain: bool
    task_relevant: bool
    likelihood_tier: int
    severity_tier: int
    expected_privacy_cue: bool = True
    fallback_globs: tuple[str, ...] = ()
    manual_review_status: str = "confirmed"
    manual_review_note: str = "Visual cue confirmed in the configured window."

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
        "private",
        False,
        False,
        True,
        5,
        4,
        manual_review_status="rejected_false_positive",
        manual_review_note=(
            "Full-clip visual review found a gaming monitor only; the wearer's face "
            "is not visibly supported in this source clip or window."
        ),
    ),
    PreviousWindow(
        "previous_02_basketball_bystanders",
        "story_12",
        "clip_02",
        0.0,
        12.0,
        ("background_individuals", "biometric_data"),
        "Multiple basketball players in a public/social setting.",
        "public",
        False,
        False,
        True,
        3,
        3,
    ),
    PreviousWindow(
        "previous_03_pay_slip",
        "story_06",
        "clip_05",
        4.0,
        16.0,
        ("pii",),
        "Financial document/pay slip; clear direct PII cue.",
        "private",
        False,
        False,
        False,
        5,
        5,
        manual_review_status="rejected_false_positive",
        manual_review_note=(
            "Full-clip visual review shows car cleaning with tissues; no readable pay "
            "slip or financial document is visibly supported."
        ),
    ),
    PreviousWindow(
        "previous_04_home_altar",
        "story_02",
        "clip_05",
        0.0,
        12.0,
        ("legal_sensitivity_information", "personal_life"),
        "Home altar; culturally sensitive inference and personal-life cue.",
        "private",
        True,
        False,
        False,
        4,
        4,
        fallback_globs=(
            "story_clips_old/story_02_pid_104/"
            "story_02_pid_104_clip05_*.mp4",
        ),
    ),
    PreviousWindow(
        "previous_05_lab_screen",
        "story_12",
        "clip_03",
        45.0,
        57.0,
        ("pii",),
        "Laboratory system screen; task-irrelevant/confidential workplace cue.",
        "semi-public",
        False,
        False,
        False,
        4,
        4,
    ),
    PreviousWindow(
        "previous_06_gabriele_name",
        "story_04",
        "clip_05",
        9.0,
        21.0,
        ("pii", "children_images"),
        "Name on a child-related activity book; PII positive and child-image negative/inference control.",
        "private",
        True,
        True,
        False,
        3,
        3,
    ),
    PreviousWindow(
        "previous_07_hot_glue_negative",
        "story_04",
        "clip_05",
        94.0,
        106.0,
        (),
        "Expert-rejected hot-glue-gun privacy cue; negative control.",
        "private",
        False,
        False,
        True,
        1,
        1,
        expected_privacy_cue=False,
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
    fho_annotation_available: str = "not_screened"
    review_round: int | str = ""
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
        default=DEFAULT_EGO4D_ROOT,
        help=(
            "Root containing downloaded Ego4D full-scale video files "
            f"(default: {DEFAULT_EGO4D_ROOT}; searched recursively)."
        ),
    )
    parser.add_argument(
        "--continuous-vlm-root",
        type=Path,
        default=DEFAULT_CONTINUOUS_VLM_ROOT,
        help=(
            "Root containing continuous-VLM story videos, normally with paths "
            "such as story_12/clip_05.mp4 "
            f"(default: {DEFAULT_CONTINUOUS_VLM_ROOT})."
        ),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help=f"Destination root for collected videos and manifests (default: {DEFAULT_OUTPUT_ROOT}).",
    )
    parser.add_argument(
        "--ego4d-metadata",
        type=Path,
        default=DEFAULT_EGO4D_METADATA,
        help=f"Ego4D metadata JSON (default: {DEFAULT_EGO4D_METADATA}).",
    )
    parser.add_argument(
        "--fho-main",
        type=Path,
        default=DEFAULT_FHO_MAIN,
        help=(
            "Ego4D FHO annotations used to prioritize the first manual-review round "
            f"(default: {DEFAULT_FHO_MAIN})."
        ),
    )
    parser.add_argument(
        "--skip-fho-screen",
        action="store_true",
        help="Do not split Ego4D candidates by presence in fho_main.json.",
    )
    parser.add_argument(
        "--materialize-fho-first-round",
        action="store_true",
        help=(
            "Copy the FHO-annotated round-one videos into a dedicated review folder. "
            "Existing files are skipped unless --overwrite is also supplied."
        ),
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


def load_fho_video_uids(annotation_path: Path, chunk_size: int = 16 * 1024 * 1024) -> set[str]:
    """Return video UIDs present in the large FHO JSON without loading it into memory."""
    if not annotation_path.is_file():
        raise FileNotFoundError(f"Ego4D FHO annotations not found: {annotation_path}")
    video_uids: set[str] = set()
    overlap = 256
    tail = b""
    with annotation_path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            data = tail + chunk
            video_uids.update(
                match.group(1).decode("ascii").casefold()
                for match in FHO_VIDEO_UID_PATTERN.finditer(data)
            )
            tail = data[-overlap:]
    return video_uids


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

    fallback_matches = [
        path
        for pattern in window.fallback_globs
        for path in root.parent.glob(pattern)
        if path.is_file() and path.suffix.casefold() in VIDEO_EXTENSIONS
    ]
    fallback_matches.sort(key=video_path_preference)
    if fallback_matches:
        return fallback_matches[0], fallback_matches

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


def collect_ego4d(
    args: argparse.Namespace,
    rows: list[ManifestRow],
    fho_video_uids: set[str] | None,
) -> None:
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
        fho_annotation_available = (
            "not_screened"
            if fho_video_uids is None
            else "yes" if uid.casefold() in fho_video_uids else "no"
        )
        row = ManifestRow(
            selection_group="ego4d_child_care",
            candidate_id=f"ego4d_{uid}",
            video_uid=uid,
            duration_sec=duration,
            scenarios=scenarios,
            vprivcal_categories="children_images",
            purpose="Manual verification of whether a child is actually visible.",
            fho_annotation_available=fho_annotation_available,
            review_round=(
                "" if fho_video_uids is None else 1 if fho_annotation_available == "yes" else 2
            ),
            source_path=str(source or ""),
            output_path=str(destination),
        )
        if window.manual_review_status == "rejected_false_positive":
            row.status = "rejected_false_positive"
            row.message = window.manual_review_note
        elif source is None:
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


def preferred_candidate_path(row: ManifestRow) -> str:
    output_path = Path(row.output_path) if row.output_path else None
    if output_path and output_path.is_file():
        return str(output_path)
    return row.source_path


def fho_first_round_video_path(output_root: Path, row: ManifestRow) -> Path:
    source_path = Path(preferred_candidate_path(row))
    suffix = source_path.suffix.casefold() or ".mp4"
    return output_root / "fho_annotated_first_round_videos" / f"{row.video_uid}{suffix}"


def materialize_fho_first_round(
    output_root: Path,
    rows: Sequence[ManifestRow],
    overwrite: bool,
) -> None:
    first_round = [
        row
        for row in rows
        if row.selection_group == "ego4d_child_care" and row.fho_annotation_available == "yes"
    ]
    counts: dict[str, int] = {}
    for row in first_round:
        source = Path(preferred_candidate_path(row))
        destination = fho_first_round_video_path(output_root, row)
        status, message = copy_video(source, destination, overwrite)
        counts[status] = counts.get(status, 0) + 1
        if status == "error":
            print(f"First-round copy error for {row.video_uid}: {message}", file=sys.stderr)
    summary = ", ".join(f"{status}={count}" for status, count in sorted(counts.items()))
    print(f"FHO first-round video folder: {output_root / 'fho_annotated_first_round_videos'}")
    print(f"FHO first-round materialization: {summary}")


def write_fho_first_round_queue(output_root: Path, rows: Sequence[ManifestRow]) -> None:
    first_round = [
        row
        for row in rows
        if row.selection_group == "ego4d_child_care" and row.fho_annotation_available == "yes"
    ]
    if not first_round:
        return
    first_round.sort(key=lambda row: (float(row.duration_sec or 0), row.video_uid))
    csv_path = output_root / "fho_annotated_first_round_manifest.csv"
    json_path = output_root / "fho_annotated_first_round_manifest.json"
    playlist_path = output_root / "fho_annotated_first_round.m3u8"
    fieldnames = list(ManifestRow.__dataclass_fields__)
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(asdict(row) for row in first_round)
    with json_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(
            {
                "schemaVersion": "vprivcal-fho-first-round-1.0.0",
                "nonEmpirical": True,
                "selectionBasis": "video_uid is present in Ego4D fho_main.json",
                "childVisibilityConfirmed": False,
                "warning": (
                    "FHO annotation coverage does not mean that a child is visible. "
                    "Every candidate still requires visual review."
                ),
                "count": len(first_round),
                "candidates": [
                    {
                        "candidateId": row.candidate_id,
                        "videoUid": row.video_uid,
                        "durationSec": row.duration_sec,
                        "videoPath": str(
                            fho_first_round_video_path(output_root, row)
                            if fho_first_round_video_path(output_root, row).is_file()
                            else preferred_candidate_path(row)
                        ),
                        "childVisible": None,
                        "manualReviewStatus": "pending",
                    }
                    for row in first_round
                ],
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")
    with playlist_path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write("#EXTM3U\n")
        for row in first_round:
            handle.write(f"#EXTINF:-1,{row.video_uid}\n")
            materialized_path = fho_first_round_video_path(output_root, row)
            handle.write(
                f"{materialized_path if materialized_path.is_file() else preferred_candidate_path(row)}\n"
            )
    print(f"FHO first-round CSV:      {csv_path}")
    print(f"FHO first-round JSON:     {json_path}")
    print(f"FHO first-round playlist: {playlist_path}")


def source_record(row: ManifestRow) -> dict[str, Any]:
    output_path = Path(row.output_path) if row.output_path else None
    collected_path = str(output_path) if output_path and output_path.is_file() else None
    return {
        "selectionGroup": row.selection_group,
        "sourcePath": row.source_path or None,
        "collectedPath": collected_path,
        "plannedOutputPath": row.output_path or None,
        "collectionStatus": row.status,
        "collectionMessage": row.message,
        "sourceAvailable": bool(row.source_path) and row.status not in {"missing", "error"},
        "startSec": row.start_sec if row.start_sec != "" else None,
        "endSec": row.end_sec if row.end_sec != "" else None,
    }


def build_detection_document(
    args: argparse.Namespace,
    rows: Sequence[ManifestRow],
) -> dict[str, Any]:
    rows_by_id = {row.candidate_id: row for row in rows}
    configured_detections: list[dict[str, Any]] = []
    for window in PREVIOUS_WINDOWS:
        row = rows_by_id.get(window.candidate_id)
        if row is None:
            continue
        policy_candidate = None
        visually_supported = window.manual_review_status != "rejected_false_positive"
        if window.expected_privacy_cue and visually_supported:
            policy_candidate = {
                "candidateId": window.candidate_id,
                "stableRegionId": f"window:{window.story_id}:{window.clip_id}:{window.start_sec:g}-{window.end_sec:g}",
                "categoryIds": list(window.vprivcal_categories),
                "scenarioType": window.scenario_type,
                "isInference": window.is_inference,
                "isUncertain": window.is_uncertain,
                "taskRelevant": window.task_relevant,
                "explicitlyRequested": False,
                "likelihoodTier": window.likelihood_tier,
                "severityTier": window.severity_tier,
                "reasonCodes": ["configured_pre_expert_cue"],
            }
        configured_detections.append(
            {
                "detectionId": window.candidate_id,
                "label": window.purpose,
                "expectedPrivacyCue": window.expected_privacy_cue,
                "manualReviewStatus": window.manual_review_status,
                "manualReviewNote": window.manual_review_note,
                "source": source_record(row),
                "policyCandidate": policy_candidate,
            }
        )

    ego4d_candidates = []
    for row in rows:
        if row.selection_group != "ego4d_child_care":
            continue
        ego4d_candidates.append(
            {
                "candidateId": row.candidate_id,
                "videoUid": row.video_uid,
                "scenarios": row.scenarios.split(" | ") if row.scenarios else [],
                "suggestedCategoryIds": ["children_images"],
                "fhoAnnotationAvailable": (
                    None
                    if row.fho_annotation_available == "not_screened"
                    else row.fho_annotation_available == "yes"
                ),
                "reviewRound": row.review_round or None,
                "manualReviewStatus": "pending",
                "childVisible": None,
                "policyCandidate": None,
                "reviewInstruction": (
                    "The scenario label is not detection evidence. Set childVisible only after "
                    "visual review, then add calibrated cue metadata before policy evaluation."
                ),
                "source": source_record(row),
            }
        )

    policy_candidate_count = sum(
        detection["policyCandidate"] is not None for detection in configured_detections
    )
    negative_control_count = sum(
        not detection["expectedPrivacyCue"]
        and detection["manualReviewStatus"] != "rejected_false_positive"
        for detection in configured_detections
    )
    rejected_false_positive_count = sum(
        detection["manualReviewStatus"] == "rejected_false_positive"
        for detection in configured_detections
    )
    fho_first_round_count = sum(
        candidate["fhoAnnotationAvailable"] is True for candidate in ego4d_candidates
    )
    fho_later_round_count = sum(
        candidate["fhoAnnotationAvailable"] is False for candidate in ego4d_candidates
    )
    return {
        "schemaVersion": DETECTION_SCHEMA_VERSION,
        "nonEmpirical": True,
        "purpose": (
            "Manual-review template and deterministic policy-filter input for pre-expert "
            "verification; not a VLM effectiveness result."
        ),
        "manualVerificationRequired": True,
        "sourceRoots": {
            "ego4d": None if args.skip_ego4d else str(args.ego4d_root),
            "continuousVlm": None if args.skip_previous else str(args.continuous_vlm_root),
            "output": str(args.output_root),
        },
        "counts": {
            "configuredDetections": len(configured_detections),
            "configuredPolicyCandidates": policy_candidate_count,
            "configuredNegativeControls": negative_control_count,
            "configuredRejectedFalsePositives": rejected_false_positive_count,
            "ego4dPendingManualReview": len(ego4d_candidates),
            "ego4dFhoAnnotatedFirstRound": fho_first_round_count,
            "ego4dWithoutFhoAnnotationLaterRound": fho_later_round_count,
        },
        "configuredDetections": configured_detections,
        "ego4dManualReviewCandidates": ego4d_candidates,
    }


def write_detection_json(
    output_root: Path,
    args: argparse.Namespace,
    rows: Sequence[ManifestRow],
) -> None:
    detection_path = output_root / "candidate_detections.json"
    with detection_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(build_detection_document(args, rows), handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Detection JSON: {detection_path}")


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
        fho_video_uids: set[str] | None = None
        if not args.skip_ego4d and not args.skip_fho_screen:
            print(f"Scanning FHO annotation coverage: {args.fho_main}")
            fho_video_uids = load_fho_video_uids(args.fho_main)
            print(f"FHO annotated video UIDs found: {len(fho_video_uids)}")
        if not args.skip_ego4d:
            collect_ego4d(args, rows, fho_video_uids)
        if not args.skip_previous:
            collect_previous(args, rows)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    print_summary(rows, args.execute)
    if args.execute:
        write_manifests(args.output_root, rows)
        if args.materialize_fho_first_round:
            materialize_fho_first_round(args.output_root, rows, args.overwrite)
        write_fho_first_round_queue(args.output_root, rows)
        write_detection_json(args.output_root, args, rows)
    else:
        print("\nNo files were written. Re-run with --execute after checking the dry-run summary.")

    return 1 if any(row.status == "error" for row in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
