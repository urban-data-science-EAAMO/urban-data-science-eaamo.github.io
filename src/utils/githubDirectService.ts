/**
 * Client-side GitHub API interactions for content management
 */

import { optimizeImage } from './imageProcessing';

interface GithubFile {
  path: string;
  content: string | ArrayBuffer;
  message: string;
  token: string; // Add token to the interface
  branch?: string;
  sha?: string; // Add optional SHA property for file updates
}

interface ContentItem {
  id: string;
  title?: string;
  date?: string;
  [key: string]: any;
}

// Add this to the top of the file with other interfaces
interface ContentDataMap {
  [key: string]: any[] | undefined;  // Make index signature compatible with optional properties
  photos?: any[];
  albums?: any[];
  snips?: any[];
  playlists?: any[];
}

// Extend the Window interface
declare global {
  interface Window {
    initialContentData?: ContentDataMap;
  }
}

// Constants
const REPO_OWNER = 'mattwfranchi';
const REPO_NAME = 'mattwfranchi.github.io';
const DEFAULT_BRANCH = 'main';

/**
 * Convert ArrayBuffer to Base64 string (for binary files)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Safely convert content to base64 for GitHub API
 * Handles both strings and binary data
 */
function toBase64(content: string | ArrayBuffer): string {
  if (typeof content === 'string') {
    // For text content
    return btoa(unescape(encodeURIComponent(content)));
  } else {
    // For binary content
    return arrayBufferToBase64(content);
  }
}

/**
 * Get repository information for a file
 */
export async function getFileInfo(token: string, path: string): Promise<any> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // File doesn't exist
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get file info:', error);
    throw error;
  }
}

/**
 * Commit a file to the repository
 */
export async function commitFile({
  path,
  content,
  message,
  token,
  branch = DEFAULT_BRANCH,
  sha
}: GithubFile & { token: string }): Promise<any> {
  try {
    // First check if the file exists if SHA not provided
    let fileSha = sha;
    if (!fileSha) {
      const existingFile = await getFileInfo(token, path).catch(() => null);
      if (existingFile) {
        fileSha = existingFile.sha;
      }
    }
    
    // Convert content to base64 for GitHub API - SIMPLIFIED
    let base64Content: string;
    if (typeof content === 'string') {
      // Text content (like markdown)
      base64Content = btoa(unescape(encodeURIComponent(content)));
    } else {
      // Binary content (like images)
      const bytes = new Uint8Array(content);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Content = btoa(binary);
    }
    
    // Prepare the request body
    const requestBody: any = {
      message,
      content: base64Content,
      branch
    };
    
    // If file exists, include the SHA
    if (fileSha) {
      requestBody.sha = fileSha;
    }
    
    // Make the API request
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // Handle errors and return result
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to commit file:', error);
    throw error;
  }
}

/**
 * Create a new content item in the repository
 */
export async function createContent(
  contentType: string,
  contentData: any,
  token: string,
  id?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Generate a slugified version of the title for the filename
    const title = contentData.title || '';
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/^-|-$/g, '')       // Remove leading/trailing hyphens
      .substring(0, 50);           // Limit length to avoid overly long filenames
    
    // Generate a filename for the content, using provided ID or generating one with title
    const timestamp = Date.now();
    const contentId = id || contentData.id || 
      `${contentType.slice(0, -1)}${titleSlug ? `-${titleSlug}` : ''}-${timestamp}`;
    
    const filename = `${contentId}.md`;
    
    // The rest of the function remains the same
    // Create a copy of the data without the ID field
    const { id: _, _sourceFile, ...dataForFrontmatter } = contentData;
    
    // Convert the content data to frontmatter + markdown format
    let frontmatter = '---\n';
    
    // Convert dataForFrontmatter to frontmatter, excluding special properties
    Object.entries(dataForFrontmatter).forEach(([key, value]) => {
      if (key !== 'content' && !key.startsWith('_')) {
        if (Array.isArray(value)) {
          if (key === 'tags') {
            // For tags, use the bracket notation format
            const formattedTags = value.map(tag => `"${tag}"`).join(', ');
            frontmatter += `${key}: [${formattedTags}]\n`;
          } else {
            // For other arrays, keep using YAML list format
            frontmatter += `${key}:\n`;
            value.forEach(item => {
              frontmatter += `  - ${item}\n`;
            });
          }
        }
        // Update the nested object handling in both createContent and updateContent functions

else if (typeof value === 'object' && value !== null) {
  // Check if object has any non-empty values before including it
  const hasNonEmptyValues = Object.values(value).some(
    v => v !== null && v !== undefined && v !== ''
  );
  
  // Only include non-empty objects
  if (hasNonEmptyValues) {
    frontmatter += `${key}:\n`;
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        // For nested objects like metadata.settings
        const hasNestedValues = Object.values(nestedValue).some(
          v => v !== null && v !== undefined && v !== ''
        );
        
        if (hasNestedValues) {
          frontmatter += `  ${nestedKey}:\n`;
          Object.entries(nestedValue).forEach(([deepKey, deepValue]) => {
            if (deepValue !== undefined && deepValue !== null && deepValue !== '') {
              frontmatter += `    ${deepKey}: ${deepValue}\n`;
            }
          });
        } else {
          // Include empty object with proper YAML syntax instead of null
          frontmatter += `  ${nestedKey}: {}\n`;
        }
      } else if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
        frontmatter += `  ${nestedKey}: ${nestedValue}\n`;
      }
    });
  } else {
    // Include empty object with proper YAML syntax
    frontmatter += `${key}: {}\n`;
  }
}
        else if (value !== undefined && value !== null) {
          // Handle specific types of values for formatting
          if (typeof value === 'string') {
            // Special case for dates in ISO format - don't add quotes
            if (key === 'pubDatetime' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
              frontmatter += `${key}: ${value}\n`;
            }
            // Border color is already a hex value with # prefix, so no need to escape further
            else if (key === 'borderColor' && value.startsWith('#')) {
              frontmatter += `${key}: "${value}"\n`;
            }
            // For all other strings, add quotes
            else {
              frontmatter += `${key}: "${value}"\n`;
            }
          }
          // For booleans and numbers, don't add quotes
          else {
            frontmatter += `${key}: ${value}\n`;
          }
        }
      }
    });
    
    frontmatter += '---\n\n';
    
    // Add content after frontmatter if it exists
    const markdown = dataForFrontmatter.content 
      ? frontmatter + dataForFrontmatter.content
      : frontmatter;
    
    // Define the file path - SPECIAL HANDLING FOR PHOTOS
    let path;
    if (contentType === 'photos' && dataForFrontmatter.albumId) {
      // For photos, include the album ID in the path
      path = `src/content/${contentType}/${dataForFrontmatter.albumId}/${filename}`;
      console.log(`Creating photo markdown in album directory: ${path}`);
    } else {
      // For other content types, use the standard path
      path = `src/content/${contentType}/${filename}`;
    }
    
    // Create the file in GitHub
    const result = await commitFile({
      path,
      content: markdown,
      message: `Add ${contentType.slice(0, -1)}: ${contentData.title || id}`,
      token
    });
    
    console.log(`Created ${contentType.slice(0, -1)} file:`, path);
    
    return {
      success: true,
      message: `${contentType.slice(0, -1).charAt(0).toUpperCase() + contentType.slice(0, -1).slice(1)} created successfully!`
    };
  } catch (error) {
    console.error(`Error creating ${contentType.slice(0, -1)}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Add this function after createContent

/**
 * Update an existing content item in the repository
 */
// Similarly update the updateContent function to exclude ID from frontmatter
export async function updateContent(
  path: string,
  contentData: any,
  token: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('Updating content at path:', path);
    console.log('Content data to update:', contentData);
    
    // Get the original file to get its SHA
    const fileResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to get original file: ${fileResponse.status}`);
    }
    
    const fileData = await fileResponse.json();
    const fileSha = fileData.sha;
    
    // Create a copy of the data without the ID field
    const { id: _, _sourceFile, ...dataForFrontmatter } = contentData;
    
    // Convert the content data to frontmatter + markdown format
    let frontmatter = '---\n';
    
    // Convert dataForFrontmatter to frontmatter, excluding special properties
    Object.entries(dataForFrontmatter).forEach(([key, value]) => {
      if (key !== 'content' && key !== '_sourceFile' && key !== '_rawContent' && !key.startsWith('_')) {
        if (Array.isArray(value)) {
          if (key === 'tags') {
            // For tags, use the bracket notation format
            const formattedTags = value.map(tag => `"${tag}"`).join(', ');
            frontmatter += `${key}: [${formattedTags}]\n`;
          } else {
            // For other arrays, keep using YAML list format
            frontmatter += `${key}:\n`;
            value.forEach(item => {
              frontmatter += `  - ${item}\n`;
            });
          }
        }
        // Update the nested object handling in both createContent and updateContent functions

else if (typeof value === 'object' && value !== null) {
  // Check if object has any non-empty values before including it
  const hasNonEmptyValues = Object.values(value).some(
    v => v !== null && v !== undefined && v !== ''
  );
  
  // Only include non-empty objects
  if (hasNonEmptyValues) {
    frontmatter += `${key}:\n`;
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        // For nested objects like metadata.settings
        const hasNestedValues = Object.values(nestedValue).some(
          v => v !== null && v !== undefined && v !== ''
        );
        
        if (hasNestedValues) {
          frontmatter += `  ${nestedKey}:\n`;
          Object.entries(nestedValue).forEach(([deepKey, deepValue]) => {
            if (deepValue !== undefined && deepValue !== null && deepValue !== '') {
              frontmatter += `    ${deepKey}: ${deepValue}\n`;
            }
          });
        } else {
          // Include empty object with proper YAML syntax instead of null
          frontmatter += `  ${nestedKey}: {}\n`;
        }
      } else if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
        frontmatter += `  ${nestedKey}: ${nestedValue}\n`;
      }
    });
  } else {
    // Include empty object with proper YAML syntax
    frontmatter += `${key}: {}\n`;
  }
}
        else if (value !== undefined && value !== null) {
          // Handle specific types of values for formatting
          if (typeof value === 'string') {
            // Special case for dates in ISO format - don't add quotes
            if (key === 'pubDatetime' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
              frontmatter += `${key}: ${value}\n`;
            }
            // Border color is already a hex value with # prefix, so no need to escape further
            else if (key === 'borderColor' && value.startsWith('#')) {
              frontmatter += `${key}: "${value}"\n`;
            }
            // For all other strings, add quotes
            else {
              frontmatter += `${key}: "${value}"\n`;
            }
          }
          // For booleans and numbers, don't add quotes
          else {
            frontmatter += `${key}: ${value}\n`;
          }
        }
      }
    });
    
    frontmatter += '---\n\n';
    
    // Add content after frontmatter if it exists
    const markdown = contentData.content 
      ? frontmatter + contentData.content
      : frontmatter;
    
    // Add more logging before sending the request
    console.log('Generated frontmatter:', frontmatter);
    console.log('Final markdown content:', markdown);
    
    // Update the file in GitHub
    const result = await commitFile({
      path,
      content: markdown,
      message: `Update content: ${contentData.title || path}`,
      token,
      branch: DEFAULT_BRANCH,
      sha: fileSha
    });
    
    console.log(`Updated content file:`, path);
    
    return {
      success: true,
      message: `Content updated successfully!`
    };
  } catch (error) {
    console.error(`Error updating content:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Upload an image to the repository
 */
export async function uploadImage(
  file: File, 
  albumId: string,
  token: string
): Promise<{ success: boolean; url?: string; relativePath?: string; error?: string }> {
  try {
    // Validate inputs
    if (!file || !albumId || !token) {
      console.error('Missing required parameters:', { 
        hasFile: !!file, 
        hasAlbumId: !!albumId, 
        hasToken: !!token 
      });
      return { success: false, error: 'Missing file, album ID, or authentication token' };
    }

    // Create a clean filename (remove spaces, special characters)
    const originalFileName = file.name;
    const fileExt = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Use a sanitized version of the original filename or create a unique filename
    let cleanFileName = originalFileName
      .toLowerCase()
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
    
    // Add timestamp to ensure uniqueness
    cleanFileName = `${cleanFileName}-${Date.now().toString(36)}`;
    const finalFileName = `${cleanFileName}.${fileExt}`;
    
    console.log(`Uploading ${originalFileName} as ${finalFileName} to album ${albumId}`);

    // Create the target path in the repository
    const path = `src/content/photos/${albumId}/${finalFileName}`;
    
    // Read the file as ArrayBuffer for binary handling
    const buffer = await file.arrayBuffer();
    
    // Log file information for debugging
    console.log(`File details - Size: ${file.size}B, Type: ${file.type}`);

    // Attempt to optimize image if possible
    let optimizedBuffer = buffer;
    // Modified code for githubDirectService.ts around line ~467
    // Attempt to optimize image if possible
    let processedFile = file;
    try {
      processedFile = await optimizeImage(file);
      console.log(`Image optimized from ${file.size}B to ${processedFile.size}B`);
      // Read the optimized file as ArrayBuffer
      optimizedBuffer = await readFileAsArrayBuffer(processedFile);
    } catch (optError) {
      console.warn('Image optimization failed, using original file:', optError);
    }
    
    // Commit file to GitHub
    const result = await commitFile({
      path,
      content: optimizedBuffer, // Use optimized content
      message: `Add photo ${finalFileName} to ${albumId} album`,
      token,
    });

    // After successful upload, return both URLs
    if (result && result.content && result.content.sha) {
      // Generate the raw GitHub URL for the image (for previews)
      const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}`;
      // Also provide the relative path for markdown content
      const relativePath = `./${finalFileName}`;
      
      console.log(`Upload successful! URL: ${rawUrl}, Relative: ${relativePath}`);
      return { 
        success: true, 
        url: rawUrl,           // For UI preview
        relativePath: relativePath  // For markdown file
      };
    } else {
      throw new Error('Unexpected response from GitHub API');
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
    return { success: false, error: errorMessage };
  }
}

// Helper function to read file as array buffer - more reliable for binary data
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Helper function to convert a file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Fetch content list from the repository
 */
export async function getContentList(
  token: string, 
  type: string
): Promise<{ success: boolean; items?: any[]; error?: string }> {
  try {
    // For Astro dev environment, try to use the initial data if available
    if (typeof window !== 'undefined' && 
        window.initialContentData && 
        window.initialContentData[type]) {
      const initialItems = window.initialContentData[type];
      if (initialItems && initialItems.length > 0) {
        console.log(`Using initial ${type} data from Astro (${initialItems.length} items)`);
        return { success: true, items: initialItems };
      }
    }
    
    // If no initial data available, fetch content from GitHub
    console.log(`Fetching ${type} from GitHub API`);
    const items = await fetchContent(type, token);
    console.log(`Fetched ${items.length} ${type} items from GitHub`);
    
    return { success: true, items };
  } catch (error) {
    console.error(`Error getting ${type} list:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : `Failed to get ${type}` 
    };
  }
}

// Add helper function to parse frontmatter from Markdown
function parseFrontmatter(markdown: string): any {
  try {
    // Simple frontmatter parser
    // Looking for content between --- markers at the beginning of the file
    const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    
    if (!frontmatterMatch) {
      return { content: markdown }; // No frontmatter found
    }
    
    const frontmatterRaw = frontmatterMatch[1];
    const content = markdown.replace(frontmatterMatch[0], '').trim();
    
    // Parse YAML-like frontmatter
    const result: Record<string, any> = { content };
    
    // Track list parsing state
    let currentList: string | null = null;
    let currentListItems: string[] = [];
    
    // Parse line by line
    const lines = frontmatterRaw.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimRight(); // Remove trailing spaces
      
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Check for list item
      if (line.trim().startsWith('- ')) {
        if (currentList) {
          // Add to current list
          currentListItems.push(line.trim().substring(2));
        }
        continue;
      }
      
      // If we were processing a list and now we found a non-list line,
      // save the list and reset the list state
      if (currentList) {
        result[currentList] = currentListItems;
        currentList = null;
        currentListItems = [];
      }
      
      // Handle regular key-value pair
      const match = line.match(/^([^:]+):\s*(.*)/);
      if (match) {
        let [_, key, value] = match;
        key = key.trim();
        value = value.trim();
        
        // If this is the start of a list
        if (!value) {
          const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
          if (nextLine.startsWith('- ')) {
            currentList = key;
            currentListItems = [];
            continue;
          }
        }
        
        // Handle arrays (e.g., tags: [tag1, tag2])
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value.slice(1, -1).split(',').map(v => v.trim());
        }
        // Handle nested objects (treat nested structure as raw text for now)
        else if (value.includes('{') && value.includes('}')) {
          try {
            // Try to parse as JSON
            result[key] = JSON.parse(value.replace(/'/g, '"'));
          } catch (e) {
            // If parsing fails, keep as string
            result[key] = value;
          }
        }
        // Handle dates
        else if (value.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/)) {
          result[key] = value; // Keep as string to avoid timezone issues
        }
        // Handle booleans
        else if (value.toLowerCase() === 'true') {
          result[key] = true;
        }
        else if (value.toLowerCase() === 'false') {
          result[key] = false;
        }
        // Handle numbers
        else if (!isNaN(Number(value)) && value !== '') {
          result[key] = Number(value);
        }
        // Default to string
        else {
          result[key] = value;
        }
      }
    }
    
    // If we were processing a list at the end, save it
    if (currentList) {
      result[currentList] = currentListItems;
    }
    
    // Add special handling for photos - make sure albumId is available
    if (result.photo && !result.albumId && result.album) {
      result.albumId = result.album;
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing frontmatter:", error);
    return { content: markdown }; // Return at least the content on failure
  }
}

// Add this function after the parseFrontmatter function

/**
 * Fetch and parse a markdown file from GitHub repository
 */
async function fetchAndParseFile(path: string, token: string): Promise<any> {
  try {
    // Fetch the file from GitHub
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // GitHub API returns file content as base64 encoded
    // Decode it to plain text
    const content = atob(data.content.replace(/\n/g, '')); // Remove newlines GitHub may add
    
    // Parse the file content
    const parsed = parseFrontmatter(content);
    
    // Add id field based on the file path
    const filename = path.split('/').pop();
    const id = filename?.replace('.md', '') || '';
    parsed.id = id;
    
    // Keep raw content for possible use
    parsed._rawContent = content;
    
    return parsed;
  } catch (error) {
    console.error(`Error fetching and parsing file ${path}:`, error);
    throw error;
  }
}

// Validate GitHub token without server
export async function validateToken(token: string): Promise<{valid: boolean; message?: string}> {
  try {
    // First, do a simple request to verify basic authentication
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!userResponse.ok) {
      console.log("Token validation failed on user endpoint:", userResponse.status);
      return { valid: false, message: `Authentication failed: ${userResponse.statusText}` };
    }

    const userData = await userResponse.json();
    
    // Now verify repository access with a less intrusive call (just checking repo existence)
    const repoResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!repoResponse.ok) {
      console.log("Token validation failed on repo endpoint:", repoResponse.status);
      return { 
        valid: false, 
        message: `Token doesn't have access to the repository: ${repoResponse.statusText}` 
      };
    }
    
    // Additional debug logging for successful validation
    console.log(`Token validated successfully as ${userData.login}`);
    return { valid: true, message: `Authenticated as ${userData.login}` };
  } catch (error) {
    console.error('Error validating token:', error);
    return { 
      valid: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete a content file from the GitHub repository
 * For photos, also deletes the associated image file
 */
export async function deleteContent(
  path: string,
  token: string,
  commitMessage: string = 'Delete content'
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get the file to retrieve its SHA - required for deletion
    const fileResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!fileResponse.ok) {
      const errorBody = await fileResponse.text();
      throw new Error(`Failed to get file: ${fileResponse.status} ${fileResponse.statusText} - ${errorBody}`);
    }
    
    const fileData = await fileResponse.json();
    const fileSha = fileData.sha;
    
    // Check if this is a photo markdown file
    const isPhotoMarkdown = path.startsWith('src/content/photos/') && path.endsWith('.md');
    
    // If this is a photo, we need to find and delete the image file too
    if (isPhotoMarkdown) {
      // Try to get the photo content to find the image reference
      const photoContent = await fetchAndParseFile(path, token);
      
      try {
        // Get the directory path (album path)
        const directoryPath = path.substring(0, path.lastIndexOf('/'));
        const baseFilename = path.split('/').pop()?.replace('.md', '');
        
        // List all files in the directory to find the image
        const dirResponse = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${directoryPath}`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github.v3+json'
            }
          }
        );
        
        if (dirResponse.ok) {
          const files = await dirResponse.json();
          
          // Look for image files with the same base name
          const matchingImageFiles = files.filter((file: { 
            path: string; 
            name: string; 
            sha: string;
          }) => {
            // Skip the markdown file itself
            if (file.path === path) return false;
            
            const fileName = file.name;
            // Check if this is an image file with the same base name
            return /\.(jpe?g|png|gif|webp)$/i.test(fileName) && 
                   fileName.replace(/\.[^/.]+$/, '') === baseFilename;
          });
          
          // Delete each matching image file
          for (const imageFile of matchingImageFiles) {
            console.log(`Deleting associated image file: ${imageFile.path}`);
            
            const imgResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${imageFile.path}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
              },
              body: JSON.stringify({
                message: `Delete image for ${baseFilename}`,
                sha: imageFile.sha
              })
            });
            
            if (!imgResponse.ok) {
              console.error(`Failed to delete image file: ${imageFile.path}`, await imgResponse.text());
              // Continue with other deletions even if one fails
            } else {
              console.log(`Successfully deleted image file: ${imageFile.path}`);
            }
          }
        }
      } catch (imageError) {
        console.error('Error finding/deleting associated image file:', imageError);
        // Continue with markdown deletion even if image deletion fails
      }
    }
    
    // Now delete the original file (markdown) using its SHA
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: commitMessage,
        sha: fileSha
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to delete file: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting content:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during deletion'
    };
  }
}

// Update the fetchContent function to avoid creating duplicate items:

export async function fetchContent(type: string, token: string): Promise<any[]> {
  try {
    // Validate the token
    const validation = await validateToken(token);
    if (!validation.valid) {
      console.error('Invalid token:', validation.message);
      return [];
    }

    // Different paths based on content type
    let directoryPath: string;
    switch (type) {
      case 'albums':
        directoryPath = 'src/content/albums';
        break;
      case 'photos':
        directoryPath = 'src/content/photos';
        break;
      case 'snips':
        directoryPath = 'src/content/snips';
        break;
      case 'playlists':
        directoryPath = 'src/content/playlists';
        break;
      default:
        throw new Error(`Unknown content type: ${type}`);
    }

    console.log(`Fetching ${type} list with token: ${token.slice(0, 5)}...${token.slice(-4)}`);

    // List the contents of the directory
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${directoryPath}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list directory: ${response.status} ${errorText}`);
    }

    const items = await response.json();
    
    // Filter out non-content files
    const validItems = Array.isArray(items) ? items : [];
    console.log(`Found ${validItems.length} files in ${type} directory`);

    // For photos, handle the special case of subdirectories by album
    if (type === 'photos') {
      const photoItems = [];
      
      // IMPROVED TRACKING: Use normalized IDs for better deduplication
      const seenPhotoIds = new Set();
      const seenMarkdownPaths = new Set();
      const seenImagePaths = new Set();
      const photosByAlbum: Record<string, any[]> = {}; // Track photos by album for better organization
      
      // For each subdirectory (album), fetch its contents
      for (const item of validItems) {
        if (item.type === 'dir') {
          const albumPath = item.path;
          const albumId = item.name; // Album ID is the directory name
          
          if (!photosByAlbum[albumId]) {
            photosByAlbum[albumId] = [];
          }
          
          // Fetch photos in this album
          const photoResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${albumPath}`,
            {
              headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
              }
            }
          );
          
          if (photoResponse.ok) {
            const albumPhotos = await photoResponse.json();
            
            // Create a map to track which images have markdown files
            const photoMap = new Map();
            
            // First pass: index all files by their base name (without extension)
            for (const file of albumPhotos) {
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              if (!photoMap.has(baseName)) {
                photoMap.set(baseName, { markdown: null, image: null });
              }
              
              if (file.name.endsWith('.md')) {
                photoMap.get(baseName).markdown = file;
              } else if (/\.(jpe?g|png|gif|webp)$/i.test(file.name)) {
                photoMap.get(baseName).image = file;
              }
            }
            
            // Second pass: Process each photo with priority to markdown files
            for (const [baseName, files] of photoMap.entries()) {
              const photoId = `${albumId}/${baseName}`;
              
              // Skip if we've already processed this photo ID
              if (seenPhotoIds.has(photoId)) {
                console.log(`Skipping duplicate photo ID: ${photoId}`);
                continue;
              }
              
              // Process markdown file if available
              if (files.markdown) {
                const mdFile = files.markdown;
                
                // Skip duplicate paths
                if (seenMarkdownPaths.has(mdFile.path)) {
                  continue;
                }
                seenMarkdownPaths.add(mdFile.path);
                
                try {
                  const photoContent = await fetchAndParseFile(mdFile.path, token);
                  if (photoContent) {
                    photoContent.albumId = albumId;
                    photoContent._sourceFile = mdFile.path;
                    photoContent.id = photoId;
                    
                    // If there's also an image file, make sure the photo property points to it
                    if (files.image) {
                      // Use GitHub raw URL for better compatibility
                      photoContent.photo = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${files.image.path}`;
                    }
                    
                    seenPhotoIds.add(photoId);
                    photoItems.push(photoContent);
                    photosByAlbum[albumId].push(photoContent);
                  }
                } catch (err) {
                  console.error(`Error processing file ${mdFile.path}:`, err);
                }
              } 
              // If no markdown but has image
              else if (files.image) {
                const imgFile = files.image;
                
                // Skip duplicate paths
                if (seenImagePaths.has(imgFile.path)) {
                  continue;
                }
                seenImagePaths.add(imgFile.path);
                
                const extension = imgFile.name.split('.').pop() || '';
                // Generate title from filename
                const title = baseName.replace(/-/g, ' ').replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase());
                
                const photoObject = {
                  id: photoId,
                  title: title,
                  albumId: albumId,
                  photo: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${imgFile.path}`,
                  _sourceFile: imgFile.path,
                  pubDatetime: new Date().toISOString(),
                  format: extension
                };
                
                seenPhotoIds.add(photoId);
                photoItems.push(photoObject);
                photosByAlbum[albumId].push(photoObject);
              }
            }
          } else {
            console.error(`Failed to fetch album ${albumId}:`, await photoResponse.text());
          }
        }
      }
      
      console.log(`Total unique photos found: ${photoItems.length}`);
      return photoItems;
    }
    
    // Regular content processing for other types (albums, snips, playlists)
    const contentItems = [];
    const seenIds = new Set(); // Track already processed IDs to prevent duplicates
    
    // Process each content file
    for (const item of validItems) {
      // Only process markdown files for regular content
      if (item.name.endsWith('.md')) {
        try {
          const baseName = item.name.replace('.md', '');
          // Prevent duplicate item processing
          if (seenIds.has(baseName)) {
            console.log(`Skipping duplicate file: ${item.name}`);
            continue;
          }
          seenIds.add(baseName);
          
          const contentData = await fetchAndParseFile(item.path, token);
          if (contentData) {
            contentData._sourceFile = item.path;
            contentItems.push(contentData);
          }
        } catch (err) {
          console.error(`Error processing file ${item.path}:`, err);
        }
      }
    }
    
    return contentItems;
  } catch (error) {
    console.error(`Error fetching ${type} content:`, error);
    return []; // Return empty array on error
  }
}