import { useNavigate } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';
import { ExpertSceneChooser } from '../components/ExpertSceneChooser';

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
    title: 'Policy profile',
    detail: 'Questionnaire defaults and contextual corrections are summarized by privacy category.',
    meta: 'Participant confirmation',
  },
  {
    number: '05',
    title: 'Completion',
    detail: 'The completed response record can be inspected through the same export interface used in the study.',
    meta: 'JSON + category-pair CSV',
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

      <div className="expert-review-grid">
        <section className="expert-section">
          <p className="study-kicker">Probe logic</p>
          <h2>Point first, reveal second</h2>
          <div className="phase-comparison">
            <article>
              <span>Phase A</span>
              <h3>Unprompted first look</h3>
              <p>The scene begins without boxes, category overlays, or detection labels.</p>
            </article>
            <article>
              <span>Phase B</span>
              <h3>Category-complete review</h3>
              <p>Every category listed for the scene is reviewed, with evidence shown only on request.</p>
            </article>
          </div>
        </section>

        <section className="expert-section review-focus-card">
          <p className="study-kicker">Suggested review focus</p>
          <h2>What to examine</h2>
          <ul className="review-checklist">
            <li>Question clarity and response-scale semantics</li>
            <li>Burden of reviewing every available category</li>
            <li>Pointing, overlap resolution, and manual-region behavior</li>
            <li>Separation of awareness status from preferred action</li>
            <li>Clarity of the generated policy summary</li>
          </ul>
        </section>
      </div>

      <section className="expert-launch-card">
        <div>
          <h2>{hasProgress ? 'Continue the interface review' : 'Open the participant interface'}</h2>
          <p>Your demo answers let you experience validation, Back navigation, and the full interaction sequence.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openInterface}>
          {hasProgress ? 'Resume interface review' : 'Start interface review'}
        </button>
      </section>
      <ExpertSceneChooser />
    </div>
  );
}
