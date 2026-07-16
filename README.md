# VPrivCal-Q10 + VPrivCal-Probe

A deployable React research frontend for the VPrivCal method. The site combines:

- **VPrivCal-Q10**: ten policy questions that initialize reminder preferences.
- **VPrivCal-Probe**: three synthetic egocentric scenes using a point-first, reveal-second interaction and category-complete review.

Question wording and policy semantics are based on `source materials/VPrivCal_Full_Research_Plan_Updated_v6.docx`. Expert-review constraints come from `source materials/VPrivCal_Expert_Workshop_Updated_v6.docx`. Scene coverage, detections, coordinates, evidence mappings, and Probe response coding come from `public/data/vprivcal_detections.json`.

The repository includes an optional Lambda/DynamoDB participant-persistence placeholder modeled on the continuous-VLM study. Expert review is always memory-only. No analytics or trackers are included.

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
| Probe instructions | `#/probe/instructions` | Explains point-first, reveal-second interaction |
| Probe scene | `#/probe/:sceneId` | Phase A pointing followed by all available category reviews |
| Profile | `#/profile` | Q10 defaults, Probe corrections, awareness gaps, and confirmation |
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
- The generated profile is a preference summary, not a diagnosis or guaranteed privacy control.
- Store exported files only in the study's approved secure location.

## Repository structure

```text
.
├── .github/workflows/deploy-pages.yml
├── public/
│   ├── assets/images/                  # Three synthetic scene images
│   └── data/vprivcal_detections.json   # Detection and Probe source of truth
├── source materials/                   # Research plans and original supplied assets
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
