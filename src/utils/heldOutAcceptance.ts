import type { ReminderDecision } from './policyFilter';

export type PolicyCondition = 'generic' | 'q10_only' | 'full_vprivcal';
export type AcceptanceRating = 1 | 2 | 3 | 4 | 5;

export interface HeldOutAcceptanceObservation {
  participantId: string;
  cueId: string;
  policyCondition: PolicyCondition;
  systemDecision: ReminderDecision;
  participantPreferredDecision: ReminderDecision;
  acceptanceRating: AcceptanceRating;
  reminderBurdenRating?: AcceptanceRating;
}

export interface HeldOutAcceptanceMetrics {
  observations: number;
  agreementCount: number;
  agreementRate: number;
  falseReminderCount: number;
  falseReminderRate: number;
  missedReminderCount: number;
  missedReminderRate: number;
  meanAcceptance: number;
  meanReminderBurden: number | null;
}

export interface HeldOutAcceptanceSummary {
  interpretation: string;
  overall: HeldOutAcceptanceMetrics;
  byCondition: Record<PolicyCondition, HeldOutAcceptanceMetrics>;
}

const CONDITIONS: readonly PolicyCondition[] = ['generic', 'q10_only', 'full_vprivcal'];
const DECISIONS: readonly ReminderDecision[] = ['NO_REMINDER', 'SHOW_REMINDER'];

function validateObservation(observation: HeldOutAcceptanceObservation): void {
  if (!observation.participantId.trim()) throw new Error('participantId is required.');
  if (!observation.cueId.trim()) throw new Error('cueId is required.');
  if (!CONDITIONS.includes(observation.policyCondition)) {
    throw new Error(`Unsupported policy condition: ${observation.policyCondition}.`);
  }
  if (!DECISIONS.includes(observation.systemDecision)) {
    throw new Error(`Unsupported system decision: ${observation.systemDecision}.`);
  }
  if (!DECISIONS.includes(observation.participantPreferredDecision)) {
    throw new Error(
      `Unsupported participant preferred decision: ${observation.participantPreferredDecision}.`,
    );
  }
  if (!Number.isInteger(observation.acceptanceRating) || observation.acceptanceRating < 1 || observation.acceptanceRating > 5) {
    throw new Error('acceptanceRating must be an integer from 1 to 5.');
  }
  if (
    observation.reminderBurdenRating !== undefined &&
    (!Number.isInteger(observation.reminderBurdenRating) ||
      observation.reminderBurdenRating < 1 ||
      observation.reminderBurdenRating > 5)
  ) {
    throw new Error('reminderBurdenRating must be an integer from 1 to 5 when supplied.');
  }
}

function metrics(observations: readonly HeldOutAcceptanceObservation[]): HeldOutAcceptanceMetrics {
  const count = observations.length;
  if (count === 0) {
    return {
      observations: 0,
      agreementCount: 0,
      agreementRate: 0,
      falseReminderCount: 0,
      falseReminderRate: 0,
      missedReminderCount: 0,
      missedReminderRate: 0,
      meanAcceptance: 0,
      meanReminderBurden: null,
    };
  }
  const agreementCount = observations.filter(
    ({ systemDecision, participantPreferredDecision }) =>
      systemDecision === participantPreferredDecision,
  ).length;
  const falseReminderCount = observations.filter(
    ({ systemDecision, participantPreferredDecision }) =>
      systemDecision === 'SHOW_REMINDER' && participantPreferredDecision === 'NO_REMINDER',
  ).length;
  const missedReminderCount = observations.filter(
    ({ systemDecision, participantPreferredDecision }) =>
      systemDecision === 'NO_REMINDER' && participantPreferredDecision === 'SHOW_REMINDER',
  ).length;
  const burden = observations.flatMap(({ reminderBurdenRating }) =>
    reminderBurdenRating === undefined ? [] : [reminderBurdenRating],
  );
  return {
    observations: count,
    agreementCount,
    agreementRate: agreementCount / count,
    falseReminderCount,
    falseReminderRate: falseReminderCount / count,
    missedReminderCount,
    missedReminderRate: missedReminderCount / count,
    meanAcceptance:
      observations.reduce((total, { acceptanceRating }) => total + acceptanceRating, 0) / count,
    meanReminderBurden:
      burden.length === 0 ? null : burden.reduce((total, value) => total + value, 0) / burden.length,
  };
}

export function summarizeHeldOutAcceptance(
  observations: readonly HeldOutAcceptanceObservation[],
): HeldOutAcceptanceSummary {
  observations.forEach(validateObservation);
  return {
    interpretation:
      'Immediate cue-level acceptance and binary reminder-decision alignment; this short-video measure does not establish long-term behavior or effectiveness.',
    overall: metrics(observations),
    byCondition: Object.fromEntries(
      CONDITIONS.map((condition) => [
        condition,
        metrics(observations.filter(({ policyCondition }) => policyCondition === condition)),
      ]),
    ) as Record<PolicyCondition, HeldOutAcceptanceMetrics>,
  };
}
