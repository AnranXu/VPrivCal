import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';
import { elapsedTimeBetween, formatElapsedTime } from '../utils/time';

export function ParticipantTimer() {
  const { session } = useStudy();
  const location = useLocation();
  const pageOpenedAt = useRef(new Date().toISOString());
  const [now, setNow] = useState(() => Date.now());
  const isWelcomePage = location.pathname === '/' || location.pathname === '/participant';
  const isProbeRoute = location.pathname.startsWith('/probe');
  const consentedAt = !isWelcomePage && session.consent?.agreed ? session.consent.answeredAt : null;
  const studyStarted = consentedAt !== null;
  const probeStartedAt = session.probeStartedAt ?? null;
  const startedAt = isProbeRoute ? (probeStartedAt ?? pageOpenedAt.current) : (consentedAt ?? pageOpenedAt.current);
  const endedAt = isProbeRoute
    ? (session.probeCompletedAt ?? null)
    : (studyStarted ? session.completedAt : null);
  const timerRunning = isProbeRoute ? probeStartedAt !== null && endedAt === null : endedAt === null;

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const elapsed = formatElapsedTime(
    isProbeRoute && !probeStartedAt ? 0 : elapsedTimeBetween(startedAt, endedAt, now),
  );
  const label = isProbeRoute ? 'Probe time' : (studyStarted ? 'Study time' : 'Time on page');

  return (
    <div className="participant-timer" role="timer" aria-label={`${label}: ${elapsed}`}>
      <span>{label}</span>
      <strong>{elapsed}</strong>
    </div>
  );
}
