import { EXPORT_SCHEMA_VERSION, studyConfig } from '../config';
import type { ProbeScene, ProbeSceneState, StudySession } from '../types';
import { deterministicShuffle } from './randomization';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptySession(sceneIds: readonly string[] = []): StudySession {
  const now = new Date().toISOString();
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    studyVersion: studyConfig.studyVersion,
    participantId: '',
    sessionId: createSessionId(),
    startedAt: now,
    completedAt: null,
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    viewportHistory:
      typeof window === 'undefined'
        ? []
        : [{ width: window.innerWidth, height: window.innerHeight, at: now }],
    originalSceneOrder: [...sceneIds],
    randomizedSceneOrder: [],
    q10Responses: {},
    q10FirstViewedAt: {},
    q10ActiveIndex: 0,
    q10StartedAt: null,
    q10CompletedAt: null,
    probeHintCompletedAt: null,
    probeStartedAt: null,
    probeCompletedAt: null,
    probeScenes: {},
    consent: null,
    profileConfirmation: null,
    evaluationPrototype: null,
    lastRoute: '/',
  };
}

export function initializeParticipantSession(
  current: StudySession,
  participantId: string,
  scenes: readonly ProbeScene[],
): StudySession {
  const normalizedId = participantId.trim();
  if (
    current.randomizedSceneOrder.length === scenes.length &&
    current.participantId === normalizedId
  ) {
    return current;
  }

  const seed = normalizedId || current.sessionId;
  const originalSceneOrder = scenes.map((scene) => scene.id);
  const randomizedSceneOrder = studyConfig.randomizeSceneOrder
    ? deterministicShuffle(originalSceneOrder, seed)
    : [...originalSceneOrder];
  const probeScenes = Object.fromEntries(
    scenes.map((scene): [string, ProbeSceneState] => {
      const categoryOrder = studyConfig.randomizeCategoryOrder
        ? deterministicShuffle(scene.availableCategoryIds, `${seed}:${scene.id}:categories`)
        : [...scene.availableCategoryIds];
      return [
        scene.id,
        {
          sceneId: scene.id,
          startedAt: '',
          completedAt: null,
          phase: 'pointing',
          pointSelections: [],
          noAdditionalSelected: false,
          listModeOpened: false,
          categoryOrder,
          categoryResponses: {},
          activeCategoryIndex: 0,
        },
      ];
    }),
  );

  return {
    ...current,
    participantId: normalizedId,
    originalSceneOrder,
    randomizedSceneOrder,
    q10Responses: {},
    q10FirstViewedAt: {},
    q10ActiveIndex: 0,
    q10StartedAt: null,
    q10CompletedAt: null,
    probeHintCompletedAt: null,
    probeStartedAt: null,
    probeCompletedAt: null,
    probeScenes,
    profileConfirmation: null,
    evaluationPrototype: null,
    completedAt: null,
    lastRoute: '/q10',
  };
}
