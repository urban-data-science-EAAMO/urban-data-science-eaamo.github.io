import type { WhiteboardItem, Position } from '../types/whiteboard';
import { STICKY_NOTE } from '../constants/whiteboard';

export function calculateInitialLayout(
  items: WhiteboardItem[],
  columns: number = Math.ceil(Math.sqrt(items.length))
): WhiteboardItem[] {
  // Use a grid layout with equal spacing between items
  const spacing = 450; // Base distance between items in pixels
  const jitterRange = 50; // Maximum random offset in pixels
  
  // Calculate grid dimensions
  const gridWidth = columns * spacing;
  const gridHeight = Math.ceil(items.length / columns) * spacing;
  
  // Position the items relative to the center of the whiteboard
  // The whiteboard uses a center-based coordinate system where (0,0) is the center
  
  // For a centered grid, we start at negative half grid width/height
  const startX = -gridWidth / 2 + (spacing / 2);
  const startY = -gridHeight / 2 + (spacing / 2);

  return items.map((item, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;

    // Add random jitter to position
    const jitterX = (Math.random() - 0.5) * jitterRange;
    const jitterY = (Math.random() - 0.5) * jitterRange;

    // Get default dimensions based on item type
    const defaultWidth = STICKY_NOTE.WIDTH;
    const defaultHeight = STICKY_NOTE.HEIGHT;

    // Add slight random rotation
    const rotation = (Math.random() - 0.5) * 5; // -2.5 to 2.5 degrees

    const finalX = startX + col * spacing + jitterX;
    const finalY = startY + row * spacing + jitterY;

    return {
      ...item,
      position: {
        x: finalX,
        y: finalY,
        z: index,
        width: item.position?.width ?? defaultWidth,
        height: item.position?.height ?? defaultHeight,
        expanded: false,
        rotation // Add rotation to position object
      }
    };
  });
}

export function updateItemZIndex(
  items: WhiteboardItem[],
  itemId: string
): WhiteboardItem[] {
  const maxZ = Math.max(...items.map(item => item.position.z));
  
  return items.map(item => ({
    ...item,
    position: {
      ...item.position,
      z: item.id === itemId ? maxZ + 1 : item.position.z
    }
  }));
}