import { describe, expect, it } from 'vitest';
import { q10Questions } from './questions';

describe('Q10 question options', () => {
  it('uses one five-point agreement format for Q7-Q10', () => {
    const agreementQuestions = q10Questions.slice(6);

    expect(agreementQuestions.map(({ id, options }) => [id, options.map(({ value }) => value)])).toEqual([
      ['Q7', [1, 2, 3, 4, 5]],
      ['Q8', [1, 2, 3, 4, 5]],
      ['Q9', [1, 2, 3, 4, 5]],
      ['Q10', [1, 2, 3, 4, 5]],
    ]);
    expect(agreementQuestions.every(({ prompt }) => (
      prompt === 'How much do you agree with the following statement?'
    ))).toBe(true);
    expect(agreementQuestions[0].options.map(({ label }) => label)).toEqual([
      'Strongly disagree',
      'Disagree',
      'Neither agree nor disagree',
      'Agree',
      'Strongly agree',
    ]);
    expect(agreementQuestions.every(({ statement }) => Boolean(statement))).toBe(true);
    expect(agreementQuestions[1].title).toBe('General reminder sensitivity');
    expect(agreementQuestions[1].statement).toBe(
      'In general, the assistant should show detected privacy threats to the user.',
    );
    expect(agreementQuestions[1].policyParameter).toBe('general_reminder_agreement');
  });
});
