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
  contentLabels?: readonly string[];
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
  contentLabels = [],
  reviewTitle = 'Highlighted visual content',
  showCategoryIdentity = false,
  onToggleEvidence,
  onAnswer,
}: CategoryReviewCardProps) {
  const specificContentLabel = [...new Set(contentLabels)].join(', ');

  return (
    <article className="category-review-card" aria-labelledby={`review-${category.id}`}>
      <div className="category-heading-row">
        <div>
          <p className={showCategoryIdentity ? 'eyebrow' : 'content-identity-label'}>
            {showCategoryIdentity ? 'Visual content review' : 'Specific highlighted content'}
          </p>
          <h2
            className={showCategoryIdentity ? undefined : 'content-identity-name'}
            id={`review-${category.id}`}
          >
            {showCategoryIdentity ? category.label : (specificContentLabel || reviewTitle)}
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

