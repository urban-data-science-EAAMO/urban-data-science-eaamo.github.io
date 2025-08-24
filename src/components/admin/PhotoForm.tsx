import React, { useState, useEffect, useMemo } from 'react';
import { createContent, validateToken, updateContent } from '../../utils/githubDirectService';
import PhotoUpload from './PhotoUpload';
import { extractPhotoUrl, normalizePhotoUrl } from '../../utils/contentHelpers';
import Pagination from './Pagination';

interface PhotoFormProps {
  albums: any[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  gitHubToken: string;
  onRefresh?: () => void; // Optional callback to refresh content
  editMode?: boolean;
  initialData?: any;
  onCancel?: () => void;
}

interface PhotoFormData {
  albumId: string;
  title: string;
  caption: string;
  order: string;
  metadata: {
    camera: string;
    lens: string;
    settings: {
      aperture: string;
      shutterSpeed: string;
      iso: string;
      focalLength: string;
    }
  };
  pubDatetime: string;
}

interface Photo {
  id?: string;
  _sourceFile?: string;
  title?: string;
  photo?: string;
  data?: {
    title?: string;
    albumId?: string;
  };
  // Add other photo properties as needed
}

const PhotoForm: React.FC<PhotoFormProps> = ({ 
  albums, 
  onSuccess, 
  onError, 
  gitHubToken, 
  onRefresh,
  editMode = false,
  initialData = null,
  onCancel
}) => {
  const [formData, setFormData] = useState<PhotoFormData>({
    albumId: '',
    title: '',
    caption: '',
    order: '',
    metadata: {
      camera: '',
      lens: '',
      settings: {
        aperture: '',
        shutterSpeed: '',
        iso: '',
        focalLength: ''
      }
    },
    pubDatetime: new Date().toISOString() // Use full ISO format
  });
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageRelativePath, setImageRelativePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValidating, setIsTokenValidating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12); // Default to 12 photos per page for grid view
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [imageUploaded, setImageUploaded] = useState(false); // Add a new state variable to track the image upload status
  const [formMessage, setFormMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Update this function with proper type annotations:

  // For paginating photos in album selector
  const paginatePhotos = (photos: Photo[], page: number, perPage: number): Photo[] => {
    const startIndex = (page - 1) * perPage;
    return photos.slice(startIndex, startIndex + perPage);
  };

  // Add this useEffect to reset to page 1 when album selection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [formData.albumId]);

  // Add this near the pagination logic
  // Get photos from the selected album
  const selectedAlbumPhotos = useMemo(() => {
    if (!formData.albumId || !albums) return [];
    
    // Find photos that match the current album ID
    const albumPhotos = albums.flatMap(album => {
      if (album.id === formData.albumId && album.photos) {
        return album.photos;
      }
      return [];
    });
    
    return albumPhotos;
  }, [formData.albumId, albums]);

  // Initialize form with data when in edit mode
  useEffect(() => {
    if (editMode && initialData) {
      console.log('Initial photo data for editing:', initialData);
      
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
      
      // Extract metadata if available - check both direct and data nested properties
      const metadata = {
        camera: '',
        lens: '',
        settings: {
          aperture: '',
          shutterSpeed: '',
          iso: '',
          focalLength: ''
        }
      };
      
      // Check both direct and data nested properties
      const metadataSource = initialData.metadata || (initialData.data && initialData.data.metadata);
      
      if (metadataSource) {
        metadata.camera = metadataSource.camera || '';
        metadata.lens = metadataSource.lens || '';
        
        if (metadataSource.settings) {
          metadata.settings.aperture = metadataSource.settings.aperture || '';
          metadata.settings.shutterSpeed = metadataSource.settings.shutterSpeed || '';
          metadata.settings.iso = metadataSource.settings.iso || '';
          metadata.settings.focalLength = metadataSource.settings.focalLength || '';
        }
      }
      
      // Get album ID from either direct property or data nested property
      const albumId = initialData.albumId || (initialData.data && initialData.data.albumId) || '';
      
      // Get title from either direct property or data nested property
      const title = initialData.title || (initialData.data && initialData.data.title) || '';
      
      // Get caption from either direct property or data nested property
      const caption = initialData.caption || (initialData.data && initialData.data.caption) || '';
      
      // Get order from either direct property or data nested property
      const order = initialData.order || (initialData.data && initialData.data.order) || '';
      
      // Set form data from initial data
      setFormData({
        albumId,
        title,
        caption,
        order: order ? String(order) : '',
        metadata,
        pubDatetime: formattedDate
      });
      
      // Set image URL if available
      const photoUrl = extractPhotoUrl(initialData);
      if (photoUrl) {
        // Get albumId for proper path normalization
        const albumId = initialData.albumId || (initialData.data && initialData.data.albumId);
        const normalizedUrl = normalizePhotoUrl(photoUrl, albumId);
        setImageUrl(normalizedUrl);
        console.log('Setting photo URL:', normalizedUrl);
        
        // Also set show advanced if metadata exists
        if (metadata.camera || metadata.lens) {
          setShowAdvanced(true);
        }
      }
    }
  }, [editMode, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      if (child.includes('.')) {
        const [nestedParent, nestedChild] = child.split('.');
        setFormData({
          ...formData,
          [parent]: {
            ...formData[parent as keyof PhotoFormData] as Record<string, any>,
            [nestedParent]: {
              ...(formData[parent as keyof PhotoFormData] as any)[nestedParent],
              [nestedChild]: value
            }
          }
        });
      } else {
        setFormData({
          ...formData,
          [parent]: {
            ...formData[parent as keyof PhotoFormData] as Record<string, any>,
            [child]: value
          }
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Replace the handleImageUploadSuccess function
  const handleImageUploadSuccess = (url: string, relativePath: string) => {
    setImageUrl(url); // Full GitHub URL for preview
    setImageRelativePath(relativePath); // Relative path for markdown
    setImageUploaded(true);
    
    // Extract filename from URL for visual feedback
    const filename = url.split('/').pop() || 'uploaded-image';
    
    // Use a local success message instead of calling the parent's onSuccess
    // This prevents the parent from thinking the entire form is done
    setFormMessage({ 
      type: 'success', 
      text: `Image "${filename}" uploaded successfully. Please complete the form below to save photo details.` 
    });
    
    // If we have a title field that's empty, use the filename as title suggestion
    if (!formData.title && !editMode) {
      const suggestedTitle = filename.split('.')[0]
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      setFormData(prev => ({
        ...prev,
        title: suggestedTitle
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrl || !imageRelativePath) {
      onError('Please upload an image first');
      return;
    }
    
    if (!formData.albumId) {
      onError('Please select an album');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Make sure we have a token
      if (!gitHubToken) {
        throw new Error("GitHub token is required");
      }
      
      // Validate the token first
      setIsTokenValidating(true);
      const validationResult = await validateToken(gitHubToken);
      setIsTokenValidating(false);
      
      if (!validationResult.valid) {
        throw new Error(`Token validation failed: ${validationResult.message || 'Unknown error'}`);
      }
      
      // Generate a unique ID for the photo (if not in edit mode)
      const photoId = editMode && initialData ? initialData.id : `photo_${Date.now()}`;
      
      // Prepare data for submission
      const photoData = {
        id: photoId,
        albumId: formData.albumId,
        title: formData.title,
        caption: formData.caption,
        order: formData.order ? parseInt(formData.order) : undefined,
        metadata: {
          camera: formData.metadata.camera,
          lens: formData.metadata.lens,
          settings: {
            aperture: formData.metadata.settings.aperture,
            shutterSpeed: formData.metadata.settings.shutterSpeed,
            iso: formData.metadata.settings.iso,
            focalLength: formData.metadata.settings.focalLength
          }
        },
        pubDatetime: formData.pubDatetime || new Date().toISOString(),
        photo: imageRelativePath, // Use relative path for markdown
        _sourceFile: editMode && initialData ? initialData._sourceFile : undefined
      };
      
      let result;
      
      if (editMode && initialData && initialData._sourceFile) {
        // Update existing photo
        result = await updateContent(initialData._sourceFile, photoData, gitHubToken);
        if (result.success) {
          onSuccess('Photo updated successfully');
        } else {
          throw new Error(result.error || 'Failed to update photo');
        }
      } else {
        // Create new photo
        const result = await createContent('photos', photoData, gitHubToken);
        if (result.success) {
          // Only now notify the parent that the entire process is complete
          onSuccess('Photo added successfully');
          
          // Reset form states
          setImageUploaded(false);
          setFormMessage(null);
          
          // Only reset form if not in edit mode
          if (!editMode) {
            setFormData({
              albumId: '',
              title: '',
              caption: '',
              order: '',
              metadata: {
                camera: '',
                lens: '',
                settings: {
                  aperture: '',
                  shutterSpeed: '',
                  iso: '',
                  focalLength: ''
                }
              },
              pubDatetime: new Date().toISOString()
            });
            setImageUrl(null);
          }
        } else {
          throw new Error(result.error || 'Failed to create photo');
        }
      }
      
      // Call refresh callback if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error(editMode ? "Error updating photo:" : "Error creating photo:", error);
      onError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine the button text based on current state
  const buttonText = isTokenValidating ? 'Validating Token...' : 
                    isSubmitting ? (editMode ? 'Updating Photo...' : 'Adding Photo...') : 
                    (editMode ? 'Update Photo' : 'Save Photo');

  // Get paginated photos when displaying album contents
  const albumPhotos = selectedAlbumPhotos ? 
    paginatePhotos(selectedAlbumPhotos, currentPage, itemsPerPage) : 
    [];

  // Add this function to handle photo selection
  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhoto(photo);
    
    // If a photo is selected, also update the form with its data
    if (photo) {
      // Update image URL
      const photoUrl = extractPhotoUrl(photo);
      if (photoUrl) {
        setImageUrl(normalizePhotoUrl(photoUrl, formData.albumId));
      }
      
      // Update title if available - FIX: Ensure title is always a string
      if (photo.title) {
        setFormData(prev => ({
          ...prev,
          title: photo.title as string // Cast to string to satisfy TypeScript
        }));
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        {editMode ? 'Edit Photo' : 'Upload New Photo'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Album*
            </label>
            <select
              name="albumId"
              value={formData.albumId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={editMode} // Don't allow changing album in edit mode
            >
              <option value="">Select an album</option>
              {albums.map(album => (
                <option key={album.id} value={album.id}>
                  {album.data?.title || album.title || album.id}
                </option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            {/* Only show upload component if we don't have an image yet or we're not in edit mode */}
            {formData.albumId && (!imageUrl || !editMode) ? (
              <>
                <PhotoUpload
                  albumId={formData.albumId}
                  githubToken={gitHubToken}
                  onSuccess={handleImageUploadSuccess}
                  onError={onError}
                />
              </>
            ) : null}
            
            {/* Show uploaded image preview/info */}
            {imageUrl && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex flex-wrap items-start">
                  <div className="flex-shrink-0 mr-4 mb-4">
                    <img 
                      src={imageUrl}
                      alt="Photo preview"
                      className="h-40 w-auto object-cover rounded-md"
                      onError={(e) => {
                        console.error('Image failed to load:', imageUrl);
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://via.placeholder.com/150?text=No+Preview';
                      }}
                    />
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium text-gray-700">Current photo:</p>
                    <p className="text-xs text-gray-500 mt-1 break-all">
                      {imageUrl}
                    </p>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => setImageUrl(null)}
                        className="mt-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                      >
                        Replace Image
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {!imageUrl && !formData.albumId && (
              <div className="border border-yellow-200 bg-yellow-50 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  Please select an album before uploading photos.
                </p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
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
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption
            </label>
            <textarea
              name="caption"
              value={formData.caption}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>
          
          <div className="md:col-span-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ml-1 transform ${showAdvanced ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {showAdvanced && (
            <>
              <div className="md:col-span-2 border-t pt-4 mt-2">
                <h3 className="text-lg font-medium mb-3">Photo Metadata</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Camera
                </label>
                <input
                  type="text"
                  name="metadata.camera"
                  value={formData.metadata.camera}
                  onChange={handleChange}
                  placeholder="e.g. Canon EOS R5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lens
                </label>
                <input
                  type="text"
                  name="metadata.lens"
                  value={formData.metadata.lens}
                  onChange={handleChange}
                  placeholder="e.g. 24-70mm f/2.8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aperture
                </label>
                <input
                  type="text"
                  name="metadata.settings.aperture"
                  value={formData.metadata.settings.aperture}
                  onChange={handleChange}
                  placeholder="e.g. f/2.8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shutter Speed
                </label>
                <input
                  type="text"
                  name="metadata.settings.shutterSpeed"
                  value={formData.metadata.settings.shutterSpeed}
                  onChange={handleChange}
                  placeholder="e.g. 1/250s"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISO
                </label>
                <input
                  type="text"
                  name="metadata.settings.iso"
                  value={formData.metadata.settings.iso}
                  onChange={handleChange}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Focal Length
                </label>
                <input
                  type="text"
                  name="metadata.settings.focalLength"
                  value={formData.metadata.settings.focalLength}
                  onChange={handleChange}
                  placeholder="e.g. 35mm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}
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
            disabled={!imageUrl || isSubmitting || isTokenValidating}
            className={`px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${(!imageUrl || isSubmitting || isTokenValidating) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {buttonText}
          </button>
        </div>
      </form>

      {/* Add this after your form fields */}
      {formMessage && (
        <div className={`mt-4 p-3 rounded-md ${
          formMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' 
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {formMessage.text}
        </div>
      )}

      {/* Add this conditional check before using albumPhotos in your JSX */}
      {formData.albumId && selectedAlbumPhotos && selectedAlbumPhotos.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mt-6 mb-2">Album Photos</h3>
          {/* Existing photo grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {albumPhotos.map((photo) => (
              // existing photo grid items
              <div 
                key={photo.id || photo._sourceFile}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 ${
                  selectedPhoto === photo ? 'border-indigo-500' : 'border-transparent'
                }`}
                onClick={() => handlePhotoSelect(photo)}
              >
                {/* Photo preview image */}
                <img 
                  src={photo.photo || extractPhotoUrl(photo) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM4ODg4ODgiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='} 
                  alt={photo.title || 'Photo'} 
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM4ODg4ODgiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
                
                {/* Selection indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedPhoto === photo && (
                    <div className="bg-indigo-500 bg-opacity-40 absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 20 20" fill="white" className="w-8 h-8">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Photo title */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1 text-xs truncate">
                  {photo.title || 'Untitled'}
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination controls */}
          <div className="mt-4 flex items-center justify-between">
            {/* existing pagination controls */}
            <div className="flex items-center">
              <label className="text-sm text-gray-600 mr-2">Photos per page:</label>
              <select 
                value={itemsPerPage} 
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1); // Reset to first page when changing items per page
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="48">48</option>
                <option value="96">96</option>
              </select>
            </div>
            
            <Pagination
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={selectedAlbumPhotos?.length || 0}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        </div>
      )}

      {formData.albumId && (!selectedAlbumPhotos || selectedAlbumPhotos.length === 0) && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
          <p className="text-gray-600">No photos in this album yet.</p>
        </div>
      )}
    </div>
  );
};

export default PhotoForm;