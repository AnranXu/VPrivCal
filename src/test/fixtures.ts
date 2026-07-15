import type {
  CategoryResponse,
  Detection,
  NormalizedBox,
  ProbeScene,
  VPrivCalDataset,
} from '../types';

export function makeDetection(
  id: string,
  primaryCategoryId: string,
  bbox: NormalizedBox,
  clickable = true,
): Detection {
  return {
    id,
    label: id,
    primaryCategoryId,
    categoryIds: [primaryCategoryId],
    subcategory: 'fixture',
    bbox,
    clickable,
    description: 'Test detection',
  };
}

export function makeCategoryResponse(
  sceneId: string,
  categoryId: string,
  presentationOrder: number,
  complete = true,
): CategoryResponse {
  return {
    sceneId,
    categoryId,
    presentationOrder,
    linkedDetectionIds: [],
    spontaneouslySelected: false,
    awarenessStatus: complete ? 1 : null,
    preferredAction: complete ? 2 : null,
    evidenceOpened: false,
    evidenceToggleCount: 0,
    changes: 0,
    firstViewedAt: '2026-07-15T00:00:00.000Z',
    answeredAt: complete ? '2026-07-15T00:00:01.000Z' : null,
    durationMs: complete ? 1000 : 0,
  };
}

export function makeScene(id: string, categoryIds: string[]): ProbeScene {
  return {
    id,
    fileName: `${id}.png`,
    assetPath: `/assets/images/${id}.png`,
    width: 1000,
    height: 750,
    scenarioType: 'private',
    title: id,
    context: 'Fixture context',
    availableCategoryIds: categoryIds,
    categoryEvidence: categoryIds.map((categoryId) => ({ categoryId, detectionIds: [] })),
    detections: [],
  };
}

export function parseDataset(raw: string): VPrivCalDataset {
  return JSON.parse(raw) as VPrivCalDataset;
}

