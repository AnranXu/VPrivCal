import type { StudySession } from '../types';

export function recordInitialHintCompletion(
  session: StudySession,
  completedAt: string,
): StudySession {
  return {
    ...session,
    probeHintCompletedAt: session.probeHintCompletedAt ?? completedAt,
    probeStartedAt: session.probeStartedAt ?? completedAt,
  };
}

export function recordProbeCompletion(
  session: StudySession,
  completedAt: string,
): StudySession {
  return {
    ...session,
    probeCompletedAt: session.probeCompletedAt ?? completedAt,
  };
}
