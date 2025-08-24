import { useState, useCallback } from 'react';
import type { Transform } from '../types/whiteboard';

interface Point {
  x: number;
  y: number;
}

export function useWhiteboardGestures(
  onTransformUpdate: (update: Transform | ((prev: Transform) => Transform)) => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });

  const handleGestureStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if ('button' in e && e.button !== 0) return;
      
      const currentPos = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY };

      setIsDragging(true);
      setLastMousePos(currentPos);
    },
    []
  );

  const handleGestureMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const currentPos = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY };

      // Calculate delta in screen coordinates
      const deltaX = currentPos.x - lastMousePos.x;
      const deltaY = currentPos.y - lastMousePos.y;
      
      // Get the actual applied scale from the DOM element
      const container = document.querySelector('.transform-container');
      const scale = container ? 
        parseFloat(getComputedStyle(container).getPropertyValue('--scale') || '1') : 
        1;

      // Apply the gesture movement with proper scaling
      onTransformUpdate(prevTransform => ({
        ...prevTransform,
        x: prevTransform.x + deltaX / scale,
        y: prevTransform.y + deltaY / scale
      }));

      setLastMousePos(currentPos);
    },
    [isDragging, lastMousePos, onTransformUpdate]
  );

  const handleGestureEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    handleGestureStart,
    handleGestureMove,
    handleGestureEnd,
    isDragging
  };
}