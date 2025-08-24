export const SCALES = {
  MIN: 0.1,     // Can zoom out to see everything
  INITIAL: 0.3, // Initial zoom for good overview
  MAX: 2        // Can zoom in to read notes
} as const;

export const STICKY_NOTE = {
  WIDTH: 280,   // in pixels
  HEIGHT: 320,  // in pixels
  MIN_WIDTH: 120,
  MIN_HEIGHT: 120,
  MAX_WIDTH: 500,  // Increased for wider content
  MAX_HEIGHT: 800  // Increased significantly for long text content
} as const;