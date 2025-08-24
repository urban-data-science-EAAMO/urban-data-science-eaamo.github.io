import React, { useState, useEffect } from 'react';
import { createContent, validateToken, updateContent } from '../../utils/githubDirectService';

interface PlaylistFormProps {
  albums: any[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  gitHubToken: string;
  onRefresh?: () => void; // Optional callback to refresh content
  editMode?: boolean;
  initialData?: any;
  onCancel?: () => void;
}

const PlaylistForm: React.FC<PlaylistFormProps> = ({ 
  albums = [], // Add default empty array to prevent undefined errors
  onSuccess, 
  onError, 
  gitHubToken,
  onRefresh,
  editMode = false,
  initialData = null,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    albumId: '',
    title: '',
    description: '',
    platform: 'spotify',
    playlistUrl: '',
    playlistId: '', // Added to store the extracted ID
    pubDatetime: new Date().toISOString(), // Use full ISO format for schema compatibility
    featured: false,
    draft: false,
    tags: '',
    coverImage: '',
    mood: '', // Added to match schema
    order: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValidating, setIsTokenValidating] = useState(false);
  const [formMessage, setFormMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Initialize form with data when in edit mode
  useEffect(() => {
    if (editMode && initialData) {
      console.log('Initial playlist data for editing:', initialData);
      
      // Format date if available - check both direct and data nested properties
      let formattedDate = '';
      try {
        const dateValue = initialData.pubDatetime || initialData.date || 
                        (initialData.data && (initialData.data.pubDatetime || initialData.data.date));
        
        if (dateValue) {
          const date = new Date(dateValue);
          formattedDate = date.toISOString();
        } else {
          formattedDate = new Date().toISOString();
        }
      } catch (e) {
        console.error('Error parsing date:', e);
        formattedDate = new Date().toISOString();
      }
      
      // Get albumId from either direct property or data nested property
      const albumId = initialData.albumId || (initialData.data && initialData.data.albumId) || '';
      
      // Get title and other fields from either direct property or data nested property
      const title = initialData.title || (initialData.data && initialData.data.title) || '';
      const description = initialData.description || (initialData.data && initialData.data.description) || '';
      const featured = initialData.featured || (initialData.data && initialData.data.featured) || false;
      const draft = initialData.draft || (initialData.data && initialData.data.draft) || false;
      const platform = initialData.platform || (initialData.data && initialData.data.platform) || 'spotify';
      const playlistUrl = initialData.playlistUrl || (initialData.data && initialData.data.playlistUrl) || '';
      const playlistId = initialData.playlistId || (initialData.data && initialData.data.playlistId) || '';
      const coverImage = initialData.coverImage || (initialData.data && initialData.data.coverImage) || '';
      const order = initialData.order || (initialData.data && initialData.data.order) || '';
      
      // Get tags, ensure it's a comma-separated string for form
      let tags = '';
      const tagsArray = initialData.tags || (initialData.data && initialData.data.tags) || [];
      if (Array.isArray(tagsArray)) {
        tags = tagsArray.join(', ');
      }

      // Get mood, ensure it's a comma-separated string for form
      let mood = '';
      const moodArray = initialData.mood || (initialData.data && initialData.data.mood) || [];
      if (Array.isArray(moodArray)) {
        mood = moodArray.join(', ');
      }
      
      setFormData({
        albumId,
        title,
        description,
        platform,
        playlistUrl,
        playlistId,
        pubDatetime: formattedDate,
        featured,
        draft,
        tags,
        coverImage,
        mood,
        order: order ? String(order) : '',
      });
    }
  }, [editMode, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    // If changing the playlist URL, try to extract the ID
    if (name === 'playlistUrl') {
      const extractedId = extractPlaylistId(value, formData.platform);
      if (extractedId) {
        setFormData({
          ...formData,
          playlistUrl: value,
          playlistId: extractedId
        });
      } else {
        setFormData({
          ...formData,
          [name]: value
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  // Extract playlist ID from the URL
  const extractPlaylistId = (url: string, platform: string): string | null => {
    try {
      if (platform === 'spotify') {
        // Handle Spotify URLs
        // Format: https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd
        if (url.includes('/playlist/')) {
          const parts = url.split('/playlist/');
          if (parts.length > 1) {
            // Remove any query parameters
            return parts[1].split('?')[0];
          }
        }
      } else if (platform === 'apple') {
        // Handle Apple Music URLs
        // Format: https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb
        if (url.includes('/playlist/')) {
          const parts = url.split('/playlist/');
          if (parts.length > 1) {
            const idPart = parts[1].split('/');
            // Return the last part which should be the ID
            return idPart[idPart.length - 1].split('?')[0];
          }
        }
      }
    } catch (error) {
      console.error('Error extracting playlist ID:', error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const token = gitHubToken;
      
      if (!token) {
        throw new Error("GitHub token is missing");
      }
      
      // Validate the token first
      setIsTokenValidating(true);
      const validationResult = await validateToken(token);
      setIsTokenValidating(false);
      
      if (!validationResult.valid) {
        throw new Error(`Token validation failed: ${validationResult.message || 'Unknown error'}`);
      }
      
      // Validate the URL and extract the ID
      const playlistId = formData.playlistId || extractPlaylistId(formData.playlistUrl, formData.platform);
      if (!playlistId) {
        throw new Error('Could not extract playlist ID from URL. Please check the format.');
      }

      // Convert tags string to array
      const tagsArray = formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : ['untagged'];
      
      // Convert mood string to array
      const moodArray = formData.mood ? formData.mood.split(',').map(item => item.trim()) : undefined;
      
      // Generate unique ID for the playlist (if not in edit mode)
      const uniqueId = editMode && initialData ? initialData.id : `playlist_${Date.now()}`;
      
      // Format data for content file
      const contentData = {
        id: uniqueId,
        title: formData.title,
        description: formData.description,
        platform: formData.platform,
        playlistUrl: formData.playlistUrl,
        playlistId: playlistId,
        pubDatetime: formData.pubDatetime,
        albumId: formData.albumId || undefined,
        featured: formData.featured,
        draft: formData.draft,
        tags: tagsArray,
        coverImage: formData.coverImage || undefined,
        mood: moodArray,
        order: formData.order ? parseInt(formData.order) : undefined,
        _sourceFile: editMode && initialData ? initialData._sourceFile : undefined
      };
      
      let result;
      
      if (editMode && initialData && initialData._sourceFile) {
        // Update existing playlist
        result = await updateContent(initialData._sourceFile, contentData, token);
        if (result.success) {
          onSuccess('Playlist updated successfully');
          
          // Call refresh callback if provided
          if (onRefresh) {
            onRefresh();
          }
        } else {
          throw new Error(result.error || 'Failed to update playlist');
        }
      } else {
        // Create new playlist
        console.log("Creating playlist content:", contentData.title);
        result = await createContent('playlists', contentData, token);
        
        if (result.success) {
          onSuccess(result.message || 'Playlist created successfully!');
          
          // Reset form for new entries
          if (!editMode) {
            setFormData({
              albumId: '',
              title: '',
              description: '',
              platform: 'spotify',
              playlistUrl: '',
              playlistId: '',
              pubDatetime: new Date().toISOString(),
              featured: false,
              draft: false,
              tags: '',
              coverImage: '',
              mood: '',
              order: ''
            });
          }
          
          // Call refresh callback if provided
          if (onRefresh) {
            onRefresh();
          }
        } else {
          throw new Error(result.error || 'Failed to create playlist');
        }
      }
      
      setFormMessage({ type: 'success', text: editMode ? 'Playlist updated successfully!' : 'Playlist created successfully!' });
      
    } catch (error) {
      console.error(editMode ? 'Error updating playlist:' : 'Error creating playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      onError(errorMessage);
      setFormMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
      setIsTokenValidating(false); // Ensure token validation state is reset
    }
  };

  // Determine button text based on current state
  const buttonText = isTokenValidating ? 'Validating Token...' : 
                    isSubmitting ? (editMode ? 'Updating...' : 'Creating...') : 
                    (editMode ? 'Update Playlist' : 'Create Playlist');

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">{editMode ? 'Edit Playlist' : 'Add New Playlist'}</h2>
      
      {formMessage && (
        <div className={`mb-4 p-3 rounded-md ${
          formMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' 
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {formMessage.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title*
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Album (optional)
            </label>
            <select
              name="albumId"
              value={formData.albumId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {(albums || []).map(album => (
                <option key={album.id} value={album.id}>
                  {album.data?.title || album.title || album.id}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Platform*
            </label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Date
            </label>
            <input
              type="date"
              name="pubDatetime"
              value={formData.pubDatetime.split('T')[0]} // Show only YYYY-MM-DD in input
              onChange={(e) => {
                // Preserve time portion of the ISO string when updating date
                const newDate = new Date(`${e.target.value}T00:00:00.000Z`);
                setFormData({
                  ...formData,
                  pubDatetime: newDate.toISOString()
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Playlist URL*
            </label>
            <input
              type="url"
              name="playlistUrl"
              value={formData.playlistUrl}
              onChange={handleChange}
              placeholder={formData.platform === 'spotify' ? 
                'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd' : 
                'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb'}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the full playlist URL from {formData.platform === 'spotify' ? 'Spotify' : 'Apple Music'}
            </p>
          </div>
          
          {formData.playlistId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Playlist ID (extracted)
              </label>
              <input
                type="text"
                value={formData.playlistId}
                readOnly
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-500"
              />
            </div>
          )}
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image URL (optional)
            </label>
            <input
              type="url"
              name="coverImage"
              value={formData.coverImage}
              onChange={handleChange}
              placeholder="https://example.com/cover-image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order (optional)
            </label>
            <input
              type="number"
              name="order"
              value={formData.order}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="music, indie, rock"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mood (comma separated, optional)
            </label>
            <input
              type="text"
              name="mood"
              value={formData.mood}
              onChange={handleChange}
              placeholder="chill, upbeat, relaxing"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex space-x-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="featured"
                checked={formData.featured}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Featured</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="draft"
                checked={formData.draft}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Draft</span>
            </label>
          </div>
        </div>
        
        <div className="pt-4 flex justify-between">
          {/* Show cancel button in edit mode */}
          {editMode && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting || isTokenValidating}
            className={`px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${(isSubmitting || isTokenValidating) ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {buttonText}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlaylistForm;