import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { studyConfig } from '../config';
import { probeQuestionPrompts } from '../questions';
import type {
  CategoryResponse,
  NormalizedPoint,
  PixelPoint,
  PointSelection,
  PrivacyCategory,
  ProbeScene,
  VPrivCalDataset,
} from '../types';
import { createPointSelection } from '../utils/probe';
import { CategoryReviewCard } from './CategoryReviewCard';
import { HintModeActiveAlert } from './HintModeActiveAlert';
import { ResponsiveImageCanvas } from './ResponsiveImageCanvas';

type HintStep = 'point' | 'delete' | 'review' | 'answer' | 'next-category' | 'complete';

const practiceScene: ProbeScene = {
  id: 'probe_hint_practice',
  fileName: 'probe_hint_practice.svg',
  assetPath: 'assets/images/probe_hint_practice.svg',
  width: 1400,
  height: 1000,
  scenarioType: 'private',
  title: 'Practice workspace',
  context: 'A simulated desk scene used only to practice the Probe controls.',
  availableCategoryIds: ['pii', 'personal_life'],
  categoryEvidence: [
    { categoryId: 'pii', detectionIds: ['hint_mail'] },
    { categoryId: 'personal_life', detectionIds: ['hint_hobby'] },
  ],
  detections: [
    {
      id: 'hint_mail',
      label: 'Practice mail',
      primaryCategoryId: 'pii',
      categoryIds: ['pii'],
      subcategory: 'practice',
      bbox: { x: 0.34, y: 0.52, width: 0.25, height: 0.18 },
      clickable: true,
      description: 'Simulated addressed mail on the desk.',
    },
    {
      id: 'hint_hobby',
      label: 'Practice hobby materials',
      primaryCategoryId: 'personal_life',
      categoryIds: ['personal_life'],
      subcategory: 'practice',
      bbox: { x: 0.64, y: 0.45, width: 0.2, height: 0.26 },
      clickable: true,
      description: 'Simulated hobby materials on the desk.',
    },
  ],
};

const stepContent: Record<HintStep, { number: number; title: string; instruction: string }> = {
  point: {
    number: 1,
    title: 'Place a practice point',
    instruction: 'Use the real pointer tool below and click anywhere on the practice image.',
  },
  delete: {
    number: 2,
    title: 'Delete the practice point',
    instruction: 'The simulated point is now in the real selection sidebar. Select Delete.',
  },
  review: {
    number: 3,
    title: 'Move to the privacy review',
    instruction: 'Select “Review all privacy threats” to practice moving to the next phase.',
  },
  answer: {
    number: 4,
    title: 'Preview the review questions',
    instruction: 'Question choices are disabled in Hint mode. Review the layout, then select Next hint.',
  },
  'next-category': {
    number: 5,
    title: 'Preview moving to the next item',
    instruction: 'This is where Next item appears in the real Probe. Select Next hint to continue.',
  },
  complete: {
    number: 5,
    title: 'Practice complete',
    instruction: 'You used the same controls as the study. Exit Hint mode to begin the real scene.',
  },
};

function makePracticeResponse(categoryId: string, presentationOrder: number): CategoryResponse {
  return {
    sceneId: practiceScene.id,
    categoryId,
    presentationOrder,
    linkedDetectionIds:
      practiceScene.categoryEvidence.find((item) => item.categoryId === categoryId)
        ?.detectionIds ?? [],
    spontaneouslySelected: false,
    awarenessStatus: null,
    preferredAction: null,
    evidenceOpened: true,
    evidenceToggleCount: 0,
    changes: 0,
    firstViewedAt: '',
    answeredAt: null,
    durationMs: 0,
  };
}

interface ProbeHintModeProps {
  dataset: VPrivCalDataset;
  onExit: (completed: boolean) => void;
  required?: boolean;
}

interface HintCalloutProps {
  step: HintStep;
  placement: 'image' | 'delete' | 'review' | 'answer' | 'next' | 'complete';
  allowExit: boolean;
  calloutRef: RefObject<HTMLElement>;
  onAdvance: () => void;
  onExit: () => void;
}

function HintCallout({
  step,
  placement,
  allowExit,
  calloutRef,
  onAdvance,
  onExit,
}: HintCalloutProps) {
  const content = stepContent[step];
  const complete = step === 'complete';

  return (
    <section
      className={`probe-hint-callout is-${placement} ${complete ? 'is-complete' : ''}`}
      ref={calloutRef}
      tabIndex={-1}
      aria-live="polite"
      aria-label="Interactive hint mode"
    >
      <div className="probe-hint-callout-heading">
        <div className="probe-hint-mode-label">
          <span aria-hidden="true">i</span>
          You are in Hint mode
        </div>
        <div className="probe-hint-callout-actions">
          {allowExit && !complete ? (
            <button className="button button-quiet probe-hint-exit" type="button" onClick={onExit}>
              Exit hint
            </button>
          ) : null}
          <button className="button probe-hint-next" type="button" onClick={onAdvance}>
            {complete ? 'Finish hint and begin Probe' : 'Next hint'}
          </button>
        </div>
      </div>
      <p className="eyebrow">Guided practice · Step {content.number} of 5</p>
      <h1>{content.title}</h1>
      <p>{content.instruction}</p>
    </section>
  );
}

export function ProbeHintMode({ dataset, onExit, required = false }: ProbeHintModeProps) {
  const [entryAlertOpen, setEntryAlertOpen] = useState(true);
  const [step, setStep] = useState<HintStep>('point');
  const [selections, setSelections] = useState<PointSelection[]>([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [evidenceVisible, setEvidenceVisible] = useState(true);
  const imageColumnRef = useRef<HTMLDivElement>(null);
  const activeHintRef = useRef<HTMLElement>(null);
  const [imageColumnHeight, setImageColumnHeight] = useState<number | null>(null);

  const practiceCategories = useMemo(() => {
    const preferredIds = ['pii', 'personal_life'];
    const preferred = preferredIds
      .map((categoryId) => dataset.categories.find((category) => category.id === categoryId))
      .filter((category): category is PrivacyCategory => Boolean(category));
    return preferred.length >= 2 ? preferred : dataset.categories.slice(0, 2);
  }, [dataset.categories]);

  const [responses, setResponses] = useState<Record<string, CategoryResponse>>(() =>
    Object.fromEntries(
      practiceCategories.map((category, index) => [
        category.id,
        makePracticeResponse(category.id, index),
      ]),
    ),
  );

  const activeCategory = practiceCategories[activeCategoryIndex] ?? practiceCategories[0];
  const activeResponse = activeCategory ? responses[activeCategory.id] : undefined;
  const reviewMode = step === 'answer' || step === 'next-category' || step === 'complete';
  const imageFocused = step === 'point';
  const sidebarFocused = step !== 'point';
  const completedCount = practiceCategories.filter((category) => {
    const response = responses[category.id];
    return response?.awarenessStatus != null && response.preferredAction != null;
  }).length;
  const evidenceIds = evidenceVisible && activeResponse ? activeResponse.linkedDetectionIds : [];
  const imageInertAttributes: Record<string, string> = imageFocused ? {} : { inert: '' };
  const sidebarInertAttributes: Record<string, string> = sidebarFocused ? {} : { inert: '' };
  const alertInertAttributes: Record<string, string> = entryAlertOpen ? { inert: '' } : {};

  useEffect(() => {
    const element = imageColumnRef.current;
    if (!element) return;
    const measure = () => setImageColumnHeight(Math.ceil(element.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [reviewMode]);

  useEffect(() => {
    if (entryAlertOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const element = activeHintRef.current;
      if (!element) return;
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      element.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entryAlertOpen, step]);

  const addPracticePoint = (normalizedPoint: NormalizedPoint, displayedPoint: PixelPoint) => {
    if (step !== 'point') return;
    setSelections([
      createPointSelection({
        sceneId: practiceScene.id,
        clickNumber: 1,
        normalizedPoint,
        displayedPoint,
        matchedDetections: [],
      }),
    ]);
    setStep('delete');
  };

  const deletePracticePoint = () => {
    if (step !== 'delete') return;
    setSelections([]);
    setStep('review');
  };

  const beginPracticeReview = () => {
    if (step !== 'review') return;
    setStep('answer');
  };

  const moveToNextCategory = () => {
    if (step !== 'next-category') return;
    setActiveCategoryIndex(Math.min(1, practiceCategories.length - 1));
    setStep('complete');
  };

  const advanceHint = () => {
    if (step === 'point') {
      if (selections.length === 0) {
        const normalizedPoint = { x: 0.48, y: 0.58 };
        setSelections([
          createPointSelection({
            sceneId: practiceScene.id,
            clickNumber: 1,
            normalizedPoint,
            displayedPoint: {
              x: normalizedPoint.x * practiceScene.width,
              y: normalizedPoint.y * practiceScene.height,
            },
            matchedDetections: [],
          }),
        ]);
      }
      setStep('delete');
      return;
    }
    if (step === 'delete') {
      setSelections([]);
      setStep('review');
      return;
    }
    if (step === 'review') {
      setStep('answer');
      return;
    }
    if (step === 'answer') {
      if (!activeCategory || !activeResponse) return;
      setResponses((current) => ({
        ...current,
        [activeCategory.id]: {
          ...activeResponse,
          awarenessStatus: dataset.probeQuestions.awarenessStatus.options[0]?.value ?? 1,
          preferredAction: dataset.probeQuestions.preferredAction.options[0]?.value ?? 0,
        },
      }));
      setStep('next-category');
      return;
    }
    if (step === 'next-category') {
      moveToNextCategory();
      return;
    }
    onExit(true);
  };

  const renderCallout = (hintStep: HintStep, placement: HintCalloutProps['placement']) => (
    <HintCallout
      step={hintStep}
      placement={placement}
      allowExit={!required}
      calloutRef={activeHintRef}
      onAdvance={advanceHint}
      onExit={() => onExit(false)}
    />
  );

  if (!activeCategory || !activeResponse) return null;

  return (
    <div className="page-stack probe-page probe-hint-mode">
      {entryAlertOpen ? (
        <HintModeActiveAlert onContinue={() => setEntryAlertOpen(false)} />
      ) : null}
      <header
        className="scene-header probe-hint-scene-header"
        {...alertInertAttributes}
        aria-hidden={entryAlertOpen}
      >
        <div>
          <p className="eyebrow">Simulated Probe scene</p>
          <h2>{practiceScene.title}</h2>
          <p>{practiceScene.context}</p>
        </div>
        <span className="phase-badge">No practice data is saved</span>
      </header>

      <div className="probe-workspace" {...alertInertAttributes} aria-hidden={entryAlertOpen}>
        <div
          className={`probe-image-column hint-focus-section ${
            imageFocused ? 'is-focused' : 'is-dimmed'
          }`}
          ref={imageColumnRef}
          {...imageInertAttributes}
          aria-hidden={!imageFocused}
        >
          {step === 'point' ? renderCallout('point', 'image') : null}
          <ResponsiveImageCanvas
            scene={practiceScene}
            selections={selections}
            activeDetectionIds={reviewMode ? evidenceIds : []}
            interactive={step === 'point'}
            onPoint={addPracticePoint}
          />
        </div>

        <aside
          className={`probe-sidebar ${reviewMode ? 'probe-review-sidebar' : ''} hint-focus-section ${
            sidebarFocused ? 'is-focused' : 'is-dimmed'
          }`}
          {...sidebarInertAttributes}
          aria-label={reviewMode ? 'Practice visual content review' : 'Practice pointing annotations'}
          aria-hidden={!sidebarFocused}
          style={imageColumnHeight ? { height: `${imageColumnHeight}px` } : undefined}
        >
          <div className="probe-sidebar-scroll">
            {!reviewMode ? (
              <section className="selection-panel probe-sidebar-panel">
                <div className="section-heading-row">
                  <div>
                    <p className="eyebrow">Practice selections</p>
                    <h2>{selections.length} selected</h2>
                  </div>
                </div>
                {step === 'delete' ? renderCallout('delete', 'delete') : null}
                {selections.length === 0 ? (
                  <p className="empty-state">
                    {step === 'review'
                      ? 'Practice point deleted. Continue to the review.'
                      : 'No practice point selected yet.'}
                  </p>
                ) : (
                  <ol className="selection-list">
                    {selections.map((selection) => (
                      <li key={selection.selectionId}>
                        <span className="selection-number">1</span>
                        <div className="selection-summary">
                          <strong>Practice point</strong>
                          <small>Simulated—nothing is saved</small>
                        </div>
                        <button
                          className="text-button danger-text hint-action-button"
                          type="button"
                          onClick={deletePracticePoint}
                          disabled={step !== 'delete'}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <label className="confirmation-check">
                  <input type="checkbox" disabled />
                  <span>I did not identify any additional privacy-sensitive content.</span>
                </label>
                {step === 'review' ? renderCallout('review', 'review') : null}
                <div className="button-row form-actions split-actions">
                  <button className="button button-secondary" type="button" disabled>
                    Back
                  </button>
                  <button
                    className={`button button-primary ${step === 'review' ? 'hint-action-button' : ''}`}
                    type="button"
                    disabled={step !== 'review'}
                    onClick={beginPracticeReview}
                  >
                    Review all privacy threats
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="sidebar-review-progress" aria-labelledby="hint-review-progress">
                  <div className="sidebar-progress-heading">
                    <div>
                      <p className="eyebrow" id="hint-review-progress">Practice progress</p>
                      <strong>Step {activeCategoryIndex + 1} of {practiceCategories.length}</strong>
                    </div>
                    <span>{completedCount} complete</span>
                  </div>
                  <progress
                    max={practiceCategories.length}
                    value={completedCount}
                    aria-label={`${completedCount} of ${practiceCategories.length} practice review items complete`}
                  />
                  <p>Question choices are disabled during Hint mode.</p>
                </section>
                {studyConfig.showProbeCategoryIdentities ? (
                  <nav className="category-stepper sidebar-stepper" aria-label="Practice category navigation">
                    {practiceCategories.map((category, index) => (
                      <button
                        className={`${index === activeCategoryIndex ? 'is-current' : ''} ${
                          responses[category.id]?.awarenessStatus != null &&
                          responses[category.id]?.preferredAction != null
                            ? 'is-complete'
                            : ''
                        }`}
                        type="button"
                        key={category.id}
                        disabled
                      >
                        <span>{index + 1}</span>
                        {category.label}
                      </button>
                    ))}
                  </nav>
                ) : null}
                {step === 'answer' ? renderCallout('answer', 'answer') : null}
                <CategoryReviewCard
                  category={activeCategory}
                  response={activeResponse}
                  reviewTitle="Highlighted practice content"
                  showCategoryIdentity={studyConfig.showProbeCategoryIdentities}
                  awarenessQuestion={{
                    ...dataset.probeQuestions.awarenessStatus,
                    prompt: probeQuestionPrompts.awareness,
                  }}
                  actionQuestion={{
                    ...dataset.probeQuestions.preferredAction,
                    prompt: probeQuestionPrompts.action,
                  }}
                  evidenceVisible={evidenceVisible}
                  disabled
                  onToggleEvidence={() => setEvidenceVisible((current) => !current)}
                  onAnswer={() => undefined}
                />
                {step === 'next-category' ? renderCallout('next-category', 'next') : null}
                {step === 'complete' ? renderCallout('complete', 'complete') : null}
                <div className="button-row form-actions split-actions">
                  <button className="button button-secondary" type="button" disabled>
                    Previous item
                  </button>
                  <button
                    className={`button button-primary ${
                      step === 'next-category' ? 'hint-action-button' : ''
                    }`}
                    type="button"
                    disabled={step !== 'next-category'}
                    onClick={moveToNextCategory}
                  >
                    Next item
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
