import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { q10Questions } from '../questions';
import { makeCategoryResponse, parseDataset } from '../test/fixtures';
import { buildCategoryCsv, buildResponseExport, validateResponseExport } from './export';
import { createEmptySession, initializeParticipantSession } from './storage';

const dataset = parseDataset(
  readFileSync(resolve(process.cwd(), 'public/data/vprivcal_detections.json'), 'utf8'),
);

function completeSession() {
  const initialized = initializeParticipantSession(
    createEmptySession(dataset.images.map((scene) => scene.id)),
    'test-participant',
    dataset.images,
  );
  initialized.q10StartedAt = '2026-07-15T00:00:00.000Z';
  initialized.q10CompletedAt = '2026-07-15T00:01:00.000Z';
  initialized.probeHintCompletedAt = '2026-07-15T00:01:30.000Z';
  initialized.probeStartedAt = '2026-07-15T00:01:30.000Z';
  initialized.probeCompletedAt = '2026-07-15T00:05:30.000Z';
  for (const question of q10Questions) {
    initialized.q10Responses[question.id] = {
      questionId: question.id,
      value: question.options[0].value,
      label: question.options[0].label,
      firstViewedAt: '2026-07-15T00:00:00.000Z',
      answeredAt: '2026-07-15T00:00:01.000Z',
      changes: 0,
    };
  }
  for (const scene of dataset.images) {
    const state = initialized.probeScenes[scene.id];
    state.startedAt = '2026-07-15T00:01:00.000Z';
    state.completedAt = '2026-07-15T00:02:00.000Z';
    state.phase = 'complete';
    state.categoryResponses = Object.fromEntries(
      state.categoryOrder.map((categoryId, index) => [
        categoryId,
        {
          ...makeCategoryResponse(scene.id, categoryId, index),
          linkedDetectionIds:
            scene.categoryEvidence.find((evidence) => evidence.categoryId === categoryId)
              ?.detectionIds ?? [],
        },
      ]),
    );
  }
  initialized.profileConfirmation = {
    value: 'matches',
    answeredAt: '2026-07-15T00:03:00.000Z',
  };
  initialized.completedAt = '2026-07-15T00:03:00.000Z';
  return initialized;
}

describe('response export', () => {
  it('validates a complete response and produces one CSV row per category-image pair', () => {
    const response = buildResponseExport(completeSession(), dataset);
    expect(validateResponseExport(response, dataset)).toEqual({ valid: true, errors: [] });
    const expectedPairs = dataset.images.reduce(
      (sum, scene) => sum + scene.availableCategoryIds.length,
      0,
    );
    expect(response.probe.flatMap((scene) => scene.categoryResponses)).toHaveLength(expectedPairs);
    expect(buildCategoryCsv(response, dataset).trim().split(/\r?\n/)).toHaveLength(expectedPairs + 1);
    expect(response.timing).toMatchObject({
      probeStartedAt: '2026-07-15T00:01:30.000Z',
      probeCompletedAt: '2026-07-15T00:05:30.000Z',
      probeDurationMs: 240_000,
    });
  });

  it('rejects an export that omits an available category', () => {
    const response = buildResponseExport(completeSession(), dataset);
    response.probe[0].categoryResponses.pop();
    const validation = validateResponseExport(response, dataset);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes('requires exactly one response'))).toBe(true);
  });

  it('does not require a profile confirmation while the profile page is hidden', () => {
    const session = completeSession();
    session.profileConfirmation = null;
    const response = buildResponseExport(session, dataset);

    expect(validateResponseExport(response, dataset)).toEqual({ valid: true, errors: [] });
  });
});

