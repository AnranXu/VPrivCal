# VPrivCal pilot three-option trigger evaluation

Date: 2026-07-21

## Scope and interpretation

This is a non-empirical software and rule-path verification. Six cut pilot videos were visually reviewed, and the resulting cue metadata was applied to five deliberately contrasting synthetic VPrivCal response profiles. Participant-facing calibration answers use three trigger levels: never remind, remind only for sensitive-detail exposure, or remind whenever the verified category is present. Runtime output remains binary: **no reminder** or **show the standardized reminder**.

These simulations verify implementation behavior and exercise rule paths. They do not measure real participant acceptance, VLM accuracy, deployment safety, long-term behavior, or real-world effectiveness. Four positive cue labels still require independent human confirmation.

## Visual review result

| Pilot cut | VLM-supported result | Policy categories | Runtime characterization |
|---|---|---|---|
| Children in home | Positive: two children are directly visible; faces are already blurred | `children_images`, `personal_life` | Proposed `PRESENCE_ONLY`; human confirmation pending |
| Garden arrangement | Positive but interpretation uncertain: a food-like bowl/plate and small flame suggest an offering or household ritual | `legal_sensitivity_information`, `personal_life` | Proposed `PRESENCE_ONLY`; human confirmation pending |
| Handmade craft | Positive: the personal name `GABRIELE` is readable; no child is visible | `pii` | Proposed `SENSITIVE_DETAIL_EXPOSED`; human confirmation pending |
| Basketball court | Positive: another player is directly visible; fine face detail is motion-blurred | `background_individuals`, `biometric_data` | Proposed `PRESENCE_ONLY`; human confirmation pending |
| Laboratory display | Negative for the current taxonomy: operational controls are visible but no readable PII is present | None | Excluded; indicates a possible confidential-workplace-data category gap |
| Gaming display | Negative: no wearer face, reflected face, or readable account information is visible | None | Excluded false positive |

## Deterministic simulated profiles

The response artifact contains five complete synthetic exports: low intervention, reminders for every cue, context dependent, uncertainty sensitive, and sensitive-detail only. These are constructed test cases, not people or demographic personas.

Five profiles applied to four positive cues produced 20 binary decisions.

| Condition | Exact binary-decision agreement | Mean absolute internal-code error |
|---|---:|---:|
| No-reminder baseline | 11/20 (55%) | 0.90 |
| Personalized preference rule | 20/20 (100%) | 0.00 |
| Personalized rule plus proof-of-concept safety floors | 14/20 (70%) | 0.60 |

The 100% personalized result is expected because the synthetic targets were declared specifically to verify the policy semantics. It is not an empirical effect size. Six guardrail overrides changed a synthetic no-reminder preference to a reminder; those are auditable policy overrides, not participant acceptance findings.

Rule-path checks exercised Q7 inference, the Q8 unlisted-category fallback, Q9 uncertainty, Q10 task relevance, three exposure-threshold suppressions, safety floors, negative-control exclusion, and deterministic regeneration.

## Seeded randomized-profile stress test

A second simulation used seed `20260721` to generate 500 correlated but substantially varied synthetic profiles. Each profile sampled a continuous reminder preference, independent Q1–Q10 noise, private/public/semi-public context biases, scene-level Probe noise, awareness, evidence use, response changes, and timing.

- Profiles compiled: 500/500; invalid profiles: 0.
- Policy decisions: 2,000/2,000; invalid decisions: 0.
- Unique four-cue preference signatures: 14 of 16 possible binary runtime signatures.
- Unique signatures after proof-of-concept floors: 4.
- Every cue produced both participant-facing decisions across the profiles.
- No reminder: 911/2,000 (45.6%).
- Show reminder: 1,089/2,000 (54.5%).
- Sensitive-detail threshold suppressed 414 presence-only reminders.
- Safety-floor overrides: 671/2,000 (33.6%).
- Q7 contributed to 293 decisions; Q9 contributed to 282; Q10 contributed to 701.

| Pilot cue | No reminder | Show reminder | Safety-floor overrides |
|---|---:|---:|---:|
| Children in home | 331 (66.2%) | 169 (33.8%) | 331 |
| Garden arrangement | 89 (17.8%) | 411 (82.2%) | 0 |
| Handmade craft | 151 (30.2%) | 349 (69.8%) | 0 |
| Basketball player | 340 (68.0%) | 160 (32.0%) | 340 |

The reduction from 14 preference signatures to 4 effective signatures shows that safety floors compress much of the three-level trigger personalization, especially for children and background individuals. Whether that loss of personalization is acceptable is an expert and ethics question.

Across seeds `20260719` through `20260723`, reminder decisions ranged from 52.2% to 56.1%, safety-floor overrides from 32.8% to 35.4%, exposure filtering occurred 383-429 times per run, and 13-15 of the 16 possible four-cue runtime signatures appeared. This supports software robustness under profile randomness, not claims about a participant population.

## User-study outcomes that remain to be measured

For every held-out cue, collect:

1. the policy condition (`generic`, `Q10-only`, or `full VPrivCal`);
2. the system's binary reminder decision;
3. the participant's preferred binary decision;
4. immediate decision acceptance on a 1–5 scale; and
5. optional reminder burden when a reminder was shown.

Report binary agreement, false-reminder rate, missed-reminder rate, mean acceptance, and reminder burden by condition. Short clips support immediate cue-level acceptance claims only; they cannot distinguish long-term silent handling from uninterrupted use and cannot establish long-term effectiveness.

## Pre-expert gate status

The three-option trigger implementation passes this constructed software pre-verification. The research gate remains open until two experts independently confirm each positive cue and exposure level, the safety floors receive expert and ethics review, and real participants complete the held-out acceptance task.
