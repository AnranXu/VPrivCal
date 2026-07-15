import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';
import { q10Questions } from '../questions';

export function Q10Page() {
  const navigate = useNavigate();
  const { session, updateSession } = useStudy();
  const index = Math.min(session.q10ActiveIndex, q10Questions.length - 1);
  const question = q10Questions[index];
  const response = session.q10Responses[question.id];

  useEffect(() => {
    const now = new Date().toISOString();
    updateSession((current) => {
      if (current.q10FirstViewedAt[question.id] && current.q10StartedAt) return current;
      return {
        ...current,
        q10StartedAt: current.q10StartedAt ?? now,
        q10FirstViewedAt: {
          ...current.q10FirstViewedAt,
          [question.id]: current.q10FirstViewedAt[question.id] ?? now,
        },
      };
    });
  }, [question.id, updateSession]);

  const answer = (value: number | string, label: string) => {
    const now = new Date().toISOString();
    updateSession((current) => {
      const previous = current.q10Responses[question.id];
      return {
        ...current,
        q10Responses: {
          ...current.q10Responses,
          [question.id]: {
            questionId: question.id,
            value,
            label,
            firstViewedAt: current.q10FirstViewedAt[question.id] ?? now,
            answeredAt: now,
            changes:
              previous && previous.value !== value ? previous.changes + 1 : previous?.changes ?? 0,
          },
        },
      };
    });
  };

  const next = () => {
    if (!response) return;
    if (index === q10Questions.length - 1) {
      updateSession((current) => ({
        ...current,
        q10CompletedAt: current.q10CompletedAt ?? new Date().toISOString(),
      }));
      navigate('/probe/instructions');
      return;
    }
    updateSession((current) => ({ ...current, q10ActiveIndex: index + 1 }));
  };

  const back = () => {
    if (index === 0) {
      navigate('/');
    } else {
      updateSession((current) => ({ ...current, q10ActiveIndex: index - 1 }));
    }
  };

  return (
    <section className="question-card">
      <div className="question-count">Question {index + 1} of {q10Questions.length}</div>
      <p className="eyebrow">VPrivCal-Q10 · {question.id}</p>
      <h1>{question.title}</h1>
      {question.example ? <p className="example-text"><strong>Examples:</strong> {question.example}</p> : null}
      <fieldset className="option-fieldset q10-options">
        <legend>{question.prompt}</legend>
        <div className="option-list">
          {question.options.map((option) => (
            <label className="radio-card numbered-option" key={option.value}>
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={response?.value === option.value}
                onChange={() => answer(option.value, option.label)}
              />
              <span className="option-number">{option.value}</span>
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="button-row form-actions split-actions">
        <button className="button button-secondary" type="button" onClick={back}>Back</button>
        <button className="button button-primary" type="button" disabled={!response} onClick={next}>
          {index === q10Questions.length - 1 ? 'Continue to VPrivCal-Probe' : 'Next question'}
        </button>
      </div>
    </section>
  );
}
