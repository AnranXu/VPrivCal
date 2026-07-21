# VPrivCal pilot rule-based evaluation

Date: 2026-07-21

## Scope

This is a deterministic, non-empirical pre-expert verification. Six cut pilot videos were reviewed with integrated visual capability using contact sheets sampled at approximately two-second intervals. Full-resolution frames were additionally inspected where text or small scene details mattered. The resulting cue metadata was applied to five deliberately contrasting simulated VPrivCal response profiles.

The review and simulation do not measure VLM accuracy, real participant satisfaction, deployment safety, or real-world effectiveness. Four positive labels still require independent human confirmation.

## Visual review result

| Pilot cut | VLM-supported result | Policy categories | Runtime characterization |
|---|---|---|---|
| Children in home | Positive: two children are directly visible; faces are already blurred | `children_images`, `personal_life` | Private, direct, certain, risk tier 5 |
| Garden arrangement | Positive but interpretation uncertain: food-like bowl/plate and a small flame suggest an offering or household ritual | `legal_sensitivity_information`, `personal_life` | Private, inferred, uncertain, risk tier 4 |
| Handmade craft | Positive: the personal name `GABRIELE` is readable; no child is visible | `pii` | Private, direct, certain, risk tier 5 |
| Basketball court | Positive: another player is directly visible; fine face detail is motion-blurred | `background_individuals`, `biometric_data` | Public, direct, certain, risk tier 5 |
| Laboratory display | Negative for the current taxonomy: operational controls are visible but no readable PII is present | None | Excluded; exposes a missing confidential-workplace-data category |
| Gaming display | Negative: no wearer face, reflected face, or readable account information is visible | None | Excluded false positive |

## Simulated profiles

The generated response artifact contains five complete synthetic VPrivCal exports:

1. Low intervention
2. High protection
3. Context dependent
4. Uncertainty sensitive
5. Reminder averse

These are deliberately constructed profiles, not people and not inferred demographic personas.

## Results

Five profiles applied to four positive cues produced 20 deterministic decisions.

| Condition | Exact target-action agreement | Mean absolute rank error |
|---|---:|---:|
| No-filter rank-0 baseline | 4/20 (20%) | 2.05 |
| Personalized preference rule | 20/20 (100%) | 0.00 |
| Personalized rule plus proof-of-concept safety floors | 17/20 (85%) | 0.20 |

The personalized preference rule matched every declared synthetic target. This is an implementation-correctness result: targets were deliberately specified to test the policy semantics, so 100% must not be reported as an empirical effect size.

The safety-floor condition intentionally differed from preference in three decisions:

- Low-intervention profile, children in home: rank 0 to rank 2 because of the high-confidence/severe floor.
- Low-intervention profile, basketball player: rank 0 to rank 1 because of the `background_individuals` category floor.
- Uncertainty-sensitive profile, children in home: rank 1 to rank 2 because of the high-confidence/severe floor.

These are auditable guardrail overrides, not rule failures. Whether those floors are normatively appropriate still requires expert and ethics review.

## Rule-path checks

All requested implementation checks passed:

- High-protection actions were never less strict than low-intervention actions for the same cue.
- An unknown category produced the declared rank-3 `DECIDED_WITH_FALLBACK` result.
- Q7 inference handling was exercised.
- Q8 reminder filtering was exercised once on the uncertain garden cue.
- Q9 uncertainty handling was exercised.
- Q10 task-relevance handling was exercised.
- Three proof-of-concept safety-floor overrides were recorded.
- Both negative controls were excluded from policy candidates.
- Repeated generation remained deterministic under the automated test suite.

## Verification

`npm run check` passed on 2026-07-21:

- ESLint: passed with zero warnings.
- Vitest: 18 test files and 67 tests passed.
- TypeScript and production Vite build: passed.

## Pre-expert gate status

The software pre-verification passes for this constructed pilot set. The research pre-expert gate remains open because the four positive VLM labels need independent human confirmation, the risk tiers are heuristic rather than calibrated, and the current taxonomy does not represent confidential workplace or laboratory operational data.
