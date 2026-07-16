import type {
  CategoryResponse,
  Detection,
  NormalizedBox,
  NormalizedPoint,
  PixelPoint,
  PointSelection,
  ProbeSceneState,
} from '../types';

interface CreateSelectionInput {
  sceneId: string;
  clickNumber: number;
  normalizedPoint: NormalizedPoint;
  displayedPoint: PixelPoint;
  matchedDetections: Detection[];
  selectedDetection?: Detection;
  manualBox?: NormalizedBox;
  at?: string;
}

export function createPointSelection(input: CreateSelectionInput): PointSelection {
  const at = input.at ?? new Date().toISOString();
  const chosen = input.selectedDetection ?? input.matchedDetections[0];
  const autoCategoryId = chosen?.primaryCategoryId ?? null;
  return {
    selectionId: `${input.sceneId}-point-${input.clickNumber}-${at}`,
    sceneId: input.sceneId,
    clickNumber: input.clickNumber,
    normalizedPoint: input.normalizedPoint,
    displayedPoint: input.displayedPoint,
    manualBox: input.manualBox,
    matchedDetectionIds: input.matchedDetections.map((detection) => detection.id),
    selectedDetectionId: chosen?.id ?? null,
    autoCategoryId,
    finalCategoryId: autoCategoryId ?? 'other_not_sure',
    categoryCorrected: false,
    manualUnmatched: input.matchedDetections.length === 0,
    createdAt: at,
    updatedAt: at,
  };
}

export function defaultAwarenessStatusForCategory(
  selections: readonly PointSelection[],
  categoryId: string,
  firstOptionValue: number | undefined,
): number | null {
  if (firstOptionValue === undefined) return null;
  return selections.some((selection) => selection.finalCategoryId === categoryId)
    ? firstOptionValue
    : null;
}

export function isCategoryResponseComplete(response: CategoryResponse | undefined): boolean {
  return response?.awarenessStatus != null && response.preferredAction != null;
}

export function isSceneReviewComplete(
  sceneState: ProbeSceneState,
  availableCategoryIds: readonly string[],
): boolean {
  return (
    availableCategoryIds.length > 0 &&
    availableCategoryIds.every((categoryId) =>
      isCategoryResponseComplete(sceneState.categoryResponses[categoryId]),
    )
  );
}

export function isCategoryIndexUnlocked(
  sceneState: ProbeSceneState,
  categoryIndex: number,
): boolean {
  if (categoryIndex <= 0) return true;
  return sceneState.categoryOrder
    .slice(0, categoryIndex)
    .every((categoryId) => isCategoryResponseComplete(sceneState.categoryResponses[categoryId]));
}
