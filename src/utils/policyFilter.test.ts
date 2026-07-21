import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { q10Questions } from '../questions';
import { parseDataset } from '../test/fixtures';
import type { VPrivCalResponseExport } from '../types';
import {
  AGREEMENT_MINIMUM_COMBINED_RISK_SCORE,
  PROOF_OF_CONCEPT_SAFETY_FLOORS,
  buildParticipantPolicy,
  evaluateCrossCuttingAgreement,
  filterCandidateBatch,
  filterCandidateCue,
  upperWeightedMedian,
  validatePolicyResponse,
  type CandidateCue,
  type CompiledParticipantPolicy,
  type DecidedCue,
  type SafetyFloorConfig,
} from './policyFilter';

const dataset = parseDataset(
  readFileSync(resolve(process.cwd(), 'public/data/vprivcal_detections.json'), 'utf8'),
);

function makeCompleteResponse(): VPrivCalResponseExport {
  const at = '2026-07-16T00:00:00.000Z';
  return {
    schemaVersion: '1.0.0',
    studyVersion: 'test-study',
    participantId: 'test-participant',
    sessionId: 'test-session',
    startedAt: at,
    completedAt: at,
    userAgent: 'vitest',
    viewportHistory: [],
    originalSceneOrder: dataset.images.map(({ id }) => id),
    randomizedSceneOrder: dataset.images.map(({ id }) => id),
    consent: { agreed: true, prolificId: 'test-participant', answeredAt: at },
    q10: q10Questions.map((question) => {
      const option = question.categoryId
        ? question.options.at(-1)!
        : question.options.find(({ value }) => value === 3)!;
      return {
        questionId: question.id,
        value: option.value,
        label: option.label,
        firstViewedAt: at,
        answeredAt: at,
        changes: 0,
        finalResponse: option.value,
      };
    }),
    probe: dataset.images.map((scene) => ({
      sceneId: scene.id,
      startedAt: at,
      completedAt: at,
      pointSelections: [],
      categoryResponses: scene.availableCategoryIds.map((categoryId, presentationOrder) => ({
        categoryId,
        presentationOrder,
        linkedDetectionIds:
          scene.categoryEvidence.find((evidence) => evidence.categoryId === categoryId)
            ?.detectionIds ?? [],
        spontaneouslySelected: false,
        awarenessStatus: 1,
        preferredAction: 2,
        evidenceOpened: false,
        evidenceToggleCount: 0,
        changes: 0,
        durationMs: 1000,
      })),
    })),
    profileConfirmation: null,
    timing: {
      q10DurationMs: 1000,
      probeStartedAt: at,
      probeCompletedAt: at,
      probeDurationMs: 1000,
      totalDurationMs: 2000,
    },
  };
}

function setQ10(response: VPrivCalResponseExport, questionId: string, value: number): void {
  const question = q10Questions.find(({ id }) => id === questionId)!;
  const option = question.options.find((item) => item.value === value)!;
  const answer = response.q10.find((item) => item.questionId === questionId)!;
  answer.value = value;
  answer.finalResponse = value;
  answer.label = option.label;
}

function setProbe(
  response: VPrivCalResponseExport,
  sceneId: string,
  categoryId: string,
  preferredAction: number,
  awarenessStatus = 1,
): void {
  const item = response.probe
    .find((scene) => scene.sceneId === sceneId)!
    .categoryResponses.find((category) => category.categoryId === categoryId)!;
  item.preferredAction = preferredAction;
  item.awarenessStatus = awarenessStatus;
}

function readyPolicy(response = makeCompleteResponse()): CompiledParticipantPolicy {
  const result = buildParticipantPolicy(response, dataset);
  expect(result.status).toBe('READY');
  if (result.status !== 'READY') throw new Error(result.errors.join('\n'));
  return result.policy;
}

function candidate(overrides: Partial<CandidateCue> = {}): CandidateCue {
  return {
    candidateId: 'cue-1',
    categoryIds: ['pii'],
    scenarioType: 'public',
    isInference: false,
    isUncertain: false,
    taskRelevant: true,
    explicitlyRequested: false,
    exposureLevel: 'SENSITIVE_DETAIL_EXPOSED',
    likelihoodTier: 3,
    severityTier: 2,
    ...overrides,
  };
}

function decided(
  result: ReturnType<typeof filterCandidateCue>,
): DecidedCue {
  expect(['DECIDED', 'DECIDED_WITH_FALLBACK']).toContain(result.status);
  if ('errors' in result) {
    throw new Error(result.errors.join('\n'));
  }
  return result;
}

describe('participant policy compilation', () => {
  it('uses an upper weighted median with deterministic exact-half behavior', () => {
    expect(upperWeightedMedian([{ action: 0, weight: 1 }, { action: 2, weight: 1 }])).toBe(2);
    expect(upperWeightedMedian([{ action: 2, weight: 1 }, { action: 0, weight: 2 }])).toBe(0);
    expect(() => upperWeightedMedian([{ action: 2, weight: 0 }])).toThrow(/positive/);
  });

  it('normalizes Q1-Q6 and lets a Probe context correct its prior', () => {
    const response = makeCompleteResponse();
    setQ10(response, 'Q4', 3);
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0);

    const policy = readyPolicy(response);
    expect(policy.categories.legal_sensitivity_information).toMatchObject({
      q10Prior: 2,
      q10PriorLabel: 'Show reminders whenever this verified category is present',
      generalAction: 0,
      generalActionLabel: 'Do not show reminders for this category',
      contextActions: { private: 0 },
    });
    expect(policy.categories.legal_sensitivity_information.observations[0].actionLabel).toBe(
      'Do not show reminders for this category',
    );
  });

  it('rejects malformed answers, duplicate scenes, and missing consent without imputation', () => {
    const response = makeCompleteResponse();
    response.consent = null;
    response.q10[0].finalResponse = 99;
    response.q10.push({ ...response.q10[0] });
    response.probe.push({ ...response.probe[0] });
    response.probe[1].categoryResponses[0].preferredAction = 99;

    const validation = validatePolicyResponse(response, dataset);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/consent/i),
        expect.stringMatching(/Q10 question Q1 must occur exactly once/),
        expect.stringMatching(/Probe scene .* must occur exactly once/),
        expect.stringMatching(/invalid preferred action/),
      ]),
    );
  });

  it('rejects an unsupported dataset action scale before aggregation', () => {
    const invalidDataset = structuredClone(dataset);
    invalidDataset.probeQuestions.preferredAction.options[0].value = 9;
    const result = buildParticipantPolicy(makeCompleteResponse(), invalidDataset);

    expect(result.status).toBe('INVALID_RESPONSE');
    if (result.status === 'INVALID_RESPONSE') {
      expect(result.errors).toContain(
        'Dataset preferred-action option 9 is outside the supported 0/1/2 trigger scale.',
      );
    }
  });

  it('returns validation errors for malformed response arrays instead of throwing', () => {
    const malformed = {
      ...makeCompleteResponse(),
      q10: undefined,
      probe: undefined,
    } as unknown as VPrivCalResponseExport;

    expect(validatePolicyResponse(malformed, dataset)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Q10 responses must be an array.',
        'Probe responses must be an array.',
      ]),
    });
    expect(buildParticipantPolicy(malformed, dataset).status).toBe('INVALID_RESPONSE');
  });

  it('records awareness gaps and rejection conflicts without changing the selected action', () => {
    const response = makeCompleteResponse();
    setQ10(response, 'Q4', 3);
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0, 3);
    let policy = readyPolicy(response);
    expect(policy.categories.legal_sensitivity_information.generalAction).toBe(0);
    expect(policy.categories.legal_sensitivity_information.awareness).toMatchObject({
      perceptualCapabilityGap: true,
      rejectionActionConflict: false,
    });

    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 2, 4);
    policy = readyPolicy(response);
    expect(policy.categories.legal_sensitivity_information.awareness).toMatchObject({
      rejectedInContext: true,
      rejectionActionConflict: true,
    });
  });

  it('treats profile confirmation as recalibration feedback only', () => {
    const response = makeCompleteResponse();
    response.profileConfirmation = {
      value: 'too_many',
      comment: 'Do not parse this into a rule.',
      answeredAt: response.startedAt,
    };
    expect(readyPolicy(response).confirmation).toEqual({
      status: 'needs_recalibration',
      recalibrationReason: 'over-reminding',
    });
  });
});

describe('runtime cue filtering', () => {
  it('takes the strictest matched category and is independent of category order', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_private_family_party', 'pii', 2);
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0);
    const policy = readyPolicy(response);

    const first = decided(filterCandidateCue(candidate({
      categoryIds: ['legal_sensitivity_information', 'pii'],
      scenarioType: 'private',
    }), policy));
    const second = decided(filterCandidateCue(candidate({
      categoryIds: ['pii', 'legal_sensitivity_information'],
      scenarioType: 'private',
    }), policy));
    expect(first.preferenceAction.rank).toBe(2);
    expect(second.preferenceAction).toEqual(first.preferenceAction);
    expect(second.categoryIds).toEqual(['legal_sensitivity_information', 'pii']);
  });

  it('uses a reminder fallback for unknown categories', () => {
    const result = decided(filterCandidateCue(candidate({
      categoryIds: ['unknown-sensitive'],
      likelihoodTier: 4,
      severityTier: 3,
    }), readyPolicy()));
    expect(result.status).toBe('DECIDED_WITH_FALLBACK');
    expect(result.unresolvedCategoryIds).toEqual(['unknown-sensitive']);
    expect(result.effectiveAction.rank).toBe(2);
    expect(result.crossCuttingEvaluations).toEqual([
      expect.objectContaining({ questionId: 'Q8', minimumCombinedRiskScore: 7, triggeredReminder: true }),
    ]);
  });

  it('does not mistake inherited object property names for known categories', () => {
    const result = decided(filterCandidateCue(candidate({
      categoryIds: ['toString'],
      likelihoodTier: 4,
      severityTier: 3,
    }), readyPolicy()));
    expect(result.status).toBe('DECIDED_WITH_FALLBACK');
    expect(result.unresolvedCategoryIds).toEqual(['toString']);
    expect(result.effectiveAction.rank).toBe(2);
  });

  it('gives every agreement level a distinct combined-risk threshold', () => {
    expect(AGREEMENT_MINIMUM_COMBINED_RISK_SCORE).toEqual({ 1: 11, 2: 9, 3: 7, 4: 5, 5: 2 });
    expect([1, 2, 3, 4, 5].map((agreementLevel) =>
      evaluateCrossCuttingAgreement('Q7', agreementLevel as 1 | 2 | 3 | 4 | 5, 5, 5),
    )).toEqual([
      expect.objectContaining({ minimumCombinedRiskScore: 11, triggeredReminder: false }),
      expect.objectContaining({ minimumCombinedRiskScore: 9, triggeredReminder: true }),
      expect.objectContaining({ minimumCombinedRiskScore: 7, triggeredReminder: true }),
      expect.objectContaining({ minimumCombinedRiskScore: 5, triggeredReminder: true }),
      expect.objectContaining({ minimumCombinedRiskScore: 2, triggeredReminder: true }),
    ]);
  });

  it('uses Q8 as the general show-or-hide threshold and keeps Q10 conditional on task relevance', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0);
    setQ10(response, 'Q7', 1);
    setQ10(response, 'Q8', 3);
    setQ10(response, 'Q9', 1);
    setQ10(response, 'Q10', 5);
    const base = {
      categoryIds: ['legal_sensitivity_information'],
      scenarioType: 'private' as const,
      likelihoodTier: 3 as const,
      severityTier: 4 as const,
    };
    const general = decided(filterCandidateCue(candidate({ ...base, taskRelevant: true }), readyPolicy(response)));
    expect(general.preferenceAction.rank).toBe(2);
    expect(general.crossCuttingEvaluations).toEqual([
      expect.objectContaining({ questionId: 'Q8', agreementLevel: 3, triggeredReminder: true }),
    ]);

    setQ10(response, 'Q8', 1);
    const taskIrrelevant = decided(filterCandidateCue(candidate({
      ...base,
      likelihoodTier: 1,
      severityTier: 1,
      taskRelevant: false,
    }), readyPolicy(response)));
    expect(taskIrrelevant.preferenceAction.rank).toBe(2);
    expect(taskIrrelevant.crossCuttingEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'Q10', agreementLevel: 5, triggeredReminder: true }),
    ]));
  });

  it('uses agreement rules as minimums while keeping one reminder presentation', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 2);
    setQ10(response, 'Q7', 1);
    setQ10(response, 'Q8', 3);
    setQ10(response, 'Q9', 3);
    const policy = readyPolicy(response);
    const minimum = decided(filterCandidateCue(candidate({
      categoryIds: ['legal_sensitivity_information'],
      scenarioType: 'private',
      isInference: true,
    }), policy));
    expect(minimum.effectiveAction.rank).toBe(2);

    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0);
    const quiet = decided(filterCandidateCue(candidate({
      categoryIds: ['legal_sensitivity_information'],
      scenarioType: 'private',
      isUncertain: true,
      likelihoodTier: 3,
      severityTier: 4,
    }), readyPolicy(response)));
    expect(quiet.effectiveAction).toMatchObject({ rank: 2, presentation: 'brief_reminder' });
    expect(quiet.combinedRiskScore).toBe(7);
    expect(quiet.crossCuttingEvaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'Q9', agreementLevel: 3, triggeredReminder: true }),
    ]));
  });

  it('uses the middle trigger only when sensitive details are exposed', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_public_cafe', 'pii', 1);
    let result = decided(filterCandidateCue(candidate({ exposureLevel: 'PRESENCE_ONLY' }), readyPolicy(response)));
    expect(result.preferenceTriggerLevel).toBe(1);
    expect(result.preferenceAction.rank).toBe(0);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['context_category_action', 'presence_only_below_selected_threshold']),
    );

    result = decided(filterCandidateCue(candidate({ exposureLevel: 'SENSITIVE_DETAIL_EXPOSED' }), readyPolicy(response)));
    expect(result.preferenceAction.rank).toBe(2);
    expect(result.reasons).toContain('sensitive_detail_threshold_met');
  });

  it('emits binary reminder decisions while retaining the selected three-level trigger', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_public_cafe', 'pii', 1);
    setQ10(response, 'Q9', 1);
    const policy = readyPolicy(response);
    const decisions = [
      decided(filterCandidateCue(candidate({ exposureLevel: 'PRESENCE_ONLY' }), policy)),
      decided(filterCandidateCue(candidate({ exposureLevel: 'SENSITIVE_DETAIL_EXPOSED' }), policy)),
    ];
    expect(decisions.map(({ preferenceAction }) => preferenceAction.rank)).toEqual([0, 2]);
    expect(decisions.map(({ preferenceTriggerLevel }) => preferenceTriggerLevel)).toEqual([1, 1]);
    expect(decisions.every(({ preferenceAction }) => [0, 2].includes(preferenceAction.rank))).toBe(true);
  });

  it('reports proof-of-concept safety floors separately and applies them after trigger resolution', () => {
    const response = makeCompleteResponse();
    setQ10(response, 'Q8', 1);
    setQ10(response, 'Q9', 1);
    setProbe(response, 'scene_public_cafe', 'children_images', 0);
    setProbe(response, 'scene_private_family_party', 'legal_sensitivity_information', 0);
    const policy = readyPolicy(response);
    const child = decided(filterCandidateCue(candidate({
      categoryIds: ['children_images'],
      likelihoodTier: 1,
      severityTier: 1,
    }), policy, PROOF_OF_CONCEPT_SAFETY_FLOORS));
    expect(child.preferenceAction.rank).toBe(0);
    expect(child.effectiveAction.rank).toBe(2);
    expect(child.floorApplied).toBe(true);

    const severe = decided(filterCandidateCue(candidate({
      categoryIds: ['legal_sensitivity_information'],
      scenarioType: 'private',
      likelihoodTier: 4,
      severityTier: 4,
    }), policy, PROOF_OF_CONCEPT_SAFETY_FLOORS));
    expect(severe.preferenceAction.rank).toBe(0);
    expect(severe.effectiveAction.rank).toBe(2);
    expect(severe.guardrailConfigId).toBe('vprivcal-proof-of-concept-v1');

  });

  it('returns explicit errors for invalid candidate metadata', () => {
    const result = filterCandidateCue(candidate({
      categoryIds: [],
      likelihoodTier: 0 as CandidateCue['likelihoodTier'],
    }), readyPolicy());
    expect(result.status).toBe('INVALID_CANDIDATE');
    if (result.status === 'INVALID_CANDIDATE') expect(result.errors).toHaveLength(2);
  });

  it('rejects invalid guardrail configurations and namespaces approved waivers', () => {
    const policy = readyPolicy();
    const invalidGuardrail = {
      configId: 'invalid-v1',
      enabled: true,
      categoryMinimums: { pii: 99 },
    } as unknown as SafetyFloorConfig;
    expect(filterCandidateCue(candidate(), policy, invalidGuardrail).status).toBe(
      'INVALID_CONFIGURATION',
    );

    const response = makeCompleteResponse();
    setProbe(response, 'scene_public_cafe', 'children_images', 0);
    const waiverConfig: SafetyFloorConfig = {
      ...PROOF_OF_CONCEPT_SAFETY_FLOORS,
      configId: 'waiver-test-v1',
      approvedWaiverKeys: ['region:shared'],
    };
    const sameTextDifferentNamespace = decided(filterCandidateCue(candidate({
      candidateId: 'shared',
      categoryIds: ['children_images'],
    }), readyPolicy(response), waiverConfig));
    expect(sameTextDifferentNamespace.effectiveAction.rank).toBe(2);
    expect(sameTextDifferentNamespace.safetyWaiverApplied).toBe(false);

    const waivedRegion = decided(filterCandidateCue(candidate({
      candidateId: 'another-id',
      stableRegionId: 'shared',
      categoryIds: ['children_images'],
    }), readyPolicy(response), waiverConfig));
    expect(waivedRegion.effectiveAction.rank).toBe(0);
    expect(waivedRegion.safetyWaiverApplied).toBe(true);
  });

  it('returns INVALID_CANDIDATE for malformed runtime types instead of throwing', () => {
    const malformed = {
      ...candidate(),
      candidateId: 42,
      categoryIds: [null],
      stableRegionId: 99,
      reasonCodes: [false],
    } as unknown as CandidateCue;
    const policy = readyPolicy();

    expect(filterCandidateCue(malformed, policy)).toMatchObject({
      status: 'INVALID_CANDIDATE',
      candidateId: '',
    });
    expect(filterCandidateBatch([malformed], policy).allDecisions[0]).toMatchObject({
      status: 'INVALID_CANDIDATE',
    });
  });
});

describe('candidate batch filtering', () => {
  it('deduplicates regions, merges categories, and orders visible actions deterministically', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_public_cafe', 'pii', 2);
    setProbe(response, 'scene_public_cafe', 'children_images', 2);
    const policy = readyPolicy(response);
    const cues: CandidateCue[] = [
      candidate({
        candidateId: 'b',
        stableRegionId: 'shared',
        categoryIds: ['pii'],
      }),
      candidate({
        candidateId: 'a',
        stableRegionId: 'shared',
        categoryIds: ['children_images'],
        severityTier: 4,
      }),
      candidate({
        candidateId: 'c',
        stableRegionId: 'separate',
        categoryIds: ['children_images'],
        severityTier: 5,
      }),
    ];
    const first = filterCandidateBatch(cues, policy);
    const second = filterCandidateBatch([...cues].reverse(), policy);

    expect(first.allDecisions).toHaveLength(2);
    expect(first.visibleDecisions.map(({ candidateId }) => candidateId)).toEqual(['c', 'a']);
    expect(first.visibleDecisions[1].categoryIds).toEqual(['children_images', 'pii']);
    expect(second).toEqual(first);
    expect(filterCandidateBatch(cues, policy, undefined, 1).visibleDecisions).toHaveLength(1);
  });

  it('does not let valid duplicates mask malformed candidate metadata', () => {
    const policy = readyPolicy();
    const valid = candidate({ candidateId: 'valid', stableRegionId: 'shared' });
    const malformed = candidate({
      candidateId: 'malformed',
      stableRegionId: 'shared',
      categoryIds: [],
      likelihoodTier: 0 as CandidateCue['likelihoodTier'],
    });
    const result = filterCandidateBatch([malformed, valid], policy);

    expect(result.allDecisions).toHaveLength(2);
    expect(result.allDecisions.some(({ status }) => status === 'INVALID_CANDIDATE')).toBe(true);
    expect(result.allDecisions.some(({ status }) => status === 'DECIDED')).toBe(true);
  });

  it('keeps candidate IDs and stable-region IDs in separate deduplication namespaces', () => {
    const policy = readyPolicy();
    const result = filterCandidateBatch([
      candidate({ candidateId: 'same-id' }),
      candidate({ candidateId: 'other-id', stableRegionId: 'same-id' }),
    ], policy);

    expect(result.allDecisions).toHaveLength(2);
    expect(result.allDecisions.map(({ candidateId }) => candidateId).sort()).toEqual([
      'other-id',
      'same-id',
    ]);
  });

  it('does not merge conflicting scenario metadata into a lower general action', () => {
    const response = makeCompleteResponse();
    setProbe(response, 'scene_public_cafe', 'pii', 2);
    setProbe(response, 'scene_private_family_party', 'pii', 0);
    const policy = readyPolicy(response);
    const result = filterCandidateBatch([
      candidate({ candidateId: 'public', stableRegionId: 'shared', scenarioType: 'public' }),
      candidate({ candidateId: 'private', stableRegionId: 'shared', scenarioType: 'private' }),
    ], policy);

    expect(result.allDecisions).toHaveLength(2);
    expect(result.visibleDecisions.some(({ effectiveAction }) => effectiveAction.rank === 2)).toBe(true);
  });
});
