import { describe, expect, it } from 'vitest';
import { makeCategoryResponse, makeDetection } from '../test/fixtures';
import {
  createPointSelection,
  defaultAwarenessStatusForCategory,
  isCategoryIndexUnlocked,
  isSceneReviewComplete,
} from './probe';
import type { ProbeSceneState } from '../types';

describe('point selections', () => {
  it('keeps matched detection mapping internal without participant correction', () => {
    const detection = makeDetection('report-card', 'pii', {
      x: 0.2,
      y: 0.3,
      width: 0.2,
      height: 0.2,
    });
    const selection = createPointSelection({
      sceneId: 'scene-1',
      clickNumber: 1,
      normalizedPoint: { x: 0.3, y: 0.4 },
      displayedPoint: { x: 300, y: 300 },
      matchedDetections: [detection],
      at: '2026-07-15T00:00:00.000Z',
    });
    expect(selection.autoCategoryId).toBe('pii');
    expect(selection.finalCategoryId).toBe('pii');
    expect(selection.categoryCorrected).toBe(false);
  });

  it('defaults awareness to the first option only for a category the participant pointed to', () => {
    const detection = makeDetection('report-card', 'pii', {
      x: 0.2,
      y: 0.3,
      width: 0.2,
      height: 0.2,
    });
    const selection = createPointSelection({
      sceneId: 'scene-1',
      clickNumber: 1,
      normalizedPoint: { x: 0.3, y: 0.4 },
      displayedPoint: { x: 300, y: 300 },
      matchedDetections: [detection],
      at: '2026-07-15T00:00:00.000Z',
    });

    expect(defaultAwarenessStatusForCategory([selection], 'pii', 1)).toBe(1);
    expect(defaultAwarenessStatusForCategory([selection], 'children_images', 1)).toBeNull();
    expect(defaultAwarenessStatusForCategory([selection], 'pii', undefined)).toBeNull();
  });

  it('stores an unmatched point immediately without requiring a predefined region', () => {
    const selection = createPointSelection({
      sceneId: 'scene-1',
      clickNumber: 2,
      normalizedPoint: { x: 0.9, y: 0.9 },
      displayedPoint: { x: 900, y: 675 },
      matchedDetections: [],
      at: '2026-07-15T00:00:00.000Z',
    });
    expect(selection.manualUnmatched).toBe(true);
    expect(selection.matchedDetectionIds).toEqual([]);
    expect(selection.manualBox).toBeUndefined();
    expect(selection.autoCategoryId).toBeNull();
    expect(selection.finalCategoryId).toBe('other_not_sure');
    expect(selection.categoryCorrected).toBe(false);
  });
});

describe('category-complete scene review', () => {
  it('requires every available category exactly once before completion', () => {
    const state: ProbeSceneState = {
      sceneId: 'scene-1',
      startedAt: '2026-07-15T00:00:00.000Z',
      completedAt: null,
      phase: 'review',
      pointSelections: [],
      noAdditionalSelected: true,
      listModeOpened: false,
      categoryOrder: ['pii', 'biometric_data'],
      categoryResponses: {
        pii: makeCategoryResponse('scene-1', 'pii', 0),
        biometric_data: makeCategoryResponse('scene-1', 'biometric_data', 1, false),
      },
      activeCategoryIndex: 1,
    };
    expect(isSceneReviewComplete(state, ['pii', 'biometric_data'])).toBe(false);
    state.categoryResponses.biometric_data = makeCategoryResponse(
      'scene-1',
      'biometric_data',
      1,
    );
    expect(isSceneReviewComplete(state, ['pii', 'biometric_data'])).toBe(true);
    expect(isSceneReviewComplete(state, ['pii', 'biometric_data', 'personal_life'])).toBe(false);
  });

  it('unlocks category steps only after every earlier category is complete', () => {
    const state: ProbeSceneState = {
      sceneId: 'scene-1',
      startedAt: '2026-07-15T00:00:00.000Z',
      completedAt: null,
      phase: 'review',
      pointSelections: [],
      noAdditionalSelected: true,
      listModeOpened: false,
      categoryOrder: ['pii', 'biometric_data', 'personal_life'],
      categoryResponses: {
        pii: makeCategoryResponse('scene-1', 'pii', 0, false),
        biometric_data: makeCategoryResponse('scene-1', 'biometric_data', 1, false),
        personal_life: makeCategoryResponse('scene-1', 'personal_life', 2, false),
      },
      activeCategoryIndex: 0,
    };

    expect(isCategoryIndexUnlocked(state, 0)).toBe(true);
    expect(isCategoryIndexUnlocked(state, 1)).toBe(false);
    state.categoryResponses.pii = makeCategoryResponse('scene-1', 'pii', 0);
    expect(isCategoryIndexUnlocked(state, 1)).toBe(true);
    expect(isCategoryIndexUnlocked(state, 2)).toBe(false);
    state.categoryResponses.biometric_data = makeCategoryResponse(
      'scene-1',
      'biometric_data',
      1,
    );
    expect(isCategoryIndexUnlocked(state, 2)).toBe(true);
  });
});
