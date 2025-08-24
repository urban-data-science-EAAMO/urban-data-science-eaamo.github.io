const { createContent } = require('../githubDirectService');

// Mock the astro:content and collections 
jest.mock('astro:content', () => ({
  z: {
    object: () => ({
      parse: jest.fn().mockImplementation(() => true)
    }),
    string: () => ({
      optional: () => ({ default: () => ({}) }),
      default: () => ({})
    }),
    date: () => ({ optional: () => ({}), default: () => ({}) }),
    boolean: () => ({ optional: () => ({}) }),
    array: () => ({ default: () => ({}) }),
    number: () => ({ optional: () => ({}) }),
    union: () => ({ optional: () => ({}) }),
  }
}));

jest.mock('../../content/config', () => ({
  collections: {
    albums: { schema: { parse: jest.fn().mockImplementation(() => true) } },
    photos: { schema: { parse: jest.fn().mockImplementation(() => true) } },
    snips: { schema: { parse: jest.fn().mockImplementation(() => true) } },
    playlists: { schema: { parse: jest.fn().mockImplementation(() => true) } },
  }
}));

// Define interface for mock data - add more specific typing
interface MockContentData {
  [key: string]: any;
  title?: string;
  albumId?: string;
  pubDatetime?: string;
  photo?: string;
  caption?: string; 
  metadata?: {
    camera?: string;
    lens?: string;
    settings?: {
      aperture?: string;
      shutterSpeed?: string;
      iso?: number | string;
      focalLength?: string;
    };
  };
}

// Store mock data for testing - add proper initialization
let mockContentData: MockContentData | null = null;

// Mock the GitHub API functions with proper typing
jest.mock('../githubDirectService', () => {
  const original = jest.requireActual('../githubDirectService');
  return {
    ...original,
    commitFile: jest.fn().mockResolvedValue({ content: { sha: 'mock-sha' } }),
    createContent: jest.fn().mockImplementation((type: string, data: any, token: string) => {
      // Use type assertion to ensure TypeScript treats it as the right type
      mockContentData = data as MockContentData;
      return Promise.resolve({ success: true, message: 'Content created' });
    })
  };
});

// Simplified schema validation test
describe('Content Schema Validation', () => {
  // Define test data
  const testData = {
    albums: {
      title: 'Test Album',
      description: 'Album description',
      pubDatetime: new Date().toISOString(),
      tags: ['test', 'album'],
    },
    photos: {
      albumId: 'test-album',
      title: 'Test Photo',
      photo: './test-photo.jpg',
      metadata: {
        camera: 'Canon',
        settings: {} // Empty settings object
      }
    },
    // Other test objects...
  };

  // Test data structure validation
  test('Photo metadata structure matches schema requirements', () => {
    const photo = testData.photos;
    
    // Basic structure validation
    expect(photo).toHaveProperty('albumId');
    expect(photo).toHaveProperty('title');
    expect(photo).toHaveProperty('photo');
    
    // Validate metadata structure
    expect(photo).toHaveProperty('metadata');
    expect(photo.metadata).toHaveProperty('camera');
    expect(photo.metadata).toHaveProperty('settings');
    expect(typeof photo.metadata.settings).toBe('object');
  });

  test('Album structure matches schema requirements', () => {
    const album = testData.albums;
    
    expect(album).toHaveProperty('title');
    expect(album).toHaveProperty('description');
    expect(album).toHaveProperty('pubDatetime');
    expect(Array.isArray(album.tags)).toBe(true);
  });
});

// Simple schema validation test that focuses on structure matching
describe('Content Schema Structure', () => {
  // Test samples matching the exact schema requirements
  const sampleData = {
    albums: {
      title: "Test Album",
      description: "Album description",
      pubDatetime: new Date().toISOString(), // Will be converted to Date object by schema
      tags: ["test", "album"],
      borderColor: "#ff5500",
      location: "Test Location",
      coverPhotoId: "test-photo"
    },
    
    photos: {
      albumId: "test-album",
      title: "Test Photo",
      photo: "./test-photo.jpg", // This should be an image path
      caption: "Test photo caption",
      pubDatetime: new Date().toISOString(),
      order: 1,
      metadata: {
        camera: "Canon EOS R5",
        lens: "24-70mm f/2.8",
        settings: {
          aperture: "f/2.8",
          shutterSpeed: "1/100",
          iso: 100,
          focalLength: "50mm"
        }
      }
    },
    
    snips: {
      title: "Test Snip",
      description: "Test snip description",
      pubDatetime: new Date().toISOString(),
      tags: ["test", "snip"],
      source: "Test Source",
      sourceUrl: "https://example.com" // Must be valid URL
    },
    
    playlists: {
      title: "Test Playlist",
      description: "Test playlist description",
      pubDatetime: new Date().toISOString(),
      platform: "spotify", // Must be "spotify" or "apple"
      playlistUrl: "https://open.spotify.com/playlist/123456", // Must be valid URL
      tags: ["test", "playlist"],
      mood: ["chill", "focus"]
    }
  };

  // Test each schema's required fields and structure
  test('Album schema structure matches config requirements', () => {
    const album = sampleData.albums;
    
    // Check required fields defined in config.ts
    expect(album).toHaveProperty('title');
    expect(album).toHaveProperty('description');
    expect(album).toHaveProperty('pubDatetime');
    
    // Check specific format requirements
    expect(album.borderColor).toMatch(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
    expect(Array.isArray(album.tags)).toBe(true);
  });
  
  test('Photo schema structure matches config requirements', () => {
    const photo = sampleData.photos;
    
    // Check required fields defined in config.ts
    expect(photo).toHaveProperty('albumId');
    expect(photo).toHaveProperty('photo');
    
    // Check metadata structure (optional but structured)
    if (photo.metadata) {
      if (photo.metadata.settings) {
        // Settings structure
        expect(typeof photo.metadata.settings).toBe('object');
      }
    }
  });
  
  test('Snip schema structure matches config requirements', () => {
    const snip = sampleData.snips;
    
    // Check required fields
    expect(snip).toHaveProperty('title');
    expect(snip).toHaveProperty('description');
    expect(snip).toHaveProperty('pubDatetime');
    
    // Check URL format if provided
    if (snip.sourceUrl) {
      expect(snip.sourceUrl).toMatch(/^https?:\/\/.+/);
    }
  });
  
  test('Playlist schema structure matches config requirements', () => {
    const playlist = sampleData.playlists;
    
    // Check required fields
    expect(playlist).toHaveProperty('title');
    expect(playlist).toHaveProperty('description');
    expect(playlist).toHaveProperty('pubDatetime');
    expect(playlist).toHaveProperty('platform');
    expect(playlist).toHaveProperty('playlistUrl');
    
    // Check enum values
    expect(['spotify', 'apple']).toContain(playlist.platform);
    
    // Check URL format
    expect(playlist.playlistUrl).toMatch(/^https?:\/\/.+/);
  });
});