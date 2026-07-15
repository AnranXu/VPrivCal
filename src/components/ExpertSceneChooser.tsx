import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import { withBasePath } from '../utils/assets';

export function ExpertSceneChooser() {
  const navigate = useNavigate();
  const { dataset } = useDataset();
  const { session, configureParticipant } = useStudy();
  const [openingSceneId, setOpeningSceneId] = useState('');

  if (!dataset) return null;

  const openScene = async (sceneId: string) => {
    setOpeningSceneId(sceneId);
    if (!session.probeScenes[sceneId]) await configureParticipant('expert-review-demo');
    navigate(`/probe/${sceneId}`);
  };

  return (
    <section className="expert-section expert-scene-chooser" aria-labelledby="scene-chooser-heading">
      <div className="expert-section-heading">
        <div>
          <p className="study-kicker">Probe shortcut</p>
          <h2 id="scene-chooser-heading">Choose a scene to review</h2>
        </div>
        <span className="workflow-duration">Fresh after every reload</span>
      </div>
      <p>Select any stimulus. Expert answers are held only in memory and are discarded on refresh.</p>
      <div className="expert-scene-grid">
        {dataset.images.map((scene) => (
          <article key={scene.id}>
            <img src={withBasePath(scene.assetPath)} alt={`Synthetic ${scene.title} scene`} />
            <div>
              <span>{scene.scenarioType}</span>
              <h3>{scene.title}</h3>
              <p>{scene.context}</p>
              <button
                className="button button-secondary"
                type="button"
                disabled={openingSceneId !== ''}
                onClick={() => void openScene(scene.id)}
              >
                {openingSceneId === scene.id ? 'Opening…' : 'Open this scene'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
