import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { createContent, validateToken, updateContent } from '../../utils/githubDirectService';

interface AlbumFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  gitHubToken: string;
  onRefresh?: () => void;
  editMode?: boolean;
  initialData?: any;
  onCancel?: () => void;
}

const AlbumForm: React.FC<AlbumFormProps> = ({ 
  onSuccess, 
  onError, 
  gitHubToken,
  onRefresh,
  editMode = false,
  initialData = null,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    pubDatetime: '', // Changed from 'date' to 'pubDatetime'
    tags: '',
    draft: false,
    featured: false,
    borderColor: '#ffffff', // Added
    location: '', // Added
    coverPhotoId: '' // Added
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValidating, setIsTokenValidating] = useState(false);

  // Initialize form with data when in edit mode
  useEffect(() => {
    if (editMode && initialData) {
      console.log('Initial data for editing:', initialData);
      
      const tagsString = Array.isArray(initialData.tags) 
        ? initialData.tags.join(', ')
        : initialData.tags || '';
        
      // More robust date handling
      let formattedDate = '';
      try {
        // Check for date in multiple possible locations (prioritize pubDatetime)
        const dateValue = initialData.pubDatetime || 
                          initialData.date || 
                          (initialData.data && (initialData.data.pubDatetime || initialData.data.date)) ||
                          '';
        
        if (dateValue) {
          // Format logic remains the same
          console.log('Original date value:', dateValue);
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
          }
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
      
      setFormData({
        id: initialData.id || '',
        title: initialData.title || '',
        description: initialData.description || '',
        pubDatetime: formattedDate, // Changed from 'date'
        tags: tagsString,
        draft: Boolean(initialData.draft),
        featured: Boolean(initialData.featured),
        borderColor: initialData.borderColor || '#ffffff', // Added
        location: initialData.location || '', // Added
        coverPhotoId: initialData.coverPhotoId || '' // Added
      });
    }
  }, [editMode, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      
      // Generate ID if not provided (only in create mode)
      const albumId = formData.id || `album-${Date.now()}`;
      
      // Convert tags string to array
      const tagsArray = formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [];
      
      // Prepare data for submission - NOTE: Removed id from this object
      const albumData = {
        title: formData.title,
        description: formData.description,
        pubDatetime: formatDateForSubmission(formData.pubDatetime), // Changed from 'date'
        tags: tagsArray,
        draft: formData.draft,
        featured: formData.featured,
        borderColor: formData.borderColor || "#ffffff",
        location: formData.location || "", 
        coverPhotoId: formData.coverPhotoId || "",
        // Preserve the source file path if in edit mode
        _sourceFile: editMode && initialData ? initialData._sourceFile : undefined
      };
      
      let result;
      
      if (editMode && initialData && initialData._sourceFile) {
        // Use the update function
        result = await updateContent(
          initialData._sourceFile,
          albumData,
          gitHubToken
        );
      } else {
        // Pass the ID separately for filename generation
        result = await createContent('albums', albumData, gitHubToken, albumId);
      }
      
      if (result.success) {
        onSuccess(result.message || (editMode ? 'Album updated successfully' : 'Album created successfully'));
        
        // Only reset form if not in edit mode
        if (!editMode) {
          setFormData({
            id: '',
            title: '',
            description: '',
            pubDatetime: '',
            tags: '',
            draft: false,
            featured: false,
            borderColor: '#ffffff',
            location: '',
            coverPhotoId: ''
          });
        }
        
        // Call refresh callback if provided
        if (onRefresh) {
          onRefresh();
        }
      } else {
        onError(result.error || (editMode ? 'Failed to update album' : 'Failed to create album'));
      }
    } catch (error) {
      console.error(editMode ? "Error updating album:" : "Error creating album:", error);
      onError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonText = isTokenValidating ? 'Validating Token...' : 
                    isSubmitting ? (editMode ? 'Updating...' : 'Creating...') : 
                    (editMode ? 'Update Album' : 'Create Album');

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        {editMode ? 'Edit Album' : 'Create New Album'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Form fields - mostly unchanged */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="id" className="block text-sm font-medium text-gray-700 mb-1">
              Album ID {!editMode && '(optional)'}
            </label>
            <input
              type="text"
              id="id"
              name="id"
              value={formData.id}
              onChange={handleChange}
              placeholder={editMode ? '' : "Generated automatically if empty"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              readOnly={editMode} // Don't allow changing ID in edit mode
              disabled={editMode}
            />
            {!editMode && (
              <p className="mt-1 text-xs text-gray-500">Unique identifier for the album. Leave blank for auto-generation.</p>
            )}
          </div>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="pubDatetime" className="block text-sm font-medium text-gray-700 mb-1">
              Publication Date
            </label>
            <input
              type="date"
              id="pubDatetime"
              name="pubDatetime"
              value={formData.pubDatetime}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">Defaults to today if left blank.</p>
          </div>
          
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="travel, photography, personal"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="borderColor" className="block text-sm font-medium text-gray-700 mb-1">
              Border Color
            </label>
            <input
              type="color"
              id="borderColor"
              name="borderColor"
              value={formData.borderColor}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. New York, NY"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="coverPhotoId" className="block text-sm font-medium text-gray-700 mb-1">
              Cover Photo ID
            </label>
            <input
              type="text"
              id="coverPhotoId"
              name="coverPhotoId"
              value={formData.coverPhotoId}
              onChange={handleChange}
              placeholder="e.g. album-cover-1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">ID of the photo to use as album cover</p>
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
          {/* Add Cancel button in edit mode */}
          {editMode && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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

// Update the formatDateForSubmission function to ensure it outputs in the right format

function formatDateForSubmission(dateString: string): string {
  if (!dateString) {
    return new Date().toISOString().split('T')[0]; // Return just the date part: YYYY-MM-DD
  }
  
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Format as YYYY-MM-DD exactly
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.error('Error formatting date for submission:', e);
  }
  
  // Default to today in the correct format
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default AlbumForm;
