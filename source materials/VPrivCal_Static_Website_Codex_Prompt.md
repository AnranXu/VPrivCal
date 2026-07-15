# Codex task: build a deployable VPrivCal-Q10 + VPrivCal-Probe static React website

Build a complete, production-quality, static research website for the **VPrivCal** method. VPrivCal is one method with two components:

1. **VPrivCal-Q10**: a short questionnaire that initializes privacy-reminder preferences.
2. **VPrivCal-Probe**: a three-scene egocentric visual probe that confirms awareness gaps and preferred privacy actions.

The repository will include these source materials:

- `VPrivCal_Full_Research_Plan_Updated_v6.docx` — source of truth for the exact Q10 wording, Probe questions, response scales, policy mapping, and metrics.
- `VPrivCal_Expert_Workshop_Updated_v6.docx` — additional expert-review wording and design constraints.
- `public/data/vprivcal_detections.json` — image metadata, category coverage, detection regions, and Probe response options.
- Three synthetic images in `public/assets/images/`:
  - `family_party_private.png`
  - `public_cafe.png`
  - `hospital_semipublic.png`

Read the two Word documents before implementing the questions. Do not invent alternative question wording when the documents specify it. The JSON file is the source of truth for image IDs, available categories, detection IDs, coordinates, and category-to-evidence mappings.

## 1. Technical requirements

Create a complete repository using:

- React 18+
- TypeScript
- Vite
- React Router
- CSS modules, plain CSS, or a small utility framework; do not require a paid service
- Vitest and React Testing Library for critical logic
- ESLint and TypeScript strict mode

The website must:

- build with `npm install && npm run build`;
- generate static files in `dist/`;
- work on GitHub Pages, Netlify, and ordinary static hosting;
- use no backend and no external database;
- make no network calls after assets have loaded;
- work on desktop and tablet widths;
- preserve all research responses locally until export;
- support refreshing/resuming through `localStorage`;
- let the participant download their responses as a JSON file;
- include a researcher-only button to clear stored responses and restart.

Provide:

- all source code;
- `README.md` with setup, deployment, JSON schema, and researcher instructions;
- GitHub Pages deployment instructions and, preferably, a GitHub Actions workflow;
- a small test suite for coordinate conversion, detection hit-testing, response persistence, and export validation.

## 2. Study flow

Implement the following routes or equivalent screens:

1. `/` — welcome, study overview, synthetic-data notice, and Start button.
2. `/participant` — optional participant/study ID entry. Do not ask for a real name.
3. `/q10` — VPrivCal-Q10.
4. `/probe/instructions` — concise explanation of the pointing interaction.
5. `/probe/:sceneId` — one scene at a time.
6. `/profile` — concise summary of the inferred reminder preferences, with a confirmation question.
7. `/complete` — completion summary and response export.

Use a visible progress indicator. Persist route progress so reloading does not erase responses.

Randomize the order of the three Probe scenes using a deterministic seed derived from the participant ID. Store both the original and displayed order. Within each scene, randomize the order of category review cards after the initial pointing phase. Do not randomize response-option order.

## 3. VPrivCal-Q10 implementation

Implement the exact ten questions and response options from the full VPrivCal research-plan document.

Requirements:

- Q1-Q6 use the shared action scale specified in the document.
- Q7-Q10 use their item-specific policy wording and response options.
- Present one question per screen on narrow displays or a clear card layout on wider displays.
- Include short examples under Q1-Q6, exactly or closely following the document.
- Require a response before continuing, but allow a visible Back button.
- Record:
  - question ID;
  - selected value and label;
  - first-view timestamp;
  - response timestamp;
  - number of changes;
  - final response;
  - total Q10 duration.

Do not calculate effectiveness from Q10 itself. It only initializes the user-specific policy.

## 4. VPrivCal-Probe scene structure

The three scene types are:

- **Private**: indoor family party.
- **Public**: busy cafe.
- **Semi-public**: hospital waiting area.

The coverage standard is not “two categories per image.” Instead:

- Every scene has a predefined list of all high-level privacy categories clearly present in that scene.
- Across the three scenes, all six VPrivCal visual privacy categories are covered.
- The website must ask about **every category listed in `availableCategoryIds` for that scene**.

Use `vprivcal_detections.json` to obtain:

- image path and dimensions;
- scenario type and context;
- all detections;
- normalized bounding boxes;
- all available categories;
- detection IDs that provide evidence for each category.

## 5. Required Probe interaction: point first, reveal second

The main interaction must preserve an unprompted first look before showing model detections.

### Phase A: participant-driven pointing

Initially display the image without boxes, category overlays, or detection labels.

Show this instruction or equivalent wording:

> Click or tap any specific content in the image that you think an AI assistant should handle carefully for privacy. Select as many areas as you think are relevant. When finished, continue to the category review.

Interaction requirements:

- The image must be responsive while preserving its aspect ratio.
- Convert click coordinates from rendered-image coordinates to normalized image coordinates in the `[0,1]` range.
- Hit-test the normalized click against detection bounding boxes in the JSON file.
- When several detections overlap, select the smallest-area matching detection first. If equally specific detections map to different primary categories, open a compact chooser.
- After a detection is matched:
  - place a numbered marker at the clicked position;
  - briefly outline the matched region;
  - automatically assign the detection's `primaryCategoryId`;
  - show the assigned category as a chip;
  - allow the participant to change the category or choose “Other / not sure.”
- If the click does not match any predefined detection:
  - allow the participant to draw or confirm a small manual rectangle around the intended content;
  - require manual category selection;
  - store it as a participant-created region without modifying the source detection JSON.
- Allow selection deletion and category correction.
- Include a clear “I did not identify any additional privacy-sensitive content” option.

The participant must not see the complete list of detected content during Phase A.

Record for every point selection:

- scene ID;
- click number;
- normalized x/y coordinate;
- displayed pixel x/y coordinate;
- matched detection IDs;
- automatically assigned category;
- final participant-selected category;
- whether the participant corrected the category;
- whether it was a manual unmatched region;
- timestamps.

### Phase B: category-complete Probe review

After Phase A is submitted, reveal the categories in `availableCategoryIds` for the current image. Every listed category must be reviewed, even if the participant did not point to it.

For each category:

1. Show the category name and short definition.
2. Provide a **Show evidence** toggle that highlights every detection listed under that category in `categoryEvidence`.
3. Use translucent overlays with clearly visible borders; do not permanently obscure the image.
4. If one detection belongs to several categories, it may be highlighted for each relevant category.
5. Ask the exact two Probe questions from the research-plan document:
   - awareness status;
   - preferred future action.
6. Require both responses before marking that category complete.
7. Allow the participant to return to earlier category cards.

The awareness question must distinguish:

- already noticed and considered the privacy implication;
- noticed but had not considered the privacy implication;
- not noticed or did not realize the VLM could detect/infer it;
- not considered a privacy concern in this situation.

The preferred-action question must use the ordered five-level policy scale:

- no intervention;
- silent handling;
- brief reminder;
- ask before use;
- avoid unless explicitly requested.

For every category-image pair, record:

- scene ID;
- category ID;
- presentation order;
- linked detection IDs;
- whether the participant pointed to this category during Phase A;
- awareness-status response;
- preferred-action response;
- response changes;
- time spent;
- whether evidence highlighting was opened;
- number of evidence-toggle uses.

## 6. Image overlay and coordinate implementation

Create reusable components such as:

- `ResponsiveImageCanvas`
- `DetectionOverlay`
- `PointSelectionLayer`
- `CategoryReviewCard`
- `ProgressHeader`

Coordinate rules:

- JSON boxes use normalized `x`, `y`, `width`, and `height` with a top-left origin.
- Determine the actual displayed image rectangle after responsive scaling.
- Convert pointer events relative to the displayed image, not the containing card.
- Ignore clicks in letterboxed/padded areas.
- Clamp normalized values to `[0,1]`.
- Recalculate overlays on resize using `ResizeObserver`.
- Support mouse, touch, and keyboard.

Accessibility fallback:

- Provide an “Use a list instead of pointing” option.
- In list mode, show neutral content labels only after the participant voluntarily opens the list.
- All category cards and options must be keyboard accessible.
- Use semantic form controls and visible focus indicators.
- Add descriptive alt text that describes the setting without enumerating hidden privacy detections before Phase B.

## 7. Policy-profile summary

After Q10 and all Probe scenes are complete, display a concise generated profile.

The profile should summarize:

- Q10 category defaults;
- category-specific Probe corrections;
- preferred intervention level by category;
- categories where the participant showed an interpretive or perceptual/capability awareness gap;
- categories rejected as privacy concerns in at least one scene.

Do not present this as a diagnosis or guaranteed privacy protection.

Ask:

> Does this summary generally match how you want a visual AI assistant to handle privacy-sensitive content?

Options:

- Yes, it generally matches.
- It would produce too many reminders.
- It would not provide enough protection.
- Some preferences depend more strongly on context.

Allow an optional comment.

## 8. Response export schema

Export one JSON file with at least this structure:

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
  randomizedSceneOrder: string[];
  q10: Array<{
    questionId: string;
    value: number | string;
    label: string;
    firstViewedAt: string;
    answeredAt: string;
    changes: number;
  }>;
  probe: Array<{
    sceneId: string;
    startedAt: string;
    completedAt: string | null;
    pointSelections: Array<{
      selectionId: string;
      normalizedPoint: { x: number; y: number };
      manualBox?: { x: number; y: number; width: number; height: number };
      matchedDetectionIds: string[];
      autoCategoryId: string | null;
      finalCategoryId: string;
      categoryCorrected: boolean;
      createdAt: string;
    }>;
    categoryResponses: Array<{
      categoryId: string;
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
    probeDurationMs: number;
    totalDurationMs: number;
  };
}
```

Validate the export before download. Also include a researcher-readable CSV export with one row per category-image pair if practical.

## 9. Researcher configuration

Create a single typed configuration module for:

- study version;
- whether participant ID is required;
- whether scene order is randomized;
- whether category order is randomized;
- whether unmatched manual regions are allowed;
- whether profile comments are enabled;
- whether JSON and CSV exports are enabled.

Do not hardcode detection boxes inside React components. Load them from `/data/vprivcal_detections.json`.

## 10. Visual design

Use an academic, restrained visual style:

- white or very light neutral background;
- dark navy headings;
- purple accent for Probe interactions;
- green accent for personalized-policy summaries;
- large readable text;
- no excessive animation;
- no generic chatbot appearance.

For the image page:

- keep the image large enough to inspect subtle content;
- allow optional zoom and pan without changing normalized coordinates;
- keep controls below or beside the image rather than covering important content;
- make overlays distinguishable but not opaque.

## 11. Data and ethics constraints

- All stimuli and identifiers are synthetic.
- Never send participant data to an external service.
- Do not include analytics trackers.
- Do not log data to the console in production.
- Add a notice that the website is a research prototype and does not guarantee privacy protection.
- Do not infer real protected traits from faces or other people in the images.

## 12. Tests and acceptance criteria

Implement tests for:

1. normalized coordinate conversion at several viewport sizes;
2. hit-testing specific and overlapping boxes;
3. smallest-box preference for overlapping detections;
4. manual unmatched-region creation;
5. category auto-selection and correction;
6. persistence after page refresh;
7. complete review of every `availableCategoryId` before scene completion;
8. valid response export;
9. deterministic scene randomization from participant ID;
10. static production build with correct asset paths.

Manual acceptance criteria:

- No detection overlay is visible before the participant submits Phase A.
- A participant can point to a report card, rifle, phone, laptop, intake form, medication bottle, wristband, child, or bystander area and receive a sensible mapped category.
- Overlapping content can be resolved without losing the original click.
- Every category listed for each image is asked exactly once in Phase B.
- All responses survive reload.
- The final site works when opened from a static host subdirectory.
- The UI remains usable at 1024 px width and on a modern tablet.

## 13. Deliverable format

Return the complete file tree and all code, not pseudocode. Ensure the project runs immediately after dependencies are installed. Include concise comments only where the coordinate or hit-testing logic is non-obvious.
