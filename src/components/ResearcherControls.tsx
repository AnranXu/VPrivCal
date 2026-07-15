import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useStudy } from '../context/StudyContext';

export function ResearcherControls() {
  const { resetStudy } = useStudy();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    if (!window.confirm('Researcher action: clear the saved responses for this interface?')) {
      return;
    }
    setClearing(true);
    setError('');
    try {
      await resetStudy();
      navigate('/');
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : 'Unable to reset the study session.',
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <details className="researcher-controls">
      <summary>Researcher controls</summary>
      <p>Reset the current interface to a new session.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button button-danger" type="button" disabled={clearing} onClick={clear}>
        {clearing ? 'Clearing…' : 'Clear responses and restart'}
      </button>
    </details>
  );
}
