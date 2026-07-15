import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpertSceneChooser } from '../components/ExpertSceneChooser';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import { readExpertSceneId } from '../utils/mode';

export function ExpertProbeEntry() {
  const navigate = useNavigate();
  const { dataset } = useDataset();
  const { configureParticipant } = useStudy();
  const requestedSceneId = readExpertSceneId();
  const requestedSceneExists = dataset?.images.some((scene) => scene.id === requestedSceneId);

  useEffect(() => {
    if (!requestedSceneId || !requestedSceneExists) return;
    void configureParticipant('expert-review-demo').then(() => {
      navigate(`/probe/${requestedSceneId}`, { replace: true });
    });
  }, [configureParticipant, navigate, requestedSceneExists, requestedSceneId]);

  if (requestedSceneId && requestedSceneExists) {
    return <section className="loading-state" aria-live="polite">Opening the selected Probe scene…</section>;
  }

  return (
    <div className="page-stack expert-probe-entry">
      <header className="expert-review-intro">
        <div>
          <span className="expert-mode-label">Expert review demo</span>
          <h1>Open VPrivCal-Probe at any scene</h1>
          <p>Choose a stimulus below. Reloading the page creates a completely fresh demo session.</p>
        </div>
      </header>
      <ExpertSceneChooser />
    </div>
  );
}
