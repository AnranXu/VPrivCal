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
            { value: 0, label: 'Do not show reminders for this category' },
            {
              value: 1,
              label: 'Show reminders only when identifying or sensitive details are exposed',
            },
            { value: 2, label: 'Show reminders whenever this verified category is present' },
          ],
        }}
        contentLabels={['Student report card']}
        evidenceVisible={false}
        onToggleEvidence={onToggle}
        onAnswer={onAnswer}
      />,
    );
    expect(screen.getByText('Specific highlighted content')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Student report card' })).toBeVisible();
    expect(screen.queryByText('PII')).not.toBeInTheDocument();
    expect(screen.queryByText('Personal records.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show highlight' }));
    await user.click(
      screen.getByRole('radio', {
        name: 'Show reminders only when identifying or sensitive details are exposed',
      }),
    );
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onAnswer).toHaveBeenCalledWith('preferredAction', 1);
    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  it('can restore category identity presentation when the configuration is enabled', () => {
    render(
      <CategoryReviewCard
        category={{ id: 'pii', label: 'PII', description: 'Personal records.' }}
        response={makeCategoryResponse('scene', 'pii', 0, false)}
        awarenessQuestion={{ id: 'awareness', prompt: 'Awareness?', options: [] }}
        actionQuestion={{ id: 'action', prompt: 'Action?', options: [] }}
        evidenceVisible
        showCategoryIdentity
        onToggleEvidence={vi.fn()}
        onAnswer={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'PII' })).toBeVisible();
    expect(screen.getByText('Personal records.')).toBeVisible();
  });
});

