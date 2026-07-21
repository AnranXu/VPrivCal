import datasetJson from '../../public/data/vprivcal_detections.json';
import pilotDetectionJson from '../../source materials/pilot videos/vlm_detections.json';
import { describe, expect, it } from 'vitest';
import type { VPrivCalDataset } from '../types';
import type { CandidateCue } from './policyFilter';
import {
  runPreExpertSimulation,
  type CandidateDetectionDocument,
} from './preExpertSimulation';

const dataset = datasetJson as unknown as VPrivCalDataset;
const pilotDetections = pilotDetectionJson as unknown as CandidateDetectionDocument;

function cue(overrides: Partial<CandidateCue> & Pick<CandidateCue, 'candidateId'>): CandidateCue {
  return {
    categoryIds: ['pii'],
    scenarioType: 'private',
    isInference: false,
    isUncertain: false,
    taskRelevant: true,
    explicitlyRequested: false,
    likelihoodTier: 3,
    severityTier: 3,
    ...overrides,
  };
}

function detectionDocument(): CandidateDetectionDocument {
  const cues: CandidateCue[] = [
    cue({
      candidateId: 'previous_01_wearer_face',
      categoryIds: ['biometric_data'],
      likelihoodTier: 5,
      severityTier: 4,
    }),
    cue({
      candidateId: 'previous_02_basketball_bystanders',
      categoryIds: ['background_individuals', 'biometric_data'],
      scenarioType: 'public',
    }),
    cue({
      candidateId: 'previous_03_pay_slip',
      taskRelevant: false,
      likelihoodTier: 5,
      severityTier: 5,
    }),
    cue({
      candidateId: 'previous_04_home_altar',
      categoryIds: ['legal_sensitivity_information', 'personal_life'],
      isInference: true,
      taskRelevant: false,
      likelihoodTier: 4,
      severityTier: 4,
    }),
    cue({
      candidateId: 'previous_05_lab_screen',
      scenarioType: 'semi-public',
      taskRelevant: false,
      likelihoodTier: 4,
      severityTier: 4,
    }),
    cue({
      candidateId: 'previous_06_gabriele_name',
      categoryIds: ['pii', 'children_images'],
      isInference: true,
      isUncertain: true,
      taskRelevant: false,
    }),
  ];
  return {
    schemaVersion: 'test-detections-1.0.0',
    nonEmpirical: true,
    manualVerificationRequired: true,
    configuredDetections: [
      ...cues.map((policyCandidate) => ({
        detectionId: policyCandidate.candidateId,
        expectedPrivacyCue: true,
        manualReviewStatus: 'pending',
        policyCandidate,
      })),
      {
        detectionId: 'previous_07_hot_glue_negative',
        expectedPrivacyCue: false,
        manualReviewStatus: 'pending',
        policyCandidate: null,
      },
    ],
    ego4dManualReviewCandidates: [{ candidateId: 'ego4d_pending' }],
  };
}

describe('pre-expert simulated policy comparison', () => {
  it('runs the VLM-reviewed pilot cuts through all simulated profiles', () => {
    const report = runPreExpertSimulation(pilotDetections, dataset);

    expect(report.inputSummary).toEqual({
      configuredDetectionCount: 6,
      policyCandidateCount: 4,
      negativeControlCount: 2,
      pendingManualReviewCount: 4,
      ego4dPendingManualReviewCount: 0,
    });
    expect(report.aggregateMetrics).toMatchObject({
      nonFilteredBaseline: {
        observations: 20,
        exactAgreementCount: 4,
        exactAgreementRate: 0.2,
        meanAbsoluteRankError: 2.05,
      },
      personalizedPreference: {
        observations: 20,
        exactAgreementCount: 20,
        exactAgreementRate: 1,
        meanAbsoluteRankError: 0,
      },
      personalizedWithProofOfConceptFloors: {
        observations: 20,
        exactAgreementCount: 17,
        exactAgreementRate: 0.85,
        meanAbsoluteRankError: 0.2,
      },
    });
    expect(report.ruleChecks).toMatchObject({
      strictnessOrderingHighProtectionAtLeastLowIntervention: true,
      unknownCategoryFallbackRank: 3,
      unknownCategoryFallbackStatus: 'DECIDED_WITH_FALLBACK',
      q8FilteredDecisionCount: 1,
      q7ReasonObserved: true,
      q9ReasonObserved: true,
      q10ReasonObserved: true,
      safetyFloorAppliedDecisionCount: 3,
      negativeControlExcludedFromPolicyCandidates: true,
    });
  });

  it('is deterministic and keeps complete auditable profile inputs and decisions', () => {
    const first = runPreExpertSimulation(detectionDocument(), dataset);
    const second = runPreExpertSimulation(detectionDocument(), dataset);

    expect(second).toEqual(first);
    expect(first.profileResults).toHaveLength(5);
    expect(first.profileResults.every(({ response }) => response.q10.length === 10)).toBe(true);
    expect(first.profileResults.every(({ candidateResults }) => candidateResults.length === 6)).toBe(true);
    expect(first.inputSummary).toMatchObject({
      policyCandidateCount: 6,
      negativeControlCount: 1,
      ego4dPendingManualReviewCount: 1,
    });
  });

  it('improves target-action alignment over the no-filter rank-zero baseline', () => {
    const report = runPreExpertSimulation(detectionDocument(), dataset);

    expect(report.aggregateMetrics.nonFilteredBaseline).toMatchObject({
      observations: 30,
      exactAgreementCount: 6,
      exactAgreementRate: 0.2,
    });
    expect(report.aggregateMetrics.personalizedPreference).toMatchObject({
      observations: 30,
      exactAgreementCount: 30,
      exactAgreementRate: 1,
      meanAbsoluteRankError: 0,
    });
    expect(report.aggregateMetrics.personalizedWithProofOfConceptFloors).toMatchObject({
      observations: 30,
      exactAgreementCount: 18,
      exactAgreementRate: 0.6,
    });
  });

  it('covers ordering, fallback, cross-cutting rules, Q8, floors, and the negative control', () => {
    const { ruleChecks } = runPreExpertSimulation(detectionDocument(), dataset);

    expect(ruleChecks).toMatchObject({
      strictnessOrderingHighProtectionAtLeastLowIntervention: true,
      unknownCategoryFallbackRank: 3,
      unknownCategoryFallbackStatus: 'DECIDED_WITH_FALLBACK',
      q8FilteredDecisionCount: 4,
      q7ReasonObserved: true,
      q9ReasonObserved: true,
      q10ReasonObserved: true,
      safetyFloorAppliedDecisionCount: 12,
      negativeControlExcludedFromPolicyCandidates: true,
    });
  });
});
