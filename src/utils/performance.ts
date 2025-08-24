import React from 'react';

// -----------------------------------------------
// Types & Interfaces
// -----------------------------------------------

interface PerformanceData {
  fps: number[];
  memoryUsage: number[];
  frameTimings: number[];
  events: Array<{time: number, event: string, duration?: number}>;
}

// Type definition for navigator.deviceMemory
interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

// Add this to define the custom window property
interface WindowWithCustomRAF extends Window {
  _originalRequestAnimationFrame?: typeof window.requestAnimationFrame;
}

// -----------------------------------------------
// Configuration
// -----------------------------------------------

export const performanceConfig = {
  verboseLogging: false,  // Disable by default in production
  performanceMonitoring: true,
  animationSettings: {
    enabled: true,
    maxActiveAnimations: 50,    // Maximum animations running simultaneously
    reduceAfter: 25000,         // Time in ms after which to reduce animations
    disableAfter: 60000,        // Time in ms after which to disable non-essential animations
    visibilityThreshold: 0.2    // How much of element must be visible to animate (0-1)
  },
  renderSettings: {
    useCheapRenderIfFPS: 30,    // Use cheaper rendering if FPS drops below this value
    throttleBackground: true,   // Throttle background animations
  },
  currentPerformanceMode: 'high' as 'high' | 'medium' | 'low' | 'minimal'
};

// -----------------------------------------------
// Performance Logger
// -----------------------------------------------

export const performanceLogger = {
  startTime: 0,
  marks: new Map<string, number>(),
  data: {
    fps: [],
    memoryUsage: [],
    frameTimings: [],
    events: []
  } as PerformanceData,
  
  // Track current FPS for real-time adaptation
  currentFPS: 60,
  
  // Initialize the logger
  start() {
    this.startTime = performance.now();
    performance.mark('app_start');
    this.data.events.push({time: 0, event: 'app_start'});
    this.monitorMemory();
  },

  // Record a performance mark
  mark(name: string) {
    const time = performance.now();
    const relativeTime = time - this.startTime;
    this.marks.set(name, time);
    performance.mark(name);
    this.data.events.push({time: relativeTime, event: name});
    perfLog('log', `${name}: ${relativeTime.toFixed(2)}ms`);
  },

  // Measure time between marks
  measure(name: string, startMark: string, endMark: string) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure').pop();
      if (measure) {
        perfLog('log', `${name}: ${measure.duration.toFixed(2)}ms`);
        this.data.events.push({
          time: measure.startTime - this.startTime,
          event: name,
          duration: measure.duration
        });
      }
    } catch (e) {
      perfLog('error', `Failed to measure ${name}:`, e);
    }
  },

  // Monitor frame rate continuously
  monitorFrameRate() {
    let lastTime = performance.now();
    let frames = 0;
    let frameTimesSum = 0;
    let slowFrames = 0;
    
    // Function to detect slowdowns
    const checkThrottling = (fps: number, avgFrameTime: number) => {
      if (slowFrames >= 5) {
        perfLog('warn', `Performance warning: ${slowFrames} slow frames detected. Avg frame time: ${avgFrameTime.toFixed(2)}ms, FPS: ${fps}`);
      }
      
      // Reset counter
      slowFrames = 0;
    };

    const measureFrame = () => {
      frames++;
      const currentTime = performance.now();
      const frameTime = currentTime - lastTime;
      
      // Track frame timing
      this.data.frameTimings.push(frameTime);
      if (this.data.frameTimings.length > 300) this.data.frameTimings.shift();
      
      frameTimesSum += frameTime;
      
      // Log frame time if it's too slow (less than 30fps)
      if (frameTime > 33.33) {
        slowFrames++;
        if (frameTime > 100) {
          // This is a very slow frame, log it immediately
          perfLog('warn', `Very slow frame: ${frameTime.toFixed(2)}ms`);
        }
      }
      
      // Calculate FPS every second
      if (currentTime >= lastTime + 1000) {
        const fps = frames;
        const avgFrameTime = frameTimesSum / frames;
        
        // Update current FPS for other utilities to reference
        this.currentFPS = fps;
        
        // Log current performance
        perfLog('log', `FPS: ${fps}, Avg frame: ${avgFrameTime.toFixed(2)}ms`);
        
        // Store the data
        this.data.fps.push(fps);
        if (this.data.fps.length > 60) this.data.fps.shift();
        
        // Check for throttling
        checkThrottling(fps, avgFrameTime);
        
        // Reset counters
        frames = 0;
        frameTimesSum = 0;
        lastTime = currentTime;
      }

      lastTime = currentTime;
      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  },
  
  // Monitor memory usage if available
  monitorMemory() {
    // Skip if memory API is not available
    if (!performance.memory) return;
    
    const checkMemory = () => {
      // TypeScript doesn't know about non-standard performance.memory
      const memory = (performance as any).memory;
      
      if (memory) {
        const usedHeapMB = memory.usedJSHeapSize / (1024 * 1024);
        const totalHeapMB = memory.totalJSHeapSize / (1024 * 1024);
        this.data.memoryUsage.push(usedHeapMB);
        
        // Keep only the last 60 readings
        if (this.data.memoryUsage.length > 60) this.data.memoryUsage.shift();
        
        // Check for memory growth
        const recentReadings = this.data.memoryUsage.slice(-20);
        if (recentReadings.length >= 20) {
          const firstAvg = recentReadings.slice(0, 5).reduce((sum, val) => sum + val, 0) / 5;
          const lastAvg = recentReadings.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
          
          // If memory is continuously growing, warn about a possible leak
          if (lastAvg > firstAvg * 1.3) {
            perfLog('warn', `Potential memory leak detected: Memory grew from ${firstAvg.toFixed(1)}MB to ${lastAvg.toFixed(1)}MB`);
          }
        }
        
        // Log every 5th reading
        if (this.data.memoryUsage.length % 5 === 0) {
          perfLog('log', `Memory usage: ${usedHeapMB.toFixed(1)}MB / ${totalHeapMB.toFixed(1)}MB`);
        }
      }
      
      // Check again in 1 second
      setTimeout(checkMemory, 1000);
    };
    
    setTimeout(checkMemory, 1000);
  },

  // Get information about GPU if available
  async getGPUInfo() {
    // Try to get GPU info from navigator
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          
          perfLog('log', 'GPU Info:', { vendor, renderer });
          return { vendor, renderer };
        }
      }
    } catch (e) {
      perfLog('log', 'Could not retrieve GPU info', e);
    }
    
    return null;
  },
  
  // Get a summary of performance metrics
  getSummary() {
    // Calculate average FPS
    const avgFPS = this.data.fps.reduce((sum, val) => sum + val, 0) / 
                   Math.max(1, this.data.fps.length);
    
    // Calculate frame time stats
    const frameTimes = this.data.frameTimings;
    const avgFrameTime = frameTimes.reduce((sum, val) => sum + val, 0) / 
                         Math.max(1, frameTimes.length);
    
    const maxFrameTime = Math.max(...frameTimes);
    
    // Calculate 95th percentile frame time (indicating stutters)
    const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
    const idx95 = Math.floor(sortedFrameTimes.length * 0.95);
    const percentile95 = sortedFrameTimes[idx95] || 0;
    
    return {
      averageFPS: avgFPS,
      currentFPS: this.currentFPS,
      averageFrameTime: avgFrameTime,
      maxFrameTime,
      frameTimePercentile95: percentile95,
      memoryUsage: this.data.memoryUsage.length > 0 ? 
                   this.data.memoryUsage[this.data.memoryUsage.length - 1] : null,
      totalRunTime: (performance.now() - this.startTime) / 1000  // In seconds
    };
  }
};

// -----------------------------------------------
// Utility Functions
// -----------------------------------------------

// Observer for element visibility (don't animate if not visible)
const visibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      const target = entry.target as HTMLElement;
      if (entry.isIntersecting && entry.intersectionRatio > performanceConfig.animationSettings.visibilityThreshold) {
        target.classList.remove('paused-animation');
      } else {
        target.classList.add('paused-animation');
      }
    });
  },
  {
    root: null,
    rootMargin: '0px',
    threshold: [0, 0.2, 0.5, 1.0]
  }
);

// Track active sticky notes for animation optimization
const activeElements = new Set<HTMLElement>();

export function trackElement(element: HTMLElement) {
  activeElements.add(element);
  visibilityObserver.observe(element);
  throttleAnimations();
  
  return () => {
    activeElements.delete(element);
    visibilityObserver.unobserve(element);
  };
}

// Limit number of active animations based on device capability and count
function throttleAnimations() {
  const maxAnimations = performanceConfig.animationSettings.maxActiveAnimations;
  
  // If we have too many animated elements, throttle some
  if (activeElements.size > maxAnimations) {
    // Sort elements by visibility and importance
    const elements = Array.from(activeElements);
    let count = 0;
    
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isInViewport = (
        rect.top >= -100 &&
        rect.left >= -100 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 100 &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) + 100
      );
      
      if (count < maxAnimations && isInViewport) {
        el.classList.remove('paused-animation');
        count++;
      } else {
        el.classList.add('paused-animation');
      }
    });
  }
}

// Add a wrapper function for console logging
export function perfLog(level: 'log' | 'warn' | 'error', message: string, data?: any) {
  if (performanceConfig.verboseLogging) {
    if (data) {
      console[level](`[PerformanceMonitor] ${message}`, data);
    } else {
      console[level](`[PerformanceMonitor] ${message}`);
    }
  }
}

// Export the debug toggle function so it can be used elsewhere
export function toggleDebugMode() {
  performanceConfig.verboseLogging = !performanceConfig.verboseLogging;
  // This will only show if debugging was just enabled
  console.log(`Debug mode: ${performanceConfig.verboseLogging ? 'enabled' : 'disabled'}`);
  return performanceConfig.verboseLogging;
}

// -----------------------------------------------
// Device Detection and Performance Modes
// -----------------------------------------------

// Apply different performance modes
export function applyPerformanceMode(mode: 'high' | 'medium' | 'low' | 'minimal') {
  performanceConfig.currentPerformanceMode = mode;
  
  // Apply CSS classes based on mode
  document.documentElement.classList.remove('perf-high', 'perf-medium', 'perf-low', 'perf-minimal');
  document.documentElement.classList.add(`perf-${mode}`);
  
  // Add data attribute for easier CSS targeting
  document.documentElement.dataset.perfMode = mode;
  
  switch (mode) {
    case 'high':
      performanceConfig.animationSettings.maxActiveAnimations = 30;
      break;
    case 'medium':
      performanceConfig.animationSettings.maxActiveAnimations = 15;
      document.documentElement.classList.add('reduce-animations');
      break;
    case 'low':
      performanceConfig.animationSettings.maxActiveAnimations = 5;
      document.documentElement.classList.add('reduce-animations', 'simplify-effects');
      break;
    case 'minimal':
      performanceConfig.animationSettings.maxActiveAnimations = 0;
      document.documentElement.classList.add('reduce-animations', 'simplify-effects', 'disable-animations');
      break;
  }
  
  // Apply performance settings to window environment
  if (typeof window !== 'undefined') {
    const win = window as WindowWithCustomRAF;
    
    // Adjust browser rendering for performance in low/minimal modes
    if (mode === 'low' || mode === 'minimal') {
      // Reduce animation frame rate to save CPU/GPU
      if (!win._originalRequestAnimationFrame && win.requestAnimationFrame) {
        win._originalRequestAnimationFrame = win.requestAnimationFrame;
        let lastTime = 0;
        
        // Throttle to ~30fps in low mode, ~15fps in minimal
        const targetFPS = mode === 'minimal' ? 15 : 30;
        const frameInterval = 1000 / targetFPS;
        
        win.requestAnimationFrame = function(callback) {
          const currentTime = performance.now();
          const timeUntilNextFrame = Math.max(0, frameInterval - (currentTime - lastTime));
          
          if (timeUntilNextFrame <= 1) {
            lastTime = currentTime;
            return win._originalRequestAnimationFrame!(callback);
          } else {
            // Cast setTimeout's return value to number to match requestAnimationFrame's return type
            return Number(setTimeout(() => {
              lastTime = performance.now();
              callback(lastTime);
            }, timeUntilNextFrame));
          }
        };
      }
    } else if (win._originalRequestAnimationFrame) {
      // Restore original rAF when back to higher performance modes
      win.requestAnimationFrame = win._originalRequestAnimationFrame;
      delete win._originalRequestAnimationFrame;
    }
  }
  
  throttleAnimations();
  return mode;
}

// Detect device capabilities and apply initial optimizations
export function detectDeviceCapabilities() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowPowerDevice = isMobile || window.navigator.hardwareConcurrency <= 4;
  const isHighEndDevice = !isMobile && window.navigator.hardwareConcurrency >= 8;
  
  // Set logging based on device capability
  performanceConfig.verboseLogging = 
    !isLowPowerDevice && 
    process.env.NODE_ENV !== 'production';
    
  // Apply performance mode based on detected capabilities
  if (isLowPowerDevice) {
    applyPerformanceMode(window.navigator.hardwareConcurrency <= 2 ? 'minimal' : 'low');
  } else if (!isHighEndDevice) {
    applyPerformanceMode('medium');
  } else {
    applyPerformanceMode('high');
  }
  
  // Start monitoring system load
  monitorSystemLoad();
  
  // Return the detected capabilities
  return {
    isMobile,
    isLowPowerDevice,
    cpuCores: window.navigator.hardwareConcurrency || 2,
    performanceMode: performanceConfig.currentPerformanceMode
  };
}

// Monitor system temperature via performance proxy
function monitorSystemLoad() {
  let consecutiveSlowFrames = 0;
  let lastMode = performanceConfig.currentPerformanceMode;
  let appStartTime = performance.now();
  
  // Function to run on each frame
  function checkPerformance() {
    const now = performance.now();
    const elapsed = now - appStartTime;
    
    // Time-based throttling (reduce animations over time)
    if (elapsed > performanceConfig.animationSettings.reduceAfter && 
        performanceConfig.currentPerformanceMode === 'high') {
      performanceConfig.currentPerformanceMode = 'medium';
      applyPerformanceMode('medium');
    }
    
    if (elapsed > performanceConfig.animationSettings.disableAfter && 
        performanceConfig.currentPerformanceMode !== 'low' && 
        performanceConfig.currentPerformanceMode !== 'minimal') {
      performanceConfig.currentPerformanceMode = 'low';
      applyPerformanceMode('low');
    }
    
    // Check if performance mode changed
    if (lastMode !== performanceConfig.currentPerformanceMode) {
      perfLog('warn', `Performance mode changed to: ${performanceConfig.currentPerformanceMode}`);
      lastMode = performanceConfig.currentPerformanceMode;
    }
    
    // Schedule next check
    requestIdleCallback(checkPerformance, { timeout: 1000 });
  }
  
  // Start monitoring after a short delay
  setTimeout(() => requestIdleCallback(checkPerformance), 1000);
}

// Function to optimize image loading
export function optimizeImageLoading() {
  if (typeof window === 'undefined') return;
  
  // Use Intersection Observer to lazy load images
  const imgObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            delete img.dataset.src;
            imgObserver.unobserve(img);
          }
        }
      });
    },
    { rootMargin: '200px' } // Start loading when within 200px
  );
  
  // Find all images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach(img => {
    imgObserver.observe(img);
  });
  
  return imgObserver;
}

// Optimize whiteboard rendering during interactions
export function optimizeWhiteboardRendering() {
  // Throttle expensive repaints when scrolling/zooming
  let isScrolling = false;
  let scrollTimer: number | null = null;
  
  const handleScroll = () => {
    if (!isScrolling) {
      document.body.classList.add('is-scrolling');
      isScrolling = true;
    }
    
    if (scrollTimer) clearTimeout(scrollTimer);
    
    scrollTimer = window.setTimeout(() => {
      document.body.classList.remove('is-scrolling');
      isScrolling = false;
    }, 150);
  };
  
  // Apply scroll optimization when window is loaded
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('wheel', handleScroll, { passive: true });
  window.addEventListener('touchmove', handleScroll, { passive: true });
  
  // Add CSS rule for scroll optimization - simplified for whiteboard
  const style = document.createElement('style');
  style.textContent = `
    .is-scrolling .sticky-note {
      will-change: transform;
      pointer-events: none;
    }
    
    .is-scrolling.perf-low .sticky-note,
    .is-scrolling.perf-minimal .sticky-note {
      animation-play-state: paused !important;
    }
  `;
  document.head.appendChild(style);
}

// Helper function for fallback performance detection
function fallbackPerformanceDetection() {
  // Check CPU cores as a rough proxy for performance capability
  const cores = navigator.hardwareConcurrency || 2;
  
  // Check if the device is mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Check for other performance indicators
  const hasReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasLowData = window.matchMedia('(prefers-reduced-data: reduce)').matches;
  
  // Start with high as default
  let suggestedMode: 'high' | 'medium' | 'low' | 'minimal' = 'high';
  
  // Apply heuristics to determine performance mode
  if (cores <= 2 || (isMobile && cores <= 4)) {
    suggestedMode = 'low';
  } else if (cores <= 4 || isMobile) {
    suggestedMode = 'medium';
  }
  
  // Further reduce if user has accessibility preferences set
  if (hasReduced || hasLowData) {
    suggestedMode = suggestedMode === 'high' ? 'medium' : 
                   suggestedMode === 'medium' ? 'low' : 'minimal';
  }
  
  // Apply the detected mode
  applyPerformanceMode(suggestedMode);
  
  perfLog('log', `Applied fallback performance detection: ${suggestedMode}`);
}

// -----------------------------------------------
// React Hook for Performance Optimization
// -----------------------------------------------

// React hook to connect components to performance monitoring
export function usePerformanceOptimization(elementRef: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    if (elementRef.current) {
      const cleanup = trackElement(elementRef.current);
      return cleanup;
    }
  }, [elementRef]);
  
  return performanceConfig.currentPerformanceMode;
}

// -----------------------------------------------
// Initialization Functions
// -----------------------------------------------

// Initialize the performance monitoring system
export function initializePerformanceMonitoring() {
  // Initialize timing
  performanceLogger.start();
  
  // Detect capabilities and apply optimizations
  const capabilities = detectDeviceCapabilities();
  
  // Log initial state
  perfLog('log', 'Performance monitoring initialized', capabilities);
  
  // Add CSS to handle animation pausing
  const style = document.createElement('style');
  style.innerHTML = `
    .paused-animation {
      animation-play-state: paused !important;
      transition: none !important;
    }
    .perf-medium .sticky-note {
      animation-duration: calc(var(--flutter-duration, 8s) * 1.5) !important;
    }
    .perf-low .sticky-note {
      animation-duration: calc(var(--flutter-duration, 8s) * 2) !important;
    }
    .simplify-effects .sticky-note {
      transform-style: flat !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    }
    .disable-animations .sticky-note {
      animation: none !important;
      transform: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Start monitoring frame rate
  performanceLogger.monitorFrameRate();
  
  return capabilities;
}

// Main initialization function to be called in app entry point
export function initializeAppPerformance() {
  initializePerformanceMonitoring();
  performanceLogger.getGPUInfo();
  optimizeImageLoading();
  optimizeWhiteboardRendering();
  
  // Set initial quality based on device memory if available
  if (typeof navigator !== 'undefined') {
    const nav = navigator as NavigatorWithMemory;
    
    // Check for device memory API
    if (nav.deviceMemory !== undefined) {
      const memory = nav.deviceMemory;
      if (memory <= 2) {
        applyPerformanceMode('minimal');
      } else if (memory <= 4) {
        applyPerformanceMode('low');
      } else if (memory <= 8) {
        applyPerformanceMode('medium');
      }
    } else {
      // No device memory API, use alternative detection
      fallbackPerformanceDetection();
    }
  }
  
  // Keep low-frequency check to detect performance issues
  let lastFPS = 60;
  
  setInterval(() => {
    const currentFPS = performanceLogger.currentFPS;
    
    // If FPS drops significantly, take action
    if (currentFPS < 20 && lastFPS >= 20) {
      perfLog('warn', `Low FPS detected: ${currentFPS}, applying performance optimizations`);
      if (performanceConfig.currentPerformanceMode === 'high') {
        applyPerformanceMode('medium');
      } else if (performanceConfig.currentPerformanceMode === 'medium') {
        applyPerformanceMode('low');
      }
    }
    
    lastFPS = currentFPS;
  }, 5000);
}