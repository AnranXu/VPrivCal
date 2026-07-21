import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HintModeActiveAlert } from './HintModeActiveAlert';

describe('HintModeActiveAlert', () => {
  it('clearly announces Hint mode before practice starts', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<HintModeActiveAlert onContinue={onContinue} />);

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      'You are in Hint mode of Stage II',
    );
    expect(screen.getByText(/starting Stage II: VPrivCal-Probe/)).toBeVisible();
    expect(screen.getByText(/complete a short interaction hint/)).toBeVisible();
    expect(screen.getByText(/continue with the Probe questions/)).toBeVisible();
    expect(screen.queryByText('Practice only')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Hint Mode' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
