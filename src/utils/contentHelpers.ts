// Create a helper file for content processing

/**
 * Extract usable image URL from various possible data structures
 * Works for both development and production environments
 */
export function extractPhotoUrl(item: any): string | null {
  try {
    // Direct photo URL handling
    if (typeof item.photo === 'string') {
      return item.photo; // Already a URL string
    }
    
    // Nested in data object (Astro content collections)
    if (item.data && item.data.photo) {
      const photoData = item.data.photo;
      
      // Handle object with src property (common in Astro)
      if (typeof photoData === 'object' && photoData !== null) {
        // Try src property first
        if (photoData.src) {
          return photoData.src;
        }
        
        // Try other common properties
        if (photoData.url) return photoData.url;
        if (photoData.href) return photoData.href;
        
        // Try fsPath if available
        if (photoData.fsPath) {
          // Try to convert fsPath to browser path
          const match = photoData.fsPath.match(/\/src\/content\/photos\/(.+)$/);
          if (match) {
            return `/assets/photos/${match[1]}`;
          }
        }
      }
      
      // Handle string directly
      if (typeof photoData === 'string') {
        return photoData;
      }
    }
    
    // Nothing found
    return null;
  } catch (error) {
    console.error('Error extracting photo URL:', error);
    return null;
  }
}

/**
 * Normalize GitHub raw URL or dev path to a format suitable for the UI
 */
export function normalizePhotoUrl(url: string, albumId?: string): string {
  if (!url) return '';
  
  // Remove any quotation marks that might be wrapping the URL
  url = url.replace(/^["'](.*)["']$/, '$1');
  
  // If it's a GitHub raw URL, use it directly
  if (url.startsWith('https://raw.githubusercontent.com/')) {
    return url;
  }
  
  // If it's a development path with /@fs/ (Astro dev server format)
  if (url.startsWith('/@fs/')) {
    // Extract the relative path from the full path
    const match = url.match(/\/content\/photos\/(.+?)(?:\?|$)/);
    if (match) {
      // In development, convert to raw GitHub URL for admin preview
      return `https://raw.githubusercontent.com/mattwfranchi/mattwfranchi.github.io/main/src/content/photos/${match[1]}`;
    }
    return url;
  }
  
  // Handle relative paths when we know the album ID
  if (url.startsWith('./') && albumId) {
    return `https://raw.githubusercontent.com/mattwfranchi/mattwfranchi.github.io/main/src/content/photos/${albumId}/${url.substring(2)}`;
  }
  
  // If it starts with /assets, convert to GitHub raw URL for admin preview
  if (url.startsWith('/assets/')) {
    const match = url.match(/\/assets\/photos\/(.+)/);
    if (match) {
      return `https://raw.githubusercontent.com/mattwfranchi/mattwfranchi.github.io/main/src/content/photos/${match[1]}`;
    }
    return url;
  }
  
  // If we have a simple filename and albumId but no path indicators
  if (albumId && !url.includes('/') && !url.startsWith('http')) {
    return `https://raw.githubusercontent.com/mattwfranchi/mattwfranchi.github.io/main/src/content/photos/${albumId}/${url}`;
  }
  
  return url;
}

/**
 * Safe way to get a property from a nested object structure
 */
export function getPropertySafely(item: any, key: string): any {
  if (!item) return null;
  
  // Direct property access
  if (item[key] !== undefined) return item[key];
  
  // Try data.property (Astro content collections)
  if (item.data && item.data[key] !== undefined) return item.data[key];
  
  // Try frontmatter.property
  if (item.frontmatter && item.frontmatter[key] !== undefined) return item.frontmatter[key];
  
  // Special case for photos
  if (key === 'photo') {
    return extractPhotoUrl(item);
  }
  
  // Special cases for dates
  if (key === 'pubDatetime' || key === 'date') {
    return item.pubDatetime || 
           item.date || 
           (item.data && (item.data.pubDatetime || item.data.date)) || 
           (item.frontmatter && (item.frontmatter.pubDatetime || item.frontmatter.date)) ||
           '2000-01-01'; // Default fallback date
  }
  
  return null;
}

/**
 * Transform Astro content items to a more consistent format
 * This helps manage differences between development and production data structures
 */
export function normalizeContentItems(items: any[], contentType: string): any[] {
  if (!Array.isArray(items)) return [];
  
  // Track item IDs to prevent duplicates
  const seenIds = new Set();
  
  const normalized = items
    .map(item => {
      // Skip if item is null or undefined
      if (!item) return null;
      
      // Generate an ID if none exists
      let id;
      
      // For photos, create a more consistent ID using albumId/filename
      if (contentType === 'photos') {
        const albumId = getPropertySafely(item, 'albumId');
        const sourceFile = item._sourceFile || '';
        // Extract filename from path or use item.id
        const filename = sourceFile.split('/').pop()?.replace('.md', '') || 
                         (typeof item.id === 'string' ? item.id.split('/').pop() : '');
        
        if (albumId && filename) {
          id = `${albumId}/${filename}`;
        } else {
          id = item.id || item._sourceFile || 
               (item.slug ? `${contentType}_${item.slug}` : null) || 
               `${contentType}_${Math.random().toString(36).substr(2, 9)}`;
        }
      } else {
        id = item.id || item._sourceFile || 
             (item.slug ? `${contentType}_${item.slug}` : null) || 
             `${contentType}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Skip duplicate IDs
      if (seenIds.has(id)) {
        console.log(`Skipping duplicate item with ID: ${id}`);
        return null;
      }
      
      seenIds.add(id);
      
      // Create a normalized item with consistent structure
      const normalizedItem: Record<string, any> = {
        id: id,
        _sourceItem: item, // Keep reference to original item
        _sourceFile: item._sourceFile // Preserve source file path
      };
      
      // Extract common properties
      const commonProps = [
        'title', 'description', 'pubDatetime', 'date', 
        'draft', 'featured', 'tags', 'slug'
      ];
      
      // Add content-specific properties
      if (contentType === 'albums') {
        commonProps.push('coverImage');
      } else if (contentType === 'photos') {
        commonProps.push('albumId', 'caption', 'metadata', 'order');
        
        // Special handling for photo property to prevent quotation mark issues
        const photoUrl = extractPhotoUrl(item);
        if (photoUrl) {
          // Get albumId for normalizing the URL
          const albumId = getPropertySafely(item, 'albumId');
          normalizedItem.photo = normalizePhotoUrl(photoUrl, albumId);
        }
      } else if (contentType === 'snips') {
        commonProps.push('language', 'code');
      } else if (contentType === 'playlists') {
        commonProps.push('platform', 'playlistUrl', 'playlistId', 'albumId');
      }
      
      // Copy all properties, handling nested data structure
      for (const prop of commonProps) {
        normalizedItem[prop] = getPropertySafely(item, prop);
      }
      
      return normalizedItem;
    })
    .filter(Boolean); // Remove null/undefined items
    
  console.log(`Normalized ${normalized.length} items for ${contentType}`);
  return normalized;
}