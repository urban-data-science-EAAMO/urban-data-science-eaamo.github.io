import { useEffect, useRef, useState, useCallback } from 'react';

export const useContentOverflow = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [requiredHeight, setRequiredHeight] = useState(0);

  const checkOverflow = useCallback(() => {
    const element = contentRef.current;
    if (!element) return;

    const isContentOverflowing = element.scrollHeight > element.clientHeight;
    setIsOverflowing(isContentOverflowing);
    setRequiredHeight(element.scrollHeight);
  }, []);

  useEffect(() => {
    checkOverflow();
    
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [checkOverflow]);

  return { contentRef, isOverflowing, requiredHeight };
};