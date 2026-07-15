import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';
import { readProlificId } from '../utils/mode';

export function WelcomePage() {
  const navigate = useNavigate();
  const { session, configureParticipant } = useStudy();
  const initialProlificId = readProlificId() || session.consent?.prolificId || session.participantId;
  const [prolificId, setProlificId] = useState(initialProlificId);
  const [agreed, setAgreed] = useState(
    () => session.consent?.agreed === true && session.consent.prolificId === initialProlificId,
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hasProgress =
    session.participantId === prolificId.trim() && Object.keys(session.q10Responses).length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!prolificId.trim()) {
      setError('Enter your Prolific ID to continue.');
      return;
    }
    if (!agreed) {
      setError('Confirm that you agree to participate before continuing.');
      return;
    }
    setSubmitting(true);
    try {
      const configured = await configureParticipant(prolificId, new Date().toISOString());
      const resumeRoute = configured?.lastRoute;
      navigate(resumeRoute && resumeRoute !== '/' ? resumeRoute : '/q10');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to prepare the study session. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="consent-page">
      <header className="consent-title-card">
        <p className="study-kicker">VPrivCal research study</p>
        <h1>Visual AI privacy preference study</h1>
        <p>
          You are invited to take part in a short study about privacy and visual AI assistants.
          Please read this page before deciding whether to participate.
        </p>
        <div className="study-facts" aria-label="Study facts">
          <div><strong>5–7</strong><span>minutes</span></div>
          <div><strong>10</strong><span>preference questions</span></div>
          <div><strong>3</strong><span>synthetic scenes</span></div>
        </div>
      </header>

      <section className="consent-information-card" aria-labelledby="study-information-heading">
        <h2 id="study-information-heading">Study information</h2>
        <p className="research-contact">
          <strong>Lead researcher:</strong> Anran Xu, Ph.D., AI Safety Researcher at RIKEN, Japan
          <br />
          <strong>Contact:</strong> <a href="mailto:anran.xu@riken.jp">anran.xu@riken.jp</a>
        </p>

        <div className="consent-section-grid">
          <article>
            <h3>What is this study about?</h3>
            <p>
              Imagine using an AI assistant, such as smart glasses, that can see what you see. We
              want to understand how you would prefer that assistant to handle privacy-sensitive
              content in everyday visual scenes.
            </p>
          </article>

          <article>
            <h3>What will I do?</h3>
            <ul>
              <li>Answer ten short questions about default privacy-reminder preferences.</li>
              <li>Inspect three synthetic first-person scenes.</li>
              <li>Point to content an AI assistant should handle carefully.</li>
              <li>Review privacy categories and confirm a preference summary.</li>
            </ul>
          </article>

          <article>
            <h3>Are there any risks?</h3>
            <p>
              The study uses synthetic everyday scenes, but some questions involve medical
              information, children, bystanders, weapons, or other potentially sensitive topics.
              You may stop participating at any time.
            </p>
          </article>

          <article>
            <h3>Benefits and compensation</h3>
            <p>
              There may be no direct personal benefit. Your responses may help researchers design
              visual AI assistants that better reflect individual privacy preferences. Compensation
              is provided as described in the Prolific study listing.
            </p>
          </article>

          <article>
            <h3>Voluntary participation</h3>
            <p>
              Taking part is voluntary. You may choose not to participate or stop before completing
              the study without giving a reason. Contact the research team through Prolific or by
              email if you have questions.
            </p>
          </article>

          <article>
            <h3>Study materials</h3>
            <p>
              All images, people, visible records, and identifiers in this study are synthetic. When
              answering, imagine that the scenes reflect what your own visual AI assistant could see.
            </p>
          </article>
        </div>
      </section>

      <form className="consent-form-card" onSubmit={submit}>
        <div>
          <p className="study-kicker">Consent to participate</p>
          <h2>Enter your Prolific ID and confirm your choice</h2>
          <p>Use your Prolific ID, not your real name or email address.</p>
        </div>

        <label className="field-label" htmlFor="prolific-id">
          Prolific ID
          <input
            className="text-input"
            id="prolific-id"
            name="prolific-id"
            value={prolificId}
            maxLength={80}
            autoComplete="off"
            required
            onChange={(event) => {
              const nextId = event.target.value;
              setProlificId(nextId);
              if (nextId.trim() !== session.consent?.prolificId) setAgreed(false);
              setError('');
            }}
          />
        </label>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => {
              setAgreed(event.target.checked);
              setError('');
            }}
          />
          <span>
            I have read the information above, understand what the study involves, and voluntarily
            agree to participate.
          </span>
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-primary consent-submit" type="submit" disabled={submitting}>
          {submitting ? 'Preparing study…' : hasProgress ? 'Resume study' : 'I agree — start study'}
        </button>
      </form>
    </div>
  );
}
