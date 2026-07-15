import { describe, expect, it } from 'vitest';
import { withBasePath } from './assets';

describe('static asset paths', () => {
  it('prefixes root-style JSON paths for a static host subdirectory', () => {
    expect(withBasePath('/assets/images/public_cafe.png', '/VPrivCal/')).toBe(
      '/VPrivCal/assets/images/public_cafe.png',
    );
    expect(withBasePath('data/vprivcal_detections.json', './')).toBe(
      './data/vprivcal_detections.json',
    );
  });
});

