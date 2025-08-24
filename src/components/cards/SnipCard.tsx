import React from 'react';
import type { CollectionEntry } from 'astro:content';
import type { WhiteboardItem } from '../../types/whiteboard';
import CardWrapper from './CardWrapper';

interface SnipCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onResize' | 'onDragStart'> {
  item: WhiteboardItem;
  id: string;
  isDragging: boolean;
  isResizing: boolean;
  onDragStart: (id: string, event: React.MouseEvent) => void;
  onExpand: (id: string, cardElement?: HTMLElement | null) => void;
  onDragEnd: () => void;

  onLongPress: (id: string) => void
  isFocused: boolean;
}

export function SnipCard({
  item,
  id,
  isDragging,
  isResizing,
  onDragStart,
  onExpand,
  onDragEnd,

  onLongPress,
  isFocused,
  ...rest
}: SnipCardProps) {
  const snip = item.data as CollectionEntry<"snips">;
  
  return (
    <CardWrapper
      item={item}
      id={id}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}

      onLongPress={(id) => onLongPress(id)}
      onExpand={(id, cardElement) => onExpand(id, cardElement)}
    >
      <div
        {...rest}
        className={`relative w-full h-full bg-gray-900/90 backdrop-blur-sm 
                   rounded-lg border border-cyan-500/30 overflow-hidden p-4 ${isFocused ? 'focused-card' : ''}`}
        style={{
          ...(rest.style || {}),
          boxShadow: isFocused ? '0 0 20px 10px rgba(0, 0, 0, 0.8)' : undefined
        }}
      >
        <h3 className="text-lg font-mono text-cyan-400 mb-3">{snip.data.title}</h3>
        <div className="space-y-3">
          <p className="text-sm text-gray-300/90">
            {snip.data.description}
          </p>
          
          {/* Add the snip body content */}
          <div className="mt-4 p-3 bg-gray-800/50 rounded border border-cyan-500/20">
            <pre className="text-sm font-mono text-cyan-300/90 whitespace-pre-wrap break-words">
              {snip.body}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {snip.data.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-full bg-cyan-950/50 
                           text-cyan-400/90 border border-cyan-500/20 font-mono 
                           tracking-tight"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Add source attribution if available */}
          {(snip.data.source || snip.data.sourceUrl) && (
            <div className="mt-3 text-xs text-gray-400/70">
              {snip.data.source && <span>Source: {snip.data.source}</span>}
              {snip.data.sourceUrl && (
                <a 
                  href={snip.data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-cyan-400/70 hover:text-cyan-400"
                >
                  View Source ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}