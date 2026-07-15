import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { studyConfig } from '../config';
import { useDataset } from '../context/DataContext';
import { useStudy } from '../context/StudyContext';
import {
  buildCategoryCsv,
  buildResponseExport,
  downloadTextFile,
  validateResponseExport,
} from '../utils/export';

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'anonymous';
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function CompletePage() {
  const navigate = useNavigate();
  const { dataset } = useDataset();
  const { session } = useStudy();
  const response = useMemo(
    () => (dataset ? buildResponseExport(session, dataset) : null),
    [dataset, session],
  );
  const validation = useMemo(
    () => (response && dataset ? validateResponseExport(response, dataset) : null),
    [dataset, response],
  );

  if (!dataset || !response || !session.profileConfirmation) {
    return (
      <section className="content-card narrow-card">
        <h1>Completion step unavailable</h1>
        <p>Confirm the privacy reminder profile before exporting responses.</p>
        <button className="button button-primary" type="button" onClick={() => navigate('/profile')}>
          Return to profile
        </button>
      </section>
    );
  }

  const fileStem = `vprivcal-${safeFilePart(session.participantId)}-${session.sessionId.slice(0, 8)}`;
  const exportJson = () => {
    if (!validation?.valid) return;
    downloadTextFile(
      `${JSON.stringify(response, null, 2)}\n`,
      `${fileStem}.json`,
      'application/json;charset=utf-8',
    );
  };
  const exportCsv = () => {
    if (!validation?.valid) return;
    downloadTextFile(
      buildCategoryCsv(response, dataset),
      `${fileStem}-category-pairs.csv`,
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="page-stack complete-page">
      <section className="completion-hero">
        <div className="completion-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Study complete</p>
        <h1>Your responses are ready to export</h1>
        <p>The completed response file has passed the study’s validation checks.</p>
      </section>

      <section className="completion-stats" aria-label="Completion summary">
        <article><strong>10</strong><span>Q10 responses</span></article>
        <article><strong>{response.probe.length}</strong><span>Probe scenes</span></article>
        <article>
          <strong>{response.probe.reduce((sum, scene) => sum + scene.categoryResponses.length, 0)}</strong>
          <span>Category-image pairs</span>
        </article>
        <article><strong>{formatDuration(response.timing.totalDurationMs)}</strong><span>Total duration</span></article>
      </section>

      {validation?.valid ? (
        <section className="export-card">
          <div>
            <p className="eyebrow">Validated export</p>
            <h2>Download research responses</h2>
            <p>JSON contains the complete session. CSV contains one row per category-image pair.</p>
          </div>
          <div className="button-row export-actions">
            {studyConfig.jsonExportEnabled ? (
              <button className="button button-primary" type="button" onClick={exportJson}>Download JSON</button>
            ) : null}
            {studyConfig.csvExportEnabled ? (
              <button className="button button-secondary" type="button" onClick={exportCsv}>Download CSV</button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="error-card" role="alert">
          <h2>Export validation found incomplete data</h2>
          <ul>{validation?.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          <button className="button button-secondary" type="button" onClick={() => navigate('/profile')}>Review study</button>
        </section>
      )}
    </div>
  );
}
