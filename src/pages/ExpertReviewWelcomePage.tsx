import { useNavigate } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';

const workflow = [
  {
    number: '01',
    title: 'VPrivCal-Q10',
    detail: 'Ten direct policy questions initialize six category defaults and four cross-cutting reminder settings.',
    meta: 'One question per screen',
  },
  {
    number: '02',
    title: 'Probe instructions',
    detail: 'The participant learns the point-first, reveal-second interaction before any stimulus is shown.',
    meta: 'Clean-image first look',
  },
  {
    number: '03',
    title: 'Three Probe scenes',
    detail: 'Private, public, and semi-public scenes each begin with pointing and continue to every available category.',
    meta: 'Phase A + Phase B',
  },
  {
    number: '04',
    title: 'Calibrated policy',
    detail: 'Questionnaire settings and Probe corrections create a hidden participant-specific policy.',
    meta: 'No profile display',
  },
  {
    number: '05',
    title: 'Two-study evaluation',
    detail: 'Study 1 builds a fully informed target set; Study 2 tests one hidden policy during task experience.',
    meta: 'Predictive + experiential',
  },
];

export function ExpertReviewWelcomePage() {
  const navigate = useNavigate();
  const { session, configureParticipant } = useStudy();
  const hasProgress =
    Object.keys(session.q10Responses).length > 0 ||
    Object.values(session.probeScenes).some((scene) => scene.startedAt);

  const openInterface = async () => {
    if (hasProgress) {
      navigate(session.lastRoute === '/' ? '/q10' : session.lastRoute);
      return;
    }
    await configureParticipant('expert-review-demo');
    navigate('/q10');
  };

  const openProbe = async () => {
    if (session.randomizedSceneOrder.length === 0) {
      await configureParticipant('expert-review-demo');
    }
    navigate('/probe/instructions');
  };

  const openEvaluation = async () => {
    if (session.randomizedSceneOrder.length === 0) {
      await configureParticipant('expert-review-demo');
    }
    navigate('/evaluation');
  };

  return (
    <div className="expert-review-welcome">
      <header className="expert-review-intro">
        <div>
          <span className="expert-mode-label">Expert review demo</span>
          <h1>VPrivCal workflow and interface review</h1>
          <p>
            Review the complete calibration sequence first, then enter the same questions and
            image interactions presented to participants.
          </p>
        </div>
        <div className="method-summary">
          <strong>One method</strong>
          <span>VPrivCal-Q10 + VPrivCal-Probe</span>
        </div>
      </header>

      <section className="expert-section" aria-labelledby="workflow-heading">
        <div className="expert-section-heading">
          <div>
            <p className="study-kicker">End-to-end sequence</p>
            <h2 id="workflow-heading">Participant workflow</h2>
          </div>
          <span className="workflow-duration">Target: 5–7 minutes</span>
        </div>
        <ol className="workflow-track">
          {workflow.map((step) => (
            <li key={step.number}>
              <span className="workflow-number">{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <span className="workflow-meta">{step.meta}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="expert-launch-card">
        <div>
          <h2>Open the interface for review</h2>
          <p>Start from VPrivCal-Q10, open the Probe, or review both post-calibration evaluation studies.</p>
        </div>
        <div className="expert-launch-actions">
          <button
            className="button button-primary expert-primary-launch"
            type="button"
            onClick={openInterface}
          >
            {hasProgress ? 'Resume full review' : 'Start full review'}
          </button>
          <button
            className="button button-secondary expert-probe-shortcut"
            type="button"
            onClick={openProbe}
          >
            Go directly to Probe
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={openEvaluation}
          >
            Review evaluation studies
          </button>
        </div>
      </section>
    </div>
  );
}
