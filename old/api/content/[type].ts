import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import slugify from 'slugify';

// Mark this route as server-only
export const prerender = false;

// Get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(__dirname, '../../../../src/content');
const publicRoot = path.resolve(__dirname, '../../../../public');

// Validate authentication
const validateAuth = (request: Request) => {
  const password = import.meta.env.ADMIN_PASSWORD || 'admin123';
  
  // Check for Bearer token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === password) {
      return true;
    }
  }
  
  // Also check cookies (for server-side rendered requests)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
    const authCookie = cookies.find(cookie => cookie.startsWith('admin_auth='));
    if (authCookie) {
      const token = authCookie.split('=')[1];
      if (token === password) {
        return true;
      }
    }
  }
  
  return false;
};

// Create directories recursively if they don't exist
const ensureDirectoryExists = async (dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
};

// Upload and optimize image
const processImage = async (file: File, albumId: string): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalFilename = file.name;
  const ext = path.extname(originalFilename).toLowerCase();
  const baseFilename = path.basename(originalFilename, ext);
  const timestamp = Date.now();
  const slug = slugify(baseFilename, { lower: true, strict: true });
  const uploadPath = `/images/uploads/${albumId}`;
  const filename = `${slug}-${timestamp}${ext}`;
  
  // Ensure upload directory exists
  const fullUploadPath = path.join(publicRoot, uploadPath);
  await ensureDirectoryExists(fullUploadPath);
  
  // Save the original image
  const filePath = path.join(fullUploadPath, filename);
  
  // Optimize the image
  await sharp(buffer)
    .resize({ width: 1800, height: 1200, fit: 'inside', withoutEnlargement: true })
    .toFile(filePath);
  
  return `${uploadPath}/${filename}`;
};

// Generate content file
const generateContentFile = async (type: string, data: any): Promise<string> => {
  const timestamp = new Date().toISOString().split('T')[0];
  const title = data.title || 'Untitled';
  const slug = slugify(title, { lower: true, strict: true });
  const id = `${timestamp}-${slug}`;
  
  let contentDir;
  let content;
  
  switch (type) {
    case 'albums':
      contentDir = path.join(contentRoot, 'albums');
      content = `---
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${data.pubDatetime || new Date().toISOString()}
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map(t => `"${t}"`).join(', ')}]
borderColor: "${data.borderColor || '#ffffff'}"
${data.location ? `location: "${data.location}"` : ''}
${data.coverPhotoId ? `coverPhotoId: "${data.coverPhotoId}"` : ''}
---`;
      break;
    
    case 'photos':
      contentDir = path.join(contentRoot, 'photos');
      content = `---
albumId: "${data.albumId}"
${data.title ? `title: "${data.title}"` : ''}
photo: "${data.photoPath}"
${data.caption ? `caption: "${data.caption}"` : ''}
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
      contentDir = path.join(contentRoot, 'snips');
      content = `---
${data.albumId ? `albumId: "${data.albumId}"` : ''}
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${data.pubDatetime || new Date().toISOString()}
${data.modDatetime ? `modDatetime: ${data.modDatetime}` : ''}
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map(t => `"${t}"`).join(', ')}]
${data.source ? `source: "${data.source}"` : ''}
${data.sourceUrl ? `sourceUrl: "${data.sourceUrl}"` : ''}
${data.order ? `order: ${data.order}` : ''}
---

${data.content || ''}`;
      break;
      
    case 'playlists':
      contentDir = path.join(contentRoot, 'playlists');
      content = `---
${data.albumId ? `albumId: "${data.albumId}"` : ''}
title: "${data.title}"
description: "${data.description || ''}"
pubDatetime: ${data.pubDatetime || new Date().toISOString()}
platform: "${data.platform || 'spotify'}"
playlistUrl: "${data.playlistUrl}"
featured: ${data.featured || false}
draft: ${data.draft || false}
tags: [${(data.tags || ['untagged']).map(t => `"${t}"`).join(', ')}]
${data.coverImage ? `coverImage: "${data.coverImage}"` : ''}
${data.mood ? `mood: [${data.mood.map(m => `"${m}"`).join(', ')}]` : ''}
${data.order ? `order: ${data.order}` : ''}
---`;
      break;
      
    default:
      throw new Error(`Invalid content type: ${type}`);
  }
  
  // Ensure content directory exists
  await ensureDirectoryExists(contentDir);
  
  // Write the file
  const filePath = path.join(contentDir, `${id}.md`);
  await fs.writeFile(filePath, content);
  
  return id;
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    // Verify authentication
    if (!validateAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { type } = params;
    if (!['albums', 'photos', 'snips', 'playlists'].includes(type || '')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const contentData: Record<string, any> = {};

    // Process form data
    for (const [key, value] of formData.entries()) {
      if (key === 'file' && value instanceof File) {
        // Handle file upload for photos
        if (type === 'photos') {
          const albumId = formData.get('albumId')?.toString() || 'uncategorized';
          contentData.photoPath = await processImage(value, albumId);
        }
      } else if (key === 'tags' || key === 'mood') {
        // Parse arrays
        contentData[key] = value ? value.toString().split(',').map(t => t.trim()) : [];
      } else if (['featured', 'draft'].includes(key)) {
        // Parse booleans
        contentData[key] = value === 'true';
      } else if (key === 'metadata') {
        // Parse metadata as JSON
        try {
          contentData[key] = JSON.parse(value.toString());
        } catch (e) {
          contentData[key] = {};
        }
      } else {
        contentData[key] = value;
      }
    }

    // Generate content file
    const contentId = await generateContentFile(type, contentData);

    return new Response(JSON.stringify({ 
      success: true, 
      id: contentId,
      message: `${type.slice(0, -1)} created successfully` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing content:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create content',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Get a list of content items
export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Verify authentication
    if (!validateAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { type } = params;
    if (!['albums', 'photos', 'snips', 'playlists'].includes(type || '')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const contentDir = path.join(contentRoot, type);
    
    try {
      const files = await fs.readdir(contentDir);
      return new Response(JSON.stringify({ items: files }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        items: [],
        message: `No ${type} found or directory does not exist`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error(`Error fetching ${params.type}:`, error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
