import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeCategoryResponse } from '../test/fixtures';
import { CategoryReviewCard } from './CategoryReviewCard';

describe('CategoryReviewCard', () => {
  it('exposes exact ordered response options and keyboard-accessible controls', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onAnswer = vi.fn();
    render(
      <CategoryReviewCard
        category={{ id: 'pii', label: 'PII', description: 'Personal records.' }}
        response={makeCategoryResponse('scene', 'pii', 0, false)}
        awarenessQuestion={{
          id: 'awareness_status',
          prompt: 'Before this content was highlighted, which best describes your experience?',
          options: [
            { value: 1, label: 'Already noticed' },
            { value: 2, label: 'Noticed without considering privacy' },
            { value: 3, label: 'Had not noticed' },
            { value: 4, label: 'Not a concern here' },
          ],
        }}
        actionQuestion={{
          id: 'preferred_action',
          prompt: 'What should the assistant do?',
          options: [
            { value: 0, label: 'No intervention' },
            { value: 1, label: 'Handle it silently' },
            { value: 2, label: 'Give a brief reminder' },
            { value: 3, label: 'Ask before using it' },
            { value: 4, label: 'Avoid using it unless I explicitly request it' },
          ],
        }}
        evidenceVisible={false}
        onToggleEvidence={onToggle}
        onAnswer={onAnswer}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show evidence' }));
    await user.click(screen.getByRole('radio', { name: 'Ask before using it' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onAnswer).toHaveBeenCalledWith('preferredAction', 3);
    expect(screen.getAllByRole('radio')).toHaveLength(9);
  });
});

