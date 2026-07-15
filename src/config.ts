export interface StudyConfig {
  studyVersion: string;
  participantIdRequired: boolean;
  randomizeSceneOrder: boolean;
  randomizeCategoryOrder: boolean;
  allowUnmatchedManualRegions: boolean;
  profileCommentsEnabled: boolean;
  jsonExportEnabled: boolean;
  csvExportEnabled: boolean;
  participantApiBaseUrl: string;
  participantRemoteSaveDebounceMs: number;
}

export const studyConfig: Readonly<StudyConfig> = {
  studyVersion: 'VPrivCal-v6.0-static-1.0.0',
  participantIdRequired: true,
  randomizeSceneOrder: true,
  randomizeCategoryOrder: true,
  allowUnmatchedManualRegions: true,
  profileCommentsEnabled: true,
  jsonExportEnabled: true,
  csvExportEnabled: true,
  participantApiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  participantRemoteSaveDebounceMs: 800,
};

export const EXPORT_SCHEMA_VERSION = '1.0.0';
