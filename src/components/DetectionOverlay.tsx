import type { Detection } from '../types';

interface DetectionOverlayProps {
  detections: readonly Detection[];
  visibleIds: readonly string[];
  transientIds?: readonly string[];
}

export function DetectionOverlay({
  detections,
  visibleIds,
  transientIds = [],
}: DetectionOverlayProps) {
  const visible = new Set(visibleIds);
  const transient = new Set(transientIds);
  return (
    <div className="overlay-layer" aria-hidden="true">
      {detections
        .filter((detection) => visible.has(detection.id) || transient.has(detection.id))
        .map((detection) => (
          <div
            className={`detection-box ${transient.has(detection.id) ? 'is-transient' : ''}`}
            key={detection.id}
            style={{
              left: `${detection.bbox.x * 100}%`,
              top: `${detection.bbox.y * 100}%`,
              width: `${detection.bbox.width * 100}%`,
              height: `${detection.bbox.height * 100}%`,
            }}
          />
        ))}
    </div>
  );
}

