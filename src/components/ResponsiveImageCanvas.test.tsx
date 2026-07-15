import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeScene } from '../test/fixtures';
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
    const moveButton = screen.getByRole('button', { name: 'Move image' });
    expect(moveButton).toBeDisabled();

    fireEvent.change(slider, { target: { value: '2' } });
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(moveButton).toBeEnabled();
    expect(document.querySelector('.image-frame')).toHaveStyle({ width: '200%' });

    fireEvent.click(moveButton);
    expect(screen.getByRole('button', { name: 'Finish moving' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.querySelector('.image-frame')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Image move mode'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finish moving' }));
    expect(screen.getByRole('button', { name: 'Move image' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
