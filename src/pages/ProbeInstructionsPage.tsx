import { useNavigate } from 'react-router-dom';
import { ProbeInterfaceHint } from '../components/ProbeInterfaceHint';
import { useStudy } from '../context/StudyContext';

export function ProbeInstructionsPage() {
  const navigate = useNavigate();
  const { session } = useStudy();
  const firstScene = session.randomizedSceneOrder[0];

  return (
    <section className="content-card instructions-card">
      <p className="eyebrow">VPrivCal-Probe</p>
      <h1>Point first, review second</h1>
      <div className="instruction-hint-row">
        <p>View the short guided hint before starting the first scene.</p>
        <ProbeInterfaceHint defaultOpen />
      </div>
      <div className="instruction-steps">
        <article>
          <span>1</span>
          <div>
            <h2>Inspect the clean image</h2>
            <p>No model boxes, labels, or category overlays are shown at first.</p>
          </div>
        </article>
        <article>
          <span>2</span>
          <div>
            <h2>Point to specific content</h2>
            <p>
              Click or tap any specific content in the image that you think an AI assistant
              should handle carefully for privacy. Select as many areas as you think are relevant.
              You do not need to name or classify your selections.
            </p>
          </div>
        </article>
        <article>
          <span>3</span>
          <div>
            <h2>Review every category present</h2>
            <p>After you submit your first look, review each category and optionally reveal its linked evidence.</p>
          </div>
        </article>
      </div>
      <aside className="notice-card compact-notice">
        Use the keyboard alternative or voluntarily open the neutral content list if pointing is not accessible to you.
      </aside>
      <div className="button-row form-actions split-actions">
        <button className="button button-secondary" type="button" onClick={() => navigate('/q10')}>Back</button>
        <button
          className="button button-primary"
          type="button"
          disabled={!firstScene}
          onClick={() => firstScene && navigate(`/probe/${firstScene}`)}
        >
          Begin first scene
        </button>
      </div>
    </section>
  );
}
