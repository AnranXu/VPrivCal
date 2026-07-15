import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLayout } from './components/AppLayout';
import { useDataset } from './context/DataContext';
import { CompletePage } from './pages/CompletePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProbeInstructionsPage } from './pages/ProbeInstructionsPage';
import { ProbeScenePage } from './pages/ProbeScenePage';
import { ProfilePage } from './pages/ProfilePage';
import { Q10Page } from './pages/Q10Page';
import { WelcomePage } from './pages/WelcomePage';
import { ExpertReviewWelcomePage } from './pages/ExpertReviewWelcomePage';
import { ExpertProbeEntry } from './pages/ExpertProbeEntry';
import { useStudy } from './context/StudyContext';
import { isDirectProbeReviewUrl } from './utils/mode';

function ConsentRequired({ children }: { children: ReactNode }) {
  const { session, expertReview } = useStudy();
  return expertReview || session.consent?.agreed ? children : <Navigate to="/" replace />;
}

export function App() {
  const { dataset, error } = useDataset();
  const { expertReview } = useStudy();
  const directProbeReview = expertReview && isDirectProbeReviewUrl();

  if (error) {
    return (
      <main className="fatal-state">
        <h1>Unable to load the study data</h1>
        <p>{error}</p>
        <p>Confirm that <code>public/data/vprivcal_detections.json</code> is deployed with the site.</p>
      </main>
    );
  }
  if (!dataset) {
    return <main className="loading-state" aria-live="polite">Loading VPrivCal study…</main>;
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              expertReview
                ? directProbeReview
                  ? <ExpertProbeEntry />
                  : <ExpertReviewWelcomePage />
                : <WelcomePage />
            }
          />
          <Route
            path="/participant"
            element={
              expertReview
                ? directProbeReview
                  ? <ExpertProbeEntry />
                  : <ExpertReviewWelcomePage />
                : <WelcomePage />
            }
          />
          <Route path="/q10" element={<ConsentRequired><Q10Page /></ConsentRequired>} />
          <Route
            path="/probe/instructions"
            element={<ConsentRequired><ProbeInstructionsPage /></ConsentRequired>}
          />
          <Route
            path="/probe/:sceneId"
            element={<ConsentRequired><ProbeScenePage /></ConsentRequired>}
          />
          <Route path="/profile" element={<ConsentRequired><ProfilePage /></ConsentRequired>} />
          <Route path="/complete" element={<ConsentRequired><CompletePage /></ConsentRequired>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
