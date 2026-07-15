import type { Detection, NormalizedBox, NormalizedPoint, PixelPoint } from '../types';

export interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function clientPointToNormalized(
  clientPoint: PixelPoint,
  imageRect: ImageRect,
): NormalizedPoint | null {
  if (
    imageRect.width <= 0 ||
    imageRect.height <= 0 ||
    clientPoint.x < imageRect.left ||
    clientPoint.y < imageRect.top ||
    clientPoint.x > imageRect.left + imageRect.width ||
    clientPoint.y > imageRect.top + imageRect.height
  ) {
    return null;
  }

  return {
    x: clamp01((clientPoint.x - imageRect.left) / imageRect.width),
    y: clamp01((clientPoint.y - imageRect.top) / imageRect.height),
  };
}

export function normalizedPointToPixels(
  point: NormalizedPoint,
  imageRect: Pick<ImageRect, 'width' | 'height'>,
): PixelPoint {
  return { x: point.x * imageRect.width, y: point.y * imageRect.height };
}

export function boxArea(box: NormalizedBox): number {
  return box.width * box.height;
}

export function pointInBox(
  point: NormalizedPoint,
  box: NormalizedBox,
  padding = 0,
): boolean {
  return (
    point.x >= box.x - padding &&
    point.x <= box.x + box.width + padding &&
    point.y >= box.y - padding &&
    point.y <= box.y + box.height + padding
  );
}

export function hitTestDetections(
  point: NormalizedPoint,
  detections: readonly Detection[],
  padding = 0,
): Detection[] {
  return detections
    .filter((detection) => detection.clickable && pointInBox(point, detection.bbox, padding))
    .sort((first, second) => boxArea(first.bbox) - boxArea(second.bbox));
}

export function smallestDetectionCandidates(matches: readonly Detection[]): Detection[] {
  if (matches.length === 0) return [];
  const minimumArea = boxArea(matches[0].bbox);
  return matches.filter((match) => Math.abs(boxArea(match.bbox) - minimumArea) < 1e-9);
}

export function createManualBox(
  point: NormalizedPoint,
  width = 0.1,
  height = 0.1,
): NormalizedBox {
  const clampedWidth = Math.min(0.35, Math.max(0.03, width));
  const clampedHeight = Math.min(0.35, Math.max(0.03, height));
  return {
    x: clamp01(Math.min(point.x - clampedWidth / 2, 1 - clampedWidth)),
    y: clamp01(Math.min(point.y - clampedHeight / 2, 1 - clampedHeight)),
    width: clampedWidth,
    height: clampedHeight,
  };
}

