import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalizeEntryUrl,
  isDirectProbeReviewUrl,
  isExpertReviewUrl,
  readExpertSceneId,
  readProlificId,
  showsResearcherControls,
} from './mode';

afterEach(() => window.history.replaceState({}, '', '/'));

describe('interface mode URLs', () => {
  it('recognizes expert review before or inside the hash route', () => {
    expect(isExpertReviewUrl('https://study.example/?expert_review=true#/')).toBe(true);
    expect(isExpertReviewUrl('https://study.example/#/?expert_review=true')).toBe(true);
    expect(isExpertReviewUrl('https://study.example/?expert_review=probe')).toBe(true);
    expect(isExpertReviewUrl('https://study.example/?expert_review=false#/')).toBe(false);
  });

  it('recognizes the direct Probe expert-review postfix', () => {
    expect(isDirectProbeReviewUrl('https://study.example/?expert_review=true&probe=true')).toBe(true);
    expect(isDirectProbeReviewUrl('https://study.example/?expert_review=probe')).toBe(true);
    expect(isDirectProbeReviewUrl('https://study.example/?expert_review=true')).toBe(false);
  });

  it('reads an optional expert Probe scene selection', () => {
    expect(
      readExpertSceneId(
        'https://study.example/?expert_review=probe&scene=scene_public_cafe',
      ),
    ).toBe('scene_public_cafe');
    expect(readExpertSceneId('https://study.example/?expert_review=probe')).toBe('');
  });

  it('keeps researcher controls out of the normal participant interface', () => {
    expect(showsResearcherControls('https://study.example/#/')).toBe(false);
    expect(showsResearcherControls('https://study.example/?researcher=true#/')).toBe(true);
    expect(showsResearcherControls('https://study.example/?expert_review=true#/')).toBe(true);
  });

  it('prefills a Prolific ID from either URL query position', () => {
    expect(readProlificId('https://study.example/?PROLIFIC_PID=P-123#/')).toBe('P-123');
    expect(readProlificId('https://study.example/#/?prolific_pid=P-456')).toBe('P-456');
    expect(readProlificId('https://study.example/#/')).toBe('');
  });

  it('removes a legacy root hash while preserving its entry query', () => {
    window.history.replaceState({}, '', '/#/?expert_review=probe');
    canonicalizeEntryUrl();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?expert_review=probe');
  });
});
