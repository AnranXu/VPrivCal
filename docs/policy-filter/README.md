# VPrivCal participant-answer policy filter

This document specifies a deterministic, rule-based algorithm that turns a completed VPrivCal participant response into a user-specific privacy-reminder policy. The policy can then filter candidate visual cues produced by a vision-language model (VLM) into one of five actions: use normally, handle silently, remind, ask, or avoid.

The algorithm is deliberately transparent. It does not train or fine-tune the VLM, infer protected traits, diagnose the participant, or assign a hidden "quality score" to the participant. Every output action can be traced to a particular Q10 answer, Probe answer, runtime condition, or configured safety rule.

> **Implementation status:** the executable core is implemented in [`src/utils/policyFilter.ts`](../../src/utils/policyFilter.ts), with unit coverage in [`src/utils/policyFilter.test.ts`](../../src/utils/policyFilter.test.ts). The current study UI does not invoke it: `ProfilePage` still calculates its simpler summary, `showProfilePage` is disabled, and the static site has no calibrated live candidate-cue feed.

## What the filter does

The algorithm has two distinct filters:

1. **Response eligibility filter:** accepts only structurally complete, in-range participant answers. It rejects malformed records instead of guessing or silently filling them in.
2. **Privacy action filter:** compiles valid Q10 and Probe answers into a policy, then applies that policy to each candidate visual cue.

The complete flow is:

```text
participant export
    -> validate answers
    -> normalize action scales
    -> compile category defaults and contextual corrections
    -> annotate awareness gaps without changing action preferences
    -> evaluate a candidate cue and its runtime conditions
    -> apply reminder sensitivity
    -> apply a visible, configurable safety floor
    -> return an action plus an explanation
```

## Implementation API

The TypeScript module exports:

- `validatePolicyResponse(response, dataset)` for strict answer and dataset-scale validation;
- `upperWeightedMedian(items)` for deterministic aggregation;
- `buildParticipantPolicy(response, dataset, config?)` for policy compilation;
- `filterCandidateCue(candidate, policy, guardrails?)` for one candidate;
- `filterCandidateBatch(candidates, policy, guardrails?, visibleLimit?)` for deduplication and stable visible-action ranking;
- `DISABLED_SAFETY_FLOORS` and opt-in `PROOF_OF_CONCEPT_SAFETY_FLOORS` configurations.

Minimal usage:

```ts
import {
  PROOF_OF_CONCEPT_SAFETY_FLOORS,
  buildParticipantPolicy,
  filterCandidateCue,
} from './utils/policyFilter';

const compiled = buildParticipantPolicy(responseExport, dataset);

if (compiled.status === 'READY') {
  const decision = filterCandidateCue(
    candidateCue,
    compiled.policy,
    PROOF_OF_CONCEPT_SAFETY_FLOORS,
  );
}
```

Guardrails are disabled when the third argument is omitted. Every safety-floor configuration has an immutable, versioned `configId`, which is copied into each decision for audit. Invalid ranks, tiers, IDs, or waiver keys return `INVALID_CONFIGURATION`. The proof-of-concept floors are deliberately opt-in because they require expert and ethics approval for a real deployment.

## Design principles

- **Q10 initializes; Probe corrects.** Q1-Q6 provide category priors. Probe preferred-action answers provide richer contextual observations.
- **Context is retained.** A private-scene preference is not silently applied to public or semi-public scenes.
- **The desired action is primary.** `preferredAction` changes the policy. Awareness status explains why content may have been missed but does not, by itself, create a reminder.
- **Cross-cutting rules are conservative modifiers.** A category or context action is the minimum participant preference. Applicable Q7, Q9, and Q10 rules may raise it but do not silently lower it. Allowing a condition-specific answer to lower protection requires a separately approved algorithm version.
- **No silent imputation.** Missing, duplicate, unknown, or out-of-range required answers produce a validation error.
- **Participant preference and deployment guardrails remain separate.** If a safety floor changes the effective action, both values are returned for audit.
- **The dataset drives coverage.** Iterate each scene's `availableCategoryIds`; never hardcode which category appears in which scene.
- **Determinism is required.** Identical participant data, candidate metadata, configuration, and algorithm version must produce identical output.

## Canonical action scale

Q1-Q6 store values from 1 to 5. Probe actions store values from 0 to 4. Normalize Q1-Q6 with `q10Value - 1` so both sources use this canonical scale:

| Rank | Canonical action | Runtime meaning |
|---:|---|---|
| 0 | `NO_INTERVENTION` | Use normally; do not show a privacy notice. |
| 1 | `HANDLE_SILENTLY` | Minimize, redact, or avoid unnecessary detail without interrupting the user. |
| 2 | `NOTIFY` | Show a quiet indicator or brief reminder. |
| 3 | `ASK_BEFORE_USE` | Require confirmation before the cue is used. |
| 4 | `AVOID_UNLESS_REQUESTED` | Suppress use unless the participant explicitly requests it. |

The original label must always be retained alongside the normalized rank. In particular, a Q9 "quiet indicator" and a Probe "brief reminder" both have rank 2 but different presentation styles.

## Inputs

### 1. Participant response export

Use the existing `VPrivCalResponseExport` shape:

- Q1-Q6: category defaults;
- Q7: inferred-risk behavior;
- Q8: reminder sensitivity;
- Q9: uncertainty behavior;
- Q10: task-irrelevant behavior;
- each Probe category-image pair: awareness status and preferred action;
- optional profile confirmation: feedback about over-reminding, under-protection, or context dependence.

Phase A points, evidence-toggle counts, response changes, and durations remain useful research measures, but they do not alter the action policy.

### 2. VPrivCal dataset

Use `public/data/vprivcal_detections.json` as the source of truth for:

- valid category IDs;
- scene IDs and `scenarioType` values;
- each scene's `availableCategoryIds`;
- allowed awareness and preferred-action values.

Participant-created `other_not_sure` points are retained in research data but cannot create a category policy because they have no canonical category.

### 3. Runtime candidate cue

A live integration needs the following metadata for each cue supplied by the upstream detector:

```text
CandidateCue
    candidateId: string
    categoryIds: one or more VPrivCal category IDs
    scenarioType: private | public | semi-public | unknown
    isInference: boolean
    isUncertain: boolean
    taskRelevant: boolean
    explicitlyRequested: boolean
    likelihoodTier: integer 1..5
    severityTier: integer 1..5
```

`likelihoodTier` and `severityTier` must come from calibrated detector or researcher metadata, not from participant demographics. Define `riskTier = max(likelihoodTier, severityTier)`, which implements "serious **or** likely" consistently.

The current static dataset does not contain calibrated likelihood and severity tiers: its `vlmConfidence` values are null, and `salience` describes visual prominence rather than privacy severity. It is sufficient for policy compilation, but a live filter must supply and validate likelihood and severity before applying Q7, Q8, or Q10 conditional rules.

## Stage 1: response eligibility filter

A response is eligible only when all of these conditions hold:

1. `schemaVersion`, `studyVersion`, `sessionId`, and `startedAt` are present.
2. Participant consent exists and `consent.agreed == true`.
3. Every Q10 question occurs exactly once, its value is one of that question's declared options, and `finalResponse` matches `value`.
4. Every dataset scene occurs exactly once in the export.
5. Every ID in a scene's `availableCategoryIds` has exactly one category response.
6. No exported scene contains an unexpected category response.
7. Every required Probe response has an allowed awareness value and preferred-action value.
8. IDs used for policy compilation exist in the loaded dataset.
9. The dataset's declared awareness and preferred-action options remain on the supported 1-4 and 0-4 scales.

Do not use "last answer wins" for duplicates and do not replace missing values with a neutral midpoint. Return all validation errors and compile no final policy.

This specification defines final-policy mode. A partial-session preview may show already answered Q10 defaults, but it must be labeled `PROVISIONAL` and must not drive a live filter. Any degraded mode that supplies generic defaults for missing answers needs its own versioned rules.

The following are **not** automatic exclusion criteria:

- short or long completion time;
- answer-change count;
- whether evidence highlighting was opened;
- whether Phase A contained no points;
- use of list mode;
- awareness status 4 (not a concern in that context);
- disagreement between Q10 and Probe.

Those fields can support separate research-quality review, but using them to discard a participant would require a preregistered rule outside this policy algorithm.

### Validation pseudocode

```text
FUNCTION VALIDATE_RESPONSE(export, dataset):
    errors = []

    REQUIRE_NONEMPTY(export.schemaVersion, export.studyVersion,
                     export.sessionId, export.startedAt)

    IF export.consent IS NULL OR export.consent.agreed != true:
        errors.ADD("Agreed participant consent is required")

    FOR question IN Q10_DEFINITIONS:
        answers = FIND export.q10 WHERE questionId == question.id
        IF COUNT(answers) != 1:
            errors.ADD("Q10 answer must occur exactly once", question.id)
        ELSE IF answers[0].value NOT IN question.allowedValues:
            errors.ADD("Q10 answer is outside its declared scale", question.id)

    FOR answer IN export.q10:
        IF answer.questionId NOT IN Q10_DEFINITIONS.ids:
            errors.ADD("Unexpected Q10 question", answer.questionId)

    FOR scene IN dataset.images:
        exportedScenes = FIND export.probe WHERE sceneId == scene.id
        IF COUNT(exportedScenes) != 1:
            errors.ADD("Probe scene must occur exactly once", scene.id)
            CONTINUE

        responses = exportedScenes[0].categoryResponses

        FOR categoryId IN scene.availableCategoryIds:
            matches = FIND responses WHERE categoryId == categoryId
            IF COUNT(matches) != 1:
                errors.ADD("Category response must occur exactly once",
                           scene.id, categoryId)
            ELSE:
                REQUIRE matches[0].awarenessStatus IN dataset.awarenessValues
                REQUIRE matches[0].preferredAction IN dataset.actionValues

        FOR response IN responses:
            IF response.categoryId NOT IN scene.availableCategoryIds:
                errors.ADD("Unexpected category response",
                           scene.id, response.categoryId)

    FOR exportedScene IN export.probe:
        IF exportedScene.sceneId NOT IN dataset.images.ids:
            errors.ADD("Unexpected Probe scene", exportedScene.sceneId)

    RETURN { valid: COUNT(errors) == 0, errors }
```

## Stage 2: compile the participant policy

### 2.1 Build category priors

Map Q1-Q6 to their category IDs and subtract one from the stored value:

```text
q10Prior[categoryId] = q10Response.value - 1
```

This produces a prior in the same 0-4 range as Probe `preferredAction`.

### 2.2 Create Probe contextual observations

For every category listed in each scene's `availableCategoryIds`, create an observation containing:

```text
{
    categoryId,
    sceneId,
    scenarioType,
    action: preferredAction,
    awarenessStatus,
    spontaneouslySelected
}
```

`preferredAction` is the only field in this observation that changes an action rank. Awareness and spontaneous selection become explanation and research metadata.

### 2.3 Calculate general and contextual actions

The compiled policy contains two related values for each category:

- **General category action:** fallback for a scenario without a matching contextual observation.
- **Context action:** action for an observed `scenarioType`.

Use an **upper weighted median** for the general action:

- Q10 prior weight: 1;
- each valid Probe preferred-action observation weight: 2;
- if cumulative weight lands exactly at half, choose the higher action rank.

Probe observations receive greater weight because they follow inspection of a concrete scene. A single Probe observation can therefore correct its generic Q10 prior. The upper tie rule is deterministic and avoids silently choosing the less protective action when evidence is evenly divided.

The 1:2 prior-to-observation weights are a proof-of-concept design choice, not a measured study result. They must be stored with the algorithm configuration and changing them requires a new algorithm version.

For a context action, use only Probe answers with the same category and `scenarioType`. With one observation, use it directly. With several observations, use their upper median. Keep all individual observations in the compiled policy for audit.

At runtime, select actions in this order:

1. matching context action;
2. general category action;
3. no policy match if the category is unknown.

An offline study that only needs a participant profile may stop after this compilation stage. Stage 3 is needed only when the compiled policy is connected to live candidate cues.

### 2.4 Derive awareness annotations

Awareness values produce flags, not action changes:

| Awareness value | Annotation |
|---:|---|
| 1 | Already aware; no gap recorded for this observation. |
| 2 | `interpretiveGap = true` |
| 3 | `perceptualCapabilityGap = true` |
| 4 | `rejectedInContext = true` |

If awareness is 4 but the participant selects a nonzero action, retain the selected action and add `rejectionActionConflict = true`. Do not resolve the apparent conflict by guessing. The participant may reject one interpretation of privacy while still requesting cautious system behavior.

### 2.5 Treat profile confirmation as feedback

Profile confirmation must not silently shift every action rank:

- `matches`: mark the compiled profile as confirmed;
- `too_many`: add `needsRecalibration = "over-reminding"`;
- `not_enough`: add `needsRecalibration = "under-protection"`;
- `context_dependent`: add `needsMoreContext = true`;
- absent: leave confirmation status `not_collected`.

Changing category actions from this feedback requires a targeted follow-up question. A blanket `+1` or `-1` would invent preferences the participant did not provide.

Never parse the optional free-text comment into a policy rule. It is qualitative research data and may contain sensitive text.

### Policy-compilation pseudocode

```text
FUNCTION UPPER_WEIGHTED_MEDIAN(weightedActions):
    sorted = SORT weightedActions BY action ASCENDING
    half = SUM(item.weight FOR item IN sorted) / 2
    cumulative = 0

    FOR item IN sorted:
        cumulative = cumulative + item.weight
        IF cumulative > half:              // strict > gives upper tie behavior
            RETURN item.action


FUNCTION BUILD_POLICY(export, dataset, algorithmVersion):
    validation = VALIDATE_RESPONSE(export, dataset)
    IF NOT validation.valid:
        RETURN { status: "INVALID_RESPONSE", errors: validation.errors }

    policy = NEW_POLICY(algorithmVersion, export.studyVersion)

    FOR category IN dataset.categories:
        q = Q10_CATEGORY_QUESTION(category.id)
        prior = ANSWER(export.q10, q.id).value - 1
        observations = []

        FOR scene IN dataset.images:
            IF category.id NOT IN scene.availableCategoryIds:
                CONTINUE

            response = CATEGORY_RESPONSE(export, scene.id, category.id)
            observations.ADD({
                sceneId: scene.id,
                scenarioType: scene.scenarioType,
                action: response.preferredAction,
                awarenessStatus: response.awarenessStatus,
                spontaneouslySelected: response.spontaneouslySelected
            })

        weighted = [{ action: prior, weight: 1, source: "Q10" }]
        FOR observation IN observations:
            weighted.ADD({ action: observation.action,
                           weight: 2,
                           source: observation.sceneId })

        contextActions = EMPTY_MAP
        FOR scenarioType IN UNIQUE(observations.scenarioType):
            actions = [o.action FOR o IN observations
                       WHERE o.scenarioType == scenarioType]
            contextActions[scenarioType] = UPPER_WEIGHTED_MEDIAN(
                [{ action, weight: 1 } FOR action IN actions]
            )

        policy.categories[category.id] = {
            q10Prior: prior,
            generalAction: UPPER_WEIGHTED_MEDIAN(weighted),
            contextActions,
            observations,
            awareness: DERIVE_AWARENESS_FLAGS(observations)
        }

    policy.crossCutting = {
        inferenceRule: ANSWER(export.q10, "Q7").value,
        reminderSensitivity: ANSWER(export.q10, "Q8").value,
        uncertaintyRule: ANSWER(export.q10, "Q9").value,
        taskIrrelevantRule: ANSWER(export.q10, "Q10").value
    }

    policy.confirmation = INTERPRET_PROFILE_CONFIRMATION(
        export.profileConfirmation
    )

    RETURN { status: "READY", policy }
```

## Stage 3: filter a runtime candidate cue

### 3.1 Select the base category action

One cue may map to several privacy categories. Deduplicate and stably sort `categoryIds`, select one base action for each category, and use the strictest result. For each category, use the matching `scenarioType` context action when present; otherwise use the general category action. Input order must never decide the result.

An unknown category contributes a generic rank-3 `ASK_BEFORE_USE` fallback and changes the result status to `DECIDED_WITH_FALLBACK`. The filter must not guess a category from a face, name, or other potentially sensitive attribute, and an unknown category must never be treated as rank 0.

### 3.2 Apply Q7, Q9, and Q10 as minimum requirements

Q7, Q9, and Q10 apply only when their corresponding runtime condition is true. Add every applicable rule to the category actions and choose the highest action rank.

This conservative minimum rule means Q7=1, Q9=1, or Q10=1 adds rank 0 but does not lower a stricter category or context action. The source research materials do not define whether a cross-cutting rule may reduce category protection. Supporting that interpretation requires an explicit research decision and a separately versioned precedence mode.

#### Q7: inferred risks

Applied only when `isInference == true`:

| Q7 | Condition action |
|---:|---|
| 1 | Rank 0: ignore the inference. |
| 2 | Rank 2 only when `riskTier >= 4`; otherwise rank 0. |
| 3 | Rank 2: brief reminder. |
| 4 | Rank 3: ask first. |
| 5 | Rank 4: avoid unless requested. |

#### Q9: uncertainty

Applied only when `isUncertain == true`:

| Q9 | Condition action |
|---:|---|
| 1 | Rank 0: do nothing. |
| 2 | Rank 2 with `quiet_indicator` presentation. |
| 3 | Rank 2 with `brief_uncertain_reminder` presentation. |
| 4 | Rank 3: ask first. |
| 5 | Rank 4: avoid until approved/requested. |

#### Q10: task relevance

Applied only when `taskRelevant == false`:

| Q10 | Condition action |
|---:|---|
| 1 | Rank 0: do nothing. |
| 2 | Rank 2 only when `riskTier >= 4`; otherwise rank 0. |
| 3 | Rank 2 with `brief_indicator` presentation. |
| 4 | Rank 3: ask first. |
| 5 | Rank 4: avoid unless requested. |

On an equal rank, keep every reason and choose the more visible rank-2 presentation in this order:

```text
brief_uncertain_reminder > brief_reminder > brief_indicator > quiet_indicator
```

### 3.3 Apply Q8 reminder sensitivity

Q8 controls the volume of rank-2 notifications. It does not downgrade rank 3 or 4 because those represent explicit permission or avoidance choices.

| Q8 | Meaning | Minimum `riskTier` for rank-2 notification |
|---:|---|---:|
| 1 | Very few reminders | 5 |
| 2 | Serious/likely only | 4 |
| 3 | Balance misses and false alarms | 3 |
| 4 | Most plausible risks | 2 |
| 5 | Every possible risk | 1 |

The formula is `minimumRiskTier = 6 - Q8`. Q7=2 and Q10=2 also require tier 4, so their effective threshold is `max(6 - Q8, 4)`.

When a rank-2 notification fails the Q8 threshold, downgrade it to rank 1 (`HANDLE_SILENTLY`) instead of discarding all privacy handling.

### 3.4 Honor the explicit-request exception

Rank 4 means "avoid unless explicitly requested." When `explicitlyRequested == true`, replace that rank-4 rule with rank 1 for the requested task only. Other simultaneously applicable rules still apply. The request must be specific to the current task; a prior unrelated request is not reusable consent.

### 3.5 Apply a visible safety floor

Safety floors are deployment rules, not inferred participant preferences. The following values are proposed proof-of-concept constants, not study-derived findings. They require expert, ethics, and deployment approval before live use:

| Condition | Minimum effective action |
|---|---:|
| `children_images` | Rank 1 |
| `background_individuals` | Rank 1 |
| High-confidence severe risk | Rank 2 |

Define "high-confidence severe" in configuration, for example `likelihoodTier >= 4 AND severityTier >= 4`. Do not bury this threshold in UI code.

If a floor raises the participant-selected action, return both `preferenceAction` and `effectiveAction`, plus `floorApplied` and the floor reason. An optional waiver must be a separate, explicit, study-approved value in `approvedWaiverKeys`. Keys are namespaced as `region:<id>` or `candidate:<id>` so equal text cannot waive the wrong identity type. Awareness status 4 alone is not a waiver, because awareness and desired action are separate questions.

For preference-only research analysis, guardrails may be disabled; the reported participant policy must never be overwritten in stored data.

Because the safety floor is applied after Q8, a floor-required notification bypasses Q8 filtering. Rank 3 and rank 4 participant actions also bypass Q8.

### Runtime-filter pseudocode

```text
FUNCTION MAP_Q7(value, riskTier):
    IF value == 1: RETURN ACTION(0, "ignore_inference")
    IF value == 2:
        IF riskTier >= 4: RETURN ACTION(2, "brief_reminder", minRisk=4)
        RETURN ACTION(0, "below_serious_or_likely_threshold")
    IF value == 3: RETURN ACTION(2, "brief_reminder")
    IF value == 4: RETURN ACTION(3, "ask_before_inference")
    IF value == 5: RETURN ACTION(4, "avoid_inference_unless_requested")


FUNCTION MAP_Q9(value):
    IF value == 1: RETURN ACTION(0, "do_nothing_when_uncertain")
    IF value == 2: RETURN ACTION(2, "quiet_indicator")
    IF value == 3: RETURN ACTION(2, "brief_uncertain_reminder")
    IF value == 4: RETURN ACTION(3, "ask_when_uncertain")
    IF value == 5: RETURN ACTION(4, "avoid_until_approved")


FUNCTION MAP_Q10(value, riskTier):
    IF value == 1: RETURN ACTION(0, "do_nothing_when_irrelevant")
    IF value == 2:
        IF riskTier >= 4: RETURN ACTION(2, "brief_reminder", minRisk=4)
        RETURN ACTION(0, "below_serious_threshold")
    IF value == 3: RETURN ACTION(2, "brief_indicator")
    IF value == 4: RETURN ACTION(3, "ask_before_irrelevant_use")
    IF value == 5: RETURN ACTION(4, "avoid_irrelevant_use_unless_requested")


FUNCTION FILTER_CUE(candidate, policy, guardrails):
    REQUIRE candidate.likelihoodTier IN 1..5
    REQUIRE candidate.severityTier IN 1..5
    categoryIds = UNIQUE_SORTED(candidate.categoryIds)
    REQUIRE COUNT(categoryIds) > 0
    riskTier = MAX(candidate.likelihoodTier, candidate.severityTier)

    applicable = []
    unresolvedCategoryIds = []
    FOR categoryId IN categoryIds:
        IF categoryId NOT IN policy.categories:
            unresolvedCategoryIds.ADD(categoryId)
            applicable.ADD(ACTION(3, "unknown_category_ask_fallback"))
            CONTINUE

        categoryPolicy = policy.categories[categoryId]
        IF candidate.scenarioType IN categoryPolicy.contextActions:
            applicable.ADD(ACTION(
                categoryPolicy.contextActions[candidate.scenarioType],
                source="probe_context:" + categoryId
            ))
        ELSE:
            applicable.ADD(ACTION(
                categoryPolicy.generalAction,
                source="category_fallback:" + categoryId
            ))

    // Cross-cutting rules add minimum actions; they never replace a base action.
    IF candidate.isInference:
        applicable.ADD(MAP_Q7(policy.crossCutting.inferenceRule, riskTier))
    IF candidate.isUncertain:
        applicable.ADD(MAP_Q9(policy.crossCutting.uncertaintyRule))
    IF NOT candidate.taskRelevant:
        applicable.ADD(MAP_Q10(policy.crossCutting.taskIrrelevantRule, riskTier))

    resolved = []
    FOR action IN applicable:
        IF action.rank == 4 AND candidate.explicitlyRequested:
            action = ACTION(1, "explicit_request_satisfied_for_this_task")

        IF action.rank == 2:
            q8Threshold = 6 - policy.crossCutting.reminderSensitivity
            requiredTier = MAX(q8Threshold, action.minRisk OR 1)
            IF riskTier < requiredTier:
                action = ACTION(1, "notification_filtered_by_q8")

        resolved.ADD(action)

    preference = STRICTEST_ACTION(resolved)

    floor = SAFETY_FLOOR(candidate, guardrails)
    IF floor.applies AND NOT floor.hasApprovedWaiver:
        effective = STRICTEST_ACTION([preference, floor.action])
    ELSE:
        effective = preference

    awarenessGapTieBreak = ANY(
        policy.categories[id].awareness.interpretiveGap OR
        policy.categories[id].awareness.perceptualCapabilityGap
        FOR id IN categoryIds
        WHERE id IN policy.categories
    )

    RETURN {
        status: "DECIDED_WITH_FALLBACK"
                IF COUNT(unresolvedCategoryIds) > 0
                ELSE "DECIDED",
        candidateId: candidate.candidateId,
        categoryIds: categoryIds,
        unresolvedCategoryIds: unresolvedCategoryIds,
        scenarioType: candidate.scenarioType,
        likelihoodTier: candidate.likelihoodTier,
        severityTier: candidate.severityTier,
        awarenessGapTieBreak: awarenessGapTieBreak,
        preferenceAction: preference,
        effectiveAction: effective,
        reminderThreshold: 6 - policy.crossCutting.reminderSensitivity,
        floorApplied: effective.rank > preference.rank,
        reasons: ALL_TRIGGERED_RULES(resolved, floor),
        policyVersion: policy.algorithmVersion,
        studyVersion: policy.studyVersion
    }
```

## Stage 4: deduplicate and rank a candidate batch

A live frame may produce several overlapping detections for the same cue. Before showing anything:

1. deduplicate candidates using a stable upstream detection or region ID;
2. merge category IDs and reason codes for duplicates;
3. run `FILTER_CUE` once on each merged candidate;
4. keep rank-0 decisions in the audit result without an intervention;
5. perform rank-1 handling silently;
6. put rank-2 through rank-4 decisions in the visible-action queue;
7. sort the queue deterministically by:
   - effective action rank, descending;
   - safety-floor-applied flag, descending;
   - severity tier, descending;
   - likelihood tier, descending;
   - awareness-gap flag as a final ranking tie-break only, descending;
   - stable candidate ID, ascending.

Candidates with the same identity but conflicting `scenarioType` metadata are not merged. Each context is evaluated independently so a strict context action cannot be replaced by a lower general fallback. All ID ordering uses locale-independent code-unit comparison.

The awareness flag may reorder otherwise equal visible items, but it must not raise an action or make an item eligible for display. If a UI imposes a maximum visible-item count, that quota and its tie behavior are algorithm configuration and must be versioned. Q8 itself is a threshold, not an undocumented quota.

```text
FUNCTION FILTER_BATCH(candidates, policy, guardrails, visibleLimit):
    merged = DEDUPLICATE_BY_STABLE_REGION_ID_AND_SCENARIO(candidates)
    FOR cue IN merged:
        cue.categoryIds = UNIQUE_SORTED(UNION_OF_DUPLICATE_CATEGORY_IDS(cue))
        cue.reasonCodes = UNIQUE_SORTED(UNION_OF_DUPLICATE_REASON_CODES(cue))

    decisions = [FILTER_CUE(cue, policy, guardrails) FOR cue IN merged]
    visible = [d FOR d IN decisions WHERE d.effectiveAction.rank >= 2]

    visible = STABLE_SORT(visible, BY:
        effectiveAction.rank DESC,
        floorApplied DESC,
        severityTier DESC,
        likelihoodTier DESC,
        awarenessGapTieBreak DESC,
        candidateId ASC
    )

    RETURN {
        allDecisions: decisions,
        visibleDecisions: FIRST(visible, visibleLimit)
    }
```

Decision logs should contain algorithm/study versions, candidate IDs, rule IDs, thresholds, and derived actions. Do not put participant IDs, image content, raw detected text, or optional comments in a routine decision log.

## Worked examples

### Example 1: Probe creates a contextual correction

- Q3 PII answer is 4, which normalizes to rank 3 (`ASK_BEFORE_USE`).
- In the semi-public hospital Probe, the participant chooses rank 4 for PII.
- The semi-public context action is therefore rank 4.
- A future semi-public PII cue is avoided unless explicitly requested.
- A private or public PII cue uses its own context action, if one exists, rather than inheriting the hospital choice.

### Example 2: Q8 filters a low-tier reminder

- The selected category action is rank 2.
- Q8 is 2, so a notification requires `riskTier >= 4`.
- A candidate has likelihood tier 3 and severity tier 2, so `riskTier == 3`.
- The visible reminder is filtered, but the cue is still handled silently at rank 1.

### Example 3: an awareness gap does not force a reminder

- A Probe answer has awareness status 3, recording a perceptual/capability gap.
- The participant's preferred action is rank 0.
- The compiled observation keeps both facts.
- The preference action remains rank 0. It rises only if an applicable Q7/Q9/Q10 rule, another matched category, or a configured deployment safety floor requires a stricter action.

### Example 4: malformed data is not imputed

- A public scene contains two PII category responses.
- Validation reports a duplicate category-image pair.
- No policy is compiled, even if both duplicate values happen to agree.

## Output contract

Each runtime decision should include at least:

```text
{
    status,
    candidateId,
    categoryIds[],
    unresolvedCategoryIds[],
    scenarioType,
    likelihoodTier,
    severityTier,
    awarenessGapTieBreak,
    preferenceAction: { rank, label, presentation, source },
    effectiveAction: { rank, label, presentation, source },
    reminderThreshold,
    floorApplied,
    safetyWaiverApplied,
    reasons[],
    policyVersion,
    studyVersion,
    guardrailConfigId
}
```

Do not return only a Boolean such as `showReminder`. Retaining the selected action, source, threshold, and guardrail result is necessary for debugging, participant-facing explanations, and research audit.

## Required tests for an implementation

At minimum, test:

1. Q1-Q6 normalization from 1-5 to 0-4.
2. rejection of missing, duplicate, unexpected, and out-of-range answers;
3. iteration over `availableCategoryIds` rather than hardcoded scene coverage;
4. upper weighted-median behavior and its exact-half tie rule;
5. direct use of a single Probe context observation;
6. context-match precedence over the general category action;
7. awareness flags without action mutation;
8. conservative combination of category, Q7, Q9, and Q10 actions, including simultaneous conditions;
9. Q8 thresholds, rank-2 downgrade to silent handling, and no downgrade of ask, avoid, or safety-floor actions;
10. explicit-request handling for rank 4;
11. guardrail reporting of both preference and effective actions;
12. multi-category maximum action, independent of input order;
13. unknown-category rank-3 fallback behavior;
14. candidate deduplication and stable batch ordering under permuted input;
15. identical outputs for identical versioned inputs;
16. absence of participant names, demographics, protected-trait inference, optional comments, or timing-based quality scores in policy decisions and routine logs.

## Versioning and audit requirements

- Give the algorithm its own semantic version, separate from `studyVersion` and the response schema version.
- Save the algorithm version, policy configuration, and safety-floor configuration with every compiled policy or decision log.
- Changing weights, tie rules, thresholds, precedence, or guardrails is an algorithm-version change.
- Never rewrite the original Q10 or Probe answers after compilation.
- If the participant later edits an answer, rebuild the policy from the full validated response rather than mutating a previous result in place.

This separation keeps the research record immutable while making every personalized filtering decision reproducible and explainable.
