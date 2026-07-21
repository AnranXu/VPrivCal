import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProbeInstructionsPage } from './ProbeInstructionsPage';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../context/StudyContext', () => ({
  useStudy: () => ({
    session: { randomizedSceneOrder: ['scene_public_cafe'] },
  }),
}));

vi.mock('../components/ProbeInterfaceHint', () => ({
  ProbeInterfaceHint: () => <button type="button">View Hint mode</button>,
}));

describe('ProbeInstructionsPage', () => {
  it('marks the first Probe page as Stage II', () => {
    render(<ProbeInstructionsPage />);

    expect(screen.getByLabelText('Stage II: Probe')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Point first, review second' })).toBeVisible();
  });
});
