import type { Detection } from '../types';

interface DetectionOverlayProps {
  detections: readonly Detection[];
  visibleIds: readonly string[];
}

export function DetectionOverlay({ detections, visibleIds }: DetectionOverlayProps) {
  const visible = new Set(visibleIds);
  return (
    <div className="overlay-layer" aria-hidden="true">
      {detections
        .filter((detection) => visible.has(detection.id))
        .map((detection) => (
          <div
            className="detection-box"
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

