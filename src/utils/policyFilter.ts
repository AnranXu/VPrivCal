import { profileConfirmationOptions, q10Questions } from '../questions';
import type { ProbeScene, VPrivCalDataset, VPrivCalResponseExport } from '../types';

export const POLICY_FILTER_ALGORITHM_VERSION = '3.0.0-three-option-trigger';

export type CanonicalActionRank = 0 | 1 | 2 | 3 | 4;
export type ReminderTriggerLevel = 0 | 1 | 2;
export type ReminderDecision = 'NO_REMINDER' | 'SHOW_REMINDER';
export type ExposureLevel = 'PRESENCE_ONLY' | 'SENSITIVE_DETAIL_EXPOSED';
export type RiskTier = 1 | 2 | 3 | 4 | 5;
export type CandidateScenarioType = ProbeScene['scenarioType'] | 'unknown';
export type ActionPresentation =
  | 'none'
  | 'silent'
  | 'quiet_indicator'
  | 'brief_indicator'
  | 'brief_reminder'
  | 'brief_uncertain_reminder'
  | 'ask'
  | 'avoid';

export interface PolicyAction {
  rank: CanonicalActionRank;
  label: string;
  presentation: ActionPresentation;
  sources: string[];
  reasons: string[];
  minimumRiskTier?: RiskTier;
}

export interface WeightedAction {
  action: CanonicalActionRank;
  weight: number;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PolicyObservation {
  categoryId: string;
  sceneId: string;
  scenarioType: ProbeScene['scenarioType'];
  action: CanonicalActionRank;
  actionLabel: string;
  awarenessStatus: number;
  spontaneouslySelected: boolean;
}

export interface AwarenessFlags {
  interpretiveGap: boolean;
  perceptualCapabilityGap: boolean;
  rejectedInContext: boolean;
  rejectionActionConflict: boolean;
}

export interface CompiledCategoryPolicy {
  categoryId: string;
  q10Prior: CanonicalActionRank;
  q10PriorLabel: string;
  generalAction: CanonicalActionRank;
  generalActionLabel: string;
  contextActions: Partial<Record<ProbeScene['scenarioType'], CanonicalActionRank>>;
  observations: PolicyObservation[];
  awareness: AwarenessFlags;
}

export interface ProfileConfirmationInterpretation {
  status: 'confirmed' | 'not_collected' | 'needs_recalibration' | 'needs_more_context';
  recalibrationReason?: 'over-reminding' | 'under-protection';
}

export interface CompiledParticipantPolicy {
  algorithmVersion: string;
  schemaVersion: string;
  studyVersion: string;
  aggregation: {
    q10PriorWeight: number;
    probeObservationWeight: number;
    tieRule: 'upper_weighted_median';
  };
  categories: Record<string, CompiledCategoryPolicy>;
  crossCutting: {
    inferenceRule: number;
    unlistedCategoryTrigger: ReminderTriggerLevel;
    uncertaintyRule: number;
    taskIrrelevantRule: number;
  };
  confirmation: ProfileConfirmationInterpretation;
}

export interface PolicyCompilationConfig {
  algorithmVersion: string;
  q10PriorWeight: number;
  probeObservationWeight: number;
}

export const DEFAULT_POLICY_COMPILATION_CONFIG: Readonly<PolicyCompilationConfig> = {
  algorithmVersion: POLICY_FILTER_ALGORITHM_VERSION,
  q10PriorWeight: 1,
  probeObservationWeight: 2,
};

export type BuildParticipantPolicyResult =
  | { status: 'READY'; policy: CompiledParticipantPolicy }
  | { status: 'INVALID_RESPONSE'; errors: string[] };

export interface CandidateCue {
  candidateId: string;
  stableRegionId?: string;
  categoryIds: string[];
  scenarioType: CandidateScenarioType;
  isInference: boolean;
  isUncertain: boolean;
  taskRelevant: boolean;
  explicitlyRequested: boolean;
  exposureLevel: ExposureLevel;
  likelihoodTier: RiskTier;
  severityTier: RiskTier;
  reasonCodes?: string[];
}

export interface HighConfidenceSevereFloor {
  minimumLikelihood: RiskTier;
  minimumSeverity: RiskTier;
  action: CanonicalActionRank;
}

export interface SafetyFloorConfig {
  configId: string;
  enabled: boolean;
  categoryMinimums: Readonly<Record<string, CanonicalActionRank>>;
  highConfidenceSevere?: Readonly<HighConfidenceSevereFloor>;
  approvedWaiverKeys?: readonly string[];
}

export const DISABLED_SAFETY_FLOORS: Readonly<SafetyFloorConfig> = {
  configId: 'disabled-v1',
  enabled: false,
  categoryMinimums: {},
};

export const PROOF_OF_CONCEPT_SAFETY_FLOORS: Readonly<SafetyFloorConfig> = {
  configId: 'vprivcal-proof-of-concept-v1',
  enabled: true,
  categoryMinimums: {
    children_images: 2,
    background_individuals: 2,
  },
  highConfidenceSevere: {
    minimumLikelihood: 4,
    minimumSeverity: 4,
    action: 2,
  },
};

export interface DecidedCue {
  status: 'DECIDED' | 'DECIDED_WITH_FALLBACK';
  candidateId: string;
  stableRegionId?: string;
  categoryIds: string[];
  unresolvedCategoryIds: string[];
  scenarioType: CandidateScenarioType;
  likelihoodTier: RiskTier;
  severityTier: RiskTier;
  exposureLevel: ExposureLevel;
  preferenceTriggerLevel: ReminderTriggerLevel;
  awarenessGapTieBreak: boolean;
  preferenceAction: PolicyAction;
  effectiveAction: PolicyAction;
  preferenceReminderDecision: ReminderDecision;
  effectiveReminderDecision: ReminderDecision;
  floorApplied: boolean;
  safetyWaiverApplied: boolean;
  reasons: string[];
  reasonCodes: string[];
  policyVersion: string;
  studyVersion: string;
  guardrailConfigId: string;
}

export interface InvalidCandidateDecision {
  status: 'INVALID_CANDIDATE';
  candidateId: string;
  errors: string[];
}

export interface InvalidFilterConfigurationDecision {
  status: 'INVALID_CONFIGURATION';
  candidateId: string;
  errors: string[];
}

export type CueDecision =
  | DecidedCue
  | InvalidCandidateDecision
  | InvalidFilterConfigurationDecision;

export interface CandidateBatchResult {
  allDecisions: CueDecision[];
  visibleDecisions: DecidedCue[];
}

const ACTION_LABELS: Record<CanonicalActionRank, string> = {
  0: 'Do not show reminders for this category',
  1: 'Show reminders only when identifying or sensitive details are exposed',
  2: 'Show reminders whenever this verified category is present',
  3: 'Legacy ask-before-use action',
  4: 'Legacy avoid-unless-requested action',
};

const DEFAULT_PRESENTATIONS: Record<CanonicalActionRank, ActionPresentation> = {
  0: 'none',
  1: 'none',
  2: 'brief_reminder',
  3: 'ask',
  4: 'avoid',
};

const PRESENTATION_PRIORITY: Record<ActionPresentation, number> = {
  none: 0,
  silent: 1,
  quiet_indicator: 2,
  brief_indicator: 3,
  brief_reminder: 4,
  brief_uncertain_reminder: 5,
  ask: 6,
  avoid: 7,
};

function compareCodeUnits(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

function isCanonicalActionRank(value: unknown): value is CanonicalActionRank {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 4;
}

function isRiskTier(value: unknown): value is RiskTier {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 5;
}

function isScenarioType(value: unknown): value is CandidateScenarioType {
  return value === 'private' || value === 'public' || value === 'semi-public' || value === 'unknown';
}

function isExposureLevel(value: unknown): value is ExposureLevel {
  return value === 'PRESENCE_ONLY' || value === 'SENSITIVE_DETAIL_EXPOSED';
}

function makeAction(
  rank: CanonicalActionRank,
  source: string,
  reason: string,
  presentation: ActionPresentation = DEFAULT_PRESENTATIONS[rank],
  minimumRiskTier?: RiskTier,
): PolicyAction {
  return {
    rank,
    label: ACTION_LABELS[rank],
    presentation,
    sources: [source],
    reasons: [reason],
    ...(minimumRiskTier === undefined ? {} : { minimumRiskTier }),
  };
}

export function reminderDecisionForAction(action: Pick<PolicyAction, 'rank'>): ReminderDecision {
  return action.rank >= 2 ? 'SHOW_REMINDER' : 'NO_REMINDER';
}

function mergeActionMetadata(action: PolicyAction, source: string, reason: string): PolicyAction {
  return {
    ...action,
    sources: uniqueSorted([...action.sources, source]),
    reasons: uniqueSorted([...action.reasons, reason]),
  };
}

function transformAction(
  action: PolicyAction,
  rank: CanonicalActionRank,
  source: string,
  reason: string,
): PolicyAction {
  const transformed = makeAction(rank, source, reason);
  return {
    ...transformed,
    sources: uniqueSorted([...action.sources, ...transformed.sources]),
    reasons: uniqueSorted([...action.reasons, ...transformed.reasons]),
  };
}

export function strictestAction(actions: readonly PolicyAction[]): PolicyAction {
  if (actions.length === 0) throw new Error('At least one action is required.');
  const highestRank = Math.max(...actions.map((action) => action.rank)) as CanonicalActionRank;
  const contenders = actions.filter((action) => action.rank === highestRank);
  const presentation = contenders.reduce((current, action) =>
    PRESENTATION_PRIORITY[action.presentation] > PRESENTATION_PRIORITY[current]
      ? action.presentation
      : current,
  contenders[0].presentation);
  const minimumRiskTier = Math.max(
    0,
    ...contenders.map((action) => action.minimumRiskTier ?? 0),
  );
  return {
    rank: highestRank,
    label: ACTION_LABELS[highestRank],
    presentation,
    sources: uniqueSorted(contenders.flatMap((action) => action.sources)),
    reasons: uniqueSorted(contenders.flatMap((action) => action.reasons)),
    ...(minimumRiskTier === 0 ? {} : { minimumRiskTier: minimumRiskTier as RiskTier }),
  };
}

export function upperWeightedMedian(items: readonly WeightedAction[]): CanonicalActionRank {
  if (items.length === 0) throw new Error('At least one weighted action is required.');
  for (const item of items) {
    if (!isCanonicalActionRank(item.action)) throw new Error('Action ranks must be integers from 0 to 4.');
    if (!Number.isFinite(item.weight) || item.weight <= 0) {
      throw new Error('Action weights must be positive finite numbers.');
    }
  }
  const sorted = [...items].sort((first, second) => first.action - second.action);
  const half = sorted.reduce((sum, item) => sum + item.weight, 0) / 2;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative > half) return item.action;
  }
  return sorted.at(-1)!.action;
}

function valuesEqual(first: unknown, second: unknown): boolean {
  return typeof first === typeof second && first === second;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatePolicyResponse(
  response: VPrivCalResponseExport,
  dataset: VPrivCalDataset,
): PolicyValidationResult {
  const errors: string[] = [];
  if (!isRecord(response as unknown)) {
    return { valid: false, errors: ['Response export must be an object.'] };
  }
  if (!response.schemaVersion) errors.push('Missing schemaVersion.');
  if (!response.studyVersion) errors.push('Missing studyVersion.');
  if (!response.sessionId) errors.push('Missing sessionId.');
  if (!response.startedAt) errors.push('Missing startedAt.');
  if (!response.consent?.agreed) errors.push('Agreed participant consent is required.');

  const rawQ10: unknown[] = Array.isArray(response.q10) ? response.q10 : [];
  if (!Array.isArray(response.q10)) errors.push('Q10 responses must be an array.');
  if (rawQ10.some((answer) => !isRecord(answer))) {
    errors.push('Every Q10 response must be an object.');
  }
  const q10 = rawQ10.filter(isRecord) as unknown as VPrivCalResponseExport['q10'];

  const questionIds = new Set(q10Questions.map((question) => question.id));
  for (const answer of q10) {
    if (!questionIds.has(answer.questionId)) {
      errors.push(`Unexpected Q10 question ${answer.questionId}.`);
    }
  }
  for (const question of q10Questions) {
    const answers = q10.filter((answer) => answer.questionId === question.id);
    if (answers.length !== 1) {
      errors.push(`Q10 question ${question.id} must occur exactly once; found ${answers.length}.`);
      continue;
    }
    const answer = answers[0];
    if (!question.options.some((option) => valuesEqual(option.value, answer.value))) {
      errors.push(`Q10 question ${question.id} has an invalid value.`);
    }
    if (!Number.isInteger(answer.value) || typeof answer.value !== 'number' || answer.value < 1 || answer.value > 5) {
      errors.push(`Q10 question ${question.id} is outside the supported numeric 1-5 scale.`);
    }
    if (!valuesEqual(answer.value, answer.finalResponse)) {
      errors.push(`Q10 question ${question.id} has inconsistent value and finalResponse.`);
    }
  }

  const categoryIds = new Set(dataset.categories.map((category) => category.id));
  for (const categoryId of categoryIds) {
    const count = dataset.categories.filter((category) => category.id === categoryId).length;
    if (count !== 1) errors.push(`Dataset category ${categoryId} must occur exactly once; found ${count}.`);
  }
  for (const scene of dataset.images) {
    const uniqueAvailableIds = new Set(scene.availableCategoryIds);
    if (uniqueAvailableIds.size !== scene.availableCategoryIds.length) {
      errors.push(`Scene ${scene.id} contains duplicate available category IDs.`);
    }
    for (const categoryId of scene.availableCategoryIds) {
      if (!categoryIds.has(categoryId)) {
        errors.push(`Scene ${scene.id} references unknown category ${categoryId}.`);
      }
    }
  }
  for (const category of dataset.categories) {
    if (!q10Questions.some((question) => question.categoryId === category.id)) {
      errors.push(`Category ${category.id} has no Q10 prior question.`);
    }
  }

  const sceneIds = new Set(dataset.images.map((scene) => scene.id));
  for (const sceneId of sceneIds) {
    const count = dataset.images.filter((scene) => scene.id === sceneId).length;
    if (count !== 1) errors.push(`Dataset scene ${sceneId} must occur exactly once; found ${count}.`);
  }
  const rawProbe: unknown[] = Array.isArray(response.probe) ? response.probe : [];
  if (!Array.isArray(response.probe)) errors.push('Probe responses must be an array.');
  if (rawProbe.some((scene) => !isRecord(scene))) {
    errors.push('Every Probe scene response must be an object.');
  }
  const probe = rawProbe.filter(isRecord) as unknown as VPrivCalResponseExport['probe'];
  for (const exportedScene of probe) {
    if (!sceneIds.has(exportedScene.sceneId)) {
      errors.push(`Unexpected Probe scene ${exportedScene.sceneId}.`);
    }
  }
  const allowedAwareness = new Set(dataset.probeQuestions.awarenessStatus.options.map(({ value }) => value));
  const allowedActions = new Set(dataset.probeQuestions.preferredAction.options.map(({ value }) => value));
  for (const value of allowedAwareness) {
    if (!Number.isInteger(value) || value < 1 || value > 4) {
      errors.push(`Dataset awareness option ${value} is outside the supported 1-4 scale.`);
    }
  }
  for (const value of allowedActions) {
    if (value !== 0 && value !== 1 && value !== 2) {
      errors.push(`Dataset preferred-action option ${value} is outside the supported 0/1/2 trigger scale.`);
    }
  }
  if (
    dataset.probeQuestions.awarenessStatus.options.length !== 4 ||
    ![1, 2, 3, 4].every((value) => allowedAwareness.has(value))
  ) {
    errors.push('Dataset must declare each awareness option from 1 to 4 exactly once.');
  }
  if (
    dataset.probeQuestions.preferredAction.options.length !== 3 ||
    ![0, 1, 2].every((value) => allowedActions.has(value))
  ) {
    errors.push('Dataset must declare preferred trigger options 0, 1, and 2 exactly once.');
  }
  for (const scene of dataset.images) {
    const exportedScenes = probe.filter((item) => item.sceneId === scene.id);
    if (exportedScenes.length !== 1) {
      errors.push(`Probe scene ${scene.id} must occur exactly once; found ${exportedScenes.length}.`);
      continue;
    }
    const rawCategoryResponses: unknown = exportedScenes[0].categoryResponses;
    if (!Array.isArray(rawCategoryResponses)) {
      errors.push(`Scene ${scene.id} category responses must be an array.`);
      continue;
    }
    if (rawCategoryResponses.some((item) => !isRecord(item))) {
      errors.push(`Every category response in scene ${scene.id} must be an object.`);
    }
    const categoryResponses = rawCategoryResponses.filter(
      isRecord,
    ) as unknown as VPrivCalResponseExport['probe'][number]['categoryResponses'];
    for (const item of categoryResponses) {
      if (!scene.availableCategoryIds.includes(item.categoryId)) {
        errors.push(`Scene ${scene.id} contains unexpected category ${item.categoryId}.`);
      }
    }
    for (const categoryId of scene.availableCategoryIds) {
      const matches = categoryResponses.filter((item) => item.categoryId === categoryId);
      if (matches.length !== 1) {
        errors.push(
          `Scene ${scene.id} category ${categoryId} must occur exactly once; found ${matches.length}.`,
        );
        continue;
      }
      if (!allowedAwareness.has(matches[0].awarenessStatus)) {
        errors.push(`Scene ${scene.id} category ${categoryId} has an invalid awareness status.`);
      }
      if (!allowedActions.has(matches[0].preferredAction)) {
        errors.push(`Scene ${scene.id} category ${categoryId} has an invalid preferred action.`);
      }
    }
  }

  if (
    response.profileConfirmation &&
    !profileConfirmationOptions.some((option) => option.value === response.profileConfirmation?.value)
  ) {
    errors.push('Profile confirmation has an invalid value.');
  }
  return { valid: errors.length === 0, errors };
}

function numericQ10Value(response: VPrivCalResponseExport, questionId: string): number {
  return response.q10.find((answer) => answer.questionId === questionId)!.value as number;
}

function interpretConfirmation(
  response: VPrivCalResponseExport,
): ProfileConfirmationInterpretation {
  switch (response.profileConfirmation?.value) {
    case 'matches':
      return { status: 'confirmed' };
    case 'too_many':
      return { status: 'needs_recalibration', recalibrationReason: 'over-reminding' };
    case 'not_enough':
      return { status: 'needs_recalibration', recalibrationReason: 'under-protection' };
    case 'context_dependent':
      return { status: 'needs_more_context' };
    default:
      return { status: 'not_collected' };
  }
}

export function buildParticipantPolicy(
  response: VPrivCalResponseExport,
  dataset: VPrivCalDataset,
  config: Readonly<PolicyCompilationConfig> = DEFAULT_POLICY_COMPILATION_CONFIG,
): BuildParticipantPolicyResult {
  const validation = validatePolicyResponse(response, dataset);
  const configErrors: string[] = [];
  if (!config.algorithmVersion.trim()) configErrors.push('Missing policy algorithm version.');
  if (!Number.isFinite(config.q10PriorWeight) || config.q10PriorWeight <= 0) {
    configErrors.push('Q10 prior weight must be a positive finite number.');
  }
  if (!Number.isFinite(config.probeObservationWeight) || config.probeObservationWeight <= 0) {
    configErrors.push('Probe observation weight must be a positive finite number.');
  }
  if (!validation.valid || configErrors.length > 0) {
    return { status: 'INVALID_RESPONSE', errors: [...validation.errors, ...configErrors] };
  }

  const categories = Object.create(null) as Record<string, CompiledCategoryPolicy>;
  for (const category of dataset.categories) {
    const question = q10Questions.find((item) => item.categoryId === category.id)!;
    const q10Response = response.q10.find((answer) => answer.questionId === question.id)!;
    const prior = (numericQ10Value(response, question.id) - 1) as CanonicalActionRank;
    const observations: PolicyObservation[] = dataset.images.flatMap((scene) => {
      if (!scene.availableCategoryIds.includes(category.id)) return [];
      const exportedScene = response.probe.find((item) => item.sceneId === scene.id)!;
      const categoryResponse = exportedScene.categoryResponses.find(
        (item) => item.categoryId === category.id,
      )!;
      return [{
        categoryId: category.id,
        sceneId: scene.id,
        scenarioType: scene.scenarioType,
        action: categoryResponse.preferredAction as CanonicalActionRank,
        actionLabel:
          dataset.probeQuestions.preferredAction.options.find(
            (option) => option.value === categoryResponse.preferredAction,
          )!.label,
        awarenessStatus: categoryResponse.awarenessStatus,
        spontaneouslySelected: categoryResponse.spontaneouslySelected,
      }];
    });
    const generalAction = upperWeightedMedian([
      { action: prior, weight: config.q10PriorWeight },
      ...observations.map((observation) => ({
        action: observation.action,
        weight: config.probeObservationWeight,
      })),
    ]);
    const contextActions: CompiledCategoryPolicy['contextActions'] = {};
    for (const scenarioType of ['private', 'public', 'semi-public'] as const) {
      const actions = observations
        .filter((observation) => observation.scenarioType === scenarioType)
        .map((observation) => ({ action: observation.action, weight: 1 }));
      if (actions.length > 0) contextActions[scenarioType] = upperWeightedMedian(actions);
    }
    categories[category.id] = {
      categoryId: category.id,
      q10Prior: prior,
      q10PriorLabel: q10Response.label,
      generalAction,
      generalActionLabel: ACTION_LABELS[generalAction],
      contextActions,
      observations,
      awareness: {
        interpretiveGap: observations.some(({ awarenessStatus }) => awarenessStatus === 2),
        perceptualCapabilityGap: observations.some(({ awarenessStatus }) => awarenessStatus === 3),
        rejectedInContext: observations.some(({ awarenessStatus }) => awarenessStatus === 4),
        rejectionActionConflict: observations.some(
          ({ awarenessStatus, action }) => awarenessStatus === 4 && action > 0,
        ),
      },
    };
  }

  return {
    status: 'READY',
    policy: {
      algorithmVersion: config.algorithmVersion,
      schemaVersion: response.schemaVersion,
      studyVersion: response.studyVersion,
      aggregation: {
        q10PriorWeight: config.q10PriorWeight,
        probeObservationWeight: config.probeObservationWeight,
        tieRule: 'upper_weighted_median',
      },
      categories,
      crossCutting: {
        inferenceRule: numericQ10Value(response, 'Q7'),
        unlistedCategoryTrigger: (numericQ10Value(response, 'Q8') - 1) as ReminderTriggerLevel,
        uncertaintyRule: numericQ10Value(response, 'Q9'),
        taskIrrelevantRule: numericQ10Value(response, 'Q10'),
      },
      confirmation: interpretConfirmation(response),
    },
  };
}

export function mapInferenceRule(value: number, riskTier: RiskTier): PolicyAction {
  void riskTier;
  switch (value) {
    case 1:
      return makeAction(0, 'Q7', 'no_reminder_for_inference');
    case 3:
      return makeAction(2, 'Q7', 'remind_for_inference');
    default:
      throw new Error('Q7 must use binary option value 1 or 3.');
  }
}

export function mapUncertaintyRule(value: number): PolicyAction {
  switch (value) {
    case 1:
      return makeAction(0, 'Q9', 'no_reminder_when_uncertain');
    case 3:
      return makeAction(2, 'Q9', 'brief_uncertain_reminder', 'brief_uncertain_reminder');
    default:
      throw new Error('Q9 must use binary option value 1 or 3.');
  }
}

export function mapTaskIrrelevantRule(value: number, riskTier: RiskTier): PolicyAction {
  void riskTier;
  switch (value) {
    case 1:
      return makeAction(0, 'Q10', 'no_reminder_when_task_irrelevant');
    case 3:
      return makeAction(2, 'Q10', 'brief_task_irrelevant_reminder', 'brief_reminder');
    default:
      throw new Error('Q10 must use binary option value 1 or 3.');
  }
}

function validateCandidate(candidate: CandidateCue): string[] {
  const errors: string[] = [];
  if (typeof candidate.candidateId !== 'string' || !candidate.candidateId.trim()) {
    errors.push('Candidate ID is required.');
  }
  if (!Array.isArray(candidate.categoryIds) || candidate.categoryIds.length === 0) {
    errors.push('At least one category ID is required.');
  } else if (
    candidate.categoryIds.some(
      (categoryId) => typeof categoryId !== 'string' || !categoryId.trim(),
    )
  ) {
    errors.push('Category IDs must be non-empty strings.');
  }
  if (
    candidate.stableRegionId !== undefined &&
    (typeof candidate.stableRegionId !== 'string' || !candidate.stableRegionId.trim())
  ) {
    errors.push('Stable region ID must be a non-empty string when supplied.');
  }
  if (
    candidate.reasonCodes !== undefined &&
    (!Array.isArray(candidate.reasonCodes) ||
      candidate.reasonCodes.some((code) => typeof code !== 'string' || !code.trim()))
  ) {
    errors.push('Reason codes must be non-empty strings when supplied.');
  }
  if (!isScenarioType(candidate.scenarioType)) errors.push('Candidate scenario type is invalid.');
  if (!isExposureLevel(candidate.exposureLevel)) {
    errors.push('Exposure level must be PRESENCE_ONLY or SENSITIVE_DETAIL_EXPOSED.');
  }
  if (!isRiskTier(candidate.likelihoodTier)) errors.push('Likelihood tier must be an integer from 1 to 5.');
  if (!isRiskTier(candidate.severityTier)) errors.push('Severity tier must be an integer from 1 to 5.');
  for (const field of ['isInference', 'isUncertain', 'taskRelevant', 'explicitlyRequested'] as const) {
    if (typeof candidate[field] !== 'boolean') errors.push(`${field} must be Boolean.`);
  }
  return errors;
}

export function validateSafetyFloorConfig(
  config: Readonly<SafetyFloorConfig>,
): PolicyValidationResult {
  if (!isRecord(config as unknown)) {
    return { valid: false, errors: ['Safety-floor configuration must be an object.'] };
  }
  const errors: string[] = [];
  if (typeof config.configId !== 'string' || !config.configId.trim()) {
    errors.push('Safety-floor configId must be a non-empty string.');
  }
  if (typeof config.enabled !== 'boolean') {
    errors.push('Safety-floor enabled must be Boolean.');
  }
  if (!isRecord(config.categoryMinimums as unknown)) {
    errors.push('Safety-floor categoryMinimums must be an object.');
  } else {
    for (const [categoryId, rank] of Object.entries(config.categoryMinimums)) {
      if (!categoryId.trim()) errors.push('Safety-floor category IDs must be non-empty strings.');
      if (!isCanonicalActionRank(rank)) {
        errors.push(`Safety-floor action for ${categoryId || '<empty>'} must be an integer from 0 to 4.`);
      }
    }
  }
  if (config.highConfidenceSevere !== undefined) {
    const severe = config.highConfidenceSevere;
    if (!isRecord(severe as unknown)) {
      errors.push('High-confidence severe floor must be an object.');
    } else {
      if (!isRiskTier(severe.minimumLikelihood)) {
        errors.push('Severe-floor minimumLikelihood must be an integer from 1 to 5.');
      }
      if (!isRiskTier(severe.minimumSeverity)) {
        errors.push('Severe-floor minimumSeverity must be an integer from 1 to 5.');
      }
      if (!isCanonicalActionRank(severe.action)) {
        errors.push('Severe-floor action must be an integer from 0 to 4.');
      }
    }
  }
  if (config.approvedWaiverKeys !== undefined) {
    if (
      !Array.isArray(config.approvedWaiverKeys) ||
      config.approvedWaiverKeys.some(
        (key) =>
          typeof key !== 'string' ||
          (!key.startsWith('candidate:') && !key.startsWith('region:')) ||
          key.split(':').slice(1).join(':').trim().length === 0,
      )
    ) {
      errors.push(
        'Approved waiver keys must use non-empty candidate:<id> or region:<id> namespaces.',
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

function resolveTriggerForExposure(
  trigger: PolicyAction,
  exposureLevel: ExposureLevel,
): PolicyAction {
  if (trigger.rank === 0) return trigger;
  if (trigger.rank === 1) {
    return exposureLevel === 'SENSITIVE_DETAIL_EXPOSED'
      ? transformAction(trigger, 2, 'exposure_rule', 'sensitive_detail_threshold_met')
      : transformAction(trigger, 0, 'exposure_rule', 'presence_only_below_selected_threshold');
  }
  if (trigger.rank === 2) {
    return mergeActionMetadata(
      trigger,
      'exposure_rule',
      'verified_category_presence_threshold_met',
    );
  }
  throw new Error('New participant trigger paths must use level 0, 1, or 2.');
}

function safetyFloorForCandidate(
  candidate: CandidateCue,
  config: Readonly<SafetyFloorConfig>,
): PolicyAction | null {
  const waiverKey = candidate.stableRegionId
    ? `region:${candidate.stableRegionId}`
    : `candidate:${candidate.candidateId}`;
  if (!config.enabled || config.approvedWaiverKeys?.includes(waiverKey)) return null;
  const floors: PolicyAction[] = [];
  for (const categoryId of uniqueSorted(candidate.categoryIds)) {
    const rank = Object.hasOwn(config.categoryMinimums, categoryId)
      ? config.categoryMinimums[categoryId]
      : undefined;
    if (rank !== undefined) {
      floors.push(makeAction(rank, 'safety_floor', `category_floor:${categoryId}`));
    }
  }
  const severe = config.highConfidenceSevere;
  if (
    severe &&
    candidate.likelihoodTier >= severe.minimumLikelihood &&
    candidate.severityTier >= severe.minimumSeverity
  ) {
    floors.push(makeAction(severe.action, 'safety_floor', 'high_confidence_severe_floor'));
  }
  return floors.length > 0 ? strictestAction(floors) : null;
}

function hasApprovedSafetyWaiver(
  candidate: CandidateCue,
  config: Readonly<SafetyFloorConfig>,
): boolean {
  const waiverKey = candidate.stableRegionId
    ? `region:${candidate.stableRegionId}`
    : `candidate:${candidate.candidateId}`;
  return Boolean(config.enabled && config.approvedWaiverKeys?.includes(waiverKey));
}

export function filterCandidateCue(
  candidate: CandidateCue,
  policy: CompiledParticipantPolicy,
  guardrails: Readonly<SafetyFloorConfig> = DISABLED_SAFETY_FLOORS,
): CueDecision {
  const errors = validateCandidate(candidate);
  if (errors.length > 0) {
    return {
      status: 'INVALID_CANDIDATE',
      candidateId: typeof candidate.candidateId === 'string' ? candidate.candidateId : '',
      errors,
    };
  }
  const guardrailValidation = validateSafetyFloorConfig(guardrails);
  if (!guardrailValidation.valid) {
    return {
      status: 'INVALID_CONFIGURATION',
      candidateId: candidate.candidateId,
      errors: guardrailValidation.errors,
    };
  }
  const categoryIds = uniqueSorted(candidate.categoryIds);
  const unresolvedCategoryIds: string[] = [];
  const applicable: PolicyAction[] = [];
  for (const categoryId of categoryIds) {
    const hasCategoryPolicy = Object.hasOwn(policy.categories, categoryId);
    const categoryPolicy = hasCategoryPolicy ? policy.categories[categoryId] : undefined;
    if (!categoryPolicy) {
      unresolvedCategoryIds.push(categoryId);
      applicable.push(
        makeAction(
          policy.crossCutting.unlistedCategoryTrigger,
          'Q8',
          `unlisted_verified_category:${categoryId}`,
        ),
      );
      continue;
    }
    const contextAction =
      candidate.scenarioType === 'unknown'
        ? undefined
        : categoryPolicy.contextActions[candidate.scenarioType];
    applicable.push(
      makeAction(
        contextAction ?? categoryPolicy.generalAction,
        contextAction === undefined ? `category_fallback:${categoryId}` : `probe_context:${categoryId}`,
        contextAction === undefined ? 'general_category_action' : 'context_category_action',
      ),
    );
  }
  const riskTier = Math.max(candidate.likelihoodTier, candidate.severityTier) as RiskTier;
  if (candidate.isInference) {
    applicable.push(mapInferenceRule(policy.crossCutting.inferenceRule, riskTier));
  }
  if (candidate.isUncertain) {
    applicable.push(mapUncertaintyRule(policy.crossCutting.uncertaintyRule));
  }
  if (!candidate.taskRelevant) {
    applicable.push(mapTaskIrrelevantRule(policy.crossCutting.taskIrrelevantRule, riskTier));
  }
  const triggerAction = strictestAction(applicable);
  const preferenceTriggerLevel = triggerAction.rank as ReminderTriggerLevel;
  const preferenceAction = resolveTriggerForExposure(triggerAction, candidate.exposureLevel);
  const safetyWaiverApplied = hasApprovedSafetyWaiver(candidate, guardrails);
  const floor = safetyFloorForCandidate(candidate, guardrails);
  const effectiveAction = floor ? strictestAction([preferenceAction, floor]) : preferenceAction;
  const floorApplied = Boolean(
    floor &&
    (floor.rank > preferenceAction.rank ||
      (floor.rank === preferenceAction.rank &&
        PRESENTATION_PRIORITY[floor.presentation] >
          PRESENTATION_PRIORITY[preferenceAction.presentation])),
  );
  const awarenessGapTieBreak = categoryIds.some((categoryId) => {
    const awareness = Object.hasOwn(policy.categories, categoryId)
      ? policy.categories[categoryId].awareness
      : undefined;
    return awareness?.interpretiveGap || awareness?.perceptualCapabilityGap;
  });
  return {
    status: unresolvedCategoryIds.length > 0 ? 'DECIDED_WITH_FALLBACK' : 'DECIDED',
    candidateId: candidate.candidateId,
    ...(candidate.stableRegionId ? { stableRegionId: candidate.stableRegionId } : {}),
    categoryIds,
    unresolvedCategoryIds,
    scenarioType: candidate.scenarioType,
    likelihoodTier: candidate.likelihoodTier,
    severityTier: candidate.severityTier,
    exposureLevel: candidate.exposureLevel,
    preferenceTriggerLevel,
    awarenessGapTieBreak,
    preferenceAction,
    effectiveAction,
    preferenceReminderDecision: reminderDecisionForAction(preferenceAction),
    effectiveReminderDecision: reminderDecisionForAction(effectiveAction),
    floorApplied,
    safetyWaiverApplied,
    reasons: uniqueSorted([
      ...triggerAction.reasons,
      ...preferenceAction.reasons,
      ...(floor?.reasons ?? []),
    ]),
    reasonCodes: uniqueSorted(candidate.reasonCodes ?? []),
    policyVersion: policy.algorithmVersion,
    studyVersion: policy.studyVersion,
    guardrailConfigId: guardrails.configId,
  };
}

function mergeCandidateGroup(candidates: readonly CandidateCue[]): CandidateCue {
  const ordered = [...candidates].sort((first, second) =>
    compareCodeUnits(first.candidateId, second.candidateId),
  );
  const scenarios = uniqueSorted(ordered.map(({ scenarioType }) => scenarioType));
  return {
    candidateId: ordered[0].candidateId,
    ...(ordered[0].stableRegionId ? { stableRegionId: ordered[0].stableRegionId } : {}),
    categoryIds: uniqueSorted(ordered.flatMap(({ categoryIds }) => categoryIds)),
    scenarioType: scenarios.length === 1 ? (scenarios[0] as CandidateScenarioType) : 'unknown',
    isInference: ordered.some(({ isInference }) => isInference),
    isUncertain: ordered.some(({ isUncertain }) => isUncertain),
    taskRelevant: ordered.every(({ taskRelevant }) => taskRelevant),
    explicitlyRequested: ordered.every(({ explicitlyRequested }) => explicitlyRequested),
    exposureLevel: ordered.some(
      ({ exposureLevel }) => exposureLevel === 'SENSITIVE_DETAIL_EXPOSED',
    )
      ? 'SENSITIVE_DETAIL_EXPOSED'
      : 'PRESENCE_ONLY',
    likelihoodTier: Math.max(...ordered.map(({ likelihoodTier }) => likelihoodTier)) as RiskTier,
    severityTier: Math.max(...ordered.map(({ severityTier }) => severityTier)) as RiskTier,
    reasonCodes: uniqueSorted(ordered.flatMap(({ reasonCodes }) => reasonCodes ?? [])),
  };
}

export function filterCandidateBatch(
  candidates: readonly CandidateCue[],
  policy: CompiledParticipantPolicy,
  guardrails: Readonly<SafetyFloorConfig> = DISABLED_SAFETY_FLOORS,
  visibleLimit = Number.POSITIVE_INFINITY,
): CandidateBatchResult {
  if (
    visibleLimit !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(visibleLimit) || visibleLimit < 0)
  ) {
    throw new Error('Visible limit must be a non-negative integer or Infinity.');
  }
  const invalidDecisions: InvalidCandidateDecision[] = [];
  const validCandidates: CandidateCue[] = [];
  for (const candidate of candidates) {
    const errors = validateCandidate(candidate);
    if (errors.length > 0) {
      invalidDecisions.push({
        status: 'INVALID_CANDIDATE',
        candidateId: typeof candidate.candidateId === 'string' ? candidate.candidateId : '',
        errors,
      });
    } else {
      validCandidates.push(candidate);
    }
  }
  const groups = new Map<string, CandidateCue[]>();
  for (const candidate of validCandidates) {
    const identityKey = candidate.stableRegionId
      ? `region:${candidate.stableRegionId}`
      : `candidate:${candidate.candidateId}`;
    const key = `${identityKey}|scenario:${candidate.scenarioType}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const merged = [...groups.entries()]
    .sort(([first], [second]) => compareCodeUnits(first, second))
    .map(([, group]) => mergeCandidateGroup(group));
  const allDecisions = [
    ...merged.map((candidate) => filterCandidateCue(candidate, policy, guardrails)),
    ...invalidDecisions,
  ].sort((first, second) =>
    compareCodeUnits(first.candidateId, second.candidateId) ||
    compareCodeUnits(first.status, second.status) ||
    compareCodeUnits(
      'errors' in first ? first.errors.join('|') : '',
      'errors' in second ? second.errors.join('|') : '',
    )
  );
  const visibleDecisions = allDecisions
    .filter(
      (decision): decision is DecidedCue =>
        (decision.status === 'DECIDED' || decision.status === 'DECIDED_WITH_FALLBACK') &&
        decision.effectiveAction.rank >= 2,
    )
    .sort((first, second) =>
      second.effectiveAction.rank - first.effectiveAction.rank ||
      Number(second.floorApplied) - Number(first.floorApplied) ||
      second.severityTier - first.severityTier ||
      second.likelihoodTier - first.likelihoodTier ||
      Number(second.awarenessGapTieBreak) - Number(first.awarenessGapTieBreak) ||
      compareCodeUnits(first.candidateId, second.candidateId),
    );
  return {
    allDecisions,
    visibleDecisions: visibleDecisions.slice(0, visibleLimit),
  };
}

export function actionWithAdditionalReason(
  action: PolicyAction,
  source: string,
  reason: string,
): PolicyAction {
  return mergeActionMetadata(action, source, reason);
}
