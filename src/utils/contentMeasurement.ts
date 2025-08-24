import { STICKY_NOTE } from '../constants/whiteboard';

/**
 * Measures the actual content height of a card and returns optimal dimensions
 */
export function measureContentHeight(cardElement: HTMLElement): {
  requiredHeight: number;
  requiredWidth: number;
  hasOverflow: boolean;
} {
  if (!cardElement) {
    return {
      requiredHeight: STICKY_NOTE.HEIGHT,
      requiredWidth: STICKY_NOTE.WIDTH,
      hasOverflow: false
    };
  }

  // Find the content container
  const contentContainer = cardElement.querySelector('.sticky-note-content');
  if (!contentContainer) {
    return {
      requiredHeight: STICKY_NOTE.HEIGHT,
      requiredWidth: STICKY_NOTE.WIDTH,
      hasOverflow: false
    };
  }

  // Create a temporary container with the same styling constraints
  const measureContainer = document.createElement('div');
  measureContainer.style.position = 'absolute';
  measureContainer.style.visibility = 'hidden';
  measureContainer.style.pointerEvents = 'none';
  measureContainer.style.top = '-9999px';
  measureContainer.style.left = '-9999px';
  measureContainer.style.width = `${STICKY_NOTE.MAX_WIDTH - 32}px`; // Account for card padding
  measureContainer.style.height = 'auto';
  measureContainer.style.overflow = 'visible';
  measureContainer.style.padding = '1rem'; // Match the card's p-4 class
  
  // Copy the computed styles from the original container
  const originalStyles = window.getComputedStyle(contentContainer);
  measureContainer.style.fontFamily = originalStyles.fontFamily;
  measureContainer.style.fontSize = originalStyles.fontSize;
  measureContainer.style.lineHeight = originalStyles.lineHeight;
  measureContainer.style.color = originalStyles.color;
  
  // Clone the content and add to the measure container
  const contentClone = contentContainer.cloneNode(true) as HTMLElement;
  contentClone.style.width = '100%';
  contentClone.style.height = 'auto';
  contentClone.style.maxHeight = 'none';
  contentClone.style.overflow = 'visible';
  
  measureContainer.appendChild(contentClone);
  document.body.appendChild(measureContainer);
  
  // Measure the natural content size
  const naturalHeight = measureContainer.scrollHeight;
  const naturalWidth = measureContainer.scrollWidth;
  
  // Clean up
  document.body.removeChild(measureContainer);
  
  // Calculate spacing requirements
  const BUTTON_SPACING = 48;      // Top button area + clearance
  const CARD_PADDING = 32;        // Card internal padding
  const CONTENT_MARGIN = 16;      // Extra margin for readability
  
  const requiredContentHeight = naturalHeight + CONTENT_MARGIN;
  const requiredTotalHeight = Math.max(
    requiredContentHeight + BUTTON_SPACING,
    STICKY_NOTE.MIN_HEIGHT
  );
  
  const requiredWidth = Math.max(
    Math.min(naturalWidth + CARD_PADDING, STICKY_NOTE.MAX_WIDTH),
    STICKY_NOTE.MIN_WIDTH
  );
  
  // Check if content would overflow in the default size
  const hasOverflow = requiredTotalHeight > STICKY_NOTE.HEIGHT || 
                     requiredWidth > STICKY_NOTE.WIDTH;
  
  console.log('Content measurement:', {
    originalHeight: STICKY_NOTE.HEIGHT,
    measuredHeight: naturalHeight,
    requiredHeight: Math.min(requiredTotalHeight, STICKY_NOTE.MAX_HEIGHT),
    hasOverflow
  });
  
  return {
    requiredHeight: Math.min(requiredTotalHeight, STICKY_NOTE.MAX_HEIGHT),
    requiredWidth,
    hasOverflow
  };
}

/**
 * Estimates content complexity for better sizing decisions
 */
function estimateContentComplexity(cardElement: HTMLElement): {
  isTextHeavy: boolean;
  approximateTextLength: number;
} {
  const preElements = cardElement.querySelectorAll('pre');
  const textContent = Array.from(preElements)
    .map(el => el.textContent || '')
    .join(' ');
  
  const totalTextLength = (cardElement.textContent || '').length;
  const isTextHeavy = textContent.length > 200 || totalTextLength > 400;
  
  return {
    isTextHeavy,
    approximateTextLength: totalTextLength
  };
}

/**
 * Calculates optimal card size based on content and current state
 */
export function calculateOptimalSize(
  cardElement: HTMLElement,
  isCurrentlyExpanded: boolean
): { width: number; height: number } {
  if (isCurrentlyExpanded) {
    // When collapsing, go back to default size
    return {
      width: STICKY_NOTE.WIDTH,
      height: STICKY_NOTE.HEIGHT
    };
  }

  const measurement = measureContentHeight(cardElement);
  const complexity = estimateContentComplexity(cardElement);
  
  // For text-heavy content (like long snips), ensure generous sizing
  if (complexity.isTextHeavy) {
    const estimatedHeight = Math.max(
      measurement.requiredHeight,
      STICKY_NOTE.HEIGHT * 2, // At least double the default height
      Math.min(complexity.approximateTextLength * 1.2, STICKY_NOTE.MAX_HEIGHT) // Rough text-based estimation
    );
    
    return {
      width: Math.min(STICKY_NOTE.WIDTH * 1.6, STICKY_NOTE.MAX_WIDTH), // Wider for better text readability
      height: estimatedHeight
    };
  }
  
  // For other content, use the measured dimensions or reasonable expansion
  if (measurement.hasOverflow) {
    return {
      width: measurement.requiredWidth,
      height: measurement.requiredHeight
    };
  } else {
    // Content fits in default size - do a modest expansion for better readability
    return {
      width: STICKY_NOTE.WIDTH * 1.4,
      height: STICKY_NOTE.HEIGHT * 1.4
    };
  }
} 