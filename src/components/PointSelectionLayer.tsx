import type { NormalizedBox, PointSelection } from '../types';

interface PointSelectionLayerProps {
  selections: readonly PointSelection[];
  keyboardPoint?: { x: number; y: number };
}

export function PointSelectionLayer({
  selections,
  keyboardPoint,
}: PointSelectionLayerProps) {
  return (
    <div className="overlay-layer" aria-hidden="true">
      {selections.map((selection) => (
        <div
          className="point-marker"
          key={selection.selectionId}
          style={{
            left: `${selection.normalizedPoint.x * 100}%`,
            top: `${selection.normalizedPoint.y * 100}%`,
          }}
        >
          {selection.clickNumber}
        </div>
      ))}
      {selections
        .filter((selection) => selection.manualBox)
        .map((selection) => {
          const box = selection.manualBox as NormalizedBox;
          return (
            <div
              className="manual-box"
              key={`${selection.selectionId}-box`}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
            />
          );
        })}
      {keyboardPoint ? (
        <div
          className="keyboard-cursor"
          style={{ left: `${keyboardPoint.x * 100}%`, top: `${keyboardPoint.y * 100}%` }}
        />
      ) : null}
    </div>
  );
}

