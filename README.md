# VPrivCal-Q10 + VPrivCal-Probe

A deployable React research frontend for the VPrivCal method. The site combines:

- **VPrivCal-Q10**: ten policy questions that initialize reminder preferences.
- **VPrivCal-Probe**: three synthetic egocentric scenes using point-first marking followed by a neutral, category-hidden, category-complete review.

Question wording and policy semantics are based on `source materials/VPrivCal_Full_Research_Plan_Updated_v6.docx`. The current expert-review procedure is `source materials/VPrivCal_Expert_Workshop_Interface_Aligned_v6_1.docx`; the earlier `VPrivCal_Expert_Workshop_Updated_v6.docx` is retained as the unmodified source version. Scene coverage, detections, coordinates, evidence mappings, and Probe response coding come from `public/data/vprivcal_detections.json`.

The repository includes an optional Lambda/DynamoDB participant-persistence placeholder modeled on the continuous-VLM study. Expert review is always memory-only. No analytics or trackers are included.

## Participant-answer policy filter

The executable policy engine is implemented in [`src/utils/policyFilter.ts`](src/utils/policyFilter.ts), with focused tests in [`src/utils/policyFilter.test.ts`](src/utils/policyFilter.test.ts). Its full design is documented in [`docs/policy-filter/README.md`](docs/policy-filter/README.md), including validation, rule hierarchy, action-scale mappings, safety floors, pseudocode, and examples. The study UI does not currently invoke this engine. `showProfilePage` is disabled, the legacy profile component produces only a simpler summary, and the static site has no calibrated runtime cue feed.

## Pre-expert simulated policy pre-verification

Before the expert workshop or participant cognitive interviews, run a small offline pre-verification using **simulated response profiles** and manually checked video cues. This step is intended to expose broken mappings, implausible policy decisions, missing categories, unsafe fallbacks, and unclear explanations before expert time is spent. It is not user profiling, an effectiveness result, or evidence that the method works.

Use the following sequence:

1. Create a small set of deliberately contrasting simulated response exports, such as low-intervention, high-protection, context-dependent, uncertainty-sensitive, and reminder-averse profiles. Do not describe these as participants or infer demographic identities for them.
2. Validate each export and compile it with the versioned policy engine in `src/utils/policyFilter.ts`.
3. Apply generic, Q10-only, and full compiled-policy conditions to the same manually verified cue set. Keep the original answers, compiled policy, candidate metadata, decision reasons, thresholds, safety-floor result, and software versions together.
4. Manually inspect deterministic repeatability, strictness ordering, unknown-category fallback, Q7/Q9/Q10 interactions, Q8 reminder filtering, and the difference between preference and safety-floor-adjusted actions.
5. Record defects and revise the implementation or expert-workshop prompts. Treat all resulting tables, profiles, and decisions as **simulated non-empirical outputs**.

For minimum sufficient coverage, start with the seven previously selected 12-second continuous-VLM windows. They cover biometric data, background individuals, PII, personal life, legal/cultural sensitivity, a child-related negative/inference control, and a negative privacy control. The Ego4D `Household management - caring for kids` matches are uncertain candidates: collect all of them and manually verify actual child visibility before selecting the shortest usable excerpts. Do not assume that the scenario label proves that a child appears.

[`scripts/filter_candidate_videos.py`](scripts/filter_candidate_videos.py) prepares those source videos. It is dry-run-only unless `--execute` is supplied and never modifies source files. The currently mounted research collection is configured as overridable defaults:

- Ego4D: `E:\ego4d_data\v2\full_scale`
- FHO annotations: `E:\ego4d_data\v2\annotations\fho_main.json`
- continuous-VLM stories: `E:\ego4d_data\documents\12 stories final`
- output: `E:\VPrivCal_pre_expert`

```powershell
python scripts/filter_candidate_videos.py `
  --previous-mode copy-full `
  --materialize-fho-first-round `
  --execute
```

Pass explicit root arguments to override those locations. FFmpeg is required to extract the short continuous-VLM windows. The example uses `--previous-mode copy-full` because FFmpeg is not installed on the current workstation; the manifest retains each 12-second start/end pair for later trimming. The missing `story_02/clip_05.mp4` alias is resolved against its audited source under `documents/story_clips_old/story_02_pid_104`. Use `--skip-ego4d` or `--skip-previous` when only one collection is mounted.

An executed collection writes `candidate_video_manifest.csv`, `candidate_video_manifest.json`, and `candidate_detections.json`. It scans `fho_main.json` without loading the 2 GB file into memory and assigns videos with an FHO annotation to review round 1. The current intersection contains 62 videos. `fho_annotated_first_round_manifest.csv`, `fho_annotated_first_round_manifest.json`, and `fho_annotated_first_round.m3u8` provide the filtered queue and playlist. With `--materialize-fho-first-round`, the 62 real video files are also copied into `fho_annotated_first_round_videos`; existing files are safely skipped on reruns. Presence in FHO means only that structured hand-object annotations exist; it does not confirm a child or even another person is visible.

The detection JSON contains six configured policy cues, one negative control, and a separate list of all Ego4D candidates. Ego4D entries deliberately have `childVisible: null` and `policyCandidate: null` until manual review establishes child visibility and calibrated likelihood/severity tiers. Pass `--skip-fho-screen` only when the annotation file is unavailable; those candidates will remain unsplit by review round.

To extract any explicit child-related timestamp language from the complete timestamped Ego4D narrations, run:

```powershell
python scripts/generate_child_timestamp_review.py
```

This writes `child_appearance_timestamp_review.csv` and `.json` beside the candidate manifests. Only explicit terms such as *child*, *kid*, *baby*, *boy*, or *girl* produce a timestamp candidate and a `-3/+5` second review window. Generic other-person narration is retained separately and never labeled as a child. An empty child timestamp means only that the annotations did not identify one; visual review remains required.

Manually confirmed results can be upserted without editing generated files directly:

```powershell
python scripts/record_manual_child_review.py `
  --video-uid "<VIDEO_UID>" `
  --child-visible yes `
  --appearance-start-sec 120 `
  --appearance-end-sec 145
```

This maintains `manual_child_visibility_reviews.csv` and `.json`. Omit the timestamp arguments when visibility is confirmed but the exact interval is still pending.

Run the deterministic simulated-profile comparison against that JSON with:

```powershell
npm run preexpert:simulate
```

This writes `E:\VPrivCal_pre_expert\simulated_policy_comparison.json`. The report retains the five simulated response exports, compiled policies, candidate metadata, decision reasons, reminder thresholds, safety-floor results, and software versions. It compares the personalized preference action and proof-of-concept guardrailed action with a declared no-filter baseline of rank 0. Exact action agreement is only an implementation-oriented preference-alignment proxy; it is not a measurement of participant satisfaction, detector accuracy, or effectiveness. Tests for this workflow are in [`src/utils/preExpertSimulation.test.ts`](src/utils/preExpertSimulation.test.ts).

The pre-expert gate is complete only when candidate visibility has been manually checked, every simulated decision is reproducible and auditable, and unresolved failures are documented for expert review. The participant-facing profile remains disabled throughout this step. The interface-aligned review form is [`source materials/VPrivCal_Expert_Workshop_Interface_Aligned_v6_1.docx`](source%20materials/VPrivCal_Expert_Workshop_Interface_Aligned_v6_1.docx).

## Participant and expert-review interfaces

The same static build provides two deliberately different entry experiences:

- **Participant study:** open only the normal site URL, for example `https://example.org/vprivcal/`. No `/#/` suffix is needed. It shows study information, a required Prolific ID field, and an explicit consent checkbox before the study interface.
- **Expert review demo:** append `?expert_review=true`, for example `https://example.org/vprivcal/?expert_review=true`. It presents the workflow and a chooser for any of the three Probe scenes. Demo answers are never stored and every reload starts from scratch.
- **Direct expert Probe review:** append `?expert_review=probe`, for example `https://example.org/vprivcal/?expert_review=probe`. This opens the three-scene chooser directly. Add `&scene=scene_public_cafe`, `&scene=scene_private_family_party`, or `&scene=scene_semipublic_hospital` to open a specific fresh scene.

Legacy root links ending in `/#/` are canonicalized to the plain site URL. Expert review has no browser or remote persistence, so a demonstration cannot overwrite participant data.

## Requirements and setup

- Node.js 20.19 or newer
- npm 10 or newer

```bash
npm install
npm run dev
```

For participant persistence, set `VITE_API_BASE_URL` to the deployed API Gateway base URL. When it is empty, participant progress is held only in memory for frontend development and no persistence request is made.

Open the local URL printed by Vite. Useful commands:

```bash
npm run lint
npm run test
npm run build
npm run preview
npm run check
```

`npm run build` creates a static deployment in `dist/`. The landing URL is clean; after entry, the app uses hash-based client routes so the same build works at a domain root or static-host subdirectory without server rewrite rules.

## Study flow

| Screen | Hash route | Purpose |
|---|---|---|
| Participant consent | `/` | Study information, required Prolific ID, and voluntary agreement |
| Expert workflow overview | `?expert_review=true` | Whole-method sequence, review focus, and demo launch |
| Direct expert Probe review | `?expert_review=probe` | Opens the three-scene chooser with a fresh in-memory demo |
| Consent alias | `#/participant` | Returns to the same participant consent page |
| Q10 | `#/q10` | One required policy question at a time, with Back navigation |
| Probe instructions | `#/probe/instructions` | Explains point-first marking and neutral linked-content review |
| Probe scene | `#/probe/:sceneId` | Phase A pointing followed by sequential, category-hidden review items |
| Profile (disabled by default) | `#/profile` | Redirects to Complete while `showProfilePage` is `false`; the legacy simpler summary appears only if enabled |
| Complete | `#/complete` | Validated JSON and category-pair CSV downloads |

The original scene order and deterministically shuffled display order are stored. The Prolific ID seeds shuffling. Category cards are deterministically shuffled per scene. Response options are never shuffled. The global top bar is intentionally omitted; Q10 and Probe screens show progress in their own question and scene controls.

## Researcher configuration

Edit the single typed module at `src/config.ts`:

```ts
interface StudyConfig {
  studyVersion: string;
  participantIdRequired: boolean;
  randomizeSceneOrder: boolean;
  randomizeCategoryOrder: boolean;
  showProbeCategoryIdentities: boolean;
  showProfilePage: boolean;
  profileCommentsEnabled: boolean;
  jsonExportEnabled: boolean;
  csvExportEnabled: boolean;
  participantApiBaseUrl: string;
  participantRemoteSaveDebounceMs: number;
}
```

Changing `studyVersion` intentionally causes older stored sessions to be treated as incompatible and starts a fresh session.

### Updating stimuli or detections

1. Put images under `public/assets/images/`.
2. Update `public/data/vprivcal_detections.json`.
3. Keep every `bbox` normalized to `[0,1]` with a top-left origin and `x`, `y`, `width`, and `height`.
4. Ensure every `availableCategoryIds` item has one `categoryEvidence` entry, even when multiple categories share a detection.
5. Run `npm run check`.

Detection boxes are never hardcoded in components. The application loads the local JSON once at startup and validates its essential structure before rendering the study.

## Pointing and coordinate behavior

`ResponsiveImageCanvas` keeps the image and overlays in a shared aspect-ratio frame. Pointer coordinates are calculated from the actual rendered image rectangle and normalized before hit testing. Out-of-image points are ignored. Matching detections are sorted by normalized area so the most specific region wins. Equally specific matches with different primary categories open a compact chooser while retaining the original point.

Probe scenes use a 7:5 image-and-annotation workspace modeled on the reference VLM annotation interface. Pointing selections and review questions remain in a right sidebar constrained to the rendered image panel height; the sidebar scrolls independently instead of forcing repeated page scrolling. Before the first Probe, a blocking prompt asks the participant to view Hint mode. Entering Hint mode then opens a centered **You are in Hint mode** alert explaining that the participant is starting Stage 2 (Probe), that its opening activity is a short image-control interaction test, and that the Probe questions follow it. After acknowledgement, a white callout with a clear red boundary appears directly beside the current control and provides a direct **Next hint** button at every step. Each newly active callout is smoothly centered and focused whether progression came from a real practice control or the direct button. The question choices are disabled during Hint mode and sample answers are simulated only to demonstrate the next-item state. Hint state never enters the study response. After the required first walkthrough, Hint mode can be restarted from either Phase A or Phase B.

Phase A never displays precomputed detection boxes or the full category set, including when a participant's point overlaps a VLM-detected privacy area; only the numbered participant point is shown. Participants only mark areas; they do not name them or select privacy categories. A matched detection's primary category is retained internally so the export can indicate whether that category was selected spontaneously, but the mapping is not exposed or editable during the first look. Selecting **Review all privacy threats** begins Phase B. The right sidebar presents each valid review item sequentially but, with `showProbeCategoryIdentities: false`, hides the category stepper, category name, and description. Above the two compact questions it shows the specific linked detection label, or multiple labels when an item contains multiple highlighted detections, so participants can identify the visual content without seeing its privacy category. Evidence regions from `categoryEvidence` remain available through the shorter highlight toggle.

When a Phase A point maps internally to a review item's category, Phase B preselects the first awareness option for that item. The participant then needs only to answer the preferred-action question unless they want to change the preselected awareness response. Review items that were not pointed to remain unanswered in both questions.

Zooming preserves the current visual center. The image toolbar has separate pointer and move icon buttons. The pointer is a toggle, so participants can turn pointing off without enabling movement and select it again when they want to resume marking. At zoom levels above 100%, select the move icon and drag the scene, or focus it and use the arrow keys, to reposition the visible area. **Reset view** returns to 100% and the original position. Panning changes only the viewport; normalized selection and overlay coordinates remain anchored to the source image.

Every point inside the image is accepted immediately, whether or not it overlaps a predefined privacy detection. An unmatched point is stored with the internal `other_not_sure` value for schema compatibility. These points exist only in the response record and never modify the source detection JSON.

Keyboard users can focus the image, move a crosshair with arrow keys, and press Enter or Space to select. Shift + arrow makes a finer movement. The voluntarily opened list fallback reveals neutral source labels only after the participant chooses that alternative.

## Participant persistence, expert reset, and researcher reset

The frontend does not store research sessions in `localStorage`. Participant mode follows the continuous-VLM API pattern: submitting the Prolific ID requests the saved session from `POST /status`, and subsequent state changes are debounced to `POST /stage`. Researcher reset calls `POST /clean`. The complete typed session is stored as the DynamoDB record's `session` document.

The API base URL comes from `VITE_API_BASE_URL`. With no configured URL, these functions are a network-silent placeholder and participant state lasts only for the current page lifetime. See `infrastructure/README.md` and the included Lambda handler for the request schema and deployment requirements.

Expert review never reads or writes browser storage and never calls the participant API. Refreshing any expert page creates a new session. The Probe chooser allows the reviewer to begin with any scene.

Participant screens include a compact elapsed-time counter above the page content. It shows time spent reviewing the consent page, resets when consent is submitted, resumes from the remote consent timestamp after refresh when the API is configured, and freezes when the study is complete. It is not shown in expert-review mode.

Researcher controls are intentionally hidden from the normal participant interface. Open the participant URL with `?researcher=true` to expose a collapsed **Researcher controls** section. With an API configured, the clear button deletes the participant's remote record, creates a new in-memory session, and returns to the entry page. Expert review needs no clear action because reload starts fresh.

For shared tablets, researchers should clear the prior session between participants and confirm that the welcome page no longer offers to resume it.

## Response export schema

The JSON download is validated before the button is enabled. It follows this top-level shape and includes a few extra audit fields (for example original order, displayed click pixels, selected detection ID, and timestamps):

```ts
interface VPrivCalResponseExport {
  schemaVersion: string;
  studyVersion: string;
  participantId: string;
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  userAgent: string;
  viewportHistory: Array<{ width: number; height: number; at: string }>;
  originalSceneOrder: string[];
  randomizedSceneOrder: string[];
  consent: {
    agreed: boolean;
    prolificId: string;
    answeredAt: string;
  } | null;
  q10: Array<{
    questionId: string;
    value: number | string;
    label: string;
    firstViewedAt: string;
    answeredAt: string;
    changes: number;
    finalResponse: number | string;
  }>;
  probe: Array<{
    sceneId: string;
    startedAt: string;
    completedAt: string | null;
    pointSelections: Array<{
      selectionId: string;
      sceneId: string;
      clickNumber: number;
      normalizedPoint: { x: number; y: number };
      displayedPoint: { x: number; y: number };
      manualBox?: { x: number; y: number; width: number; height: number };
      matchedDetectionIds: string[];
      selectedDetectionId: string | null;
      autoCategoryId: string | null;
      finalCategoryId: string;
      categoryCorrected: boolean;
      manualUnmatched: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    categoryResponses: Array<{
      categoryId: string;
      presentationOrder: number;
      linkedDetectionIds: string[];
      spontaneouslySelected: boolean;
      awarenessStatus: number;
      preferredAction: number;
      evidenceOpened: boolean;
      evidenceToggleCount: number;
      changes: number;
      durationMs: number;
    }>;
  }>;
  profileConfirmation: {
    value: string;
    comment?: string;
    answeredAt: string;
  } | null;
  timing: {
    q10DurationMs: number;
    probeStartedAt: string | null;
    probeCompletedAt: string | null;
    probeDurationMs: number;
    totalDurationMs: number;
  };
}
```

`autoCategoryId`, `finalCategoryId`, and `categoryCorrected` remain in the export for schema and analysis compatibility. The Phase A interface does not ask participants to classify or correct their own markings, so matched points retain the internal model mapping, unmatched regions use `other_not_sure`, and `categoryCorrected` remains `false`.

Probe timing starts only when the participant completes the required first Hint walkthrough and stops when the final Probe scene is completed. The visible Probe timer remains at `00:00` during the introductory prompt and Hint walkthrough. The two persisted timing boundaries and their elapsed duration are included in the JSON export.

Probe awareness uses the source JSON values `1–4`. Probe preferred action uses `0–4`, from no intervention through avoid unless explicitly requested. Q10 uses the research plan's `1–5` item coding.

The CSV contains one row per required category-image pair with IDs, response labels and values, evidence use, changes, and duration. It is intended for quick researcher inspection; JSON remains the complete record.

## Testing

The Vitest/React Testing Library suite covers:

- normalized coordinate conversion across rendered sizes and offsets;
- out-of-image rejection;
- overlapping detection hit testing and smallest-area priority;
- equal-specificity resolution candidates;
- immediately accepted unmatched points;
- internal category mapping for matched points without participant-facing classification;
- participant `/status` restoration and `/stage` request payloads;
- zero persistence requests when the placeholder endpoint is unconfigured;
- complete review of every `availableCategoryId`;
- deterministic scene/category randomization;
- valid and invalid exports plus CSV row counts;
- relative/subdirectory asset paths;
- semantic category-review controls.

Run all quality gates with `npm run check`.

## Deployment

### GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`.

1. Push the project to a GitHub repository using `main` as the default branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push to `main` or run the workflow manually.
4. The workflow installs from `package-lock.json`, runs lint/tests/build, and publishes `dist/`.

Relative assets and hash routes make repository subpaths work without a custom `404.html` workaround. Provide `VITE_API_BASE_URL` as a workflow environment variable when enabling participant persistence.

### Netlify

Connect the repository with:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `20`

Alternatively, drag the local `dist/` directory into Netlify Drop. No redirects file is required for hash routes.

### Ordinary static hosting

Run `npm run build`, then copy every file in `dist/` to the desired directory on the static server. Do not open `dist/index.html` directly with a `file://` URL because browsers may restrict local JSON fetches; serve it over HTTP(S).

## Ethics and data handling

- All stimuli, visible records, and identifiers are synthetic.
- Ask only for the participant's Prolific ID; do not ask for a real name or email address.
- The interface does not infer protected traits from faces or people.
- No analytics, trackers, or remote fonts are included. Participant session requests are sent only to the researcher-configured API Gateway endpoint.
- Simulated or legacy generated profiles are preference summaries, not diagnoses, real-user findings, or guaranteed privacy controls.
- Store exported files only in the study's approved secure location.

## Repository structure

```text
.
├── .github/workflows/deploy-pages.yml
├── public/
│   ├── assets/images/                  # Three synthetic scene images
│   └── data/vprivcal_detections.json   # Detection and Probe source of truth
├── source materials/                   # Research plans and original supplied assets
├── scripts/                            # Candidate-video collection and excerpt utility
├── infrastructure/                    # Lambda/DynamoDB persistence placeholder
├── src/
│   ├── components/                     # Image, overlay, review, progress, layout controls
│   ├── context/                        # Dataset and persistent study state
│   ├── pages/                          # Route screens
│   ├── test/                           # Shared test setup and fixtures
│   ├── utils/                          # Coordinates, hit testing, storage, export, shuffle
│   ├── config.ts                       # Typed researcher configuration
│   ├── questions.ts                    # Research-plan Q10 wording and options
│   ├── types.ts                        # Dataset, session, and export types
│   └── styles.css                      # Responsive academic visual system
├── package.json
├── package-lock.json
├── vite.config.ts
└── README.md
```
