/**
 * Client-side image processing utility
 */

export async function optimizeImage(file: File): Promise<File> {
  // For debugging - log incoming file details
  console.log(`Processing image: ${file.name}, size: ${file.size}B, type: ${file.type}`);
  
  try {
    // Create a URL for the input file
    const originalUrl = URL.createObjectURL(file);
    
    // Create an image element to load the file
    const img = new Image();
    
    // Wait for the image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = originalUrl;
    });
    
    // Target dimensions - adjust based on your needs
    const maxWidth = 1600;
    const maxHeight = 1600;
    
    // Calculate new dimensions while preserving aspect ratio
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    console.log(`Original dimensions: ${width}x${height}`);
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      console.log(`Resizing to: ${width}x${height}`);
    } else {
      // If no resize needed, return original file to avoid quality loss
      console.log('No resize needed, returning original');
      URL.revokeObjectURL(originalUrl);
      return file;
    }
    
    // Use regular canvas instead of OffscreenCanvas for better compatibility
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context for canvas');
    }
    
    // Draw and resize the image
    ctx.drawImage(img, 0, 0, width, height);
    
    // Clean up the object URL
    URL.revokeObjectURL(originalUrl);
    
    // Determine output format based on input
    let outputType = file.type;
    let quality = 0.85;
    
    // Default to JPEG only if the input type isn't recognized
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(outputType)) {
      outputType = 'image/jpeg';
    }
    
    // Get the blob with proper type and quality
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((result) => {
        resolve(result as Blob);
      }, outputType, quality);
    });
    
    if (!blob) {
      throw new Error('Failed to create image blob');
    }
    
    console.log(`Optimized image size: ${blob.size}B, type: ${blob.type}`);
    
    // Create a new file from the blob with original name but optimized content
    return new File([blob], file.name, {
      type: outputType,
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Image optimization failed:', error);
    // Return original file as fallback
    return file;
  }
}