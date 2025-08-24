import slugify from 'slugify';

// GitHub repository information - updated to the correct repository
const REPO_OWNER = 'mattwfranchi'; 
const REPO_NAME = 'mattwfranchi.github.io'; // Changed from 'mattwfranchi' to 'mattwfranchi.github.io'
const BRANCH = 'main'; // Update if you use a different branch

interface ContentFile {
  path: string;
  content: string;
  message: string;
}

interface ImageFile {
  filename: string;
  content: string; // base64 encoded
  albumId: string;
}

// Create or update a file in the GitHub repository
export async function commitFile(
  token: string, 
  file: ContentFile
): Promise<{ success: boolean; sha?: string; message?: string }> {
  try {
    if (!token) {
      console.error("GitHub token is missing");
      return { success: false, message: "GitHub token is missing" };
    }
    
    // Clean the token
    const cleanToken = token.trim();
    
    // Make sure token is formatted correctly for GitHub API
    const formattedToken = `token ${cleanToken}`;
    
    // First, check if the file exists to get its SHA
    let sha: string | undefined;
    
    try {
      const fileResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${file.path}`,
        {
          headers: {
            Authorization: formattedToken,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (fileResponse.status === 200) {
        const fileData = await fileResponse.json();
        sha = fileData.sha;
      } else if (fileResponse.status !== 404) {
        // If status isn't 404 (not found), log the error
        const errorText = await fileResponse.text();
        console.error(`GitHub API error (${fileResponse.status}):`, errorText);
      }
    } catch (error) {
      console.error("Error checking for existing file:", error);
      // Non-fatal error, continue with creation
    }
    
    console.log(`Creating/updating file at ${file.path}${sha ? ' (updating existing file)' : ''}`);
    
    // Now create or update the file
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: formattedToken,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: file.message,
          content: btoa(unescape(encodeURIComponent(file.content))), // Base64 encode content
          branch: BRANCH,
          sha: sha, // Include SHA if updating, omit if creating
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`GitHub API error (${response.status}):`, errorData);
      throw new Error(`GitHub API error (${response.status}): ${errorData}`);
    }
    
    const data = await response.json();
    console.log("File created successfully:", data.content.html_url);
    return { success: true, sha: data.content.sha };
  } catch (error) {
    console.error('GitHub API error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Validate that a token has the required permissions
export async function validateToken(token: string): Promise<{ valid: boolean; message?: string }> {
  try {
    if (!token || token.trim() === '') {
      return { valid: false, message: 'No token provided' };
    }
    
    // Clean the token (remove any leading/trailing whitespace)
    const cleanToken = token.trim();
    
    console.log("Testing token: ", cleanToken.substring(0, 4) + '...' + cleanToken.substring(cleanToken.length - 4));
    
    // Try to fetch repo info as a basic validation
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
      {
        headers: {
          Authorization: `token ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!response.ok) {
      const status = response.status;
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }
      
      console.error(`GitHub validation failed: Status ${status}`, errorData);
      
      if (status === 401) {
        return { valid: false, message: 'Invalid token or token has expired' };
      } else if (status === 403) {
        return { valid: false, message: 'Token lacks required permissions' };
      } else if (status === 404) {
        return { valid: false, message: 'Repository not found. Check repository owner and name' };
      } else {
        return { valid: false, message: errorData.message || 'Unknown error validating token' };
      }
    }
    
    // Token is valid if we get here
    console.log("Token validation successful!");
    return { valid: true };
  } catch (error) {
    console.error("Token validation error:", error);
    return { 
      valid: false, 
      message: error instanceof Error 
        ? error.message 
        : 'Failed to validate token' 
    };
  }
}

// Upload an image to the repository
export async function uploadImage(
  token: string,
  imageFile: ImageFile
): Promise<{ success: boolean; path?: string; message?: string }> {
  try {
    const timestamp = Date.now();
    const safeName = slugify(imageFile.filename.split('.')[0], { lower: true, strict: true });
    const extension = imageFile.filename.split('.').pop() || 'jpg';
    
    const path = `public/images/uploads/${imageFile.albumId}/${safeName}-${timestamp}.${extension}`;
    
    const result = await commitFile(token, {
      path,
      content: atob(imageFile.content), // The content is already base64 encoded
      message: `Upload image: ${imageFile.filename}`
    });
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    return {
      success: true,
      path: `/images/uploads/${imageFile.albumId}/${safeName}-${timestamp}.${extension}`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Generate a markdown file for content types
export function generateContentFile(type: string, data: any): ContentFile {
  const timestamp = new Date().toISOString().split('T')[0];
  const title = data.title || 'Untitled';
  const slug = slugify(title, { lower: true, strict: true });
  const id = `${timestamp}-${slug}`;
  
  // Ensure we have valid dates
  const formattedDate = data.pubDatetime 
    ? (typeof data.pubDatetime === 'string' ? data.pubDatetime : data.pubDatetime.toISOString()) 
    : new Date().toISOString();
  
  let filePath: string;
  let content: string;
  
  switch (type) {
    case 'albums':
      filePath = `src/content/albums/${id}.md`;
      content = `---
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${formattedDate}
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map((t: string) => `"${t}"`).join(', ')}]
borderColor: "${data.borderColor || '#ffffff'}"
${data.location ? `location: "${data.location}"` : ''}
${data.coverPhotoId ? `coverPhotoId: "${data.coverPhotoId}"` : ''}
---`;
      break;
    
    case 'photos':
      filePath = `src/content/photos/${id}.md`;
      content = `---
albumId: "${data.albumId}"
${data.title ? `title: "${data.title}"` : ''}
photo: "${data.photoPath}"
${data.caption ? `caption: "${data.caption}"` : ''}
pubDatetime: ${formattedDate}
${data.order ? `order: ${data.order}` : ''}
${data.metadata ? `metadata:
  ${data.metadata.camera ? `camera: "${data.metadata.camera}"` : ''}
  ${data.metadata.lens ? `lens: "${data.metadata.lens}"` : ''}
  ${data.metadata.settings ? `settings:
    ${data.metadata.settings.aperture ? `aperture: "${data.metadata.settings.aperture}"` : ''}
    ${data.metadata.settings.shutterSpeed ? `shutterSpeed: "${data.metadata.settings.shutterSpeed}"` : ''}
    ${data.metadata.settings.iso ? `iso: ${data.metadata.settings.iso}` : ''}
    ${data.metadata.settings.focalLength ? `focalLength: "${data.metadata.settings.focalLength}"` : ''}` : ''}` : ''}
---`;
      break;
      
    case 'snips':
      filePath = `src/content/snips/${id}.md`;
      content = `---
${data.albumId ? `albumId: "${data.albumId}"` : ''}
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${formattedDate}
${data.modDatetime ? `modDatetime: ${data.modDatetime}` : ''}
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map((t: string) => `"${t}"`).join(', ')}]
${data.source ? `source: "${data.source}"` : ''}
${data.sourceUrl ? `sourceUrl: "${data.sourceUrl}"` : ''}
${data.order ? `order: ${data.order}` : ''}
---

${data.content || ''}`;
      break;
      
    case 'playlists':
      filePath = `src/content/playlists/${id}.md`;
      content = `---
${data.albumId ? `albumId: "${data.albumId}"` : ''}
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${formattedDate}
platform: "${data.platform || 'spotify'}"
playlistUrl: "${data.playlistUrl}"
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map((t: string) => `"${t}"`).join(', ')}]
${data.coverImage ? `coverImage: "${data.coverImage}"` : ''}
${data.mood ? `mood: [${data.mood.map((m: string) => `"${m}"`).join(', ')}]` : ''}
${data.order ? `order: ${data.order}` : ''}
---`;
      break;
      
    default:
      throw new Error(`Invalid content type: ${type}`);
  }
  
  return {
    path: filePath,
    content: content,
    message: `Add ${type.slice(0, -1)}: ${title}`
  };
}

// Convert a file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
