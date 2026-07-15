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
  const consentedAt = !isWelcomePage && session.consent?.agreed ? session.consent.answeredAt : null;
  const studyStarted = consentedAt !== null;
  const startedAt = consentedAt ?? pageOpenedAt.current;
  const endedAt = studyStarted ? session.completedAt : null;

  useEffect(() => {
    if (endedAt) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [endedAt]);

  const elapsed = formatElapsedTime(elapsedTimeBetween(startedAt, endedAt, now));
  const label = studyStarted ? 'Study time' : 'Time on page';

  return (
    <div className="participant-timer" role="timer" aria-label={`${label}: ${elapsed}`}>
      <span>{label}</span>
      <strong>{elapsed}</strong>
    </div>
  );
}
