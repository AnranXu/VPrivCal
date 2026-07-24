import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import { readEvaluationStudy } from '../utils/mode';

type StudyOneDecision = boolean | undefined;

interface StudyOneCandidate {
  id: string;
  title: string;
  category: string;
  description: string;
  evidence: string;
}

interface StudyTwoClip {
  id: string;
  number: string;
  title: string;
  context: string;
  task: string;
  taskOptions: string[];
  reminderText: string;
  surfacedFor: Array<'generic' | 'full-vprivcal'>;
}

const studyOneCandidates: StudyOneCandidate[] = [
  {
    id: 's1-colleague-face',
    title: 'Visible colleague',
    category: 'Biometric data',
    description: 'A colleague is visible and recognizable near the shared display.',
    evidence: 'The evidence view would briefly outline the person’s face in the held-out clip.',
  },
  {
    id: 's1-client-reference',
    title: 'Client reference number',
    category: 'Personally identifiable information',
    description: 'A project panel includes a fictional client name and reference number.',
    evidence: 'The evidence view would highlight the relevant line on the project panel.',
  },
  {
    id: 's1-wall-calendar',
    title: 'Background team calendar',
    category: 'Personal life',
    description: 'A background calendar shows work patterns and planned absences.',
    evidence: 'The evidence view would mark the calendar in the rear of the scene.',
  },
  {
    id: 's1-desk-photo',
    title: 'Partially visible family photo',
    category: 'Children images',
    description: 'A small desk photo appears to include a child, although the image is unclear.',
    evidence: 'The evidence view would magnify the photo without adding a privacy judgment.',
  },
];

const studyTwoClips: StudyTwoClip[] = [
  {
    id: 's2-clip-deadline',
    number: '01',
    title: 'Project handoff',
    context: 'Review a shared project board and identify the delivery deadline.',
    task: 'Which item is due on Friday?',
    taskOptions: ['Research summary', 'Design package', 'Budget review'],
    reminderText: 'A client reference number is visible in this scene.',
    surfacedFor: ['generic', 'full-vprivcal'],
  },
  {
    id: 's2-clip-pickup',
    number: '02',
    title: 'Lobby pickup',
    context: 'Follow the delivery instructions shown near the reception desk.',
    task: 'Where should the package be collected?',
    taskOptions: ['Reception desk', 'Loading bay', 'Meeting room'],
    reminderText: 'A bystander and a personal schedule are visible in this scene.',
    surfacedFor: ['generic'],
  },
];

const clipRatingItems = [
  ['usefulness', "The assistant's privacy-reminder behavior in this clip was useful."],
  ['annoyance', "The assistant's privacy-reminder behavior in this clip was annoying."],
  ['frequency-fit', 'The amount of privacy information shown in this clip was appropriate.'],
  ['protection', 'I felt sufficiently informed about privacy-sensitive content in this clip.'],
] as const;

const postSessionItems = [
  ['overall-usefulness', "Overall, the assistant's privacy-reminder behavior was useful."],
  ['overall-annoyance', 'Overall, the privacy reminders were annoying.'],
  ['overall-frequency', 'The overall number of reminders was appropriate.'],
  ['overall-protection', "I felt sufficiently protected by the assistant's privacy behavior."],
  ['adoption', 'I would use this reminder configuration in an egocentric VLM assistant.'],
] as const;

const scaleValues = [1, 2, 3, 4, 5, 6, 7] as const;

function hiddenCondition(participantId: string): 'generic' | 'full-vprivcal' {
  const seed = participantId || 'evaluation-prototype';
  const total = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return total % 2 === 0 ? 'generic' : 'full-vprivcal';
}

function EvaluationStage({
  number,
  title,
  context,
  reminder,
}: {
  number: string;
  title: string;
  context: string;
  reminder?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="evaluation-stage" aria-label={`${title} video prototype`}>
      <div className="evaluation-stage-bar">
        <span>Held-out clip {number}</span>
        <span>00:42 / 01:10</span>
      </div>
      <div className="evaluation-stage-scene" aria-hidden="true">
        <span className="scene-panel scene-panel-large" />
        <span className="scene-panel scene-panel-small" />
        <span className="scene-person scene-person-one" />
        <span className="scene-person scene-person-two" />
        <span className="scene-desk" />
        <span className="scene-play">▶</span>
      </div>
      <div className="evaluation-stage-caption">
        <div>
          <strong>{title}</strong>
          <span>{context}</span>
        </div>
        <span className="prototype-chip">Synthetic prototype</span>
      </div>
      {reminder ? (
        <aside className="privacy-reminder-card" aria-label="Privacy reminder">
          <div>
            <span className="reminder-icon" aria-hidden="true">!</span>
            <div>
              <strong>Privacy reminder</strong>
              <p>{reminder}</p>
            </div>
          </div>
          <button className="text-button" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Hide details' : 'Why am I seeing this?'}
          </button>
          {expanded ? (
            <p className="reminder-detail">
              The assistant identified visual content that may need careful handling. The reminder
              does not claim that harm has occurred.
            </p>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

function SevenPointScale({
  itemId,
  prompt,
  value,
  onChange,
}: {
  itemId: string;
  prompt: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="evaluation-scale">
      <legend>{prompt}</legend>
      <div className="scale-options">
        {scaleValues.map((scaleValue) => (
          <label key={scaleValue}>
            <input
              type="radio"
              name={itemId}
              checked={value === scaleValue}
              onChange={() => onChange(scaleValue)}
            />
            <span>{scaleValue}</span>
          </label>
        ))}
      </div>
      <div className="scale-anchors" aria-hidden="true">
        <span>Strongly disagree</span>
        <span>Strongly agree</span>
      </div>
    </fieldset>
  );
}

export function EvaluationPrototypeLandingPage() {
  const navigate = useNavigate();
  const { dataset } = useDataset();
  const { session, expertReview } = useStudy();
  const assignedStudy = readEvaluationStudy();
  const calibrationComplete =
    Object.keys(session.q10Responses).length === 10 &&
    (dataset?.images.every((scene) => Boolean(session.probeScenes[scene.id]?.completedAt)) ?? false);

  if (!expertReview && !calibrationComplete) {
    return (
      <section className="content-card narrow-card">
        <p className="eyebrow">Post-calibration evaluation</p>
        <h1>Complete VPrivCal first</h1>
        <p>The evaluation begins only after the questionnaire and privacy-awareness Probe are complete.</p>
        <button className="button button-primary" type="button" onClick={() => navigate('/q10')}>
          Return to calibration
        </button>
      </section>
    );
  }

  if (!assignedStudy) {
    return (
      <section className="content-card narrow-card">
        <p className="eyebrow">Evaluation assignment required</p>
        <h1>This study link is incomplete</h1>
        <p>
          Participants must receive a recruitment link ending in <code>?study=1</code> or{' '}
          <code>?study=2</code>. The interface does not allow participants to choose a study.
        </p>
      </section>
    );
  }

  const studyOneAssigned = assignedStudy === 'study-1';

  return (
    <div className="page-stack evaluation-landing">
      <header className="evaluation-hero">
        <div>
          <p className="eyebrow">
            Profile ready · {studyOneAssigned ? 'Study 1' : 'Study 2'} assigned
          </p>
          <h1>
            {studyOneAssigned
              ? 'Predictive effectiveness evaluation'
              : 'Reminder experience evaluation'}
          </h1>
          <p>
            The calibrated policy is ready. This recruitment link opens only the assigned
            evaluation; the other study is not shown or accessible from this session.
          </p>
        </div>
        <div className="profile-ready-badge">
          <span aria-hidden="true">✓</span>
          <strong>Calibration complete</strong>
          <small>Profile details remain hidden</small>
        </div>
      </header>

      <section
        className="evaluation-study-grid single-study-grid"
        aria-label="Assigned evaluation study"
      >
        {studyOneAssigned ? (
          <article className="evaluation-study-card">
            <span className="study-number">Study 1</span>
            <h2>Predictive effectiveness</h2>
            <p>
              Review every held-out candidate, build a fully informed target configuration,
              revise the final load, and complete an unannounced reliability check.
            </p>
            <ul>
              <li>No personalized policy output is shown</li>
              <li>Neutral candidate descriptions and optional evidence</li>
              <li>Final selected and suppressed counts before confirmation</li>
            </ul>
            <button
              className="button button-primary"
              type="button"
              onClick={() => navigate('/evaluation/study-1')}
            >
              Continue to Study 1
            </button>
          </article>
        ) : (
          <article className="evaluation-study-card study-two-card">
            <span className="study-number">Study 2</span>
            <h2>Reminder experience</h2>
            <p>
              Experience one hidden policy, complete the visual task, rate reminder behavior
              after each clip, and report the overall experience before debriefing.
            </p>
            <ul>
              <li>Random assignment occurs after calibration</li>
              <li>Reminder appearance stays identical between conditions</li>
              <li>Seven-point usefulness and annoyance measures</li>
            </ul>
            <button
              className="button button-primary green-button"
              type="button"
              onClick={() => navigate('/evaluation/study-2')}
            >
              Continue to Study 2
            </button>
          </article>
        )}
      </section>

      <aside className="prototype-note">
        <strong>Prototype boundary</strong>
        <p>
          The clip panels and candidate content are interaction placeholders. The main studies
          require disjoint, expert-verified stimulus sets and frozen policy metadata.
        </p>
      </aside>
    </div>
  );
}

export function StudyOneEvaluationPage() {
  const navigate = useNavigate();
  const { session, updateSession } = useStudy();
  const previous = session.evaluationPrototype?.study === 'study-1'
    ? session.evaluationPrototype.studyOne
    : undefined;
  const [step, setStep] = useState<'intro' | 'review' | 'load' | 'reliability'>('intro');
  const [activeIndex, setActiveIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, StudyOneDecision>>(
    previous?.targetSelections ?? {},
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reliabilityDecision, setReliabilityDecision] = useState<StudyOneDecision>(
    previous?.reliabilityDecision ?? undefined,
  );
  const candidate = studyOneCandidates[activeIndex];
  const selectedCount = Object.values(decisions).filter(Boolean).length;

  const start = () => {
    const now = new Date().toISOString();
    updateSession((current) => ({
      ...current,
      evaluationPrototype: {
        study: 'study-1',
        condition: null,
        startedAt: current.evaluationPrototype?.study === 'study-1'
          ? current.evaluationPrototype.startedAt
          : now,
        completedAt: null,
        studyOne: {
          targetSelections: Object.fromEntries(
            Object.entries(decisions).filter((entry): entry is [string, boolean] => entry[1] !== undefined),
          ),
          finalLoadConfirmedAt: null,
          reliabilityDecision: null,
        },
      },
    }));
    setStep('review');
  };

  const saveDecision = (value: boolean) => {
    setDecisions((current) => ({ ...current, [candidate.id]: value }));
  };

  const nextCandidate = () => {
    setEvidenceOpen(false);
    if (activeIndex < studyOneCandidates.length - 1) {
      setActiveIndex((index) => index + 1);
    } else {
      setStep('load');
    }
  };

  const confirmLoad = () => {
    const confirmedAt = new Date().toISOString();
    updateSession((current) => current.evaluationPrototype?.study === 'study-1'
      ? {
          ...current,
          evaluationPrototype: {
            ...current.evaluationPrototype,
            studyOne: {
              targetSelections: Object.fromEntries(
                Object.entries(decisions).filter((entry): entry is [string, boolean] => entry[1] !== undefined),
              ),
              finalLoadConfirmedAt: confirmedAt,
              reliabilityDecision: null,
            },
          },
        }
      : current);
    setStep('reliability');
  };

  const finish = () => {
    if (reliabilityDecision === undefined) return;
    const now = new Date().toISOString();
    updateSession((current) => current.evaluationPrototype?.study === 'study-1'
      ? {
          ...current,
          completedAt: now,
          evaluationPrototype: {
            ...current.evaluationPrototype,
            completedAt: now,
            studyOne: {
              targetSelections: Object.fromEntries(
                Object.entries(decisions).filter((entry): entry is [string, boolean] => entry[1] !== undefined),
              ),
              finalLoadConfirmedAt:
                current.evaluationPrototype.studyOne?.finalLoadConfirmedAt ?? now,
              reliabilityDecision,
            },
          },
        }
      : current);
    navigate('/complete');
  };

  if (step === 'intro') {
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header">
          <div>
            <p className="eyebrow">Study 1 · Predictive effectiveness</p>
            <h1>Build your target display configuration</h1>
            <p>
              You will review all candidate detections identified in held-out videos. No
              personalized policy decisions will be shown before your target set is finalized.
            </p>
          </div>
          <span className="flow-duration">Prototype: 4 candidates</span>
        </header>
        <section className="content-card evaluation-instruction">
          <h2>Your task</h2>
          <p>
            For each candidate, choose whether you would want the assistant to surface it during
            normal use of the situation. Leave it suppressed when you would not want it shown.
          </p>
          <div className="instruction-steps">
            <div><span>1</span><strong>View context</strong><small>No policy output</small></div>
            <div><span>2</span><strong>Review every candidate</strong><small>Evidence is optional</small></div>
            <div><span>3</span><strong>Confirm final load</strong><small>Revise before locking</small></div>
          </div>
        </section>
        <div className="button-row split-actions">
          <button className="button button-secondary" type="button" onClick={() => navigate('/evaluation')}>Back</button>
          <button className="button button-primary" type="button" onClick={start}>Begin candidate review</button>
        </div>
      </div>
    );
  }

  if (step === 'load') {
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header">
          <div>
            <p className="eyebrow">Study 1 · Final load review</p>
            <h1>Review the complete target set</h1>
            <p>Revise any decision before confirming. Policy comparisons remain hidden.</p>
          </div>
          <div className="load-count"><strong>{selectedCount}</strong><span>of {studyOneCandidates.length} surfaced</span></div>
        </header>
        <section className="target-review-list">
          {studyOneCandidates.map((item) => (
            <article key={item.id} className={decisions[item.id] ? 'target-surface' : 'target-suppress'}>
              <div>
                <span>{item.category}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <div className="target-review-actions" role="group" aria-label={`${item.title} decision`}>
                <button
                  className={`decision-button ${decisions[item.id] ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setDecisions((current) => ({ ...current, [item.id]: true }))}
                >
                  Surface
                </button>
                <button
                  className={`decision-button ${decisions[item.id] === false ? 'selected suppress-selected' : ''}`}
                  type="button"
                  onClick={() => setDecisions((current) => ({ ...current, [item.id]: false }))}
                >
                  Suppress
                </button>
              </div>
            </article>
          ))}
        </section>
        <div className="button-row split-actions">
          <button className="button button-secondary" type="button" onClick={() => {
            setActiveIndex(studyOneCandidates.length - 1);
            setStep('review');
          }}>Back to cards</button>
          <button className="button button-primary" type="button" onClick={confirmLoad}>Confirm target configuration</button>
        </div>
      </div>
    );
  }

  if (step === 'reliability') {
    const repeatedCandidate = studyOneCandidates[1];
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header">
          <div>
            <p className="eyebrow">Study 1 · Final candidate</p>
            <h1>One last review</h1>
            <p>Use the same decision rule as before.</p>
          </div>
          <span className="flow-duration">1 candidate remaining</span>
        </header>
        <section className="candidate-review-card">
          <div className="candidate-heading">
            <span>{repeatedCandidate.category}</span>
            <h2>{repeatedCandidate.title}</h2>
          </div>
          <p>{repeatedCandidate.description}</p>
          <fieldset className="binary-decision">
            <legend>What should the assistant do during normal use?</legend>
            <label>
              <input type="radio" name="reliability-decision" checked={reliabilityDecision === true} onChange={() => setReliabilityDecision(true)} />
              <span><strong>Surface this candidate</strong><small>Show it as privacy information.</small></span>
            </label>
            <label>
              <input type="radio" name="reliability-decision" checked={reliabilityDecision === false} onChange={() => setReliabilityDecision(false)} />
              <span><strong>Suppress this candidate</strong><small>Do not show it during normal use.</small></span>
            </label>
          </fieldset>
        </section>
        <div className="button-row form-actions">
          <button className="button button-primary" type="button" disabled={reliabilityDecision === undefined} onClick={finish}>
            Finish Study 1 prototype
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack evaluation-flow">
      <header className="evaluation-flow-header">
        <div>
          <p className="eyebrow">Study 1 · Candidate review</p>
          <h1>Review every candidate detection</h1>
          <p>Select what you would want surfaced during normal use of this situation.</p>
        </div>
        <span className="flow-duration">Candidate {activeIndex + 1} of {studyOneCandidates.length}</span>
      </header>

      <EvaluationStage
        number="01"
        title="Shared workspace handoff"
        context="Reviewing project notes on a shared display."
      />

      <section className="candidate-review-card">
        <div className="candidate-heading">
          <span>{candidate.category}</span>
          <h2>{candidate.title}</h2>
        </div>
        <p>{candidate.description}</p>
        <button className="evidence-button" type="button" onClick={() => setEvidenceOpen((value) => !value)}>
          {evidenceOpen ? 'Hide evidence highlight' : 'View optional evidence highlight'}
        </button>
        {evidenceOpen ? <div className="evidence-panel">{candidate.evidence}</div> : null}
        <fieldset className="binary-decision">
          <legend>What should the assistant do during normal use?</legend>
          <label>
            <input type="radio" name={`decision-${candidate.id}`} checked={decisions[candidate.id] === true} onChange={() => saveDecision(true)} />
            <span><strong>Surface this candidate</strong><small>Show it as privacy information.</small></span>
          </label>
          <label>
            <input type="radio" name={`decision-${candidate.id}`} checked={decisions[candidate.id] === false} onChange={() => saveDecision(false)} />
            <span><strong>Suppress this candidate</strong><small>Do not show it during normal use.</small></span>
          </label>
        </fieldset>
      </section>

      <div className="button-row split-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => activeIndex === 0 ? setStep('intro') : setActiveIndex((index) => index - 1)}
        >
          Back
        </button>
        <button className="button button-primary" type="button" disabled={decisions[candidate.id] === undefined} onClick={nextCandidate}>
          {activeIndex === studyOneCandidates.length - 1 ? 'Review final load' : 'Next candidate'}
        </button>
      </div>
    </div>
  );
}

export function StudyTwoEvaluationPage() {
  const navigate = useNavigate();
  const { session, updateSession } = useStudy();
  const existing = session.evaluationPrototype?.study === 'study-2'
    ? session.evaluationPrototype
    : null;
  const condition = existing?.condition ?? hiddenCondition(session.participantId);
  const [step, setStep] = useState<'intro' | 'task' | 'ratings' | 'post' | 'debrief'>('intro');
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [taskAnswers, setTaskAnswers] = useState<Record<string, string>>(
    existing?.studyTwo?.taskAnswers ?? {},
  );
  const [clipRatings, setClipRatings] = useState<Record<string, Record<string, number>>>(
    existing?.studyTwo?.clipRatings ?? {},
  );
  const [postRatings, setPostRatings] = useState<Record<string, number>>(
    existing?.studyTwo?.postSessionRatings ?? {},
  );
  const [feedback, setFeedback] = useState(existing?.studyTwo?.openFeedback ?? '');
  const clip = studyTwoClips[activeClipIndex];
  const reminder = clip.surfacedFor.includes(condition) ? clip.reminderText : undefined;
  const activeRatings = clipRatings[clip.id] ?? {};
  const clipRatingsComplete = clipRatingItems.every(([id]) => activeRatings[id] !== undefined);
  const postRatingsComplete = postSessionItems.every(([id]) => postRatings[id] !== undefined);

  const start = () => {
    const now = new Date().toISOString();
    updateSession((current) => ({
      ...current,
      evaluationPrototype: {
        study: 'study-2',
        condition,
        startedAt: existing?.startedAt ?? now,
        completedAt: null,
        studyTwo: {
          taskAnswers,
          clipRatings,
          postSessionRatings: postRatings,
          openFeedback: feedback,
          debriefViewedAt: null,
        },
      },
    }));
    setStep('task');
  };

  const saveClipRatings = () => {
    if (!clipRatingsComplete) return;
    if (activeClipIndex < studyTwoClips.length - 1) {
      setActiveClipIndex((index) => index + 1);
      setStep('task');
    } else {
      setStep('post');
    }
  };

  const submitPost = () => {
    if (!postRatingsComplete) return;
    const now = new Date().toISOString();
    updateSession((current) => ({
      ...current,
      evaluationPrototype: {
        study: 'study-2',
        condition,
        startedAt: current.evaluationPrototype?.study === 'study-2'
          ? current.evaluationPrototype.startedAt
          : now,
        completedAt: null,
        studyTwo: {
          taskAnswers,
          clipRatings,
          postSessionRatings: postRatings,
          openFeedback: feedback.trim(),
          debriefViewedAt: now,
        },
      },
    }));
    setStep('debrief');
  };

  const finish = () => {
    const now = new Date().toISOString();
    updateSession((current) => current.evaluationPrototype?.study === 'study-2'
      ? {
          ...current,
          completedAt: now,
          evaluationPrototype: {
            ...current.evaluationPrototype,
            completedAt: now,
          },
        }
      : current);
    navigate('/complete');
  };

  if (step === 'intro') {
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header study-two-header">
          <div>
            <p className="eyebrow">Study 2 · Reminder experience</p>
            <h1>Complete a visual-assistant task</h1>
            <p>
              You will experience one privacy-reminder configuration throughout the task. The
              configuration label and study hypothesis remain hidden until debriefing.
            </p>
          </div>
          <span className="flow-duration">Prototype: 2 clips</span>
        </header>
        <section className="content-card evaluation-instruction">
          <h2>What to expect</h2>
          <div className="instruction-steps">
            <div><span>1</span><strong>Watch and complete the task</strong><small>Reminders may or may not appear</small></div>
            <div><span>2</span><strong>Rate each clip</strong><small>Usefulness, annoyance, fit, protection</small></div>
            <div><span>3</span><strong>Rate the full session</strong><small>Then view the debrief</small></div>
          </div>
          <p className="neutral-note">
            There are no correct preferences. Rate the assistant’s reminder behavior even when no
            reminder appears.
          </p>
        </section>
        <div className="button-row split-actions">
          <button className="button button-secondary" type="button" onClick={() => navigate('/evaluation')}>Back</button>
          <button className="button button-primary green-button" type="button" onClick={start}>Begin task experience</button>
        </div>
      </div>
    );
  }

  if (step === 'ratings') {
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header study-two-header">
          <div>
            <p className="eyebrow">Study 2 · Clip {activeClipIndex + 1} rating</p>
            <h1>Rate the assistant’s reminder behavior</h1>
            <p>Answer each item based on the clip you just completed.</p>
          </div>
          <span className="flow-duration">4 required items</span>
        </header>
        <section className="rating-card">
          {clipRatingItems.map(([id, prompt]) => (
            <SevenPointScale
              key={id}
              itemId={`${clip.id}-${id}`}
              prompt={prompt}
              value={activeRatings[id]}
              onChange={(value) => setClipRatings((current) => ({
                ...current,
                [clip.id]: { ...(current[clip.id] ?? {}), [id]: value },
              }))}
            />
          ))}
        </section>
        <div className="button-row split-actions">
          <button className="button button-secondary" type="button" onClick={() => setStep('task')}>Back to clip</button>
          <button className="button button-primary" type="button" disabled={!clipRatingsComplete} onClick={saveClipRatings}>
            {activeClipIndex === studyTwoClips.length - 1 ? 'Continue to overall ratings' : 'Continue to next clip'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'post') {
    return (
      <div className="page-stack evaluation-flow">
        <header className="evaluation-flow-header study-two-header">
          <div>
            <p className="eyebrow">Study 2 · Overall experience</p>
            <h1>Rate the reminder configuration</h1>
            <p>Think about the complete task rather than any single clip.</p>
          </div>
          <span className="flow-duration">Final questionnaire</span>
        </header>
        <section className="rating-card">
          {postSessionItems.map(([id, prompt]) => (
            <SevenPointScale
              key={id}
              itemId={id}
              prompt={prompt}
              value={postRatings[id]}
              onChange={(value) => setPostRatings((current) => ({ ...current, [id]: value }))}
            />
          ))}
          <label className="field-label" htmlFor="evaluation-feedback">
            Optional feedback
            <span>What was useful, missing, or interruptive about the reminder behavior?</span>
            <textarea
              id="evaluation-feedback"
              className="text-input textarea-input"
              rows={5}
              maxLength={1200}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
        </section>
        <div className="button-row split-actions">
          <button className="button button-secondary" type="button" onClick={() => {
            setActiveClipIndex(studyTwoClips.length - 1);
            setStep('ratings');
          }}>Back</button>
          <button className="button button-primary green-button" type="button" disabled={!postRatingsComplete} onClick={submitPost}>
            Submit and view debrief
          </button>
        </div>
      </div>
    );
  }

  if (step === 'debrief') {
    const remindersShown = studyTwoClips.filter((item) => item.surfacedFor.includes(condition)).length;
    return (
      <div className="page-stack evaluation-flow">
        <section className="debrief-card">
          <span className="debrief-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">Study 2 debrief</p>
          <h1>Your assigned configuration was {condition === 'generic' ? 'Generic' : 'Full VPrivCal'}</h1>
          <p>
            Assignment occurred after calibration. All participants completed the same setup, but
            only the show-or-suppress policy differed during the task.
          </p>
          <div className="debrief-summary">
            <div><strong>{remindersShown}</strong><span>reminders surfaced</span></div>
            <div><strong>{studyTwoClips.length}</strong><span>clips completed</span></div>
            <div><strong>7-point</strong><span>experience measures</span></div>
          </div>
          {condition === 'generic' ? (
            <p className="debrief-explanation">
              The Generic condition used one fixed threshold that did not use your calibrated profile.
            </p>
          ) : (
            <p className="debrief-explanation">
              The Full VPrivCal condition used the category, cross-cutting, and Probe-informed policy
              created during your calibration.
            </p>
          )}
          <button className="button button-primary green-button" type="button" onClick={finish}>
            Finish Study 2 prototype
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack evaluation-flow">
      <header className="evaluation-flow-header study-two-header">
        <div>
          <p className="eyebrow">Study 2 · Task clip {activeClipIndex + 1} of {studyTwoClips.length}</p>
          <h1>{clip.title}</h1>
          <p>{clip.context}</p>
        </div>
        <span className="flow-duration">Policy condition hidden</span>
      </header>
      <EvaluationStage
        number={clip.number}
        title={clip.title}
        context={clip.context}
        reminder={reminder}
      />
      <section className="task-response-card">
        <label htmlFor={`task-${clip.id}`}>{clip.task}</label>
        <select
          id={`task-${clip.id}`}
          className="text-input"
          value={taskAnswers[clip.id] ?? ''}
          onChange={(event) => setTaskAnswers((current) => ({ ...current, [clip.id]: event.target.value }))}
        >
          <option value="">Choose an answer</option>
          {clip.taskOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </section>
      <div className="button-row split-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => activeClipIndex === 0 ? setStep('intro') : setActiveClipIndex((index) => index - 1)}
        >
          Back
        </button>
        <button className="button button-primary" type="button" disabled={!taskAnswers[clip.id]} onClick={() => setStep('ratings')}>
          Complete clip and rate behavior
        </button>
      </div>
    </div>
  );
}
