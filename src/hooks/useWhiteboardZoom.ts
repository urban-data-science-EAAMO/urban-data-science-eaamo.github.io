import { useCallback } from 'react';
import type { Transform } from '../types/whiteboard';
import { SCALES } from '../constants/whiteboard';
import { clampScale } from '../utils/whiteboardUtils';

export function useWhiteboardZoom(
  onTransformUpdate: (transform: Transform) => void
) {
  const handleWheel = useCallback((e: WheelEvent, currentTransform: Transform) => {
    e.preventDefault();
    
    if (e.ctrlKey) {
      const delta = -e.deltaY;
      const zoomFactor = 0.005;
      const newScale = clampScale(
        currentTransform.scale * (1 + (delta > 0 ? zoomFactor : -zoomFactor)),
        SCALES.MIN,
        SCALES.MAX
      );
      
      // Get the whiteboard container which uses:
      // transform: translate(-50%, -50%) translate3d(var(--translateX,0),var(--translateY,0),0) scale(var(--scale,1));
      const container = document.querySelector('.whiteboard-container') as HTMLElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Center of the container in its own coordinate system:
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
     
      // Calculate new dynamic translation so that the container's center remains the focal point.
      const scaleFactor = newScale / currentTransform.scale;
      const newX = centerX - (centerX - currentTransform.x) * scaleFactor;
      const newY = centerY - (centerY - currentTransform.y) * scaleFactor;
      
      const newTransform: Transform = { x: newX, y: newY, scale: newScale };
      onTransformUpdate(newTransform);
    }
  }, [onTransformUpdate]);

  const zoomTo = useCallback((scale: number, currentTransform: Transform) => {
    const newScale = clampScale(scale, SCALES.MIN, SCALES.MAX);
    
    const container = document.querySelector('.whiteboard-container') as HTMLElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const scaleFactor = newScale / currentTransform.scale;
    const newX = centerX - (centerX - currentTransform.x) * scaleFactor;
    const newY = centerY - (centerY - currentTransform.y) * scaleFactor;
    
    const newTransform: Transform = { x: newX, y: newY, scale: newScale };
    onTransformUpdate(newTransform);
  }, [onTransformUpdate]);

  return { handleWheel, zoomTo };
}