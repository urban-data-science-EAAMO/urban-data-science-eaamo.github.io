import type { Point } from '../types/whiteboard';
import { SCALES } from '../constants/whiteboard';

export function clampScale(
  scale: number,
  minScale: number,
  maxScale: number = SCALES.MAX
): number {
  return Math.min(Math.max(scale, minScale), maxScale);
}

export function calculateMinimumScale(viewportWidth: number, viewportHeight: number): number {
  // For an infinite whiteboard, we use a much smaller minimum scale
  // to allow users to zoom out and see more content
  return SCALES.MIN;
}

export function calculateBoundaries(
  scale: number,
  viewportWidth: number,
  viewportHeight: number
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  // For infinite whiteboard, provide very generous boundaries
  // Allow panning far beyond viewport in all directions
  const maxOffset = Math.max(viewportWidth, viewportHeight) * 5;
  
  return {
    minX: -maxOffset,
    maxX: maxOffset,
    minY: -maxOffset,
    maxY: maxOffset
  };
}

export function clampOffset(
  offset: Point,
  scale: number,
  viewportWidth: number,
  viewportHeight: number
): Point {
  // For an infinite whiteboard, we don't clamp offsets
  // Users can pan freely in any direction
  return offset;
}