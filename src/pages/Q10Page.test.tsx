import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Q10Page } from './Q10Page';

const testState = vi.hoisted(() => ({
  activeIndex: 0,
  navigate: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => testState.navigate,
}));

vi.mock('../context/StudyContext', () => ({
  useStudy: () => ({
    session: {
      q10ActiveIndex: testState.activeIndex,
      q10Responses: {},
      q10FirstViewedAt: {},
      q10StartedAt: null,
    },
    updateSession: testState.updateSession,
  }),
}));

describe('Q10Page', () => {
  beforeEach(() => {
    cleanup();
    testState.activeIndex = 0;
    testState.navigate.mockReset();
    testState.updateSession.mockReset();
  });

  it('does not display internal numeric option values', () => {
    const { container } = render(<Q10Page />);

    expect(screen.getByLabelText('Stage I: Questions')).toBeVisible();
    expect(container.querySelector('.option-number')).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('shows the five-point agreement interface for Q7', () => {
    testState.activeIndex = 6;
    render(<Q10Page />);

    expect(screen.queryByLabelText('Stage I: Questions')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('How much do you agree with the following statement?')).toBeVisible();
    expect(screen.getByText(
      'The assistant should show a privacy reminder when a visual cue supports a sensitive inference.',
    )).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Strongly agree' })).toBeVisible();
    expect(screen.queryByText('1', { exact: true })).not.toBeInTheDocument();
  });
});
