import { useEffect, useId, useRef, useState } from 'react';

const hintSteps = [
  {
    title: 'Inspect and mark the image',
    body:
      'Click or tap each area that you think a visual AI assistant should handle carefully. A numbered marker confirms each saved point.',
    detail: 'You only mark the area. You do not need to name it or select a privacy type.',
    diagram: 'point',
  },
  {
    title: 'Adjust or remove marked areas',
    body:
      'Your marked areas appear in the right sidebar. Delete an accidental point there. If the interface asks for a rectangle, adjust it around the content you meant and confirm it.',
    detail: 'Use “Move image” after zooming when you need to inspect a different part of the scene.',
    diagram: 'adjust',
  },
  {
    title: 'Start the privacy review',
    body:
      'When your first look is complete, select “Review all privacy threats.” The system will then show one precomputed privacy category at a time.',
    detail: 'Model evidence is not shown until you choose to start this review.',
    diagram: 'review',
  },
  {
    title: 'Complete the right-side steps',
    body:
      'The relevant evidence area is highlighted automatically. Answer both questions, then use “Next category” until the progress indicator is complete.',
    detail: 'You can return to an earlier unlocked category or hide and show its evidence.',
    diagram: 'answer',
  },
] as const;

interface ProbeInterfaceHintProps {
  defaultOpen?: boolean;
}

export function ProbeInterfaceHint({ defaultOpen = false }: ProbeInterfaceHintProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [stepIndex, setStepIndex] = useState(0);
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const step = hintSteps[stepIndex];

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  const openHint = () => {
    setStepIndex(0);
    setOpen(true);
  };

  return (
    <>
      <button className="button button-hint" type="button" onClick={openHint}>
        <span aria-hidden="true">?</span>
        View interface hint
      </button>
      {open ? (
        <div
          className="interface-hint-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="interface-hint-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <header>
              <div>
                <p className="eyebrow">Interface hint · Step {stepIndex + 1} of {hintSteps.length}</p>
                <h2 id={headingId}>{step.title}</h2>
              </div>
              <button
                className="hint-close-button"
                type="button"
                ref={closeButtonRef}
                aria-label="Close interface hint"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <progress
              max={hintSteps.length}
              value={stepIndex + 1}
              aria-label={`Interface hint step ${stepIndex + 1} of ${hintSteps.length}`}
            />

            <div className={`hint-interface-diagram hint-diagram-${step.diagram}`} aria-hidden="true">
              <div className="hint-image-preview">
                <span className="hint-marker hint-marker-one">1</span>
                <span className="hint-marker hint-marker-two">2</span>
                <span className="hint-evidence-box" />
              </div>
              <div className="hint-sidebar-preview">
                <span />
                <span />
                <span />
                <strong>{stepIndex === 3 ? 'Answer both questions' : 'Marked areas'}</strong>
              </div>
            </div>

            <div className="interface-hint-copy">
              <p>{step.body}</p>
              <p className="hint-detail">{step.detail}</p>
            </div>

            <footer>
              <button
                className="button button-secondary"
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              >
                Previous hint
              </button>
              {stepIndex < hintSteps.length - 1 ? (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setStepIndex((current) => current + 1)}
                >
                  Next hint
                </button>
              ) : (
                <button className="button button-primary" type="button" onClick={() => setOpen(false)}>
                  Start using the interface
                </button>
              )}
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
