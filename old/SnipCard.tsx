import React, { useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
import type { CollectionEntry } from "astro:content";
import { useContentOverflow } from '../hooks/useContentOverflow';

interface SnipCardProps {
  item: {
    id: string;
    type: 'snip';
    data: CollectionEntry<"snips">;
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

const SnipCard: React.FC<SnipCardProps> = ({ item, handleExpand, handleResizeStart, resizing }) => {
  const { contentRef, isOverflowing } = useContentOverflow();
  const snipData = item.data.data;
  const snipBody = item.data.body; // Get the body content

  // Effect to handle initial sizing
  useEffect(() => {
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      if (contentHeight > item.position.height) {
        handleResizeStart(
          new MouseEvent('mousedown', { clientX: 0, clientY: 0 }),
          item.id
        );
      }
    }
  }, [snipBody]);

  return (
    <div className="card-content bg-gray-900/90 backdrop-blur-sm rounded-lg 
                    border border-green-500/30 overflow-hidden
                    shadow-[0_10px_20px_rgba(0,0,0,0.3),0_6px_6px_rgba(0,0,0,0.2)]">
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        <button
          onClick={() => handleExpand(item.id)}
          className="w-3 h-3 rounded-full bg-green-500/20 hover:bg-green-400/40 
                    transition-colors duration-200"
          title="Expand"
        />
      </div>

      <div ref={contentRef} className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-mono text-green-400">{snipData.title}</h3>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {snipData.description && (
            <p className="text-sm text-gray-300/90 mb-4">
              {snipData.description}
            </p>
          )}
          {snipBody && (
            <p className="text-sm text-gray-300/90 whitespace-pre-wrap">
              {snipBody}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnipCard;