import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProbeInterfaceHint } from './ProbeInterfaceHint';

describe('ProbeInterfaceHint', () => {
  it('starts the interactive interface hint', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<ProbeInterfaceHint onStart={onStart} />);

    await user.click(screen.getByRole('button', { name: 'View interactive hint' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
