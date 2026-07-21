import { profileConfirmationOptions, q10Questions } from '../questions';
import type {
  ProfileConfirmation,
  ProbeScene,
  VPrivCalDataset,
  VPrivCalResponseExport,
} from '../types';
import {
  DISABLED_SAFETY_FLOORS,
  POLICY_FILTER_ALGORITHM_VERSION,
  PROOF_OF_CONCEPT_SAFETY_FLOORS,
  buildParticipantPolicy,
  filterCandidateCue,
  type CanonicalActionRank,
  type CandidateCue,
  type DecidedCue,
  type ReminderTriggerLevel,
} from './policyFilter';
import type { CandidateDetectionDocument } from './preExpertSimulation';

export const RANDOMIZED_SIMULATION_VERSION = 'vprivcal-randomized-profile-simulation-3.0.0';
const FIXED_TIME_MS = Date.UTC(2026, 0, 1);
const REMINDER_RANKS = [0, 2] as const;

export interface RandomizedSimulationConfig {
  seed: number;
  profileCount: number;
}

export interface CompactRandomizedDecision {
  candidateId: string;
  exposureLevel: DecidedCue['exposureLevel'];
  combinedRiskScore: number;
  crossCuttingEvaluations: DecidedCue['crossCuttingEvaluations'];
  preferenceTriggerLevel: DecidedCue['preferenceTriggerLevel'];
  preferenceRank: CanonicalActionRank;
  effectiveRank: CanonicalActionRank;
  floorApplied: boolean;
  status: DecidedCue['status'];
  sources: string[];
  reasons: string[];
}

export interface RandomizedProfileResult {
  profileId: string;
  latentReminderProbability: number;
  q10Values: Record<string, number>;
  response: VPrivCalResponseExport;
  decisions: CompactRandomizedDecision[];
  preferenceSignature: string;
  effectiveSignature: string;
}

interface CandidateDistribution {
  candidateId: string;
  preferenceActionCounts: Record<string, number>;
  effectiveActionCounts: Record<string, number>;
  distinctPreferenceRanks: number;
  floorAppliedCount: number;
}

export interface RandomizedProfileSimulationResult {
  schemaVersion: string;
  nonEmpirical: true;
  interpretation: string;
  config: RandomizedSimulationConfig;
  software: {
    policyFilterAlgorithmVersion: string;
    detectionSchemaVersion: string;
    safetyFloorConfigId: string;
  };
  generationModel: {
    latentReminderPreference: string;
    categoryVariation: string;
    probeVariation: string;
    awarenessVariation: string;
  };
  inputSummary: {
    configuredDetectionCount: number;
    policyCandidateCount: number;
    negativeControlCount: number;
  };
  robustness: {
    requestedProfileCount: number;
    compiledProfileCount: number;
    invalidProfileCount: number;
    decisionCount: number;
    invalidDecisionCount: number;
    uniquePreferenceSignatures: number;
    uniqueEffectiveSignatures: number;
    preferenceActionCounts: Record<string, number>;
    effectiveActionCounts: Record<string, number>;
    reminderDecisionCount: number;
    reminderDecisionRate: number;
    noReminderDecisionCount: number;
    noReminderDecisionRate: number;
    meanPreferenceRank: number;
    meanEffectiveRank: number;
    noFilterAgreementCount: number;
    noFilterAgreementRate: number;
    noFilterConflictCount: number;
    noFilterConflictRate: number;
    safetyFloorAppliedCount: number;
    safetyFloorAppliedRate: number;
    q7DecisionCount: number;
    exposureFilteredDecisionCount: number;
    q9DecisionCount: number;
    q10DecisionCount: number;
    fallbackDecisionCount: number;
    allCandidatesShowPreferenceVariation: boolean;
  };
  candidateDistributions: CandidateDistribution[];
  validationErrors: Array<{ profileId: string; errors: string[] }>;
  profileResults: RandomizedProfileResult[];
}

interface RandomSource {
  next(): number;
  integer(minimum: number, maximum: number): number;
  chance(probability: number): boolean;
}

function makeRandomSource(seed: number): RandomSource {
  let state = seed >>> 0;
  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    integer: (minimum, maximum) => Math.floor(next() * (maximum - minimum + 1)) + minimum,
    chance: (probability) => next() < probability,
  };
}

function clampProbability(value: number): number {
  return Math.max(0.02, Math.min(0.98, value));
}

function triggerLevelForScore(score: number): ReminderTriggerLevel {
  if (score < 1 / 3) return 0;
  if (score < 2 / 3) return 1;
  return 2;
}

function agreementLevelForScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score < 0.2) return 1;
  if (score < 0.4) return 2;
  if (score < 0.6) return 3;
  if (score < 0.8) return 4;
  return 5;
}

function emptyActionCounts(): Record<string, number> {
  return Object.fromEntries(REMINDER_RANKS.map((actionRank) => [String(actionRank), 0]));
}

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = random.integer(0, index);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function candidateCues(document: CandidateDetectionDocument): CandidateCue[] {
  if (!Array.isArray(document.configuredDetections)) {
    throw new Error('Detection JSON must contain configuredDetections.');
  }
  const ids = document.configuredDetections.map(({ detectionId }) => detectionId);
  if (new Set(ids).size !== ids.length) throw new Error('Detection IDs must be unique.');
  return document.configuredDetections
    .filter(({ expectedPrivacyCue, policyCandidate }) => expectedPrivacyCue && policyCandidate)
    .map(({ policyCandidate }) => policyCandidate as CandidateCue)
    .sort((first, second) => first.candidateId.localeCompare(second.candidateId));
}

function randomProfileConfirmation(
  random: RandomSource,
  timestamp: string,
): ProfileConfirmation | null {
  if (random.chance(0.5)) return null;
  const option = profileConfirmationOptions[random.integer(0, profileConfirmationOptions.length - 1)];
  return {
    value: option.value,
    answeredAt: timestamp,
  };
}

function generateResponse(
  profileIndex: number,
  dataset: VPrivCalDataset,
  random: RandomSource,
): {
  profileId: string;
  latentReminderProbability: number;
  q10Values: Record<string, number>;
  response: VPrivCalResponseExport;
} {
  const profileNumber = String(profileIndex + 1).padStart(4, '0');
  const profileId = `sim_random_${profileNumber}`;
  const timestamp = new Date(FIXED_TIME_MS + profileIndex * 1000).toISOString();
  const latentReminderProbability = 0.1 + random.next() * 0.8;
  const q10Values: Record<string, number> = {};
  const categoryRanks: Record<string, CanonicalActionRank> = {};

  for (const question of q10Questions) {
    if (question.categoryId) {
      const categoryProbability = clampProbability(
        latentReminderProbability + (random.next() - 0.5) * 0.7,
      );
      const categoryRank = triggerLevelForScore(categoryProbability);
      categoryRanks[question.categoryId] = categoryRank;
      q10Values[question.id] = categoryRank + 1;
    } else {
      const ruleProbability = clampProbability(
        latentReminderProbability + (random.next() - 0.5) * 0.8,
      );
      q10Values[question.id] = agreementLevelForScore(ruleProbability);
    }
  }

  const scenarioBias: Record<ProbeScene['scenarioType'], number> = {
    private: (random.next() - 0.5) * 0.5,
    public: (random.next() - 0.5) * 0.5,
    'semi-public': (random.next() - 0.5) * 0.5,
  };
  const randomizedScenes = shuffled(dataset.images, random);
  const probe = randomizedScenes.map((scene) => ({
    sceneId: scene.id,
    startedAt: timestamp,
    completedAt: timestamp,
    pointSelections: [],
    categoryResponses: shuffled(scene.availableCategoryIds, random).map(
      (categoryId, presentationOrder) => {
        const awarenessStatus = random.integer(1, 4);
        const probeProbability = clampProbability(
          0.2 +
            (categoryRanks[categoryId] === 2 ? 0.55 : 0) +
            scenarioBias[scene.scenarioType] +
            (random.next() - 0.5) * 0.65,
        );
        const preferredAction = triggerLevelForScore(probeProbability);
        const spontaneouslySelected = random.chance(awarenessStatus <= 2 ? 0.6 : 0.15);
        const evidenceOpened = random.chance(0.35);
        return {
          categoryId,
          presentationOrder,
          linkedDetectionIds:
            scene.categoryEvidence.find((evidence) => evidence.categoryId === categoryId)
              ?.detectionIds ?? [],
          spontaneouslySelected,
          awarenessStatus,
          preferredAction,
          evidenceOpened,
          evidenceToggleCount: evidenceOpened ? random.integer(1, 3) : 0,
          changes: random.integer(0, 2),
          durationMs: random.integer(500, 12000),
        };
      },
    ),
  }));

  const q10 = q10Questions.map((question) => {
    const value = q10Values[question.id];
    const option = question.options.find((candidate) => candidate.value === value);
    if (!option) throw new Error(`${profileId} generated an invalid ${question.id} value.`);
    return {
      questionId: question.id,
      value,
      label: option.label,
      firstViewedAt: timestamp,
      answeredAt: timestamp,
      changes: random.integer(0, 2),
      finalResponse: value,
    };
  });
  const q10DurationMs = q10.reduce((total) => total + random.integer(800, 8000), 0);
  const probeDurationMs = probe.reduce(
    (total, scene) =>
      total + scene.categoryResponses.reduce((sceneTotal, response) => sceneTotal + response.durationMs, 0),
    0,
  );

  return {
    profileId,
    latentReminderProbability,
    q10Values,
    response: {
      schemaVersion: dataset.schemaVersion,
      studyVersion: RANDOMIZED_SIMULATION_VERSION,
      participantId: `simulated-profile:${profileId}`,
      sessionId: `session:${profileId}`,
      startedAt: timestamp,
      completedAt: timestamp,
      userAgent: 'deterministic-randomized-pre-expert-simulation',
      viewportHistory: [],
      originalSceneOrder: dataset.images.map(({ id }) => id),
      randomizedSceneOrder: randomizedScenes.map(({ id }) => id),
      consent: {
        agreed: true,
        prolificId: `simulated-profile:${profileId}`,
        answeredAt: timestamp,
      },
      q10,
      probe,
      profileConfirmation: randomProfileConfirmation(random, timestamp),
      timing: {
        q10DurationMs,
        probeStartedAt: timestamp,
        probeCompletedAt: timestamp,
        probeDurationMs,
        totalDurationMs: q10DurationMs + probeDurationMs,
      },
    },
  };
}

function decided(decision: ReturnType<typeof filterCandidateCue>): DecidedCue | null {
  return decision.status === 'DECIDED' || decision.status === 'DECIDED_WITH_FALLBACK'
    ? decision
    : null;
}

export function runRandomizedProfileSimulation(
  document: CandidateDetectionDocument,
  dataset: VPrivCalDataset,
  config: RandomizedSimulationConfig,
): RandomizedProfileSimulationResult {
  if (!Number.isInteger(config.seed) || config.seed < 0) {
    throw new Error('Randomized simulation seed must be a non-negative integer.');
  }
  if (!Number.isInteger(config.profileCount) || config.profileCount < 1 || config.profileCount > 10000) {
    throw new Error('Randomized simulation profileCount must be an integer from 1 to 10000.');
  }
  const candidates = candidateCues(document);
  if (candidates.length === 0) throw new Error('At least one policy candidate is required.');
  const random = makeRandomSource(config.seed);
  const validationErrors: Array<{ profileId: string; errors: string[] }> = [];
  const profileResults: RandomizedProfileResult[] = [];
  let invalidDecisionCount = 0;

  for (let profileIndex = 0; profileIndex < config.profileCount; profileIndex += 1) {
    const generated = generateResponse(profileIndex, dataset, random);
    const compilation = buildParticipantPolicy(generated.response, dataset);
    if (compilation.status !== 'READY') {
      validationErrors.push({ profileId: generated.profileId, errors: compilation.errors });
      continue;
    }
    const decisions: CompactRandomizedDecision[] = [];
    for (const candidate of candidates) {
      const preference = decided(
        filterCandidateCue(candidate, compilation.policy, DISABLED_SAFETY_FLOORS),
      );
      const guarded = decided(
        filterCandidateCue(candidate, compilation.policy, PROOF_OF_CONCEPT_SAFETY_FLOORS),
      );
      if (!preference || !guarded) {
        invalidDecisionCount += 1;
        continue;
      }
      decisions.push({
        candidateId: candidate.candidateId,
        exposureLevel: preference.exposureLevel,
        combinedRiskScore: preference.combinedRiskScore,
        crossCuttingEvaluations: preference.crossCuttingEvaluations,
        preferenceTriggerLevel: preference.preferenceTriggerLevel,
        preferenceRank: preference.preferenceAction.rank,
        effectiveRank: guarded.effectiveAction.rank,
        floorApplied: guarded.floorApplied,
        status: preference.status,
        sources: preference.preferenceAction.sources,
        reasons: preference.reasons,
      });
    }
    profileResults.push({
      ...generated,
      decisions,
      preferenceSignature: decisions.map(({ preferenceRank }) => preferenceRank).join('-'),
      effectiveSignature: decisions.map(({ effectiveRank }) => effectiveRank).join('-'),
    });
  }

  const allDecisions = profileResults.flatMap(({ decisions }) => decisions);
  const preferenceActionCounts = emptyActionCounts();
  const effectiveActionCounts = emptyActionCounts();
  for (const decision of allDecisions) {
    preferenceActionCounts[String(decision.preferenceRank)] += 1;
    effectiveActionCounts[String(decision.effectiveRank)] += 1;
  }
  const decisionCount = allDecisions.length;
  const noFilterAgreementCount = allDecisions.filter(({ preferenceRank }) => preferenceRank === 0).length;
  const safetyFloorAppliedCount = allDecisions.filter(({ floorApplied }) => floorApplied).length;
  const candidateDistributions = candidates.map((candidate): CandidateDistribution => {
    const matching = allDecisions.filter(({ candidateId }) => candidateId === candidate.candidateId);
    const preferenceCounts = emptyActionCounts();
    const effectiveCounts = emptyActionCounts();
    for (const decision of matching) {
      preferenceCounts[String(decision.preferenceRank)] += 1;
      effectiveCounts[String(decision.effectiveRank)] += 1;
    }
    return {
      candidateId: candidate.candidateId,
      preferenceActionCounts: preferenceCounts,
      effectiveActionCounts: effectiveCounts,
      distinctPreferenceRanks: REMINDER_RANKS.filter(
        (actionRank) => preferenceCounts[String(actionRank)] > 0,
      ).length,
      floorAppliedCount: matching.filter(({ floorApplied }) => floorApplied).length,
    };
  });

  return {
    schemaVersion: RANDOMIZED_SIMULATION_VERSION,
    nonEmpirical: true,
    interpretation:
      'Seeded randomized VPrivCal profiles stress-test validation, decision diversity, rule coverage, and guardrail effects. They are not sampled participants or evidence of real-world effectiveness.',
    config,
    software: {
      policyFilterAlgorithmVersion: POLICY_FILTER_ALGORITHM_VERSION,
      detectionSchemaVersion: document.schemaVersion,
      safetyFloorConfigId: PROOF_OF_CONCEPT_SAFETY_FLOORS.configId,
    },
    generationModel: {
      latentReminderPreference:
        'Each profile samples a continuous reminder probability from 0.10 to 0.90 that correlates, but does not determine, its answers.',
      categoryVariation:
        'Each Q1-Q6 three-option trigger answer and each Q7-Q10 five-point agreement answer receives independent probability noise around the latent reminder preference.',
      probeVariation:
        'Probe decisions combine the category prior, profile-specific context biases, and substantial scene-level noise before sampling reminder or no reminder.',
      awarenessVariation:
        'Awareness, spontaneous selection, evidence use, response changes, and timing are sampled independently within valid ranges.',
    },
    inputSummary: {
      configuredDetectionCount: document.configuredDetections.length,
      policyCandidateCount: candidates.length,
      negativeControlCount: document.configuredDetections.filter(
        ({ expectedPrivacyCue }) => !expectedPrivacyCue,
      ).length,
    },
    robustness: {
      requestedProfileCount: config.profileCount,
      compiledProfileCount: profileResults.length,
      invalidProfileCount: validationErrors.length,
      decisionCount,
      invalidDecisionCount,
      uniquePreferenceSignatures: new Set(
        profileResults.map(({ preferenceSignature }) => preferenceSignature),
      ).size,
      uniqueEffectiveSignatures: new Set(
        profileResults.map(({ effectiveSignature }) => effectiveSignature),
      ).size,
      preferenceActionCounts,
      effectiveActionCounts,
      reminderDecisionCount: decisionCount - noFilterAgreementCount,
      reminderDecisionRate: (decisionCount - noFilterAgreementCount) / decisionCount,
      noReminderDecisionCount: noFilterAgreementCount,
      noReminderDecisionRate: noFilterAgreementCount / decisionCount,
      meanPreferenceRank:
        allDecisions.reduce((total, { preferenceRank }) => total + preferenceRank, 0) / decisionCount,
      meanEffectiveRank:
        allDecisions.reduce((total, { effectiveRank }) => total + effectiveRank, 0) / decisionCount,
      noFilterAgreementCount,
      noFilterAgreementRate: noFilterAgreementCount / decisionCount,
      noFilterConflictCount: decisionCount - noFilterAgreementCount,
      noFilterConflictRate: (decisionCount - noFilterAgreementCount) / decisionCount,
      safetyFloorAppliedCount,
      safetyFloorAppliedRate: safetyFloorAppliedCount / decisionCount,
      q7DecisionCount: allDecisions.filter(({ sources }) => sources.includes('Q7')).length,
      exposureFilteredDecisionCount: allDecisions.filter(({ reasons }) =>
        reasons.includes('presence_only_below_selected_threshold'),
      ).length,
      q9DecisionCount: allDecisions.filter(({ sources }) => sources.includes('Q9')).length,
      q10DecisionCount: allDecisions.filter(({ sources }) => sources.includes('Q10')).length,
      fallbackDecisionCount: allDecisions.filter(({ status }) => status === 'DECIDED_WITH_FALLBACK')
        .length,
      allCandidatesShowPreferenceVariation: candidateDistributions.every(
        ({ distinctPreferenceRanks }) => distinctPreferenceRanks > 1,
      ),
    },
    candidateDistributions,
    validationErrors,
    profileResults,
  };
}
