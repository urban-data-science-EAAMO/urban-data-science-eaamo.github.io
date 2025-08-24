import React, { useState } from 'react';
import { uploadImage } from '../../utils/githubDirectService';

interface PhotoUploadProps {
  albumId: string;
  githubToken: string;
  onSuccess: (imageUrl: string, relativePath: string) => void;
  onError: (message: string) => void;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ 
  albumId, 
  githubToken, 
  onSuccess, 
  onError 
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Reset file input after upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setFileError(null);
    setUploading(true);
    setProgress(10);
    
    try {
      const file = files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setFileError('File must be an image');
        onError('File must be an image');
        setUploading(false);
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFileError('Image must be less than 5MB');
        onError('Image must be less than 5MB');
        setUploading(false);
        return;
      }
      
      // Validate album ID
      if (!albumId) {
        setFileError('Please select an album first');
        onError('Please select an album first');
        setUploading(false);
        return;
      }
      
      // More granular progress updates
      setProgress(20);
      console.log(`Starting upload of ${file.name} to album ${albumId}`);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Stop at 85% - the last 15% will be after upload completes
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return Math.min(prev + 3, 85);
        });
      }, 500);
      
      // Upload the image
      const result = await uploadImage(file, albumId, githubToken);
      
      clearInterval(progressInterval);
      
      if (result.success && result.url) {
        setProgress(95); // Almost done
        console.log(`Upload succeeded: ${result.url}`);
        
        // Short delay to show "Processing..." state to improve UX
        setTimeout(() => {
          setProgress(100);
          onSuccess(result.url || '', result.relativePath || '');
          
          // Reset file input for next upload
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 800);
      } else {
        setFileError(result.error || 'Failed to upload image');
        onError(result.error || 'Failed to upload image');
      }
    } catch (error) {
      const errorMsg = `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      setFileError(errorMsg);
      onError(errorMsg);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload Photo {albumId ? `to album: ${albumId}` : ''}
      </label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileUpload}
        disabled={uploading || !albumId}
        className={`block w-full text-sm ${
          fileError ? 'text-red-500' : 'text-slate-500'
        }
          file:mr-4 file:py-2 file:px-4
          file:rounded-md file:border-0
          file:text-sm file:font-semibold
          file:bg-indigo-50 file:text-indigo-700
          hover:file:bg-indigo-100
          ${!albumId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      />
      
      {fileError && (
        <p className="mt-1 text-xs text-red-500">{fileError}</p>
      )}
      
      {!albumId && (
        <p className="mt-1 text-xs text-amber-600">
          Please select an album before uploading photos
        </p>
      )}
      
      {uploading && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {progress < 100 ? 'Uploading and optimizing...' : 'Upload complete!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;