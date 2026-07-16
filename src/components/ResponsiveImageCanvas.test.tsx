import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeDetection, makeScene } from '../test/fixtures';
import { createPointSelection } from '../utils/probe';
import { ResponsiveImageCanvas } from './ResponsiveImageCanvas';

describe('ResponsiveImageCanvas zoom and movement', () => {
  it('enables image movement after zooming and returns to annotation mode', () => {
    render(
      <ResponsiveImageCanvas
        scene={makeScene('zoom-scene', [])}
        selections={[]}
        interactive
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Image zoom' });
    const pointButton = screen.getByRole('button', { name: 'Point on image' });
    const moveButton = screen.getByRole('button', { name: 'Move image' });
    expect(pointButton).toHaveAttribute('aria-pressed', 'true');
    expect(moveButton).toBeDisabled();

    fireEvent.change(slider, { target: { value: '2' } });
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(moveButton).toBeEnabled();
    expect(document.querySelector('.image-frame')).toHaveStyle({ width: '200%' });

    fireEvent.click(moveButton);
    expect(moveButton).toHaveAttribute('aria-pressed', 'true');
    expect(pointButton).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('.image-frame')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Image move mode'),
    );

    fireEvent.click(pointButton);
    expect(pointButton).toHaveAttribute('aria-pressed', 'true');
    expect(moveButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('accepts any in-image point only while pointing is enabled', () => {
    const onPoint = vi.fn();
    const { container } = render(
      <ResponsiveImageCanvas
        scene={makeScene('point-scene', [])}
        selections={[]}
        interactive
        onPoint={onPoint}
      />,
    );

    const frame = container.querySelector('.image-frame') as HTMLDivElement;
    Object.defineProperty(frame, 'getBoundingClientRect', {
      value: () => ({
        left: 10,
        top: 20,
        width: 400,
        height: 300,
        right: 410,
        bottom: 320,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    });
    fireEvent.load(container.querySelector('img') as HTMLImageElement);
    const firePoint = () => {
      const pointerEvent = new Event('pointerdown', { bubbles: true });
      Object.defineProperties(pointerEvent, {
        clientX: { value: 390 },
        clientY: { value: 260 },
      });
      fireEvent(frame, pointerEvent);
    };
    const pointButton = container.querySelector(
      'button[aria-label="Point on image"]',
    ) as HTMLButtonElement;

    firePoint();

    expect(onPoint).toHaveBeenCalledWith({ x: 0.95, y: 0.8 }, { x: 380, y: 240 });

    fireEvent.click(pointButton);
    expect(pointButton).toHaveAttribute('aria-pressed', 'false');
    expect(frame).not.toHaveAttribute('role');
    firePoint();
    expect(onPoint).toHaveBeenCalledTimes(1);

    fireEvent.click(pointButton);
    expect(pointButton).toHaveAttribute('aria-pressed', 'true');
    firePoint();
    expect(onPoint).toHaveBeenCalledTimes(2);
  });

  it('shows only the participant point when it matches a hidden model detection', () => {
    const detection = makeDetection(
      'hidden-privacy-area',
      'pii',
      { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
    );
    const scene = { ...makeScene('first-look-scene', ['pii']), detections: [detection] };
    const selection = createPointSelection({
      sceneId: scene.id,
      clickNumber: 1,
      normalizedPoint: { x: 0.3, y: 0.3 },
      displayedPoint: { x: 300, y: 225 },
      matchedDetections: [detection],
      selectedDetection: detection,
      at: '2026-07-16T00:00:00.000Z',
    });

    const { container } = render(
      <ResponsiveImageCanvas scene={scene} selections={[selection]} interactive />,
    );

    expect(container.querySelector('.point-marker')).toBeInTheDocument();
    expect(container.querySelector('.detection-box')).not.toBeInTheDocument();
  });
});
