import type {
  CategoryResponse,
  PrivacyCategory,
  ProbeQuestionDefinition,
} from '../types';

interface CategoryReviewCardProps {
  category: PrivacyCategory;
  response: CategoryResponse;
  awarenessQuestion: ProbeQuestionDefinition;
  actionQuestion: ProbeQuestionDefinition;
  evidenceVisible: boolean;
  onToggleEvidence: () => void;
  onAnswer: (field: 'awarenessStatus' | 'preferredAction', value: number) => void;
}

export function CategoryReviewCard({
  category,
  response,
  awarenessQuestion,
  actionQuestion,
  evidenceVisible,
  onToggleEvidence,
  onAnswer,
}: CategoryReviewCardProps) {
  return (
    <article className="category-review-card" aria-labelledby={`category-${category.id}`}>
      <div className="category-heading-row">
        <div>
          <p className="eyebrow">Category review</p>
          <h2 id={`category-${category.id}`}>{category.label}</h2>
          <p>{category.description}</p>
        </div>
        <button
          className={`button button-secondary ${evidenceVisible ? 'is-active' : ''}`}
          type="button"
          aria-pressed={evidenceVisible}
          onClick={onToggleEvidence}
        >
          {evidenceVisible ? 'Hide evidence' : 'Show evidence'}
        </button>
      </div>

      <fieldset className="option-fieldset">
        <legend>{awarenessQuestion.prompt}</legend>
        <div className="option-list">
          {awarenessQuestion.options.map((option) => (
            <label className="radio-card" key={option.value}>
              <input
                type="radio"
                name={`${category.id}-awareness`}
                value={option.value}
                checked={response.awarenessStatus === option.value}
                onChange={() => onAnswer('awarenessStatus', option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="option-fieldset">
        <legend>{actionQuestion.prompt}</legend>
        <div className="option-list compact-options">
          {actionQuestion.options.map((option) => (
            <label className="radio-card" key={option.value}>
              <input
                type="radio"
                name={`${category.id}-action`}
                value={option.value}
                checked={response.preferredAction === option.value}
                onChange={() => onAnswer('preferredAction', option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </article>
  );
}

