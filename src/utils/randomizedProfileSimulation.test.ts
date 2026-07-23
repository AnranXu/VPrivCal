import datasetJson from '../../public/data/vprivcal_detections.json';
import { describe, expect, it } from 'vitest';
import { pilotDetectionsFixture } from '../test/fixtures/pilotDetections';
import type { VPrivCalDataset } from '../types';
import { runRandomizedProfileSimulation } from './randomizedProfileSimulation';

const dataset = datasetJson as unknown as VPrivCalDataset;
const detections = pilotDetectionsFixture;

describe('seeded randomized VPrivCal profile simulation', () => {
  it('is exactly reproducible for the same seed', () => {
    const first = runRandomizedProfileSimulation(detections, dataset, {
      seed: 20260721,
      profileCount: 25,
    });
    const second = runRandomizedProfileSimulation(detections, dataset, {
      seed: 20260721,
      profileCount: 25,
    });

    expect(second).toEqual(first);
  });

  it('changes response and decision samples when the seed changes', () => {
    const first = runRandomizedProfileSimulation(detections, dataset, {
      seed: 100,
      profileCount: 25,
    });
    const second = runRandomizedProfileSimulation(detections, dataset, {
      seed: 101,
      profileCount: 25,
    });

    expect(second.profileResults).not.toEqual(first.profileResults);
    expect(second.robustness.preferenceActionCounts).not.toEqual(
      first.robustness.preferenceActionCounts,
    );
  });

  it('compiles valid profiles and produces varied decisions for every pilot cue', () => {
    const report = runRandomizedProfileSimulation(detections, dataset, {
      seed: 20260721,
      profileCount: 100,
    });

    expect(report.robustness).toMatchObject({
      requestedProfileCount: 100,
      compiledProfileCount: 100,
      invalidProfileCount: 0,
      decisionCount: 400,
      invalidDecisionCount: 0,
      fallbackDecisionCount: 0,
      allCandidatesShowPreferenceVariation: true,
    });
    expect(report.robustness.uniquePreferenceSignatures).toBeGreaterThanOrEqual(8);
    expect(report.robustness.q7DecisionCount).toBeGreaterThan(0);
    expect(report.robustness.exposureFilteredDecisionCount).toBeGreaterThan(0);
    expect(report.robustness.q9DecisionCount).toBeGreaterThan(0);
    expect(report.robustness.q10DecisionCount).toBeGreaterThan(0);
    expect(report.robustness.safetyFloorAppliedCount).toBeGreaterThan(0);
    expect(report.candidateDistributions).toHaveLength(4);
    expect(
      report.candidateDistributions.every(({ distinctPreferenceRanks }) => distinctPreferenceRanks === 2),
    ).toBe(true);
    expect(report.robustness.preferenceActionCounts).toEqual({
      '0': expect.any(Number),
      '2': expect.any(Number),
    });
  });

  it('rejects invalid Monte Carlo configuration', () => {
    expect(() =>
      runRandomizedProfileSimulation(detections, dataset, { seed: -1, profileCount: 10 }),
    ).toThrow(/seed/);
    expect(() =>
      runRandomizedProfileSimulation(detections, dataset, { seed: 1, profileCount: 0 }),
    ).toThrow(/profileCount/);
  });
});
