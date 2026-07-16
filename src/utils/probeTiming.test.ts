import { describe, expect, it } from 'vitest';
import { createEmptySession } from './storage';
import { recordInitialHintCompletion, recordProbeCompletion } from './probeTiming';

describe('Probe timing boundaries', () => {
  it('starts once when the initial Hint mode is completed and stops once after the Probe', () => {
    const hintCompletedAt = '2026-07-16T00:01:00.000Z';
    const probeCompletedAt = '2026-07-16T00:08:30.000Z';
    const started = recordInitialHintCompletion(createEmptySession(), hintCompletedAt);
    const completed = recordProbeCompletion(started, probeCompletedAt);

    expect(started.probeHintCompletedAt).toBe(hintCompletedAt);
    expect(started.probeStartedAt).toBe(hintCompletedAt);
    expect(completed.probeCompletedAt).toBe(probeCompletedAt);

    const unchanged = recordInitialHintCompletion(completed, '2026-07-16T00:20:00.000Z');
    expect(unchanged.probeStartedAt).toBe(hintCompletedAt);
    expect(recordProbeCompletion(unchanged, '2026-07-16T00:30:00.000Z').probeCompletedAt).toBe(
      probeCompletedAt,
    );
  });
});
