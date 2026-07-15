import { describe, expect, it } from 'vitest';
import { makeScene } from '../test/fixtures';
import { deterministicShuffle } from './randomization';
import { createEmptySession, initializeParticipantSession } from './storage';

describe('deterministic randomization', () => {
  it('produces a stable permutation for a participant ID', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(deterministicShuffle(items, 'participant-42')).toEqual(
      deterministicShuffle(items, 'participant-42'),
    );
    expect(deterministicShuffle(items, 'participant-42')).not.toEqual(
      deterministicShuffle(items, 'participant-99'),
    );
    expect([...deterministicShuffle(items, 'participant-42')].sort()).toEqual(items);
  });

  it('stores original and displayed scene order when participant setup completes', () => {
    const scenes = [makeScene('one', ['pii']), makeScene('two', ['pii']), makeScene('three', ['pii'])];
    const first = initializeParticipantSession(createEmptySession(), 'participant-42', scenes);
    const second = initializeParticipantSession(createEmptySession(), 'participant-42', scenes);
    expect(first.originalSceneOrder).toEqual(['one', 'two', 'three']);
    expect(first.randomizedSceneOrder).toEqual(second.randomizedSceneOrder);
  });
});
