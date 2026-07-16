import { q10Questions } from '../questions';
import type {
  CategoryResponse,
  StudySession,
  VPrivCalDataset,
  VPrivCalResponseExport,
} from '../types';

function durationBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

export function buildResponseExport(
  session: StudySession,
  dataset: VPrivCalDataset,
): VPrivCalResponseExport {
  void dataset;
  const q10 = q10Questions
    .map((question) => session.q10Responses[question.id])
    .filter((response) => response !== undefined)
    .map((response) => ({ ...response, finalResponse: response.value }));

  const probe = session.randomizedSceneOrder.map((sceneId) => {
    const sceneState = session.probeScenes[sceneId];
    return {
      sceneId,
      startedAt: sceneState?.startedAt ?? '',
      completedAt: sceneState?.completedAt ?? null,
      pointSelections: sceneState?.pointSelections ?? [],
      categoryResponses: Object.values(sceneState?.categoryResponses ?? {})
        .sort((first, second) => first.presentationOrder - second.presentationOrder)
        .map((response) => ({
          categoryId: response.categoryId,
          presentationOrder: response.presentationOrder,
          linkedDetectionIds: response.linkedDetectionIds,
          spontaneouslySelected: response.spontaneouslySelected,
          awarenessStatus: response.awarenessStatus ?? -1,
          preferredAction: response.preferredAction ?? -1,
          evidenceOpened: response.evidenceOpened,
          evidenceToggleCount: response.evidenceToggleCount,
          changes: response.changes,
          durationMs: response.durationMs,
        })),
    };
  });

  const summedSceneDurationMs = session.randomizedSceneOrder.reduce((sum, sceneId) => {
    const sceneState = session.probeScenes[sceneId];
    return sum + durationBetween(sceneState?.startedAt ?? null, sceneState?.completedAt ?? null);
  }, 0);
  const probeStartedAt = session.probeStartedAt ?? null;
  const probeCompletedAt = session.probeCompletedAt ?? null;
  const probeDurationMs =
    probeStartedAt && probeCompletedAt
      ? durationBetween(probeStartedAt, probeCompletedAt)
      : summedSceneDurationMs;
  const end = session.completedAt ?? new Date().toISOString();

  return {
    schemaVersion: session.schemaVersion,
    studyVersion: session.studyVersion,
    participantId: session.participantId,
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    userAgent: session.userAgent,
    viewportHistory: session.viewportHistory,
    originalSceneOrder: session.originalSceneOrder,
    randomizedSceneOrder: session.randomizedSceneOrder,
    consent: session.consent,
    q10,
    probe,
    profileConfirmation: session.profileConfirmation,
    timing: {
      q10DurationMs: durationBetween(session.q10StartedAt, session.q10CompletedAt),
      probeStartedAt,
      probeCompletedAt,
      probeDurationMs,
      totalDurationMs: durationBetween(session.startedAt, end),
    },
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateResponseExport(
  response: VPrivCalResponseExport,
  dataset: VPrivCalDataset,
): ValidationResult {
  const errors: string[] = [];
  if (!response.schemaVersion) errors.push('Missing schemaVersion.');
  if (!response.studyVersion) errors.push('Missing studyVersion.');
  if (!response.sessionId) errors.push('Missing sessionId.');
  if (!response.startedAt) errors.push('Missing startedAt.');
  if (response.q10.length !== q10Questions.length) {
    errors.push(`Expected ${q10Questions.length} Q10 responses; found ${response.q10.length}.`);
  }

  const expectedSceneIds = new Set(dataset.images.map((scene) => scene.id));
  const actualSceneIds = new Set(response.probe.map((scene) => scene.sceneId));
  for (const sceneId of expectedSceneIds) {
    if (!actualSceneIds.has(sceneId)) errors.push(`Missing Probe scene ${sceneId}.`);
  }

  for (const scene of dataset.images) {
    const exportedScene = response.probe.find((item) => item.sceneId === scene.id);
    if (!exportedScene) continue;
    const categoryIds = exportedScene.categoryResponses.map((item) => item.categoryId);
    for (const categoryId of scene.availableCategoryIds) {
      const responses = exportedScene.categoryResponses.filter(
        (item) => item.categoryId === categoryId,
      );
      if (responses.length !== 1) {
        errors.push(
          `Scene ${scene.id} requires exactly one response for ${categoryId}; found ${responses.length}.`,
        );
      } else if (
        responses[0].awarenessStatus < 0 ||
        responses[0].preferredAction < 0
      ) {
        errors.push(`Scene ${scene.id} has an incomplete response for ${categoryId}.`);
      }
    }
    const unexpected = categoryIds.filter(
      (categoryId) => !scene.availableCategoryIds.includes(categoryId),
    );
    if (unexpected.length > 0) {
      errors.push(`Scene ${scene.id} contains unexpected categories: ${unexpected.join(', ')}.`);
    }
  }

  if (!response.profileConfirmation) errors.push('Missing profile confirmation.');
  return { valid: errors.length === 0, errors };
}

function csvCell(value: unknown): string {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function buildCategoryCsv(
  response: VPrivCalResponseExport,
  dataset: VPrivCalDataset,
): string {
  const header = [
    'participant_id',
    'session_id',
    'scene_id',
    'scenario_type',
    'category_id',
    'presentation_order',
    'linked_detection_ids',
    'spontaneously_selected',
    'awareness_status',
    'awareness_label',
    'preferred_action',
    'preferred_action_label',
    'evidence_opened',
    'evidence_toggle_count',
    'response_changes',
    'duration_ms',
  ];

  const rows = response.probe.flatMap((probeScene) => {
    const scene = dataset.images.find((item) => item.id === probeScene.sceneId);
    return probeScene.categoryResponses.map((item) => {
      const awarenessLabel = dataset.probeQuestions.awarenessStatus.options.find(
        (option) => option.value === item.awarenessStatus,
      )?.label;
      const actionLabel = dataset.probeQuestions.preferredAction.options.find(
        (option) => option.value === item.preferredAction,
      )?.label;
      return [
        response.participantId,
        response.sessionId,
        item.categoryId ? probeScene.sceneId : '',
        scene?.scenarioType,
        item.categoryId,
        item.presentationOrder,
        item.linkedDetectionIds.join('|'),
        item.spontaneouslySelected,
        item.awarenessStatus,
        awarenessLabel,
        item.preferredAction,
        actionLabel,
        item.evidenceOpened,
        item.evidenceToggleCount,
        item.changes,
        item.durationMs,
      ]
        .map(csvCell)
        .join(',');
    });
  });
  return [header.map(csvCell).join(','), ...rows].join('\r\n');
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function categoryResponsesByOrder(
  responses: Record<string, CategoryResponse>,
): CategoryResponse[] {
  return Object.values(responses).sort(
    (first, second) => first.presentationOrder - second.presentationOrder,
  );
}
