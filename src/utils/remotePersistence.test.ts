import { describe, expect, it, vi } from 'vitest';
import { studyConfig } from '../config';
import { makeScene } from '../test/fixtures';
import { createEmptySession, initializeParticipantSession } from './storage';
import {
  loadParticipantSession,
  participantRemotePersistenceConfigured,
  saveParticipantSession,
} from './remotePersistence';

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  } as Response;
}

describe('participant remote persistence placeholder', () => {
  it('makes no request while the API base URL is unconfigured', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(participantRemotePersistenceConfigured('')).toBe(false);
    await expect(loadParticipantSession('P-1', fetcher, '')).resolves.toBeNull();
    await saveParticipantSession(createEmptySession(), fetcher, '');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads a compatible session through the status endpoint', async () => {
    const session = initializeParticipantSession(
      createEmptySession(['scene-a']),
      'P-2',
      [makeScene('scene-a', ['pii'])],
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ session }));

    await expect(loadParticipantSession('P-2', fetcher, 'https://api.example')).resolves.toEqual(
      session,
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/status',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          participantId: 'P-2',
          study: studyConfig.studyVersion,
          component: 'vprivcal',
        }),
      }),
    );
  });

  it('saves the full participant stage through the stage endpoint', async () => {
    const session = initializeParticipantSession(
      createEmptySession(['scene-a']),
      'P-3',
      [makeScene('scene-a', ['pii'])],
    );
    session.lastRoute = '/q10';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));

    await saveParticipantSession(session, fetcher, 'https://api.example/');
    const request = fetcher.mock.calls[0];
    expect(request[0]).toBe('https://api.example/stage');
    expect(JSON.parse(String((request[1] as RequestInit).body))).toEqual(
      expect.objectContaining({
        participantId: 'P-3',
        stage: '/q10',
        sessionId: session.sessionId,
        finished: false,
        session,
      }),
    );
  });
});
