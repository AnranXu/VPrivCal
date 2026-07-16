import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDataset } from '../test/fixtures';

const dataset = parseDataset(
  readFileSync(resolve(process.cwd(), 'public/data/vprivcal_detections.json'), 'utf8'),
);

describe('VPrivCal detection data', () => {
  it('assigns every detection to exactly one representative category', () => {
    for (const scene of dataset.images) {
      const evidenceOwners = new Map<string, string[]>();
      for (const evidence of scene.categoryEvidence) {
        for (const detectionId of evidence.detectionIds) {
          evidenceOwners.set(detectionId, [
            ...(evidenceOwners.get(detectionId) ?? []),
            evidence.categoryId,
          ]);
        }
      }

      for (const detection of scene.detections) {
        expect(detection.categoryIds, detection.id).toEqual([detection.primaryCategoryId]);
        expect(evidenceOwners.get(detection.id), detection.id).toEqual([
          detection.primaryCategoryId,
        ]);
      }
    }
  });

  it('contains no duplicate regions within a scene', () => {
    for (const scene of dataset.images) {
      const regionKeys = scene.detections.map(({ bbox }) =>
        [bbox.x, bbox.y, bbox.width, bbox.height].join(','),
      );
      expect(new Set(regionKeys).size, scene.id).toBe(regionKeys.length);
    }
  });
});
