import { useRef, useEffect, useState } from 'react';
import { performanceConfig } from '../utils/performance';

export function useOptimizedAnimation(options = {}) {
  const {
    enabled = true,
    priority = 'medium',
    pauseWhenOffscreen = true
  } = options;
  
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(enabled);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !pauseWhenOffscreen) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const isElementVisible = entries[0].isIntersecting;
        setIsVisible(isElementVisible);
        
        const shouldAnimate = isElementVisible && 
          (performanceConfig.currentPerformanceMode !== 'minimal') &&
          (priority === 'high' || performanceConfig.currentPerformanceMode !== 'low');
          
        setIsAnimating(shouldAnimate);
        
        if (shouldAnimate) {
          element.classList.remove('paused-animation');
        } else {
          element.classList.add('paused-animation');
        }
      },
      { threshold: [0, 0.2] }
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, [priority, pauseWhenOffscreen]);
  
  return { ref: elementRef, isVisible, isAnimating };
}