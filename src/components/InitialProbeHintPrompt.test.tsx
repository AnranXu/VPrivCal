import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InitialProbeHintPrompt } from './InitialProbeHintPrompt';

describe('InitialProbeHintPrompt', () => {
  it('requires the participant to open Hint mode before the first Probe', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<InitialProbeHintPrompt onStart={onStart} />);

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Please first view Hint mode');
    expect(screen.getByText(/Hint time is not included/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'View Hint mode' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
