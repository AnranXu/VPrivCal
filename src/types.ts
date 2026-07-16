export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface NormalizedBox extends NormalizedPoint {
  width: number;
  height: number;
}

export interface PrivacyCategory {
  id: string;
  label: string;
  description: string;
}

export interface Detection {
  id: string;
  label: string;
  primaryCategoryId: string;
  categoryIds: string[];
  subcategory: string;
  bbox: NormalizedBox;
  clickable: boolean;
  description: string;
}

export interface CategoryEvidence {
  categoryId: string;
  detectionIds: string[];
}

export interface ProbeOption {
  value: number;
  label: string;
}

export interface ProbeQuestionDefinition {
  id: string;
  prompt: string;
  options: ProbeOption[];
}

export interface ProbeScene {
  id: string;
  fileName: string;
  assetPath: string;
  width: number;
  height: number;
  scenarioType: 'private' | 'public' | 'semi-public';
  title: string;
  context: string;
  availableCategoryIds: string[];
  categoryEvidence: CategoryEvidence[];
  detections: Detection[];
}

export interface VPrivCalDataset {
  schemaVersion: string;
  coordinateSystem: {
    type: 'normalized_xywh';
    origin: 'top-left';
    range: [number, number];
    imageAspectRatio: string;
    hitPadding: number;
  };
  categories: PrivacyCategory[];
  probeQuestions: {
    awarenessStatus: ProbeQuestionDefinition;
    preferredAction: ProbeQuestionDefinition;
  };
  images: ProbeScene[];
}

export interface Q10Option {
  value: number | string;
  label: string;
}

export interface Q10Question {
  id: string;
  title: string;
  prompt: string;
  example?: string;
  policyParameter: string;
  categoryId?: string;
  options: Q10Option[];
}

export interface Q10Response {
  questionId: string;
  value: number | string;
  label: string;
  firstViewedAt: string;
  answeredAt: string;
  changes: number;
}

export interface PointSelection {
  selectionId: string;
  sceneId: string;
  clickNumber: number;
  normalizedPoint: NormalizedPoint;
  displayedPoint: PixelPoint;
  manualBox?: NormalizedBox;
  matchedDetectionIds: string[];
  selectedDetectionId: string | null;
  autoCategoryId: string | null;
  finalCategoryId: string;
  categoryCorrected: boolean;
  manualUnmatched: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryResponse {
  sceneId: string;
  categoryId: string;
  presentationOrder: number;
  linkedDetectionIds: string[];
  spontaneouslySelected: boolean;
  awarenessStatus: number | null;
  preferredAction: number | null;
  evidenceOpened: boolean;
  evidenceToggleCount: number;
  changes: number;
  firstViewedAt: string;
  answeredAt: string | null;
  durationMs: number;
}

export interface ProbeSceneState {
  sceneId: string;
  startedAt: string;
  completedAt: string | null;
  phase: 'pointing' | 'review' | 'complete';
  pointSelections: PointSelection[];
  noAdditionalSelected: boolean;
  listModeOpened: boolean;
  categoryOrder: string[];
  categoryResponses: Record<string, CategoryResponse>;
  activeCategoryIndex: number;
}

export interface ProfileConfirmation {
  value: string;
  comment?: string;
  answeredAt: string;
}

export interface StudyConsent {
  agreed: boolean;
  prolificId: string;
  answeredAt: string;
}

export interface ViewportRecord {
  width: number;
  height: number;
  at: string;
}

export interface StudySession {
  schemaVersion: string;
  studyVersion: string;
  participantId: string;
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  userAgent: string;
  viewportHistory: ViewportRecord[];
  originalSceneOrder: string[];
  randomizedSceneOrder: string[];
  q10Responses: Record<string, Q10Response>;
  q10FirstViewedAt: Record<string, string>;
  q10ActiveIndex: number;
  q10StartedAt: string | null;
  q10CompletedAt: string | null;
  probeHintCompletedAt: string | null;
  probeStartedAt: string | null;
  probeCompletedAt: string | null;
  probeScenes: Record<string, ProbeSceneState>;
  consent: StudyConsent | null;
  profileConfirmation: ProfileConfirmation | null;
  lastRoute: string;
}

export interface VPrivCalResponseExport {
  schemaVersion: string;
  studyVersion: string;
  participantId: string;
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  userAgent: string;
  viewportHistory: ViewportRecord[];
  originalSceneOrder: string[];
  randomizedSceneOrder: string[];
  consent: StudyConsent | null;
  q10: Array<Q10Response & { finalResponse: number | string }>;
  probe: Array<{
    sceneId: string;
    startedAt: string;
    completedAt: string | null;
    pointSelections: PointSelection[];
    categoryResponses: Array<{
      categoryId: string;
      presentationOrder: number;
      linkedDetectionIds: string[];
      spontaneouslySelected: boolean;
      awarenessStatus: number;
      preferredAction: number;
      evidenceOpened: boolean;
      evidenceToggleCount: number;
      changes: number;
      durationMs: number;
    }>;
  }>;
  profileConfirmation: ProfileConfirmation | null;
  timing: {
    q10DurationMs: number;
    probeStartedAt: string | null;
    probeCompletedAt: string | null;
    probeDurationMs: number;
    totalDurationMs: number;
  };
}
