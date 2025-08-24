import React from 'react';
import { Move } from 'lucide-react';
import type { CollectionEntry } from "astro:content";
import { Image } from 'astro:assets';

interface AlbumCardProps {
  item: {
    id: string;
    type: 'album';
    data: CollectionEntry<"albums">;
    position: {
      x: number;
      y: number;
      z: number;
      rotate: number;
      width: number;
      height: number;
      expanded: boolean;
    };
  };
  photos: {
    id: string;
    slug: string;
    body: string;
    collection: string;
    data: {
      albumId: string;
      caption: string;
      photo: any;
    };
    render: () => Promise<{
      Content: () => Promise<string>;
      headings: never[];
      remarkPluginFrontmatter: Record<string, any>;
    }>;
    optimizedPhoto: any;
  }[];
  handleExpand: (itemId: string) => void;
  handleResizeStart: (e: React.MouseEvent, itemId: string) => void;
  resizing: string | null;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ item, photos, handleExpand, handleResizeStart, resizing }) => {
  console.log("AlbumCard photos:", photos);

  return (
    <div className="relative w-full h-full bg-gray-900/90 backdrop-blur-sm rounded-lg 
                    border border-cyan-500/30 overflow-hidden
                    shadow-[0_10px_20px_rgba(0,0,0,0.3),0_6px_6px_rgba(0,0,0,0.2),0_-2px_6px_rgba(255,255,255,0.02)]
                    after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 
                    after:h-12 after:bg-gradient-to-t after:from-black/20 after:to-transparent">
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        <button
          onClick={() => handleExpand(item.id)}
          className="w-3 h-3 rounded-full bg-cyan-500/20 hover:bg-cyan-400/40 
                    transition-colors duration-200"
          title="Expand"
        />
      </div>

      <div className="p-4 h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-mono text-cyan-400">{item.data.data.title}</h3>
          <Move className="w-5 h-5 text-cyan-500/70" />
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-300/90">
            {item.data.data.description}
          </p>

          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 3).map(photo => (
              <div
                key={photo.slug}
                className="relative aspect-square overflow-hidden rounded 
                         border border-cyan-500/20 group"
              >
                {photo.optimizedPhoto && (
                  <img src={photo.optimizedPhoto.src} alt={photo.data.caption} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 
                              to-transparent opacity-0 group-hover:opacity-100 
                              transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-xs text-white/90 truncate">
                      {photo.data.caption}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {item.data.data.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-full bg-cyan-950/50 
                         text-cyan-400/90 border border-cyan-500/20
                         font-mono tracking-tight"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
        onMouseDown={e => handleResizeStart(e, item.id)}
      >
        <div className="absolute bottom-1 right-1 w-3 h-3 
                       border-r-2 border-b-2 border-cyan-500/30
                       group-hover:border-cyan-400 transition-colors"
          style={{
            transform: resizing === item.id ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.2s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default AlbumCard;