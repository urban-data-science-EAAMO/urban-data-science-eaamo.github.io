import React, { useState, useEffect } from 'react';
import PhotoForm from './PhotoForm.tsx';
import AlbumForm from './AlbumForm.tsx';
import SnipForm from './SnipForm.tsx';
import PlaylistForm from './PlaylistForm.tsx';
import ContentList from './ContentList.tsx';
import { getContentList, validateToken } from '../../utils/githubDirectService';

type ContentType = 'albums' | 'photos' | 'snips' | 'playlists';

interface AdminInterfaceProps {
  albums: any[];
  photos: any[];
  snips: any[];
  playlists: any[];
  gitHubToken: string;
}

const AdminInterface: React.FC<AdminInterfaceProps> = ({
  albums: initialAlbums,
  photos: initialPhotos,
  snips: initialSnips,
  playlists: initialPlaylists,
  gitHubToken
}) => {
  const [activeTab, setActiveTab] = useState<ContentType>('albums');
  const [contentMode, setContentMode] = useState<'list' | 'create' | 'edit'>('list');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // State for content lists
  const [albums, setAlbums] = useState(initialAlbums || []);
  const [photos, setPhotos] = useState(initialPhotos || []);
  const [snips, setSnips] = useState(initialSnips || []);
  const [playlists, setPlaylists] = useState(initialPlaylists || []);
  
  // Loading state for data refreshes
  const [loading, setLoading] = useState<Record<ContentType, boolean>>({
    albums: false,
    photos: false,
    snips: false,
    playlists: false
  });

  // Add a new state for the item being edited
  const [editingItem, setEditingItem] = useState<any>(null);

  const handleTabClick = (tab: ContentType) => {
    setActiveTab(tab);
    setContentMode('list');
    refreshContent(tab);
  };
  
  // Function to refresh content when needed
  const refreshContent = async (type: string) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    
    try {
      console.log(`Refreshing ${type} content...`);
      const result = await getContentList(gitHubToken, type);
      if (result.success && result.items) {
        console.log(`Received ${result.items.length} ${type} items`);
        
        // For photos, deduplicate by filename
        if (type === 'photos') {
          // Track unique filenames
          const seen = new Set();
          const uniqueItems = result.items.filter(item => {
            // Extract the filename from photo URL/path
            let photoPath = '';
            if (typeof item.photo === 'string') {
              photoPath = item.photo;
            } else if (item.data && item.data.photo) {
              photoPath = typeof item.data.photo === 'string' ? 
                        item.data.photo : 
                        (item.data.photo.src || '');
            }
            
            // Skip items without a photo
            if (!photoPath) return false;
            
            // Extract filename from path/URL
            const filename = photoPath.split('/').pop();
            if (!filename) return false;
            
            // Only keep this item if we haven't seen this filename before
            // Always prioritize GitHub URLs over local paths
            const isGithubUrl = photoPath.startsWith('https://raw.githubusercontent.com/');
            if (isGithubUrl || !seen.has(filename)) {
              seen.add(filename);
              return true;
            }
            
            return false;
          });
          
          console.log(`Filtered ${result.items.length} photos down to ${uniqueItems.length} unique items`);
          setPhotos(uniqueItems);
        } else {
          // For other content types, use all items
          switch (type) {
            case 'albums':
              setAlbums(result.items);
              break;
            case 'snips':
              setSnips(result.items);
              break;
            case 'playlists':
              setPlaylists(result.items);
              break;
          }
        }
      } else if (result.error) {
        console.error(`Error fetching ${type}:`, result.error);
      }
    } catch (error) {
      console.error(`Error refreshing ${type}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };
  
  // Initialize with up-to-date data from GitHub
  useEffect(() => {
    if (gitHubToken) {
      refreshContent(activeTab);
    }
  }, [gitHubToken]);

  // Debug the format of the incoming data
  useEffect(() => {
    console.log("Albums data structure:", albums);
    console.log("Photos data structure:", photos);
    console.log("Snips data structure:", snips);
    console.log("Playlists data structure:", playlists);
  }, [albums, photos, snips, playlists]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({
      message,
      type
    });
    
    // Scroll to top to show the notification
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleCreateSuccess = (message: string) => {
    setContentMode('list');
    showNotification(message, 'success');
    console.log('Success:', message);
    // Refresh the content list after creation
    refreshContent(activeTab); // Use the current active tab
  };

  const handleError = (message: string) => {
    showNotification(message, 'error');
    console.error('Error:', message);
  };

  // Handle editing an item
  const handleEdit = (item: any) => {
    setEditingItem(item);
    setContentMode('edit');
  };

  // Add a function to handle canceling edit:
  const handleCancelEdit = () => {
    setEditingItem(null);
    setContentMode('list');
  };

  // Add a function to handle edit success:
  const handleEditSuccess = (message: string) => {
    showNotification(message, 'success');
    setEditingItem(null);
    setContentMode('list');
    refreshContent(activeTab);
  };

  // Handle deleting an item
  const handleDelete = async (id: string, contentType: ContentType) => {
    if (!gitHubToken) {
      showNotification('No GitHub token available', 'error');
      return;
    }
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete this ${contentType.slice(0, -1)}? This action cannot be undone.`)) {
      return;
    }
    
    // Set loading state for the specific content type
    setLoading(prev => ({ ...prev, [contentType]: true }));
    
    try {
      // First validate the token
      const validationResult = await validateToken(gitHubToken);
      if (!validationResult.valid) {
        throw new Error(`Token validation failed: ${validationResult.message}`);
      }
      
      // Find the item to get its source file path
      let itemToDelete: any;
      switch (contentType) {
        case 'albums':
          itemToDelete = albums.find(item => item.id === id);
          break;
        case 'photos':
          itemToDelete = photos.find(item => item.id === id);
          break;
        case 'snips':
          itemToDelete = snips.find(item => item.id === id);
          break;
        case 'playlists':
          itemToDelete = playlists.find(item => item.id === id);
          break;
      }
      
      if (!itemToDelete || !itemToDelete._sourceFile) {
        throw new Error('Item not found or missing source file information');
      }
      
      // Import the deleteContent function
      const { deleteContent } = await import('../../utils/githubDirectService');
      
      // Delete the content file
      const result = await deleteContent(
        itemToDelete._sourceFile,
        gitHubToken,
        `Delete ${contentType.slice(0, -1)}: ${itemToDelete.title || id}`
      );
      
      if (result.success) {
        showNotification(`${contentType.slice(0, -1).charAt(0).toUpperCase() + contentType.slice(0, -1).slice(1)} deleted successfully`, 'success');
        
        // Update local state to remove the deleted item
        switch (contentType) {
          case 'albums':
            setAlbums(albums.filter(item => item.id !== id));
            break;
          case 'photos':
            setPhotos(photos.filter(item => item.id !== id));
            break;
          case 'snips':
            setSnips(snips.filter(item => item.id !== id));
            break;
          case 'playlists':
            setPlaylists(playlists.filter(item => item.id !== id));
            break;
        }
      } else {
        throw new Error(result.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification(`Error: ${error instanceof Error ? error.message : 'Failed to delete item'}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [contentType]: false }));
    }
  };

  const renderContentItem = (item: any) => {
    try {
      // Use safe property extraction
      const title = item.title || (item.data && item.data.title) || 
                    (item.frontmatter && item.frontmatter.title) || 
                    item.id || 'Untitled';
                    
      const draft = item.draft || (item.data && item.data.draft) || 
                    (item.frontmatter && item.frontmatter.draft);
      
      const description = (item.description || 
                          (item.data && item.data.description) || 
                          (item.frontmatter && item.frontmatter.description) || 
                          '').substring(0, 100);
      
      // Get tags safely
      const tags = item.tags || (item.data && item.data.tags) || 
                  (item.frontmatter && item.frontmatter.tags) || [];
                  
      const tagsArray = Array.isArray(tags) ? tags : 
                       typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
      
      // Format the date
      let pubDateStr = 'No date';
      const pubDate = item.pubDatetime || item.date || 
                     (item.data && (item.data.pubDatetime || item.data.date)) || 
                     (item.frontmatter && (item.frontmatter.pubDatetime || item.frontmatter.date));
      
      if (pubDate) {
        try {
          pubDateStr = new Date(pubDate).toLocaleDateString();
        } catch (err) {
          pubDateStr = String(pubDate);
        }
      }
      
      return (
        <tr key={item.id} className="border-t hover:bg-gray-50">
          <td className="px-4 py-3">
            <div className="font-medium text-gray-800">{title}</div>
            {item._sourceFile && (
              <div className="text-sm text-gray-500 truncate max-w-xs">
                {item._sourceFile}
              </div>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-gray-600">
            {pubDateStr}
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {tagsArray.map((tag: string, idx: number) => (
                <span 
                  key={idx} 
                  className="inline-block px-2 py-1 text-xs bg-gray-100 rounded-full text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3 text-center">
            <div className="flex justify-center space-x-2">
              {draft ? (
                <span className="px-2 py-1 text-xs bg-yellow-100 rounded-full text-yellow-800">
                  Draft
                </span>
              ) : (
                <span className="px-2 py-1 text-xs bg-green-100 rounded-full text-green-800">
                  Published
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-3 text-center">
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => handleEdit(item)}
                className="px-2 py-1 text-xs bg-blue-100 rounded text-blue-800 hover:bg-blue-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(item.id, activeTab)}
                className="px-2 py-1 text-xs bg-red-100 rounded text-red-800 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      );
    } catch (err) {
      console.error('Error rendering item:', err, item);
      // Return a fallback UI for broken items
      return (
        <tr className="border-t bg-red-50">
          <td colSpan={5} className="px-4 py-3 text-red-700">
            Error rendering item {item?.id || 'unknown'}
          </td>
        </tr>
      );
    }
  };

  const renderContent = () => {
    if (contentMode === 'create') {
      switch (activeTab) {
        case 'albums':
          return <AlbumForm 
                   onSuccess={handleCreateSuccess} 
                   onError={handleError} 
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('albums')}
                 />;
        case 'photos':
          return <PhotoForm 
                   albums={albums} 
                   onSuccess={handleCreateSuccess} 
                   onError={handleError} 
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('photos')}
                 />;
        case 'snips':
          return <SnipForm 
                   albums={albums} // Add the albums prop here
                   onSuccess={handleCreateSuccess} 
                   onError={handleError} 
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('snips')}
                 />;
        case 'playlists':
          return <PlaylistForm 
                   albums={albums} 
                   onSuccess={handleCreateSuccess} 
                   onError={handleError} 
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('playlists')}
                 />;
        default:
          return null;
      }
    } else if (contentMode === 'edit') {
      // Render the appropriate edit form based on activeTab
      if (!editingItem) return null;
      
      switch (activeTab) {
        case 'albums':
          return <AlbumForm 
                   editMode={true}
                   initialData={editingItem}
                   onSuccess={handleEditSuccess}
                   onError={handleError}
                   onCancel={handleCancelEdit}
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('albums')}
                 />;
        case 'photos':
          return <PhotoForm 
                   editMode={true}
                   initialData={editingItem}
                   albums={albums}
                   onSuccess={handleEditSuccess}
                   onError={handleError}
                   onCancel={handleCancelEdit}
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('photos')}
                 />;
        case 'snips':
          return <SnipForm 
                   editMode={true}
                   initialData={editingItem}
                   albums={albums} // Add the albums prop here
                   onSuccess={handleEditSuccess}
                   onError={handleError}
                   onCancel={handleCancelEdit}
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('snips')}
                 />;
        case 'playlists':
          return <PlaylistForm 
                   editMode={true}
                   initialData={editingItem}
                   albums={albums}
                   onSuccess={handleEditSuccess}
                   onError={handleError}
                   onCancel={handleCancelEdit}
                   gitHubToken={gitHubToken}
                   onRefresh={() => refreshContent('playlists')}
                 />;
        default:
          return null;
      }
    } else {
      // List mode - show content lists
      return (
        <ContentList
          type={activeTab}
          items={activeTab === 'albums' ? albums : 
                activeTab === 'photos' ? photos :
                activeTab === 'snips' ? snips :
                playlists}
          isLoading={loading[activeTab]}  // <-- Use the loading state for the active tab
          onRefresh={() => refreshContent(activeTab)}
          onEdit={handleEdit}
          onDelete={(id) => handleDelete(id, activeTab)}
        />
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Brain Admin Interface</h1>
      
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {notification.message}
        </div>
      )}
      
      {/* Tab navigation */}
      <div className="flex border-b mb-6">
        {(['albums', 'photos', 'snips', 'playlists'] as ContentType[]).map((tab) => (
          <button 
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`py-2 px-6 text-lg ${
              activeTab === tab 
                ? 'border-b-2 border-indigo-500 text-indigo-600 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end mb-6">
        {contentMode === 'list' ? (
          <button
            onClick={() => setContentMode('create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Create New {activeTab.slice(0, -1)}
          </button>
        ) : (
          <button
            onClick={() => setContentMode('list')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to List
          </button>
        )}
      </div>
      
      {/* Content area */}
      <div className="bg-white rounded-lg shadow p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminInterface;
