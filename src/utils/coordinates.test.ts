import { describe, expect, it } from 'vitest';
import {
  clientPointToNormalized,
  createManualBox,
  hitTestDetections,
  smallestDetectionCandidates,
} from './coordinates';
import { makeDetection } from '../test/fixtures';

describe('coordinate conversion', () => {
  it.each([
    [{ x: 100, y: 50 }, { left: 0, top: 0, width: 200, height: 100 }, { x: 0.5, y: 0.5 }],
    [{ x: 824, y: 593 }, { left: 100, top: 50, width: 1448, height: 1086 }, { x: 0.5, y: 0.5 }],
    [{ x: 1124, y: 818 }, { left: 100, top: 50, width: 1024, height: 768 }, { x: 1, y: 1 }],
  ])('converts rendered point %# to normalized coordinates', (point, rect, expected) => {
    expect(clientPointToNormalized(point, rect)).toEqual(expected);
  });

  it('ignores points in padding outside the displayed image', () => {
    expect(
      clientPointToNormalized(
        { x: 49, y: 75 },
        { left: 50, top: 25, width: 400, height: 300 },
      ),
    ).toBeNull();
  });
});

describe('detection hit testing', () => {
  const broad = makeDetection('broad', 'personal_life', {
    x: 0.1,
    y: 0.1,
    width: 0.7,
    height: 0.7,
  });
  const specific = makeDetection('specific', 'pii', {
    x: 0.4,
    y: 0.4,
    width: 0.1,
    height: 0.1,
  });

  it('returns every overlapping hit with the smallest region first', () => {
    expect(hitTestDetections({ x: 0.45, y: 0.45 }, [broad, specific]).map((item) => item.id))
      .toEqual(['specific', 'broad']);
  });

  it('returns equally specific candidates so different categories can be resolved', () => {
    const equal = makeDetection('equal', 'biometric_data', specific.bbox);
    const matches = hitTestDetections({ x: 0.45, y: 0.45 }, [broad, equal, specific]);
    expect(smallestDetectionCandidates(matches).map((item) => item.id)).toEqual([
      'equal',
      'specific',
    ]);
  });

  it('creates a bounded manual region for an unmatched edge click', () => {
    expect(createManualBox({ x: 0.99, y: 0.01 }, 0.1, 0.08)).toEqual({
      x: 0.9,
      y: 0,
      width: 0.1,
      height: 0.08,
    });
  });
});

