import { describe, expect, it } from 'vitest';
import { elapsedTimeBetween, formatElapsedTime } from './time';

describe('participant elapsed-time display', () => {
  it('formats elapsed time as a stable clock', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
    expect(formatElapsedTime(65_999)).toBe('01:05');
    expect(formatElapsedTime(3_661_000)).toBe('01:01:01');
  });

  it('calculates resumable elapsed time from timestamps', () => {
    expect(
      elapsedTimeBetween('2026-07-15T00:00:00.000Z', null, Date.parse('2026-07-15T00:02:03.000Z')),
    ).toBe(123_000);
    expect(
      elapsedTimeBetween(
        '2026-07-15T00:00:00.000Z',
        '2026-07-15T00:00:42.000Z',
        Date.parse('2026-07-15T00:10:00.000Z'),
      ),
    ).toBe(42_000);
  });
});
