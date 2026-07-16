interface InitialProbeHintPromptProps {
  onStart: () => void;
}

export function InitialProbeHintPrompt({ onStart }: InitialProbeHintPromptProps) {
  return (
    <div className="initial-hint-backdrop">
      <section
        className="initial-hint-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="initial-hint-heading"
        aria-describedby="initial-hint-description"
      >
        <div className="initial-hint-icon" aria-hidden="true">i</div>
        <p className="eyebrow">Before the first Probe</p>
        <h1 id="initial-hint-heading">Please first view Hint mode</h1>
        <p id="initial-hint-description">
          Complete the short guided walkthrough before starting the Probe. Hint time is not
          included in your Probe completion time.
        </p>
        <button className="button button-primary" type="button" onClick={onStart} autoFocus>
          View Hint mode
        </button>
      </section>
    </div>
  );
}
