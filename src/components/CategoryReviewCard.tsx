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
  disabled?: boolean;
  reviewTitle?: string;
  showCategoryIdentity?: boolean;
  onToggleEvidence: () => void;
  onAnswer: (field: 'awarenessStatus' | 'preferredAction', value: number) => void;
}

export function CategoryReviewCard({
  category,
  response,
  awarenessQuestion,
  actionQuestion,
  evidenceVisible,
  disabled = false,
  reviewTitle = 'Highlighted visual content',
  showCategoryIdentity = false,
  onToggleEvidence,
  onAnswer,
}: CategoryReviewCardProps) {
  return (
    <article className="category-review-card" aria-labelledby={`review-${category.id}`}>
      <div className="category-heading-row">
        <div>
          <p className="eyebrow">Visual content review</p>
          <h2 id={`review-${category.id}`}>
            {showCategoryIdentity ? category.label : reviewTitle}
          </h2>
          {showCategoryIdentity ? <p>{category.description}</p> : null}
        </div>
        <button
          className={`button button-secondary ${evidenceVisible ? 'is-active' : ''}`}
          type="button"
          disabled={disabled}
          aria-pressed={evidenceVisible}
          onClick={onToggleEvidence}
        >
          {evidenceVisible ? 'Hide highlight' : 'Show highlight'}
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
                disabled={disabled}
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
                disabled={disabled}
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

