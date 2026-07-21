# VPrivCal three-option reminder-trigger policy

Current algorithm: `3.0.0-three-option-trigger`.

VPrivCal now elicits **when** a participant wants a privacy reminder, not how the assistant should handle or present private information. The participant chooses one of three trigger thresholds, while the runtime output remains binary:

| Trigger | Participant-facing label | Runtime rule |
|---:|---|---|
| 0 | Do not show reminders for this category | `NO_REMINDER` |
| 1 | Show reminders only when identifying or sensitive details are exposed | `SHOW_REMINDER` only for `SENSITIVE_DETAIL_EXPOSED` |
| 2 | Show reminders whenever this verified category is present | `SHOW_REMINDER` for either verified exposure level |

All displayed reminders use the same wording, timing, and visual presentation. The controlled study therefore tests reminder triggering, immediate acceptance, and cue awareness without adding a reminder-style condition.

## Scope and implementation status

The executable rule is in [`src/utils/policyFilter.ts`](../../src/utils/policyFilter.ts), with unit coverage in [`src/utils/policyFilter.test.ts`](../../src/utils/policyFilter.test.ts).

The current UI collects VPrivCal-Q10 and VPrivCal-Probe responses. It does not run a live VLM or deploy reminders during natural use. Held-out cue decisions are produced by the rule layer from a locked detection JSON.

This version replaces the former five-action design. Legacy actions such as silent handling, asking before use, and avoiding information are outside the current short-study construct.

## Questionnaire values

- Q1-Q6 use the shared three-option scale and store displayed values `1`, `2`, and `3`.
- Q8 uses the same scale as a fallback for an expert-verified category not represented by Q1-Q6.
- Probe uses the same labels and stores internal trigger values `0`, `1`, and `2`.
- Q7, Q9, and Q10 remain binary cross-cutting reminder questions with stored values `1` and `3`.
- The compiler normalizes Q1-Q6 and Q8 with `displayedValue - 1`.

Awareness responses are kept separate from reminder preferences. A participant can notice a cue but prefer no reminder, or miss a cue but still prefer no reminder after review.

## Controlled expert-verification gate

The study does not ask an unrestricted VLM to decide importance, obviousness, or whether to remind. The VLM proposes candidate evidence only. Before any participant-policy comparison:

1. Two experts independently verify that the candidate is visible and belongs to the proposed privacy category.
2. Each expert assigns one exposure label using the locked codebook below.
3. Experts do not see participant answers or policy outputs while labeling.
4. Category or exposure disagreements are adjudicated by a prespecified third review, or the cue is excluded.
5. The final category and exposure label are locked in the study JSON before the experiment begins.
6. Raw agreement, category agreement, exposure agreement, and exclusion counts are reported separately from participant outcomes.

The middle option is testable only when the held-out set contains both exposure levels for the relevant categories. If the verified cue set contains almost no `PRESENCE_ONLY` cases, levels 1 and 2 are empirically indistinguishable and this must be reported as a stimulus-coverage limitation.

## Exposure-label codebook

Use only these labels:

- `PRESENCE_ONLY`: the verified category is present, but the cue does not reveal an identifying or sensitive fact about a specific person or household beyond ordinary visible presence.
- `SENSITIVE_DETAIL_EXPOSED`: the cue makes an identifying, linkable, intimate, protected, or otherwise private detail available about a specific person or household.

Apply the following decision test:

1. Is the proposed category actually visible or directly supported by visible evidence? If no, exclude the candidate.
2. Can the visible evidence identify/link a person or reveal a private fact about a person or household? If yes, label `SENSITIVE_DETAIL_EXPOSED`.
3. Otherwise, label `PRESENCE_ONLY`.

Category anchors for expert review:

| Category | `PRESENCE_ONLY` anchor | `SENSITIVE_DETAIL_EXPOSED` anchor |
|---|---|---|
| Biometric data | A distant, occluded, or otherwise non-recognizable person/body feature | A sufficiently clear face or distinctive body feature that supports recognition or re-identification |
| Children images | A child is present without a recognizable identity or linkable school/location detail | A recognizable child, readable name, school affiliation, home link, or other identity/location detail |
| PII | A document, screen, badge, plate, or device is present but its identifying content is not readable | A readable name, address, account/contact number, email, plate, patient ID, or comparable identifier |
| Legal sensitivity information | A potentially sensitive object or setting is present without person-specific sensitive content | Explicit content, a visible unlawful/high-risk act, or person-linked legal/safety information is exposed |
| Personal life | A generic home, routine, relationship, or personal object is visible without a linkable private fact | An intimate activity, precise location, relationship/routine, or household detail is exposed and linkable |
| Background individuals | An incidental person is distant or non-recognizable | A bystander is recognizable or linked to a readable name, workplace, health context, or other private detail |

These anchors are proposed operational definitions for expert review, not established ground truth. Reviewers should assess whether each anchor can be applied consistently and recommend category-specific revisions before the cue set is locked.

## Participant-policy compilation

The compiler first validates the response and dataset. Missing, duplicated, unknown, or out-of-range required answers produce an `INELIGIBLE` result; the system does not impute a midpoint.

Q1-Q6 initialize category trigger priors. Each Probe category-scene response is a contextual observation. The default aggregation is an upper weighted median:

- Q10 prior weight: `1.0`;
- Probe response weight: `1.0`;
- optional profile-confirmation correction: `0.5`;
- an awareness gap is retained as audit metadata and does not itself change the trigger preference.

The compiled policy retains category, scene type, source answer, original label, normalized trigger, and any contextual correction.

## Deterministic cue rule

Every controlled-study cue must include:

```text
candidateId
categoryIds[]
scenarioType: private | public | semi-public | unknown
exposureLevel: PRESENCE_ONLY | SENSITIVE_DETAIL_EXPOSED
isInference: boolean
isUncertain: boolean
taskRelevant: boolean
explicitlyRequested: boolean
likelihoodTier: 1..5
severityTier: 1..5
reasonCodes[]
```

For a verified cue:

```text
trigger = strictest applicable participant trigger

if trigger == 0:
    preference decision = NO_REMINDER
else if trigger == 1 and exposureLevel == SENSITIVE_DETAIL_EXPOSED:
    preference decision = SHOW_REMINDER
else if trigger == 1:
    preference decision = NO_REMINDER
else:
    preference decision = SHOW_REMINDER

effective decision = apply any approved safety floor after the preference decision
```

Q8 supplies the trigger for a verified category missing from Q1-Q6. Applicable Q7, Q9, or Q10 answers can raise the trigger for inferred, uncertain, or task-irrelevant cues. They cannot silently lower a stricter category or Probe trigger.

When duplicate detections merge into one cue, the merged cue is labeled `SENSITIVE_DETAIL_EXPOSED` if any verified member has that label. Category IDs and reason codes are deduplicated, and the maximum likelihood and severity tiers are retained for safety-floor auditing.

## Safety floors

Safety floors are disabled by default. The opt-in `PROOF_OF_CONCEPT_SAFETY_FLOORS` configuration demonstrates how an approved rule can raise a participant preference from no reminder to the standardized reminder.

Each override records:

- participant-preference decision;
- effective decision;
- floor rule and configuration ID;
- waiver status, if any;
- category, exposure level, and reason codes.

Safety-floor outcomes must be reported separately because an aggressive floor can erase the distinction among the three participant preferences.

## Output and audit fields

`filterCandidateCue` returns both preference and effective outcomes, including:

- `preferenceTriggerLevel`;
- `exposureLevel`;
- `preferenceReminderDecision`;
- `effectiveReminderDecision`;
- `preferenceAction` and `effectiveAction` audit objects;
- `floorApplied` and `safetyWaiverApplied`;
- unresolved category IDs and reason codes;
- `algorithmVersion` and `policyConfigId`.

`filterCandidateBatch` validates all candidates, deterministically merges duplicates, and returns stable decision ordering.

## Evaluation measures

Held-out evaluation records, for every verified cue and condition:

- system decision: no reminder or show reminder;
- participant's preferred binary decision;
- immediate decision acceptance on a 1-5 scale;
- pre-reminder cue awareness;
- policy condition and exposure level.

Primary summaries are immediate acceptance, binary agreement, false-reminder rate, missed-reminder rate, and awareness by condition. Reminder frequency is a burden measure. Outcomes should also be stratified by exposure level to test whether the middle option behaves differently from the always-remind option.

Short clips support immediate cue-level claims only. They cannot establish long-term acceptance, memory, behavior change, or real-world effectiveness.

## API example

```ts
import {
  DISABLED_SAFETY_FLOORS,
  buildParticipantPolicy,
  filterCandidateCue,
} from './utils/policyFilter';

const compiled = buildParticipantPolicy(responseExport, dataset);

if (compiled.status === 'READY') {
  const decision = filterCandidateCue(candidate, compiled.policy, DISABLED_SAFETY_FLOORS);
}
```

## Verification

Run:

```bash
npm run check
npm run preexpert:simulate
npm run preexpert:randomized
```

The simulation outputs are software checks with synthetic profiles. They are not participant findings and do not validate the exposure codebook; expert agreement and controlled held-out testing are still required.
