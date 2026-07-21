import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VPrivCalDataset } from '../types';
import { ProbeHintMode } from './ProbeHintMode';

const dataset: VPrivCalDataset = {
  schemaVersion: 'test',
  coordinateSystem: {
    type: 'normalized_xywh',
    origin: 'top-left',
    range: [0, 1],
    imageAspectRatio: '7:5',
    hitPadding: 0,
  },
  categories: [
    { id: 'pii', label: 'PII', description: 'Personal records.' },
    { id: 'personal_life', label: 'Personal Life', description: 'Private activities.' },
  ],
  probeQuestions: {
    awarenessStatus: {
      id: 'awareness',
      prompt: 'Awareness?',
      options: [
        { value: 1, label: 'Already noticed' },
        { value: 2, label: 'Noticed without considering privacy' },
      ],
    },
    preferredAction: {
      id: 'action',
      prompt: 'Action?',
      options: [
        { value: 0, label: 'Do not show reminders for this category' },
        {
          value: 1,
          label: 'Show reminders only when identifying or sensitive details are exposed',
        },
        { value: 2, label: 'Show reminders whenever this verified category is present' },
      ],
    },
  },
  images: [],
};

describe('ProbeHintMode', () => {
  it('uses direct next controls and keeps practice question choices disabled', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const { container } = render(
      <ProbeHintMode dataset={dataset} onExit={onExit} required />,
    );

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      'You are in Hint mode of Stage 2',
    );
    expect(container.querySelector('.probe-workspace')).toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: 'Start Hint Mode' }));
    expect(container.querySelector('.probe-workspace')).not.toHaveAttribute('inert');
    expect(screen.getByText('You are in Hint mode')).toBeVisible();
    const pointHeading = screen.getByRole('heading', { name: 'Place a practice point' });
    const imageColumn = container.querySelector('.probe-image-column');
    const sidebar = container.querySelector('.probe-sidebar');
    expect(pointHeading).toBeVisible();
    expect(pointHeading.closest('.probe-hint-callout')).toHaveClass('is-image');
    expect(imageColumn).toContainElement(pointHeading.closest('.probe-hint-callout'));
    expect(container.querySelector('.probe-hint-banner')).not.toBeInTheDocument();
    expect(imageColumn).not.toHaveAttribute('inert');
    expect(container.querySelector('.probe-sidebar')).toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: 'Exit hint' })).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(pointHeading.closest('section')));

    await user.click(screen.getByRole('button', { name: 'Next hint' }));

    const deleteHeading = screen.getByRole('heading', { name: 'Delete the practice point' });
    expect(deleteHeading).toBeVisible();
    expect(deleteHeading.closest('.probe-hint-callout')).toHaveClass('is-delete');
    expect(sidebar).toContainElement(deleteHeading.closest('.probe-hint-callout'));
    expect(screen.getByRole('heading', { name: '1 selected' })).toBeVisible();
    expect(imageColumn).toHaveAttribute('inert');
    expect(sidebar).not.toHaveAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(deleteHeading.closest('section')));

    expect(screen.getByRole('button', { name: 'Next hint' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const reviewHeading = screen.getByRole('heading', { name: 'Move to the privacy review' });
    expect(reviewHeading).toBeVisible();
    expect(reviewHeading.closest('.probe-hint-callout')).toHaveClass('is-review');
    await waitFor(() => expect(document.activeElement).toBe(reviewHeading.closest('section')));

    await user.click(screen.getByRole('button', { name: 'Next hint' }));
    const answerHeading = screen.getByRole('heading', { name: 'Preview the review questions' });
    expect(answerHeading).toBeVisible();
    expect(answerHeading.closest('.probe-hint-callout')).toHaveClass('is-answer');
    expect(screen.getByRole('radio', { name: 'Already noticed' })).toBeDisabled();
    expect(
      screen.getByRole('radio', {
        name: 'Show reminders only when identifying or sensitive details are exposed',
      }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next hint' }));
    const nextHeading = screen.getByRole('heading', {
      name: 'Preview moving to the next item',
    });
    expect(nextHeading).toBeVisible();
    expect(nextHeading.closest('.probe-hint-callout')).toHaveClass('is-next');

    await user.click(screen.getByRole('button', { name: 'Next hint' }));
    const completeHeading = screen.getByRole('heading', { name: 'Practice complete' });
    expect(completeHeading).toBeVisible();
    expect(completeHeading.closest('.probe-hint-callout')).toHaveClass('is-complete');
    expect(sidebar).not.toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'Finish hint and begin Probe' }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledWith(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, 10000);
});
