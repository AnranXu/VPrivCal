import { q10Questions } from '../questions';
import type { VPrivCalDataset, VPrivCalResponseExport } from '../types';
import {
  DISABLED_SAFETY_FLOORS,
  POLICY_FILTER_ALGORITHM_VERSION,
  PROOF_OF_CONCEPT_SAFETY_FLOORS,
  buildParticipantPolicy,
  filterCandidateCue,
  type CandidateCue,
  type CanonicalActionRank,
  type CompiledParticipantPolicy,
  type DecidedCue,
} from './policyFilter';

const SIMULATION_VERSION = 'vprivcal-pre-expert-simulation-1.0.0';
const FIXED_TIME = '2026-01-01T00:00:00.000Z';

type Q10Id = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8' | 'Q9' | 'Q10';

export interface CandidateDetectionRecord {
  detectionId: string;
  expectedPrivacyCue: boolean;
  manualReviewStatus: string;
  policyCandidate: CandidateCue | null;
  [key: string]: unknown;
}

export interface CandidateDetectionDocument {
  schemaVersion: string;
  nonEmpirical: boolean;
  manualVerificationRequired: boolean;
  configuredDetections: CandidateDetectionRecord[];
  ego4dManualReviewCandidates?: unknown[];
  [key: string]: unknown;
}

interface SimulatedProfileDefinition {
  profileId: string;
  label: string;
  rationale: string;
  q10Values: Record<Q10Id, number>;
  defaultProbeAction: CanonicalActionRank;
  probeActionOverrides?: Record<string, CanonicalActionRank>;
  awarenessStatus: 1 | 2 | 3 | 4;
  expectedPreferenceRanks: Record<string, CanonicalActionRank>;
}

export interface AlignmentMetrics {
  observations: number;
  exactAgreementCount: number;
  exactAgreementRate: number;
  meanAbsoluteRankError: number;
}

export interface SimulatedProfileResult {
  profileId: string;
  label: string;
  rationale: string;
  response: VPrivCalResponseExport;
  compiledPolicy: CompiledParticipantPolicy;
  candidateResults: Array<{
    candidate: CandidateCue;
    expectedPreferenceRank: CanonicalActionRank;
    nonFilteredBaselineRank: CanonicalActionRank;
    personalizedDecision: DecidedCue;
    guardrailedDecision: DecidedCue;
  }>;
  metrics: {
    nonFilteredBaseline: AlignmentMetrics;
    personalizedPreference: AlignmentMetrics;
    personalizedWithProofOfConceptFloors: AlignmentMetrics;
  };
}

export interface PreExpertSimulationReport {
  schemaVersion: string;
  nonEmpirical: true;
  interpretation: string;
  assumptions: {
    nonFilteredBaseline: string;
    satisfactionProxy: string;
    safetyFloorComparison: string;
    manualReview: string;
  };
  software: {
    simulationVersion: string;
    policyFilterAlgorithmVersion: string;
    detectionSchemaVersion: string;
    proofOfConceptGuardrailConfigId: string;
  };
  inputSummary: {
    configuredDetectionCount: number;
    policyCandidateCount: number;
    negativeControlCount: number;
    pendingManualReviewCount: number;
    ego4dPendingManualReviewCount: number;
  };
  profileResults: SimulatedProfileResult[];
  aggregateMetrics: SimulatedProfileResult['metrics'];
  ruleChecks: {
    strictnessOrderingHighProtectionAtLeastLowIntervention: boolean;
    unknownCategoryFallbackRank: number;
    unknownCategoryFallbackStatus: string;
    exposureFilteredDecisionCount: number;
    q7ReasonObserved: boolean;
    q9ReasonObserved: boolean;
    q10ReasonObserved: boolean;
    safetyFloorAppliedDecisionCount: number;
    negativeControlExcludedFromPolicyCandidates: boolean;
  };
}

const candidateIds = {
  face: 'previous_01_wearer_face',
  basketball: 'previous_02_basketball_bystanders',
  paySlip: 'previous_03_pay_slip',
  altar: 'previous_04_home_altar',
  lab: 'previous_05_lab_screen',
  name: 'previous_06_gabriele_name',
  pilotChildren: 'pilot_01_children_in_home',
  pilotOffering: 'pilot_02_outdoor_offering',
  pilotName: 'pilot_03_visible_name_craft',
  pilotBasketball: 'pilot_04_basketball_player',
} as const;

function q10Values(
  categoryValue: number,
  q7: number,
  q8: number,
  q9: number,
  q10: number,
): Record<Q10Id, number> {
  return {
    Q1: categoryValue,
    Q2: categoryValue,
    Q3: categoryValue,
    Q4: categoryValue,
    Q5: categoryValue,
    Q6: categoryValue,
    Q7: q7,
    Q8: q8,
    Q9: q9,
    Q10: q10,
  };
}

const profiles: readonly SimulatedProfileDefinition[] = [
  {
    profileId: 'sim_low_intervention',
    label: 'Low intervention',
    rationale: 'Requests normal use and no cross-cutting reminders.',
    q10Values: q10Values(1, 1, 1, 1, 1),
    defaultProbeAction: 0,
    awarenessStatus: 1,
    expectedPreferenceRanks: {
      [candidateIds.face]: 0,
      [candidateIds.basketball]: 0,
      [candidateIds.paySlip]: 0,
      [candidateIds.altar]: 0,
      [candidateIds.lab]: 0,
      [candidateIds.name]: 0,
      [candidateIds.pilotChildren]: 0,
      [candidateIds.pilotOffering]: 0,
      [candidateIds.pilotName]: 0,
      [candidateIds.pilotBasketball]: 0,
    },
  },
  {
    profileId: 'sim_high_protection',
    label: 'Reminder for every cue',
    rationale: 'Requests a visible reminder for every category and cross-cutting condition.',
    q10Values: q10Values(3, 3, 3, 3, 3),
    defaultProbeAction: 2,
    awarenessStatus: 3,
    expectedPreferenceRanks: {
      [candidateIds.face]: 2,
      [candidateIds.basketball]: 2,
      [candidateIds.paySlip]: 2,
      [candidateIds.altar]: 2,
      [candidateIds.lab]: 2,
      [candidateIds.name]: 2,
      [candidateIds.pilotChildren]: 2,
      [candidateIds.pilotOffering]: 2,
      [candidateIds.pilotName]: 2,
      [candidateIds.pilotBasketball]: 2,
    },
  },
  {
    profileId: 'sim_context_dependent',
    label: 'Context dependent',
    rationale: 'Requests reminders only for selected category-by-context combinations.',
    q10Values: q10Values(1, 1, 3, 1, 1),
    defaultProbeAction: 0,
    probeActionOverrides: {
      'scene_private_family_party|biometric_data': 0,
      'scene_private_family_party|children_images': 2,
      'scene_private_family_party|pii': 2,
      'scene_private_family_party|legal_sensitivity_information': 0,
      'scene_private_family_party|personal_life': 0,
      'scene_public_cafe|biometric_data': 2,
      'scene_public_cafe|children_images': 2,
      'scene_public_cafe|pii': 2,
      'scene_public_cafe|background_individuals': 2,
      'scene_semipublic_hospital|biometric_data': 0,
      'scene_semipublic_hospital|pii': 2,
    },
    awarenessStatus: 2,
    expectedPreferenceRanks: {
      [candidateIds.face]: 0,
      [candidateIds.basketball]: 2,
      [candidateIds.paySlip]: 2,
      [candidateIds.altar]: 0,
      [candidateIds.lab]: 2,
      [candidateIds.name]: 2,
      [candidateIds.pilotChildren]: 2,
      [candidateIds.pilotOffering]: 0,
      [candidateIds.pilotName]: 2,
      [candidateIds.pilotBasketball]: 2,
    },
  },
  {
    profileId: 'sim_uncertainty_sensitive',
    label: 'Uncertainty sensitive',
    rationale: 'Requests a reminder only when the VLM cue is uncertain.',
    q10Values: q10Values(1, 1, 3, 3, 1),
    defaultProbeAction: 0,
    awarenessStatus: 3,
    expectedPreferenceRanks: {
      [candidateIds.face]: 0,
      [candidateIds.basketball]: 0,
      [candidateIds.paySlip]: 0,
      [candidateIds.altar]: 0,
      [candidateIds.lab]: 0,
      [candidateIds.name]: 2,
      [candidateIds.pilotChildren]: 0,
      [candidateIds.pilotOffering]: 2,
      [candidateIds.pilotName]: 0,
      [candidateIds.pilotBasketball]: 0,
    },
  },
  {
    profileId: 'sim_sensitive_detail_only',
    label: 'Sensitive-detail only',
    rationale: 'Requests reminders only when identifying or sensitive details are exposed.',
    q10Values: q10Values(2, 1, 2, 1, 1),
    defaultProbeAction: 1,
    awarenessStatus: 1,
    expectedPreferenceRanks: {
      [candidateIds.face]: 2,
      [candidateIds.basketball]: 2,
      [candidateIds.paySlip]: 2,
      [candidateIds.altar]: 2,
      [candidateIds.lab]: 2,
      [candidateIds.name]: 2,
      [candidateIds.pilotChildren]: 0,
      [candidateIds.pilotOffering]: 0,
      [candidateIds.pilotName]: 2,
      [candidateIds.pilotBasketball]: 0,
    },
  },
] as const;

function probeAction(
  profile: SimulatedProfileDefinition,
  sceneId: string,
  categoryId: string,
): CanonicalActionRank {
  return profile.probeActionOverrides?.[`${sceneId}|${categoryId}`] ?? profile.defaultProbeAction;
}

function buildSimulatedResponse(
  profile: SimulatedProfileDefinition,
  dataset: VPrivCalDataset,
): VPrivCalResponseExport {
  const profileKey = `simulated-profile:${profile.profileId}`;
  return {
    schemaVersion: dataset.schemaVersion,
    studyVersion: SIMULATION_VERSION,
    participantId: profileKey,
    sessionId: `session:${profile.profileId}`,
    startedAt: FIXED_TIME,
    completedAt: FIXED_TIME,
    userAgent: 'deterministic-pre-expert-simulation',
    viewportHistory: [],
    originalSceneOrder: dataset.images.map(({ id }) => id),
    randomizedSceneOrder: dataset.images.map(({ id }) => id),
    consent: { agreed: true, prolificId: profileKey, answeredAt: FIXED_TIME },
    q10: q10Questions.map((question) => {
      const value = profile.q10Values[question.id as Q10Id];
      const option = question.options.find((item) => item.value === value);
      if (!option) throw new Error(`${profile.profileId} has an invalid ${question.id} value.`);
      return {
        questionId: question.id,
        value,
        label: option.label,
        firstViewedAt: FIXED_TIME,
        answeredAt: FIXED_TIME,
        changes: 0,
        finalResponse: value,
      };
    }),
    probe: dataset.images.map((scene) => ({
      sceneId: scene.id,
      startedAt: FIXED_TIME,
      completedAt: FIXED_TIME,
      pointSelections: [],
      categoryResponses: scene.availableCategoryIds.map((categoryId, presentationOrder) => ({
        categoryId,
        presentationOrder,
        linkedDetectionIds:
          scene.categoryEvidence.find((evidence) => evidence.categoryId === categoryId)
            ?.detectionIds ?? [],
        spontaneouslySelected: false,
        awarenessStatus: profile.awarenessStatus,
        preferredAction: probeAction(profile, scene.id, categoryId),
        evidenceOpened: false,
        evidenceToggleCount: 0,
        changes: 0,
        durationMs: 1000,
      })),
    })),
    profileConfirmation: null,
    timing: {
      q10DurationMs: 1000,
      probeStartedAt: FIXED_TIME,
      probeCompletedAt: FIXED_TIME,
      probeDurationMs: 1000,
      totalDurationMs: 2000,
    },
  };
}

function requireDecision(decision: ReturnType<typeof filterCandidateCue>): DecidedCue {
  if (decision.status === 'DECIDED' || decision.status === 'DECIDED_WITH_FALLBACK') {
    return decision;
  }
  const detail = 'errors' in decision ? decision.errors.join(' ') : `unexpected ${decision.status}`;
  throw new Error(`${decision.candidateId || 'candidate'} failed: ${detail}`);
}

function alignmentMetrics(
  actualRanks: readonly number[],
  expectedRanks: readonly number[],
): AlignmentMetrics {
  if (actualRanks.length !== expectedRanks.length || actualRanks.length === 0) {
    throw new Error('Alignment metrics require equal non-empty action arrays.');
  }
  const exactAgreementCount = actualRanks.filter(
    (rank, index) => rank === expectedRanks[index],
  ).length;
  const absoluteError = actualRanks.reduce(
    (total, rank, index) => total + Math.abs(rank - expectedRanks[index]),
    0,
  );
  return {
    observations: actualRanks.length,
    exactAgreementCount,
    exactAgreementRate: exactAgreementCount / actualRanks.length,
    meanAbsoluteRankError: absoluteError / actualRanks.length,
  };
}

function aggregateMetrics(
  profileResults: readonly SimulatedProfileResult[],
  metric: keyof SimulatedProfileResult['metrics'],
): AlignmentMetrics {
  const observations = profileResults.reduce(
    (total, result) => total + result.metrics[metric].observations,
    0,
  );
  const exactAgreementCount = profileResults.reduce(
    (total, result) => total + result.metrics[metric].exactAgreementCount,
    0,
  );
  const absoluteErrorTotal = profileResults.reduce(
    (total, result) =>
      total + result.metrics[metric].meanAbsoluteRankError * result.metrics[metric].observations,
    0,
  );
  return {
    observations,
    exactAgreementCount,
    exactAgreementRate: exactAgreementCount / observations,
    meanAbsoluteRankError: absoluteErrorTotal / observations,
  };
}

function validateInput(document: CandidateDetectionDocument): void {
  if (!document || typeof document !== 'object') throw new Error('Detection JSON must be an object.');
  if (!Array.isArray(document.configuredDetections)) {
    throw new Error('Detection JSON must contain configuredDetections.');
  }
  const ids = document.configuredDetections.map(({ detectionId }) => detectionId);
  if (new Set(ids).size !== ids.length) throw new Error('Detection IDs must be unique.');
}

export function runPreExpertSimulation(
  document: CandidateDetectionDocument,
  dataset: VPrivCalDataset,
): PreExpertSimulationReport {
  validateInput(document);
  const candidates = document.configuredDetections
    .filter(({ expectedPrivacyCue, policyCandidate }) => expectedPrivacyCue && policyCandidate)
    .map(({ policyCandidate }) => policyCandidate as CandidateCue)
    .sort((first, second) =>
      first.candidateId < second.candidateId ? -1 : first.candidateId > second.candidateId ? 1 : 0,
    );
  const negativeControls = document.configuredDetections.filter(
    ({ expectedPrivacyCue }) => !expectedPrivacyCue,
  );
  const pendingManualReviewCount = document.configuredDetections.filter(
    ({ manualReviewStatus }) =>
      manualReviewStatus === 'pending' || manualReviewStatus.includes('needs_human_confirmation'),
  ).length;

  const profileResults = profiles.map((profile): SimulatedProfileResult => {
    const response = buildSimulatedResponse(profile, dataset);
    const compilation = buildParticipantPolicy(response, dataset);
    if (compilation.status !== 'READY') {
      throw new Error(`${profile.profileId} did not compile: ${compilation.errors.join(' ')}`);
    }
    const candidateResults = candidates.map((candidate) => {
      const expectedPreferenceRank = profile.expectedPreferenceRanks[candidate.candidateId];
      if (expectedPreferenceRank === undefined) {
        throw new Error(`${profile.profileId} has no expectation for ${candidate.candidateId}.`);
      }
      return {
        candidate,
        expectedPreferenceRank,
        nonFilteredBaselineRank: 0 as const,
        personalizedDecision: requireDecision(
          filterCandidateCue(candidate, compilation.policy, DISABLED_SAFETY_FLOORS),
        ),
        guardrailedDecision: requireDecision(
          filterCandidateCue(candidate, compilation.policy, PROOF_OF_CONCEPT_SAFETY_FLOORS),
        ),
      };
    });
    const expected = candidateResults.map(({ expectedPreferenceRank }) => expectedPreferenceRank);
    return {
      profileId: profile.profileId,
      label: profile.label,
      rationale: profile.rationale,
      response,
      compiledPolicy: compilation.policy,
      candidateResults,
      metrics: {
        nonFilteredBaseline: alignmentMetrics(candidateResults.map(() => 0), expected),
        personalizedPreference: alignmentMetrics(
          candidateResults.map(({ personalizedDecision }) => personalizedDecision.preferenceAction.rank),
          expected,
        ),
        personalizedWithProofOfConceptFloors: alignmentMetrics(
          candidateResults.map(({ guardrailedDecision }) => guardrailedDecision.effectiveAction.rank),
          expected,
        ),
      },
    };
  });

  const low = profileResults.find(({ profileId }) => profileId === 'sim_low_intervention');
  const high = profileResults.find(({ profileId }) => profileId === 'sim_high_protection');
  if (!low || !high) throw new Error('Strictness audit profiles are missing.');
  const strictnessOrdering = high.candidateResults.every((highResult) => {
    const lowResult = low.candidateResults.find(
      ({ candidate }) => candidate.candidateId === highResult.candidate.candidateId,
    );
    return Boolean(
      lowResult &&
      highResult.personalizedDecision.preferenceAction.rank >=
        lowResult.personalizedDecision.preferenceAction.rank,
    );
  });

  const contextPolicy = profileResults.find(
    ({ profileId }) => profileId === 'sim_context_dependent',
  )!.compiledPolicy;
  const unknownDecision = requireDecision(filterCandidateCue({
    candidateId: 'audit_unknown_category',
    categoryIds: ['unknown_sensitive_category'],
    scenarioType: 'unknown',
    isInference: false,
    isUncertain: false,
    taskRelevant: true,
    explicitlyRequested: false,
    exposureLevel: 'PRESENCE_ONLY',
    likelihoodTier: 3,
    severityTier: 3,
  }, contextPolicy));
  const everyDecision = profileResults.flatMap(({ candidateResults }) =>
    candidateResults.map(({ personalizedDecision }) => personalizedDecision),
  );
  const guardrailedDecisions = profileResults.flatMap(({ candidateResults }) =>
    candidateResults.map(({ guardrailedDecision }) => guardrailedDecision),
  );

  return {
    schemaVersion: SIMULATION_VERSION,
    nonEmpirical: true,
    interpretation: (
      'This is a deterministic implementation check using deliberately constructed response profiles. ' +
      'It is not evidence about real participant satisfaction or VLM accuracy.'
    ),
    assumptions: {
      nonFilteredBaseline: 'Every detected cue is used normally with action rank 0.',
      satisfactionProxy: (
        'Exact agreement and absolute rank error against each simulated profile\'s declared target action.'
      ),
      safetyFloorComparison: (
        'Preference actions are compared separately from effective actions after opt-in proof-of-concept floors.'
      ),
      manualReview: (
        'Configured source-video cues are exercised while their visual verification remains pending; ' +
        'Ego4D scenario matches are excluded until child visibility and calibrated tiers are confirmed.'
      ),
    },
    software: {
      simulationVersion: SIMULATION_VERSION,
      policyFilterAlgorithmVersion: POLICY_FILTER_ALGORITHM_VERSION,
      detectionSchemaVersion: document.schemaVersion,
      proofOfConceptGuardrailConfigId: PROOF_OF_CONCEPT_SAFETY_FLOORS.configId,
    },
    inputSummary: {
      configuredDetectionCount: document.configuredDetections.length,
      policyCandidateCount: candidates.length,
      negativeControlCount: negativeControls.length,
      pendingManualReviewCount,
      ego4dPendingManualReviewCount: document.ego4dManualReviewCandidates?.length ?? 0,
    },
    profileResults,
    aggregateMetrics: {
      nonFilteredBaseline: aggregateMetrics(profileResults, 'nonFilteredBaseline'),
      personalizedPreference: aggregateMetrics(profileResults, 'personalizedPreference'),
      personalizedWithProofOfConceptFloors: aggregateMetrics(
        profileResults,
        'personalizedWithProofOfConceptFloors',
      ),
    },
    ruleChecks: {
      strictnessOrderingHighProtectionAtLeastLowIntervention: strictnessOrdering,
      unknownCategoryFallbackRank: unknownDecision.effectiveAction.rank,
      unknownCategoryFallbackStatus: unknownDecision.status,
      exposureFilteredDecisionCount: everyDecision.filter(({ reasons }) =>
        reasons.includes('presence_only_below_selected_threshold'),
      ).length,
      q7ReasonObserved: everyDecision.some(({ preferenceAction }) =>
        preferenceAction.sources.includes('Q7'),
      ),
      q9ReasonObserved: everyDecision.some(({ preferenceAction }) =>
        preferenceAction.sources.includes('Q9'),
      ),
      q10ReasonObserved: everyDecision.some(({ preferenceAction }) =>
        preferenceAction.sources.includes('Q10'),
      ),
      safetyFloorAppliedDecisionCount: guardrailedDecisions.filter(({ floorApplied }) => floorApplied)
        .length,
      negativeControlExcludedFromPolicyCandidates:
        negativeControls.length > 0 && negativeControls.every(({ policyCandidate }) => policyCandidate === null),
    },
  };
}
