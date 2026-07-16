interface HintModeActiveAlertProps {
  onContinue: () => void;
}

export function HintModeActiveAlert({ onContinue }: HintModeActiveAlertProps) {
  return (
    <div className="hint-mode-alert-backdrop">
      <section
        className="hint-mode-alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hint-mode-alert-heading"
        aria-describedby="hint-mode-alert-description"
      >
        <div className="hint-mode-alert-icon" aria-hidden="true">i</div>
        <h2 id="hint-mode-alert-heading">You are in Hint mode of Stage 2</h2>
        <p id="hint-mode-alert-description">
          You are now starting Stage 2: VPrivCal-Probe. First, complete a short interaction hint with the
          image controls. Follow the on-screen hints through each step; then you will continue
          with the Probe questions.
        </p>
        <button className="button button-primary" type="button" onClick={onContinue} autoFocus>
          Start Hint Mode
        </button>
      </section>
    </div>
  );
}
