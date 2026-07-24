import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CategoryReviewCard } from '../components/CategoryReviewCard';
import { InitialProbeHintPrompt } from '../components/InitialProbeHintPrompt';
import { ProbeHintMode } from '../components/ProbeHintMode';
import { ProbeInterfaceHint } from '../components/ProbeInterfaceHint';
import { ResponsiveImageCanvas } from '../components/ResponsiveImageCanvas';
import { studyConfig } from '../config';
import { readEvaluationStudy } from '../utils/mode';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import { probeQuestionPrompts } from '../questions';
import type {
  CategoryResponse,
  Detection,
  NormalizedPoint,
  PixelPoint,
} from '../types';
import {
  hitTestDetections,
  smallestDetectionCandidates,
} from '../utils/coordinates';
import {
  createPointSelection,
  defaultAwarenessStatusForCategory,
  isCategoryIndexUnlocked,
  isSceneReviewComplete,
} from '../utils/probe';
import { recordInitialHintCompletion, recordProbeCompletion } from '../utils/probeTiming';

interface PendingMatch {
  normalizedPoint: NormalizedPoint;
  displayedPoint: PixelPoint;
  matches: Detection[];
  candidates: Detection[];
}

export function ProbeScenePage() {
  const { sceneId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { dataset } = useDataset();
  const { session, updateSession, expertReview } = useStudy();
  const scene = dataset?.images.find((item) => item.id === sceneId);
  const sceneState = session.probeScenes[sceneId];
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const [pointingError, setPointingError] = useState('');
  const [hintMode, setHintMode] = useState(
    () =>
      expertReview ||
      Boolean((location.state as { startProbeHint?: boolean } | null)?.startProbeHint),
  );
  const imageColumnRef = useRef<HTMLDivElement>(null);
  const reviewSidebarScrollRef = useRef<HTMLDivElement>(null);
  const [imageColumnHeight, setImageColumnHeight] = useState<number | null>(null);
  const initialHintRequired =
    !expertReview &&
    sceneId === session.randomizedSceneOrder[0] &&
    !session.probeHintCompletedAt;

  const categoriesById = useMemo(
    () => new Map(dataset?.categories.map((category) => [category.id, category]) ?? []),
    [dataset],
  );

  useEffect(() => {
    if (hintMode || initialHintRequired || !sceneState || sceneState.startedAt) return;
    updateSession((current) => ({
      ...current,
      probeScenes: {
        ...current.probeScenes,
        [sceneId]: { ...current.probeScenes[sceneId], startedAt: new Date().toISOString() },
      },
    }));
  }, [hintMode, initialHintRequired, sceneId, sceneState, updateSession]);

  useEffect(() => {
    setEvidenceVisible(sceneState?.phase === 'review');
    if (sceneState?.phase === 'review') {
      window.requestAnimationFrame(() => reviewSidebarScrollRef.current?.scrollTo({ top: 0 }));
    }
  }, [sceneState?.activeCategoryIndex, sceneState?.phase]);

  useEffect(() => {
    const element = imageColumnRef.current;
    if (!element) return;
    const measure = () => setImageColumnHeight(Math.ceil(element.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [sceneId, sceneState?.phase]);

  if (!dataset || !scene || !sceneState) {
    return (
      <section className="content-card narrow-card">
        <h1>Scene unavailable</h1>
        <p>Complete participant setup before opening a Probe scene.</p>
        <button className="button button-primary" type="button" onClick={() => navigate('/participant')}>
          Return to participant setup
        </button>
      </section>
    );
  }

  if (hintMode) {
    return (
      <ProbeHintMode
        dataset={dataset}
        required={initialHintRequired}
        onExit={(completed) => {
          if (completed && !expertReview) {
            const now = new Date().toISOString();
            updateSession((current) => recordInitialHintCompletion(current, now));
          }
          setHintMode(false);
        }}
      />
    );
  }

  if (initialHintRequired) {
    return <InitialProbeHintPrompt onStart={() => setHintMode(true)} />;
  }

  const addSelection = (
    normalizedPoint: NormalizedPoint,
    displayedPoint: PixelPoint,
    matches: Detection[],
    selectedDetection?: Detection,
  ) => {
    updateSession((current) => {
      const currentScene = current.probeScenes[scene.id];
      const selection = createPointSelection({
        sceneId: scene.id,
        clickNumber: currentScene.pointSelections.length + 1,
        normalizedPoint,
        displayedPoint,
        matchedDetections: matches,
        selectedDetection,
      });
      return {
        ...current,
        probeScenes: {
          ...current.probeScenes,
          [scene.id]: {
            ...currentScene,
            pointSelections: [...currentScene.pointSelections, selection],
            noAdditionalSelected: false,
          },
        },
      };
    });
    setPendingMatch(null);
    setPointingError('');
  };

  const handlePoint = (normalizedPoint: NormalizedPoint, displayedPoint: PixelPoint) => {
    const matches = hitTestDetections(
      normalizedPoint,
      scene.detections,
      dataset.coordinateSystem.hitPadding,
    );
    if (matches.length === 0) {
      addSelection(normalizedPoint, displayedPoint, []);
      return;
    }

    const candidates = smallestDetectionCandidates(matches);
    const primaryCategories = new Set(candidates.map((candidate) => candidate.primaryCategoryId));
    if (candidates.length > 1 && primaryCategories.size > 1) {
      setPendingMatch({ normalizedPoint, displayedPoint, matches, candidates });
      return;
    }
    addSelection(normalizedPoint, displayedPoint, matches, candidates[0]);
  };

  const removeSelection = (selectionId: string) => {
    updateSession((current) => {
      const currentScene = current.probeScenes[scene.id];
      const remaining = currentScene.pointSelections
        .filter((selection) => selection.selectionId !== selectionId)
        .map((selection, index) => ({ ...selection, clickNumber: index + 1 }));
      return {
        ...current,
        probeScenes: {
          ...current.probeScenes,
          [scene.id]: { ...currentScene, pointSelections: remaining },
        },
      };
    });
  };

  const beginReview = () => {
    if (sceneState.pointSelections.length === 0 && !sceneState.noAdditionalSelected) {
      setPointingError('Select content or confirm that you did not identify any additional content.');
      return;
    }
    const now = new Date().toISOString();
    const responses = Object.fromEntries(
      sceneState.categoryOrder.map((categoryId, index): [string, CategoryResponse] => {
        const linkedDetectionIds =
          scene.categoryEvidence.find((evidence) => evidence.categoryId === categoryId)
            ?.detectionIds ?? [];
        const spontaneouslySelected = sceneState.pointSelections.some(
          (selection) => selection.finalCategoryId === categoryId,
        );
        return [
          categoryId,
          {
            sceneId: scene.id,
            categoryId,
            presentationOrder: index,
            linkedDetectionIds,
            spontaneouslySelected,
            awarenessStatus: defaultAwarenessStatusForCategory(
              sceneState.pointSelections,
              categoryId,
              dataset.probeQuestions.awarenessStatus.options[0]?.value,
            ),
            preferredAction: null,
            evidenceOpened: index === 0,
            evidenceToggleCount: 0,
            changes: 0,
            firstViewedAt: index === 0 ? now : '',
            answeredAt: null,
            durationMs: 0,
          },
        ];
      }),
    );
    updateSession((current) => ({
      ...current,
      probeScenes: {
        ...current.probeScenes,
        [scene.id]: {
          ...current.probeScenes[scene.id],
          phase: 'review',
          categoryResponses: responses,
          activeCategoryIndex: 0,
        },
      },
    }));
  };

  const setNoAdditional = (checked: boolean) => {
    updateSession((current) => ({
      ...current,
      probeScenes: {
        ...current.probeScenes,
        [scene.id]: {
          ...current.probeScenes[scene.id],
          noAdditionalSelected: checked,
        },
      },
    }));
  };

  if (sceneState.phase === 'pointing') {
    return (
      <div className="page-stack probe-page">
        <header className="scene-header">
          <div>
            <p className="eyebrow">{scene.scenarioType} scene · Phase A</p>
            <h1>{scene.title}</h1>
            <p>{scene.context}</p>
          </div>
          <div className="scene-header-actions">
            <ProbeInterfaceHint onStart={() => setHintMode(true)} />
            {expertReview ? (
              <button className="button button-quiet" type="button" onClick={() => navigate('/')}>
                Choose another scene
              </button>
            ) : null}
            <span className="phase-badge">Point first</span>
          </div>
        </header>
        <aside className="probe-instruction">
          Click or tap any specific content in the image that you think an AI assistant should
          handle carefully for privacy. Select as many areas as you think are relevant. When
          finished, review all privacy threats. No model detections or evidence boxes are shown
          during this first look. You only need to mark areas; you do not need to select a type.
        </aside>
        <div className="probe-workspace">
          <div className="probe-image-column" ref={imageColumnRef}>
            <ResponsiveImageCanvas
              scene={scene}
              selections={sceneState.pointSelections}
              interactive
              onPoint={handlePoint}
            />
          </div>
          <aside
            className="probe-sidebar"
            aria-label="Pointing annotations"
            style={imageColumnHeight ? { height: `${imageColumnHeight}px` } : undefined}
          >
            <div className="probe-sidebar-scroll">

        {pendingMatch ? (
          <section className="resolution-card" role="dialog" aria-labelledby="overlap-heading">
            <h2 id="overlap-heading">Which content did you mean?</h2>
            <p>The point falls on equally specific regions. Your original click will be retained.</p>
            <div className="button-row">
              {pendingMatch.candidates.map((candidate) => (
                <button
                  className="button button-secondary"
                  type="button"
                  key={candidate.id}
                  onClick={() =>
                    addSelection(
                      pendingMatch.normalizedPoint,
                      pendingMatch.displayedPoint,
                      pendingMatch.matches,
                      candidate,
                    )
                  }
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="selection-panel probe-sidebar-panel">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Your first-look selections</p>
              <h2>{sceneState.pointSelections.length} selected</h2>
            </div>
          </div>
          {sceneState.pointSelections.length === 0 ? (
            <p className="empty-state">No areas selected yet.</p>
          ) : (
            <ol className="selection-list">
              {sceneState.pointSelections.map((selection) => (
                <li key={selection.selectionId}>
                  <span className="selection-number">{selection.clickNumber}</span>
                  <div className="selection-summary">
                    <strong>Marked area {selection.clickNumber}</strong>
                    <small>
                      {selection.manualUnmatched
                        ? 'Participant-created region'
                        : 'Point saved on the image'}
                    </small>
                  </div>
                  <button className="text-button danger-text" type="button" onClick={() => removeSelection(selection.selectionId)}>
                    Delete
                  </button>
                </li>
              ))}
            </ol>
          )}

          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={sceneState.noAdditionalSelected}
              onChange={(event) => setNoAdditional(event.target.checked)}
            />
            <span>I did not identify any additional privacy-sensitive content.</span>
          </label>
          {pointingError ? <p className="form-error" role="alert">{pointingError}</p> : null}
          <div className="button-row form-actions split-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                const index = session.randomizedSceneOrder.indexOf(scene.id);
                if (index === 0) navigate('/probe/instructions');
                else navigate(`/probe/${session.randomizedSceneOrder[index - 1]}`);
              }}
            >
              Back
            </button>
            <button className="button button-primary" type="button" onClick={beginReview}>
              Review all privacy threats
            </button>
          </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const activeIndex = Math.min(sceneState.activeCategoryIndex, sceneState.categoryOrder.length - 1);
  const activeCategoryId = sceneState.categoryOrder[activeIndex];
  const activeCategory = categoriesById.get(activeCategoryId);
  const activeResponse = sceneState.categoryResponses[activeCategoryId];
  const evidenceIds = activeResponse?.linkedDetectionIds ?? [];
  const activeContentLabels = activeResponse
    ? activeResponse.linkedDetectionIds
        .map(
          (detectionId) =>
            scene.detections.find((detection) => detection.id === detectionId)?.label,
        )
        .filter((label): label is string => Boolean(label))
    : [];

  const ensureViewedAndNavigate = (nextIndex: number) => {
    const categoryId = sceneState.categoryOrder[nextIndex];
    const now = new Date().toISOString();
    updateSession((current) => {
      const currentScene = current.probeScenes[scene.id];
      const response = currentScene.categoryResponses[categoryId];
      return {
        ...current,
        probeScenes: {
          ...current.probeScenes,
          [scene.id]: {
            ...currentScene,
            activeCategoryIndex: nextIndex,
            categoryResponses: {
              ...currentScene.categoryResponses,
              [categoryId]: {
                ...response,
                firstViewedAt: response.firstViewedAt || now,
                evidenceOpened: true,
              },
            },
          },
        },
      };
    });
  };

  const answerCategory = (field: 'awarenessStatus' | 'preferredAction', value: number) => {
    const now = new Date().toISOString();
    updateSession((current) => {
      const currentScene = current.probeScenes[scene.id];
      const response = currentScene.categoryResponses[activeCategoryId];
      const changed = response[field] !== null && response[field] !== value;
      const nextResponse = { ...response, [field]: value };
      const isAnswered =
        nextResponse.awarenessStatus !== null && nextResponse.preferredAction !== null;
      return {
        ...current,
        probeScenes: {
          ...current.probeScenes,
          [scene.id]: {
            ...currentScene,
            categoryResponses: {
              ...currentScene.categoryResponses,
              [activeCategoryId]: {
                ...nextResponse,
                changes: response.changes + (changed ? 1 : 0),
                answeredAt: isAnswered ? now : response.answeredAt,
                durationMs: response.firstViewedAt
                  ? Math.max(0, new Date(now).getTime() - new Date(response.firstViewedAt).getTime())
                  : response.durationMs,
              },
            },
          },
        },
      };
    });
  };

  const toggleEvidence = () => {
    const opening = !evidenceVisible;
    setEvidenceVisible(opening);
    updateSession((current) => {
      const currentScene = current.probeScenes[scene.id];
      const response = currentScene.categoryResponses[activeCategoryId];
      return {
        ...current,
        probeScenes: {
          ...current.probeScenes,
          [scene.id]: {
            ...currentScene,
            categoryResponses: {
              ...currentScene.categoryResponses,
              [activeCategoryId]: {
                ...response,
                evidenceOpened: response.evidenceOpened || opening,
                evidenceToggleCount: response.evidenceToggleCount + 1,
              },
            },
          },
        },
      };
    });
  };

  const finishScene = () => {
    if (!isSceneReviewComplete(sceneState, scene.availableCategoryIds)) return;
    const now = new Date().toISOString();
    const sceneIndex = session.randomizedSceneOrder.indexOf(scene.id);
    const nextScene = session.randomizedSceneOrder[sceneIndex + 1];
    updateSession((current) => {
      const completedSession = nextScene
        ? current
        : {
            ...recordProbeCompletion(current, now),
            completedAt: current.completedAt ?? now,
          };
      return {
        ...completedSession,
        probeScenes: {
          ...completedSession.probeScenes,
          [scene.id]: {
            ...completedSession.probeScenes[scene.id],
            phase: 'complete',
            completedAt: now,
          },
        },
      };
    });
    const assignedStudy = readEvaluationStudy();
    navigate(
      nextScene
        ? `/probe/${nextScene}`
        : studyConfig.showProfilePage
          ? '/profile'
          : assignedStudy
            ? `/evaluation/${assignedStudy}`
            : '/complete',
    );
  };

  if (!activeCategory || !activeResponse) {
    return <section className="content-card"><h1>Category review unavailable</h1></section>;
  }

  const completedCount = scene.availableCategoryIds.filter((categoryId) => {
    const response = sceneState.categoryResponses[categoryId];
    return response?.awarenessStatus != null && response.preferredAction != null;
  }).length;
  const allComplete = isSceneReviewComplete(sceneState, scene.availableCategoryIds);

  return (
    <div className="page-stack probe-page">
      <header className="scene-header">
        <div>
          <p className="eyebrow">{scene.scenarioType} scene · Phase B</p>
          <h1>{scene.title}</h1>
          <p>{completedCount} of {scene.availableCategoryIds.length} review items complete</p>
        </div>
        <div className="scene-header-actions">
          <ProbeInterfaceHint onStart={() => setHintMode(true)} />
          {expertReview ? (
            <button className="button button-quiet" type="button" onClick={() => navigate('/')}>
              Choose another scene
            </button>
          ) : null}
          <span className="phase-badge review-badge">Visual review</span>
        </div>
      </header>
      <div className="probe-workspace">
        <div className="probe-image-column" ref={imageColumnRef}>
          <ResponsiveImageCanvas
            scene={scene}
            selections={sceneState.pointSelections}
            activeDetectionIds={evidenceVisible ? evidenceIds : []}
          />
        </div>
        <aside
          className="probe-sidebar probe-review-sidebar"
          aria-label="Visual content review"
          style={imageColumnHeight ? { height: `${imageColumnHeight}px` } : undefined}
        >
          <div className="probe-sidebar-scroll" ref={reviewSidebarScrollRef}>
      <section className="sidebar-review-progress" aria-labelledby="review-progress-heading">
        <div className="sidebar-progress-heading">
          <div>
            <p className="eyebrow" id="review-progress-heading">Review progress</p>
            <strong>Step {activeIndex + 1} of {scene.availableCategoryIds.length}</strong>
          </div>
          <span>{completedCount} complete</span>
        </div>
        <progress
          max={scene.availableCategoryIds.length}
          value={completedCount}
          aria-label={`${completedCount} of ${scene.availableCategoryIds.length} review items complete`}
        />
        <p id="category-progress-help">
          Answer both questions for this highlighted content to unlock the next item.
        </p>
      </section>
      {studyConfig.showProbeCategoryIdentities ? (
        <nav className="category-stepper sidebar-stepper" aria-label="Category review navigation">
          {sceneState.categoryOrder.map((categoryId, index) => {
            const response = sceneState.categoryResponses[categoryId];
            const complete = response?.awarenessStatus != null && response.preferredAction != null;
            const unlocked = isCategoryIndexUnlocked(sceneState, index);
            return (
              <button
                className={`${index === activeIndex ? 'is-current' : ''} ${complete ? 'is-complete' : ''}`}
                type="button"
                key={categoryId}
                aria-current={index === activeIndex ? 'step' : undefined}
                aria-describedby="category-progress-help"
                disabled={!unlocked}
                onClick={() => ensureViewedAndNavigate(index)}
              >
                <span>{index + 1}</span>
                {categoriesById.get(categoryId)?.label}
              </button>
            );
          })}
        </nav>
      ) : null}
      <CategoryReviewCard
        category={activeCategory}
        response={activeResponse}
        contentLabels={activeContentLabels}
        reviewTitle={`Highlighted visual content ${activeIndex + 1}`}
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
        onToggleEvidence={toggleEvidence}
        onAnswer={answerCategory}
      />
      <div className="button-row form-actions split-actions">
        <button
          className="button button-secondary"
          type="button"
          disabled={activeIndex === 0}
          onClick={() => ensureViewedAndNavigate(activeIndex - 1)}
        >
          Previous item
        </button>
        {activeIndex < sceneState.categoryOrder.length - 1 ? (
          <button
            className="button button-primary"
            type="button"
            disabled={activeResponse.awarenessStatus == null || activeResponse.preferredAction == null}
            onClick={() => ensureViewedAndNavigate(activeIndex + 1)}
          >
            Next item
          </button>
        ) : (
          <button className="button button-primary" type="button" disabled={!allComplete} onClick={finishScene}>
            Complete scene
          </button>
        )}
      </div>
      {!allComplete && activeIndex === sceneState.categoryOrder.length - 1 ? (
        <p className="field-help centered-help">Review and answer every item before completing this scene.</p>
      ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
