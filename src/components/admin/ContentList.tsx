import React, { useState, useEffect } from 'react';
import { getPropertySafely, extractPhotoUrl, normalizePhotoUrl } from '../../utils/contentHelpers';
import Pagination from './Pagination';

export interface ContentListProps {
  type: string;
  items: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onEdit?: (item: any) => void;  // Add edit handler
  onDelete?: (id: string, type: string) => void;  // Add delete handler
  renderItem?: (item: any) => JSX.Element;
}

const ContentList: React.FC<ContentListProps> = ({ 
  type,
  items,
  isLoading,
  onRefresh,
  onEdit,
  onDelete,
  renderItem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({
    key: 'pubDatetime',
    direction: 'desc'
  });
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Calculate current items to display based on pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  
  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  // Safe accessor function to get property values from Astro content collections
  const getPropertySafely = (item: any, key: string): any => {
    if (!item) return null;
    
    // Direct property access
    if (item[key] !== undefined) return item[key];
    
    // Try data.property (Astro content collections)
    if (item.data && item.data[key] !== undefined) return item.data[key];
    
    // Try frontmatter.property
    if (item.frontmatter && item.frontmatter[key] !== undefined) return item.frontmatter[key];
    
    // Special case for dates
    if (key === 'pubDatetime') {
      return item.pubDatetime || 
             item.date || 
             (item.data && (item.data.pubDatetime || item.data.date)) || 
             (item.frontmatter && (item.frontmatter.pubDatetime || item.frontmatter.date)) ||
             '2000-01-01'; // Default fallback date
    }
    
    return null;
  };

  useEffect(() => {
    if (!Array.isArray(items)) {
      console.error('Items is not an array:', items);
      setFilteredItems([]);
      return;
    }

    try {
      console.log(`Filtering and sorting ${items.length} items`);
      
      // Make a defensive copy
      let filtered = [...items];
      
      // Apply search filter if needed
      if (searchTerm) {
        const lowercaseSearch = searchTerm.toLowerCase();
        filtered = items.filter(item => {
          try {
            // Safe property access for filtering
            const title = String(getPropertySafely(item, 'title') || '').toLowerCase();
            const description = String(getPropertySafely(item, 'description') || '').toLowerCase();
            const id = String(item.id || '').toLowerCase();
            
            // Handle tags which might be an array
            let tags = '';
            const rawTags = getPropertySafely(item, 'tags');
            if (Array.isArray(rawTags)) {
              tags = rawTags.join(' ').toLowerCase();
            } else if (typeof rawTags === 'string') {
              tags = rawTags.toLowerCase();
            }
            
            return (
              title.includes(lowercaseSearch) ||
              description.includes(lowercaseSearch) ||
              tags.includes(lowercaseSearch) ||
              id.includes(lowercaseSearch)
            );
          } catch (err) {
            console.error('Error filtering item:', err);
            return false;
          }
        });
      }

      // Sort the filtered items
      filtered.sort((a, b) => {
        try {
          const aValue = getPropertySafely(a, sortConfig.key);
          const bValue = getPropertySafely(b, sortConfig.key);
          
          // Handle date comparisons
          if (sortConfig.key === 'pubDatetime' || sortConfig.key === 'date') {
            const timeA = new Date(aValue || '2000-01-01').getTime();
            const timeB = new Date(bValue || '2000-01-01').getTime();
            return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
          }
          
          // Handle string comparisons
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'asc' 
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }
          
          // Handle numeric or boolean comparisons
          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        } catch (err) {
          console.error('Error sorting items:', err);
          return 0;
        }
      });

      setFilteredItems(filtered);
      
      // Reset to first page when filter changes
      setCurrentPage(1);
    } catch (error) {
      console.error('Error processing items:', error);
      // Set to empty array on error so UI can still render
      setFilteredItems([]);
    }
  }, [items, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the table when changing pages
    window.scrollTo(0, 0);
  };
  
  // Handle items per page change
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };

  const renderTableHeader = () => {
    const headers: {[key: string]: string} = {
      albums: 'Album',
      photos: 'Photo',
      snips: 'Snip', 
      playlists: 'Playlist'
    };

    return (
      <tr>
        <th className="px-4 py-2 text-left">
          <button 
            onClick={() => handleSort('title')}
            className="font-medium text-gray-700 hover:text-indigo-600 flex items-center"
          >
            {headers[type] || type} Title
            {sortConfig.key === 'title' && (
              <span className="ml-1">
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        </th>
        <th className="px-4 py-2 text-left">
          <button 
            onClick={() => handleSort('pubDatetime')}
            className="font-medium text-gray-700 hover:text-indigo-600 flex items-center"
          >
            Date
            {sortConfig.key === 'pubDatetime' && (
              <span className="ml-1">
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        </th>
        <th className="px-4 py-2 text-left">Tags</th>
        <th className="px-4 py-2 text-center">Status</th>
        <th className="px-4 py-2 text-center">Actions</th>
      </tr>
    );
  };

  // Update the renderDefaultContentItem function:
  const renderDefaultContentItem = (item: any) => {
    try {
      // Safe property extraction using our helper
      const title = getPropertySafely(item, 'title') || 'Untitled';
      const itemId = item.id || 'unknown';
      const albumId = getPropertySafely(item, 'albumId');
      const pubDate = getPropertySafely(item, 'pubDatetime');
      const tags = getPropertySafely(item, 'tags') || [];
      const isDraft = !!getPropertySafely(item, 'draft');
      const isFeatured = !!getPropertySafely(item, 'featured');
      
      // Format date
      let pubDateStr = 'No date';
      if (pubDate) {
        try {
          pubDateStr = new Date(pubDate).toLocaleDateString();
        } catch (err) {
          pubDateStr = String(pubDate);
        }
      }
      
      // Get tags as array
      const tagsArray = Array.isArray(tags) ? tags : 
                       typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [];
      
      // Special handling for photos
      if (type === 'photos') {
        // Extract photo URL - prioritize GitHub URLs
        let photoUrl = null;
        const albumId = getPropertySafely(item, 'albumId');
        
        // Check for direct photo property first
        if (item.photo && typeof item.photo === 'string') {
          photoUrl = item.photo;
        } 
        // Then check nested in data object
        else if (item.data && item.data.photo) {
          if (typeof item.data.photo === 'string') {
            photoUrl = item.data.photo;
          } else if (item.data.photo.src) {
            photoUrl = item.data.photo.src;
          }
        }
        
        // Normalize the URL to ensure it works in admin UI
        if (photoUrl) {
          photoUrl = normalizePhotoUrl(photoUrl, albumId);
          
          // Skip rendering if not an absolute URL (log was already happening)
          if (!photoUrl.startsWith('http')) {
            console.log(`Skipping non-absolute URL: ${photoUrl}`);
            photoUrl = null;
          }
        }
        
        return (
          <tr key={`${itemId}_${Math.random().toString(36).substring(2, 7)}`} className="border-t hover:bg-gray-50">
            <td className="px-4 py-3">
              <div className="flex items-center">
                <div className="h-16 w-16 mr-3 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  {photoUrl ? (
                    <img 
                      src={photoUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error('Image failed to load:', photoUrl);
                        e.currentTarget.onerror = null; 
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI1IiB3aWR0aD0iMTgiIGhlaWdodD0iMTQiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiPjwvY2lyY2xlPjwvc3ZnPg==';
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{title}</div>
                  <div className="text-sm text-gray-500">
                    {albumId ? `Album: ${albumId}` : '(No album)'}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-xs">
                    {item.slug || itemId.split('/').pop()}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">{pubDateStr}</td>
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
                {isDraft ? (
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
                {onEdit && (
                  <button 
                    onClick={() => onEdit(item)}
                    className="px-2 py-1 text-xs bg-blue-100 rounded text-blue-800 hover:bg-blue-200"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button 
                    onClick={() => onDelete(itemId, type)}
                    className="px-2 py-1 text-xs bg-red-100 rounded text-red-800 hover:bg-red-200"
                  >
                    Delete
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      }
      
      // Regular content item rendering for albums, snips, and playlists
      return (
        <tr key={itemId} className="border-t hover:bg-gray-50">
          <td className="px-4 py-3">
            <div className="flex items-center">
              <div>
                <div className="font-medium text-gray-800">{title}</div>
                {/* Show different details based on content type */}
                {type === 'albums' && (
                  <div className="text-sm text-gray-500">
                    {getPropertySafely(item, 'description')?.substring(0, 60)}{getPropertySafely(item, 'description')?.length > 60 ? '...' : ''}
                  </div>
                )}
                {type === 'snips' && (
                  <div className="text-sm text-gray-500">
                    Language: {getPropertySafely(item, 'language') || 'Not specified'}
                  </div>
                )}
                {type === 'playlists' && (
                  <div className="text-sm text-gray-500">
                    Platform: {getPropertySafely(item, 'platform') || 'Not specified'}
                  </div>
                )}
                <div className="text-sm text-gray-500 truncate max-w-xs">
                  {item.slug || itemId.split('/').pop()}
                </div>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-gray-600">{pubDateStr}</td>
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
              {isDraft ? (
                <span className="px-2 py-1 text-xs bg-yellow-100 rounded-full text-yellow-800">
                  Draft
                </span>
              ) : (
                <span className="px-2 py-1 text-xs bg-green-100 rounded-full text-green-800">
                  Published
                </span>
              )}
              {isFeatured && (
                <span className="px-2 py-1 text-xs bg-indigo-100 rounded-full text-indigo-800">
                  Featured
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-3 text-center">
            <div className="flex justify-center space-x-2">
              {onEdit && (
                <button 
                  onClick={() => onEdit(item)}
                  className="px-2 py-1 text-xs bg-blue-100 rounded text-blue-800 hover:bg-blue-200"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button 
                  onClick={() => onDelete(itemId, type)}
                  className="px-2 py-1 text-xs bg-red-100 rounded text-red-800 hover:bg-red-200"
                >
                  Delete
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    } catch (err) {
      // Error handling
    }
  };

  // Make sure the renderItem function is returning a tr element
  // or use the default if it's not provided or invalid
  const getRenderedItem = (item: any) => {
    if (!renderItem) {
      return renderDefaultContentItem(item);
    }
    
    try {
      const renderedContent = renderItem(item);
      
      // Check if the returned element is a tr
      // (This is a simplistic check, in real production you might use React.isValidElement)
      if (renderedContent && renderedContent.type === 'tr') {
        return renderedContent;
      } else {
        console.warn('Invalid render item: The renderItem function must return a <tr> element');
        return renderDefaultContentItem(item);
      }
    } catch (err) {
      console.error('Error using custom renderItem function:', err);
      return renderDefaultContentItem(item);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold capitalize">
          {type} ({items?.length || 0})
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchTerm && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center px-3 py-1.5 rounded-md ${
              isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
            }`}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          {/* Debug button - expanded to work for all content types */}
          <button
            onClick={() => {
              console.log(`Current ${type} items:`, items);
              console.log(`Filtered ${type} items:`, filteredItems);
              
              // Check data structure for the first item
              if (items && items.length > 0) {
                console.log(`Sample ${type} item structure:`, items[0]);
                console.log('Direct properties:', Object.keys(items[0]));
                if (items[0].data) {
                  console.log('Data properties:', Object.keys(items[0].data));
                }
              }
              
              alert(`${type}: ${items.length} items, ${filteredItems.length} filtered items`);
            }}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
          >
            Debug {type}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {!isLoading && (!filteredItems || filteredItems.length === 0) && (
        <div className="bg-gray-50 py-10 rounded-md text-center">
          <h3 className="font-medium text-lg text-gray-600 mb-2">No {type} found</h3>
          <p className="text-gray-500">
            {searchTerm ? `No results matching "${searchTerm}"` : 'Create some content to get started'}
          </p>
        </div>
      )}

      {!isLoading && filteredItems && filteredItems.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50">
              {renderTableHeader()}
            </thead>
            <tbody>
              {currentItems.map((item, index) => {
                // Create a truly unique key using both ID and index
                // This prevents duplicate key issues even when multiple items have the same ID
                const uniqueKey = `${item.id || item._sourceFile || 'item'}_${index}`;
                return (
                  <React.Fragment key={uniqueKey}>
                    {getRenderedItem(item)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination component */}
      <Pagination
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalItems={filteredItems.length}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default ContentList;
