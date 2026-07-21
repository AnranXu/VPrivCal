import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ResearcherControls } from './ResearcherControls';
import { useStudy } from '../context/StudyContext';
import { showsResearcherControls } from '../utils/mode';

export function AppLayout() {
  const location = useLocation();
  const { updateSession, expertReview } = useStudy();
  const showResearcherControls = showsResearcherControls();

  useEffect(() => {
    updateSession((current) =>
      current.lastRoute === location.pathname
        ? current
        : { ...current, lastRoute: location.pathname },
    );
  }, [location.pathname, updateSession]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className={`app-shell ${expertReview ? 'expert-mode' : 'participant-mode'}`}>
      <main id="main-content" className="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>{expertReview ? 'VPrivCal expert review demo' : 'VPrivCal research study'} · Synthetic visual stimuli</p>
        {showResearcherControls ? <ResearcherControls /> : null}
      </footer>
    </div>
  );
}
