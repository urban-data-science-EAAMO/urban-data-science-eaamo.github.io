import React, { useState, useEffect, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import type { CollectionEntry } from "astro:content";

interface PlaylistCardProps {
  item: {
    id: string;
    type: 'playlist';
    data: CollectionEntry<"playlists">;
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
  handleExpand: (itemId: string) => void;
  handleResizeStart: (e: React.MouseEvent, itemId: string) => void;
  resizing: string | null;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ item, handleExpand, handleResizeStart, resizing }) => {
  const playlistData = item.data.data;
  const platform = playlistData.platform;
  const playlistUrl = playlistData.playlistUrl;
  const playlistId = playlistUrl.split('/').pop();

  const [embedCode, setEmbedCode] = useState<JSX.Element | null>(null);
  const [cardWidth, setCardWidth] = useState<number>(item.position.width);
  const [cardHeight, setCardHeight] = useState<number>(item.position.height);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCardWidth(item.position.width);
    setCardHeight(item.position.height);
  }, [item.position.width, item.position.height]);

  useEffect(() => {
    if (!contentRef.current) return;

    const contentHeight = contentRef.current.offsetHeight;
    const availableHeight = cardHeight - contentHeight - 20; // Subtract some margin

    let newEmbedCode = null;

    if (platform === 'spotify') {
      newEmbedCode = (
        <iframe
          src={`https://open.spotify.com/embed/playlist/${playlistId}`}
          width="100%"
          height={Math.max(80, availableHeight)}
          style={{ minHeight: '80px' }}
          frameBorder="0"
          allowtransparency="true"
          allow="encrypted-media"
        ></iframe>
      );
    } else if (platform === 'apple') {
      newEmbedCode = (
        <iframe
          allow="autoplay *; encrypted-media *;"
          frameBorder="0"
          height={Math.max(80, availableHeight)}
          style={{ width: '100%', overflow: 'hidden', background: 'transparent', minHeight: '80px' }}
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          src={`https://embed.music.apple.com/us/playlist/${playlistId}`}
        ></iframe>
      );
    }

    setEmbedCode(newEmbedCode);
  }, [platform, playlistId, cardWidth, cardHeight]);

  return (
    <div className="card-content bg-gradient-to-br from-purple-800 via-purple-700 to-purple-800/90 
                    backdrop-blur-sm rounded-lg border border-purple-500/30 overflow-hidden
                    shadow-[0_10px_20px_rgba(0,0,0,0.3),0_6px_6px_rgba(0,0,0,0.2),0_-2px_6px_rgba(255,255,255,0.02)]
                    after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 
                    after:h-12 after:bg-gradient-to-t after:from-black/20 after:to-transparent">
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        <button
          onClick={() => handleExpand(item.id)}
          className="w-3 h-3 rounded-full bg-purple-500/20 hover:bg-purple-400/40 
                    transition-colors duration-200"
          title="Expand"
        />
      </div>

      <div className="p-4 flex flex-col justify-between h-full">
        <div ref={contentRef}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-mono text-purple-400">{item.data.data.title}</h3>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-300/90">
              {item.data.data.description}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {item.data.data.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full bg-purple-950/50 
                           text-purple-400/90 border border-purple-500/20
                           font-mono tracking-tight"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Minified Playlist Embed */}
        <div className="mt-4">
          {embedCode}
        </div>
      </div>

      <div
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
        onMouseDown={e => handleResizeStart(e, item.id)}
      >
        <div className="absolute bottom-1 right-1 w-3 h-3 
                       border-r-2 border-b-2 border-purple-500/30
                       group-hover:border-purple-400 transition-colors"
          style={{
            transform: resizing === item.id ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.2s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default PlaylistCard;