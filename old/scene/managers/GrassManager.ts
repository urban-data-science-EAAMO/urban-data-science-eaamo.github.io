interface GrassBlade {
  x: number;
  y: number;
  height: number;
  offset: number;
  color: string;
  width: number;
  swayFactor: number;
  curve: number;
  treeRowIndex: number;  // Used only for z-ordering with trees
  visualDepth: number;   // Used for visual positioning and scaling
}

export class GrassManager {
  private blades: GrassBlade[] = [];
  // Store patch positions for consistent rendering
  private pathEdgePatches: Array<{x: number, y: number, size: number, isGrass: boolean}> = [];
  private readonly COLORS = [
    { h: 85, s: 70, l: 25 }, // Deep green
    { h: 75, s: 65, l: 30 }, // Forest green
    { h: 95, s: 75, l: 20 }, // Dark green
    { h: 65, s: 60, l: 35 }  // Olive green
  ];
  private readonly BATCH_SIZE = 100;
  private readonly VIEW_PADDING = 100;
  
  constructor(
    private width: number,
    private height: number,
    private groundLevel: number
  ) {
    this.initializeGrass();
  }

  private initializeGrass() {
    const numTreeRows = 4;
    const subdivisions = 3;
    const numRows = numTreeRows * subdivisions;
    const grassPerRow = 3000;
    const pathCenterX = this.width * 0.5;
    const pathWidth = this.width * 0.32;
    const vanishingPointY = this.height * 0.56;
    
    this.blades = [];

    for (let row = 0; row < numRows; row++) {
      // Calculate visual depth for positioning and scaling
      const visualDepth = row / (numRows - 1);
      // Map to tree rows for z-ordering only
      const treeRowIndex = Math.floor(row / subdivisions);
      
      const currentPathWidth = pathWidth * (1 - visualDepth * 0.7);
      const rowY = this.groundLevel - visualDepth * (this.groundLevel - vanishingPointY);
      const heightScale = 1 - visualDepth * 0.8;
      
      for (let i = 0; i < grassPerRow; i++) {
        const xProgress = i / grassPerRow;
        let x = this.width * xProgress;
        
        const randomOffset = (Math.random() * 60 - 30) * (1 - visualDepth);
        x += randomOffset;
        
        const distanceFromCenter = Math.abs(x - pathCenterX);
        if (distanceFromCenter < currentPathWidth/2) continue;
        
        if (distanceFromCenter < currentPathWidth && Math.random() > 0.3) continue;
        
        const baseHeight = 15 + Math.random() * 25;
        const colorIndex = Math.floor(Math.random() * this.COLORS.length);
        const baseColor = this.COLORS[colorIndex];
        
        this.blades.push({
          x,
          y: rowY + (Math.random() * 20 - 10) * (1 - visualDepth),
          height: baseHeight * heightScale,
          width: (1 + Math.random()) * heightScale,
          offset: Math.random() * Math.PI * 2,
          color: `hsl(${baseColor.h + Math.random() * 10 - 5}, ${baseColor.s}%, ${baseColor.l}%)`,
          swayFactor: 0.5 + Math.random() * 0.5,
          curve: 0.3 + Math.random() * 0.4,
          treeRowIndex,
          visualDepth
        });
      }
    }

    this.addWoodedAreaGrass(pathCenterX, pathWidth, vanishingPointY);
  }

  private addWoodedAreaGrass(pathCenterX: number, pathWidth: number, vanishingPointY: number) {
    const woodedAreaGrass = 300;
    
    for (let i = 0; i < woodedAreaGrass; i++) {
      const depthFactor = Math.random();
      const rowIndex = Math.floor(depthFactor * 12); // Match to number of rows
      const zIndex = rowIndex * 2; // Keep consistent with main grass rows
      
      const currentPathWidth = pathWidth * (1 - depthFactor * 0.7);
      const y = this.groundLevel * (this.groundLevel - vanishingPointY);
      const heightScale = 1 - depthFactor * 0.1;
      const side = Math.random() > 0.5;
      const spreadFactor = Math.random() * 3; // Increased spread
      let x;
      
      if (side) {
        x = pathCenterX + currentPathWidth/2 + (currentPathWidth * spreadFactor);
      } else {
        x = pathCenterX - currentPathWidth/2 - (currentPathWidth * spreadFactor);
      }
      
      const colorIndex = Math.floor(Math.random() * this.COLORS.length);
      const baseColor = this.COLORS[colorIndex];
      
      this.blades.push({
        x,
        y: y + (Math.random() * 30 - 15) * (1 - depthFactor),
        height: (20 + Math.random() * 30) * heightScale,
        width: (50 + Math.random()) * heightScale,
        offset: Math.random() * Math.PI * 2,
        color: `hsl(${baseColor.h + Math.random() * 10 - 5}, ${baseColor.s}%, ${baseColor.l}%)`,
        swayFactor: 0.5 + Math.random() * 0.5,
        curve: 0.3 + Math.random() * 0.4,
        zIndex,
        rowIndex
      });
    }
  }

  private generatePathEdgePatches() {
    const pathCenterX = this.width * 0.5;
    const pathWidth = this.width * 0.3;
    const transitionWidth = 40;
    const patchCount = 300;

    this.pathEdgePatches = [];
    
    for (let i = 0; i < patchCount; i++) {
      const progress = i / patchCount;
      const y = this.groundLevel - (progress * this.height * 0.3);
      const pathWidthAtY = pathWidth * (1 - progress * 0.7);
      
      // Left side patches
      this.pathEdgePatches.push({
        x: pathCenterX - pathWidthAtY/2 - Math.random() * transitionWidth,
        y,
        size: 2 + Math.random() * 3,
        isGrass: Math.random() > 0.5
      });

      // Right side patches
      this.pathEdgePatches.push({
        x: pathCenterX + pathWidthAtY/2 + Math.random() * transitionWidth,
        y,
        size: 2 + Math.random() * 3,
        isGrass: Math.random() > 0.5
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, windStrength: number) {
    // Sort blades by y position for proper depth
    this.blades.sort((a, b) => b.y - a.y);

    const time = Date.now() / 8000;
    const viewport = {
      left: -this.VIEW_PADDING,
      right: this.width + this.VIEW_PADDING
    };

    ctx.lineCap = 'round';
    
    // Batch processing and culling
    for (let i = 0; i < this.blades.length; i += this.BATCH_SIZE) {
      const batch = this.blades.slice(i, i + this.BATCH_SIZE);
      
      batch.forEach(blade => {
        // Cull blades outside viewport
        if (blade.x < viewport.left || blade.x > viewport.right) return;
        
        const windEffect = (Math.sin(time + blade.offset) * windStrength * 12 * blade.swayFactor);
        
        // Use blade's y position instead of groundLevel
        const midX = blade.x + windEffect * 0.5;
        const midY = blade.y - blade.height * 0.5;
        const endX = blade.x + windEffect;
        const endY = blade.y - blade.height;
        
        ctx.strokeStyle = blade.color;
        ctx.lineWidth = blade.width;
        ctx.beginPath();
        ctx.moveTo(blade.x, blade.y); // Start from blade's y position
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      });
    }
  }

  // Method to get grass for a specific depth layer
  public getGrassForLayer(layerIndex: number): GrassBlade[] {
    return this.blades.filter(blade => blade.rowIndex === layerIndex);
  }

  // Update method to get grass for specific tree row
  public getGrassForTreeRow(treeRowIndex: number): GrassBlade[] {
    return this.blades.filter(blade => blade.treeRowIndex === treeRowIndex)
      .sort((a, b) => b.visualDepth - a.visualDepth); // Maintain visual depth order within group
  }
}