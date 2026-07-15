import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { studyConfig } from '../config';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import { profileConfirmationOptions, q10Questions } from '../questions';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { dataset } = useDataset();
  const { session, updateSession } = useStudy();
  const [value, setValue] = useState(session.profileConfirmation?.value ?? '');
  const [comment, setComment] = useState(session.profileConfirmation?.comment ?? '');

  const allScenesComplete =
    dataset?.images.every((scene) => session.probeScenes[scene.id]?.completedAt) ?? false;

  const summaries = useMemo(() => {
    if (!dataset) return [];
    return dataset.categories.map((category) => {
      const question = q10Questions.find((item) => item.categoryId === category.id);
      const q10Response = question ? session.q10Responses[question.id] : undefined;
      const q10ActionLevel = typeof q10Response?.value === 'number' ? q10Response.value - 1 : null;
      const observations = dataset.images.flatMap((scene) => {
        const response = session.probeScenes[scene.id]?.categoryResponses[category.id];
        return response ? [{ scene, response }] : [];
      });
      const preferredLevel = median(
        observations
          .map(({ response }) => response.preferredAction)
          .filter((item): item is number => item !== null),
      );
      const preferredLabel = dataset.probeQuestions.preferredAction.options.find(
        (option) => option.value === preferredLevel,
      )?.label;
      const corrections = observations.filter(
        ({ response }) =>
          q10ActionLevel !== null &&
          response.preferredAction !== null &&
          response.preferredAction !== q10ActionLevel,
      );
      return {
        category,
        q10Response,
        preferredLabel,
        corrections,
        interpretiveGap: observations.some(({ response }) => response.awarenessStatus === 2),
        perceptualGap: observations.some(({ response }) => response.awarenessStatus === 3),
        rejected: observations.some(({ response }) => response.awarenessStatus === 4),
      };
    });
  }, [dataset, session.probeScenes, session.q10Responses]);

  if (!dataset || !allScenesComplete) {
    return (
      <section className="content-card narrow-card">
        <h1>Complete the Probe first</h1>
        <p>The profile is generated only after every category in all three scenes is reviewed.</p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            const incomplete = session.randomizedSceneOrder.find(
              (sceneId) => !session.probeScenes[sceneId]?.completedAt,
            );
            navigate(incomplete ? `/probe/${incomplete}` : '/probe/instructions');
          }}
        >
          Return to Probe
        </button>
      </section>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    const now = new Date().toISOString();
    updateSession((current) => ({
      ...current,
      profileConfirmation: {
        value,
        ...(studyConfig.profileCommentsEnabled && comment.trim()
          ? { comment: comment.trim() }
          : {}),
        answeredAt: now,
      },
      completedAt: now,
    }));
    navigate('/complete');
  };

  return (
    <div className="page-stack profile-page">
      <header className="profile-hero">
        <p className="eyebrow">Personalized policy summary</p>
        <h1>Your visual privacy reminder profile</h1>
        <p>
          This summary combines your Q10 defaults with category-specific Probe preferences and
          awareness responses. It is not a diagnosis or a guarantee of privacy protection.
        </p>
      </header>

      <section className="profile-grid" aria-label="Category preference summary">
        {summaries.map((summary) => (
          <article className="profile-card" key={summary.category.id}>
            <h2>{summary.category.label}</h2>
            <dl>
              <div>
                <dt>Q10 default</dt>
                <dd>{summary.q10Response?.label ?? 'No response recorded'}</dd>
              </div>
              <div>
                <dt>Probe-informed preference</dt>
                <dd>{summary.preferredLabel ?? 'No contextual response'}</dd>
              </div>
            </dl>
            {summary.corrections.length > 0 ? (
              <div className="profile-corrections">
                <strong>Context-specific corrections</strong>
                <ul>
                  {summary.corrections.map(({ scene, response }) => (
                    <li key={scene.id}>
                      {scene.title}: {dataset.probeQuestions.preferredAction.options.find(
                        (option) => option.value === response.preferredAction,
                      )?.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="status-chip-row">
              {summary.interpretiveGap ? <span className="status-chip">Interpretive gap</span> : null}
              {summary.perceptualGap ? <span className="status-chip">Perceptual / capability gap</span> : null}
              {summary.rejected ? <span className="status-chip muted-chip">Not a concern in one context</span> : null}
              {!summary.interpretiveGap && !summary.perceptualGap && !summary.rejected ? (
                <span className="status-chip positive-chip">No awareness gap recorded</span>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <form className="content-card confirmation-card" onSubmit={submit}>
        <fieldset className="option-fieldset">
          <legend>
            Does this summary generally match how you want a visual AI assistant to handle
            privacy-sensitive content?
          </legend>
          <div className="option-list compact-options">
            {profileConfirmationOptions.map((option) => (
              <label className="radio-card" key={option.value}>
                <input
                  type="radio"
                  name="profile-confirmation"
                  checked={value === option.value}
                  onChange={() => setValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {studyConfig.profileCommentsEnabled ? (
          <label className="field-label" htmlFor="profile-comment">
            Optional comment
            <textarea
              className="text-input textarea-input"
              id="profile-comment"
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
        ) : null}
        <div className="button-row form-actions split-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => navigate(`/probe/${session.randomizedSceneOrder.at(-1)}`)}
          >
            Back
          </button>
          <button className="button button-primary green-button" type="submit" disabled={!value}>
            Confirm profile
          </button>
        </div>
      </form>
    </div>
  );
}

