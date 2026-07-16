interface ProbeInterfaceHintProps {
  disabled?: boolean;
  onStart: () => void;
}

export function ProbeInterfaceHint({ disabled = false, onStart }: ProbeInterfaceHintProps) {
  return (
    <button
      className="button button-hint"
      type="button"
      disabled={disabled}
      onClick={onStart}
    >
      <span aria-hidden="true">?</span>
      View interactive hint
    </button>
  );
}
