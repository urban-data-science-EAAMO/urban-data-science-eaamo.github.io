/**
 * Initializes mobile optimizations and performance settings for the whiteboard
 */
export function initializeMobileOptimizations() {
  const root = document.documentElement;
  
  // Detect if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.innerWidth <= 768);
  
  // Apply mobile optimizations if needed
  if (isMobile) {
    console.log('Mobile device detected, applying optimizations');
    
    // Add a class to enable mobile-specific CSS
    root.classList.add('mobile-optimized');
  }
}

/**
 * Utility function to throttle frequent events like pan/zoom on mobile
 */
export function throttle(func: Function, delay: number) {
  let lastCall = 0;
  return function(...args: any[]) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  };
} 