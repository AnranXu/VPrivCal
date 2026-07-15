import { EXPORT_SCHEMA_VERSION, studyConfig } from '../config';
import type { StudySession } from '../types';

type FetchLike = typeof fetch;

interface StatusResponse {
  session?: unknown;
}

function apiUrl(path: string, baseUrl = studyConfig.participantApiBaseUrl): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function isCompatibleSession(value: unknown): value is StudySession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<StudySession>;
  return (
    session.schemaVersion === EXPORT_SCHEMA_VERSION &&
    session.studyVersion === studyConfig.studyVersion &&
    typeof session.participantId === 'string' &&
    typeof session.sessionId === 'string' &&
    typeof session.startedAt === 'string' &&
    typeof session.q10Responses === 'object' &&
    typeof session.probeScenes === 'object'
  );
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function participantRemotePersistenceConfigured(
  baseUrl = studyConfig.participantApiBaseUrl,
): boolean {
  return baseUrl.trim().length > 0;
}

export async function loadParticipantSession(
  participantId: string,
  fetcher: FetchLike = fetch,
  baseUrl = studyConfig.participantApiBaseUrl,
): Promise<StudySession | null> {
  if (!participantRemotePersistenceConfigured(baseUrl)) return null;
  const response = await fetcher(apiUrl('/status', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: participantId.trim(),
      study: studyConfig.studyVersion,
      component: 'vprivcal',
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Participant status request failed (${response.status}).`));
  }
  const payload = (await response.json()) as StatusResponse;
  if (payload.session == null) return null;
  if (!isCompatibleSession(payload.session)) {
    throw new Error('The saved participant session is incompatible with this study version.');
  }
  return payload.session;
}

export async function saveParticipantSession(
  session: StudySession,
  fetcher: FetchLike = fetch,
  baseUrl = studyConfig.participantApiBaseUrl,
): Promise<void> {
  if (!participantRemotePersistenceConfigured(baseUrl) || !session.participantId) return;
  const response = await fetcher(apiUrl('/stage', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: session.participantId,
      study: session.studyVersion,
      stage: session.lastRoute,
      sessionId: session.sessionId,
      finished: session.completedAt !== null,
      session,
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Participant stage save failed (${response.status}).`));
  }
}

export async function clearParticipantSession(
  participantId: string,
  fetcher: FetchLike = fetch,
  baseUrl = studyConfig.participantApiBaseUrl,
): Promise<void> {
  if (!participantRemotePersistenceConfigured(baseUrl) || !participantId.trim()) return;
  const response = await fetcher(apiUrl('/clean', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: participantId.trim(),
      study: studyConfig.studyVersion,
      component: 'vprivcal',
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Participant reset failed (${response.status}).`));
  }
}
