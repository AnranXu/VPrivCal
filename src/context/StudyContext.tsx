import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { StudySession } from '../types';
import { studyConfig } from '../config';
import { useDataset } from './DataContext';
import {
  createEmptySession,
  initializeParticipantSession,
} from '../utils/storage';
import { isExpertReviewUrl } from '../utils/mode';
import {
  clearParticipantSession,
  loadParticipantSession,
  participantRemotePersistenceConfigured,
  saveParticipantSession,
} from '../utils/remotePersistence';

type ParticipantPersistenceStatus =
  | 'not-configured'
  | 'idle'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'error';

interface StudyContextValue {
  session: StudySession;
  updateSession: (updater: (session: StudySession) => StudySession) => void;
  configureParticipant: (
    participantId: string,
    consentedAt?: string,
  ) => Promise<StudySession | null>;
  resetStudy: () => Promise<void>;
  expertReview: boolean;
  participantPersistence: {
    configured: boolean;
    status: ParticipantPersistenceStatus;
    error: string | null;
  };
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const { dataset } = useDataset();
  const [expertReview] = useState(() => isExpertReviewUrl());
  const remoteConfigured = participantRemotePersistenceConfigured();
  const sceneIds = useMemo(() => dataset?.images.map((scene) => scene.id) ?? [], [dataset]);
  const [session, setSession] = useState<StudySession>(() => createEmptySession(sceneIds));
  const [persistenceStatus, setPersistenceStatus] = useState<ParticipantPersistenceStatus>(
    remoteConfigured ? 'idle' : 'not-configured',
  );
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    if (sceneIds.length === 0 || session.originalSceneOrder.length > 0) return;
    setSession((current) => ({ ...current, originalSceneOrder: [...sceneIds] }));
  }, [sceneIds, session.originalSceneOrder.length]);

  useEffect(() => {
    if (
      !expertReview ||
      !dataset ||
      Object.keys(session.probeScenes).length === dataset.images.length
    ) {
      return;
    }
    setSession(
      initializeParticipantSession(
        createEmptySession(dataset.images.map((scene) => scene.id)),
        'expert-review-demo',
        dataset.images,
      ),
    );
  }, [dataset, expertReview, session.probeScenes]);

  useEffect(() => {
    if (
      expertReview ||
      !remoteConfigured ||
      !session.participantId ||
      !session.consent?.agreed
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setPersistenceStatus('saving');
      setPersistenceError(null);
      void saveParticipantSession(session)
        .then(() => setPersistenceStatus('saved'))
        .catch((error: unknown) => {
          setPersistenceStatus('error');
          setPersistenceError(
            error instanceof Error ? error.message : 'Unable to save participant progress.',
          );
        });
    }, studyConfig.participantRemoteSaveDebounceMs);
    return () => window.clearTimeout(timeout);
  }, [expertReview, remoteConfigured, session]);

  useEffect(() => {
    let timeout = 0;
    const record = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setSession((current) => {
          const last = current.viewportHistory.at(-1);
          if (last?.width === window.innerWidth && last.height === window.innerHeight) return current;
          return {
            ...current,
            viewportHistory: [
              ...current.viewportHistory,
              {
                width: window.innerWidth,
                height: window.innerHeight,
                at: new Date().toISOString(),
              },
            ],
          };
        });
      }, 250);
    };
    window.addEventListener('resize', record);
    return () => {
      window.removeEventListener('resize', record);
      window.clearTimeout(timeout);
    };
  }, []);

  const updateSession = useCallback(
    (updater: (current: StudySession) => StudySession) => setSession(updater),
    [],
  );

  const configureParticipant = useCallback(
    async (participantId: string, consentedAt?: string): Promise<StudySession | null> => {
      if (!dataset) return null;
      const normalizedId = participantId.trim();
      let baseSession: StudySession;

      if (expertReview) {
        baseSession = initializeParticipantSession(session, normalizedId, dataset.images);
      } else if (remoteConfigured) {
        setPersistenceStatus('loading');
        setPersistenceError(null);
        try {
          const restored = await loadParticipantSession(normalizedId);
          baseSession =
            restored?.participantId === normalizedId
              ? restored
              : initializeParticipantSession(createEmptySession(sceneIds), normalizedId, dataset.images);
          setPersistenceStatus(restored ? 'saved' : 'idle');
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to restore participant progress.';
          setPersistenceStatus('error');
          setPersistenceError(message);
          throw error;
        }
      } else {
        baseSession = initializeParticipantSession(session, normalizedId, dataset.images);
      }

      const existingConsent =
        baseSession.consent?.agreed && baseSession.consent.prolificId === normalizedId
          ? baseSession.consent
          : null;
      const configured = consentedAt
        ? {
            ...baseSession,
            consent:
              existingConsent ??
              {
                agreed: true,
                prolificId: normalizedId,
                answeredAt: consentedAt,
              },
          }
        : baseSession;
      setSession(configured);
      return configured;
    },
    [dataset, expertReview, remoteConfigured, sceneIds, session],
  );

  const resetStudy = useCallback(async () => {
    if (!expertReview && remoteConfigured && session.participantId) {
      await clearParticipantSession(session.participantId);
    }
    setSession(createEmptySession(sceneIds));
    setPersistenceError(null);
    setPersistenceStatus(remoteConfigured ? 'idle' : 'not-configured');
  }, [expertReview, remoteConfigured, sceneIds, session.participantId]);

  const participantPersistence = useMemo(
    () => ({
      configured: remoteConfigured,
      status: persistenceStatus,
      error: persistenceError,
    }),
    [persistenceError, persistenceStatus, remoteConfigured],
  );

  const value = useMemo(
    () => ({
      session,
      updateSession,
      configureParticipant,
      resetStudy,
      expertReview,
      participantPersistence,
    }),
    [
      configureParticipant,
      expertReview,
      participantPersistence,
      resetStudy,
      session,
      updateSession,
    ],
  );
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyContextValue {
  const value = useContext(StudyContext);
  if (!value) throw new Error('useStudy must be used inside StudyProvider.');
  return value;
}
