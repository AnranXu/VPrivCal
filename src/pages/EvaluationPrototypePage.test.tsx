import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EvaluationPrototypeLandingPage,
  StudyOneEvaluationPage,
  StudyTwoEvaluationPage,
} from './EvaluationPrototypePage';

const testState = vi.hoisted(() => ({
  updateSession: vi.fn(),
  session: {
    participantId: 'demo',
    q10Responses: {},
    probeScenes: {},
    evaluationPrototype: null,
  },
}));

vi.mock('../context/DataContext', () => ({
  useDataset: () => ({ dataset: { images: [] } }),
}));

vi.mock('../context/StudyContext', () => ({
  useStudy: () => ({
    session: testState.session,
    updateSession: testState.updateSession,
    expertReview: true,
  }),
}));

function renderRoute(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe('two-study evaluation prototype', () => {
  beforeEach(() => {
    cleanup();
    testState.updateSession.mockReset();
    testState.session.evaluationPrototype = null;
  });

  it('offers separate predictive and experiential study flows after calibration', () => {
    renderRoute(<EvaluationPrototypeLandingPage />);

    expect(screen.getByRole('heading', { name: 'Predictive effectiveness' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Reminder experience' })).toBeVisible();
    expect(screen.getByText('Profile details remain hidden')).toBeVisible();
  });

  it('keeps policy output hidden while Study 1 collects target decisions', () => {
    renderRoute(<StudyOneEvaluationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Begin candidate review' }));

    expect(screen.getByRole('heading', { name: 'Review every candidate detection' })).toBeVisible();
    expect(screen.queryByText('Privacy reminder')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Surface this candidate/ })).toBeVisible();
  });

  it('uses the planned seven-point clip ratings in Study 2', () => {
    renderRoute(<StudyTwoEvaluationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Begin task experience' }));
    fireEvent.change(screen.getByLabelText('Which item is due on Friday?'), {
      target: { value: 'Design package' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete clip and rate behavior' }));

    expect(screen.getByRole('heading', { name: 'Rate the assistant’s reminder behavior' })).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(28);
  });
});
