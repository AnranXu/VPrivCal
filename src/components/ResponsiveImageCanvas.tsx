import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type {
  NormalizedPoint,
  PixelPoint,
  PointSelection,
  ProbeScene,
} from '../types';
import { clientPointToNormalized, normalizedPointToPixels } from '../utils/coordinates';
import { withBasePath } from '../utils/assets';
import { DetectionOverlay } from './DetectionOverlay';
import { PointSelectionLayer } from './PointSelectionLayer';

type InteractionMode = 'none' | 'point' | 'move';

interface ResponsiveImageCanvasProps {
  scene: ProbeScene;
  selections: readonly PointSelection[];
  activeDetectionIds?: readonly string[];
  interactive?: boolean;
  onPoint?: (normalized: NormalizedPoint, displayed: PixelPoint) => void;
}

function PointModeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3.5 18.5 13l-6.1 1.15 3.45 5.55-2.75 1.7-3.4-5.55L5 20V3.5Z" />
    </svg>
  );
}

function MoveModeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.5-3 3h2v5.5H5.5V9l-3 3 3 3v-2H11v5.5H9l3 3 3-3h-2V13h5.5v2l3-3-3-3v2H13V5.5h2l-3-3Z" />
    </svg>
  );
}

export function ResponsiveImageCanvas({
  scene,
  selections,
  activeDetectionIds = [],
  interactive = false,
  onPoint,
}: ResponsiveImageCanvasProps) {
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(
    interactive ? 'point' : 'none',
  );
  const [isPanning, setIsPanning] = useState(false);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });
  const [keyboardPoint, setKeyboardPoint] = useState<NormalizedPoint>({ x: 0.5, y: 0.5 });
  const pointMode = interactive && interactionMode === 'point';
  const panMode = interactionMode === 'move';

  const measure = useCallback(() => {
    const rect = imageFrameRef.current?.getBoundingClientRect();
    if (rect) setRenderedSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    const element = imageFrameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [measure, zoom]);

  const invokePoint = (normalized: NormalizedPoint) => {
    if (!pointMode || !onPoint) return;
    onPoint(normalized, normalizedPointToPixels(normalized, renderedSize));
  };

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointMode) return;
    const rect = imageFrameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const normalized = clientPointToNormalized(
      { x: event.clientX, y: event.clientY },
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    );
    if (normalized) {
      setKeyboardPoint(normalized);
      invokePoint(normalized);
    }
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panMode && zoom > 1) {
      const distance = event.shiftKey ? 24 : 80;
      const region = scrollRegionRef.current;
      if (!region) return;
      if (event.key === 'ArrowLeft') region.scrollBy({ left: -distance });
      else if (event.key === 'ArrowRight') region.scrollBy({ left: distance });
      else if (event.key === 'ArrowUp') region.scrollBy({ top: -distance });
      else if (event.key === 'ArrowDown') region.scrollBy({ top: distance });
      else return;
      event.preventDefault();
      return;
    }
    if (!pointMode) return;
    const step = event.shiftKey ? 0.005 : 0.02;
    let next = keyboardPoint;
    if (event.key === 'ArrowLeft') next = { ...next, x: Math.max(0, next.x - step) };
    if (event.key === 'ArrowRight') next = { ...next, x: Math.min(1, next.x + step) };
    if (event.key === 'ArrowUp') next = { ...next, y: Math.max(0, next.y - step) };
    if (event.key === 'ArrowDown') next = { ...next, y: Math.min(1, next.y + step) };
    if (next !== keyboardPoint) {
      event.preventDefault();
      setKeyboardPoint(next);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      invokePoint(keyboardPoint);
    }
  };

  const changeZoom = (nextZoom: number) => {
    const region = scrollRegionRef.current;
    const center = region
      ? {
          x: (region.scrollLeft + region.clientWidth / 2) / Math.max(region.scrollWidth, 1),
          y: (region.scrollTop + region.clientHeight / 2) / Math.max(region.scrollHeight, 1),
        }
      : { x: 0.5, y: 0.5 };
    setZoom(nextZoom);
    if (nextZoom <= 1) {
      setInteractionMode((current) => (current === 'move' ? 'none' : current));
    }
    window.requestAnimationFrame(() => {
      const updated = scrollRegionRef.current;
      if (!updated) return;
      updated.scrollLeft = center.x * updated.scrollWidth - updated.clientWidth / 2;
      updated.scrollTop = center.y * updated.scrollHeight - updated.clientHeight / 2;
    });
  };

  const resetView = () => {
    setZoom(1);
    setInteractionMode((current) => (current === 'move' ? 'none' : current));
    scrollRegionRef.current?.scrollTo({ left: 0, top: 0 });
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panMode || zoom <= 1) return;
    event.preventDefault();
    const region = scrollRegionRef.current;
    if (!region) return;
    region.setPointerCapture(event.pointerId);
    panDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: region.scrollLeft,
      scrollTop: region.scrollTop,
    };
    setIsPanning(true);
  };

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    const region = scrollRegionRef.current;
    if (!drag || !region || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    region.scrollLeft = drag.scrollLeft - (event.clientX - drag.clientX);
    region.scrollTop = drag.scrollTop - (event.clientY - drag.clientY);
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    const region = scrollRegionRef.current;
    if (panDragRef.current?.pointerId !== event.pointerId) return;
    if (region?.hasPointerCapture(event.pointerId)) region.releasePointerCapture(event.pointerId);
    panDragRef.current = null;
    setIsPanning(false);
  };

  return (
    <section className="image-canvas" aria-label={`${scene.title} image interaction`}>
      <div className="image-toolbar">
        <div className="zoom-control">
          <label htmlFor={`zoom-${scene.id}`}>Image zoom</label>
          <input
            id={`zoom-${scene.id}`}
            type="range"
            min="1"
            max="2.5"
            step="0.1"
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
          />
          <output>{Math.round(zoom * 100)}%</output>
        </div>
        <div className="image-view-actions">
          <div className="image-mode-controls" role="group" aria-label="Image interaction mode">
            <button
              className={`image-tool-button image-mode-button ${pointMode ? 'is-active' : ''}`}
              type="button"
              disabled={!interactive}
              aria-label="Point on image"
              title={pointMode ? 'Turn pointing off' : 'Enable pointing'}
              aria-pressed={pointMode}
              onClick={() => {
                setInteractionMode((current) => (current === 'point' ? 'none' : 'point'));
                window.requestAnimationFrame(() => imageFrameRef.current?.focus());
              }}
            >
              <PointModeIcon />
            </button>
            <button
              className={`image-tool-button image-mode-button ${panMode ? 'is-active' : ''}`}
              type="button"
              disabled={zoom <= 1}
              aria-label="Move image"
              title={zoom <= 1 ? 'Zoom in to move the image' : 'Move image'}
              aria-pressed={panMode}
              onClick={() => {
                setInteractionMode((current) => (current === 'move' ? 'none' : 'move'));
                window.requestAnimationFrame(() => imageFrameRef.current?.focus());
              }}
            >
              <MoveModeIcon />
            </button>
          </div>
          <button
            className="image-tool-button"
            type="button"
            disabled={zoom === 1}
            onClick={resetView}
          >
            Reset view
          </button>
        </div>
      </div>
      <div
        ref={scrollRegionRef}
        className={`image-scroll-region ${panMode ? 'is-pan-mode' : ''} ${isPanning ? 'is-panning' : ''}`}
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          ref={imageFrameRef}
          className={`image-frame ${pointMode ? 'is-interactive' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${scene.width} / ${scene.height}` }}
          role={pointMode || panMode ? 'application' : undefined}
          aria-label={
            panMode
              ? 'Image move mode. Drag the zoomed image, or use arrow keys, to change the focused area.'
              : pointMode
                ? 'Interactive scene. Use a pointer, or move the keyboard cursor with arrow keys and press Enter to select.'
                : undefined
          }
          tabIndex={pointMode || panMode ? 0 : -1}
          onPointerDown={handlePointer}
          onKeyDown={handleKeyboard}
        >
          <img
            src={withBasePath(scene.assetPath)}
            alt={`Synthetic first-person view. ${scene.context}`}
            draggable={false}
            onLoad={measure}
          />
          <DetectionOverlay
            detections={scene.detections}
            visibleIds={activeDetectionIds}
          />
          <PointSelectionLayer
            selections={selections}
            keyboardPoint={pointMode ? keyboardPoint : undefined}
          />
        </div>
      </div>
      {interactive || panMode ? (
        <p className="keyboard-help">
          {panMode
            ? 'Move mode: drag the image or use arrow keys. Select the pointer icon to mark areas again.'
            : pointMode
              ? 'Point mode: click or tap anywhere to mark it. Select the pointer icon again to turn pointing off.'
              : 'Pointing is off. Select the pointer icon when you want to mark the image.'}
        </p>
      ) : null}
    </section>
  );
}
