import { describe, expect, it } from 'vitest';
import {
  summarizeHeldOutAcceptance,
  type HeldOutAcceptanceObservation,
} from './heldOutAcceptance';

const observations: HeldOutAcceptanceObservation[] = [
  {
    participantId: 'p1',
    cueId: 'c1',
    policyCondition: 'generic',
    systemDecision: 'SHOW_REMINDER',
    participantPreferredDecision: 'SHOW_REMINDER',
    acceptanceRating: 5,
    reminderBurdenRating: 1,
  },
  {
    participantId: 'p1',
    cueId: 'c2',
    policyCondition: 'q10_only',
    systemDecision: 'SHOW_REMINDER',
    participantPreferredDecision: 'NO_REMINDER',
    acceptanceRating: 2,
    reminderBurdenRating: 4,
  },
  {
    participantId: 'p1',
    cueId: 'c3',
    policyCondition: 'full_vprivcal',
    systemDecision: 'NO_REMINDER',
    participantPreferredDecision: 'SHOW_REMINDER',
    acceptanceRating: 1,
  },
];

describe('held-out acceptance summary', () => {
  it('separates agreement, false reminders, missed reminders, acceptance, and burden', () => {
    const summary = summarizeHeldOutAcceptance(observations);

    expect(summary.overall).toMatchObject({
      observations: 3,
      agreementCount: 1,
      agreementRate: 1 / 3,
      falseReminderCount: 1,
      falseReminderRate: 1 / 3,
      missedReminderCount: 1,
      missedReminderRate: 1 / 3,
      meanAcceptance: 8 / 3,
      meanReminderBurden: 2.5,
    });
    expect(summary.byCondition.full_vprivcal).toMatchObject({
      observations: 1,
      missedReminderCount: 1,
      meanReminderBurden: null,
    });
    expect(summary.interpretation).toMatch(/does not establish long-term/i);
  });

  it('returns explicit empty-condition metrics and rejects invalid ratings', () => {
    const summary = summarizeHeldOutAcceptance([observations[0]]);
    expect(summary.byCondition.q10_only).toMatchObject({
      observations: 0,
      agreementRate: 0,
      meanAcceptance: 0,
      meanReminderBurden: null,
    });

    expect(() =>
      summarizeHeldOutAcceptance([
        { ...observations[0], acceptanceRating: 6 as HeldOutAcceptanceObservation['acceptanceRating'] },
      ]),
    ).toThrow(/1 to 5/);
  });
});
