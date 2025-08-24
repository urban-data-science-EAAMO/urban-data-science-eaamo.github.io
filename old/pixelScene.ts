import { Tree } from './scene/elements/Tree';
import { Cloud } from './scene/elements/Cloud';
import { Leaf } from './scene/elements/Leaf';
import { AtmosphereManager } from './scene/managers/AtmosphereManager';
import { type SceneConfig } from './scene/types';
import { PerformanceMonitor } from './scene/managers/PerformanceMonitor';
import { WindManager } from './scene/managers/WindManager';
import { GrassManager } from './scene/managers/GrassManager';

export class PixelScene {
  private performanceMonitor = new PerformanceMonitor();
  private windManager = new WindManager();
  private grassManager: GrassManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private trees: Tree[] = [];
  private clouds: Cloud[] = [];
  private leaves: Leaf[] = [];
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private readonly TARGET_FPS = 60; // Increased from 30
  private readonly FRAME_INTERVAL = 1000 / 60; // Increased from 30
  private lowPerformanceMode = false;
  private atmosphereManager: AtmosphereManager;
  // Initialize timeOfDay after atmosphereManager is created
  private timeOfDay: number;
  private lastTimestamp: number = 0;
  private animationFrameId: number = 0;
  private readonly PERFORMANCE_CHECK_INTERVAL = 10000; // Increased from 5000
  private lastPerformanceCheck = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    if (!ctx) throw new Error('Could not get canvas context');
    
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.lowPerformanceMode = this.detectLowPerformanceDevice();
    
    // Create atmosphereManager first
    this.atmosphereManager = new AtmosphereManager(
      this.width, 
      this.height, 
      this.lowPerformanceMode
    );
    
    // Then initialize timeOfDay
    this.timeOfDay = this.atmosphereManager.getTimeOfDay();

    const groundLevel = this.height * 0.8;
    this.grassManager = new GrassManager(this.width, this.height, groundLevel);

    this.init();
  }

  private detectLowPerformanceDevice(): boolean {
    return (
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator as any).deviceMemory < 4
    );
  }

  public init() {
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    this.createTrees();
    this.createClouds();
    this.animate(0);
  }

  public cleanup() {
    window.removeEventListener('resize', this.resizeCanvas);
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
    cancelAnimationFrame(this.animationFrameId);
  }

  private resizeCanvas = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.atmosphereManager = new AtmosphereManager(this.canvas.width, this.canvas.height, this.lowPerformanceMode);

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    const groundLevel = this.height * 0.8;

    this.grassManager = new GrassManager(this.width, this.height, groundLevel);
    
    // Remove building update
  };

  private createTrees() {
    const groundLevel = this.height * 0.8;
    const pathCenterX = this.width * 0.5;
    const pathWidth = this.width * 0.3;
    const vanishingPointY = this.height * 0.3;
    
    const numRows = 4;
    const treesPerSide = 3;
    
    for (let row = 0; row < numRows; row++) {
      const depthFactor = row / (numRows - 1);
      const currentPathWidth = pathWidth * (1 - depthFactor * 0.7);
      const treeHeight = 700 * (1 - depthFactor * 0.4);
      const yPos = groundLevel - depthFactor * (groundLevel - vanishingPointY) * 0.3;
      
      for (let side = 0; side < treesPerSide; side++) {
        const sideSpread = side / (treesPerSide - 1);
        
        const leftX = pathCenterX - currentPathWidth 
                     - (currentPathWidth * 0.5 * sideSpread)
                     + (Math.random() * 50 - 25);
        
        const rightX = pathCenterX + currentPathWidth 
                      + (currentPathWidth * 0.5 * sideSpread)
                      + (Math.random() * 50 - 25);
        
        const yVariation = Math.random() * 50 - 25;
        
        // Pass row index to Tree constructor
        this.trees.push(
          new Tree(leftX, yPos + yVariation, treeHeight, row),
          new Tree(rightX, yPos + yVariation, treeHeight, row)
        );
      }
    }
  }

  private createClouds() {
    const numClouds = 12 + Math.floor(Math.random() * 6); // Significantly more clouds
    for (let i = 0; i < numClouds; i++) {
      this.clouds.push(new Cloud(
        Math.random() * (this.width * 1.2) - this.width * 0.1, // Allow clouds slightly off-screen
        Math.random() * (this.height * 0.5), // Changed from 0.7 to 0.5 to lower clouds
        40 + Math.random() * 60, // Larger size variation
        this.atmosphereManager
      ));
    }
  }

  private spawnLeaf() {
    this.leaves.push(new Leaf(
      Math.random() * this.width,
      -20,
      5 + Math.random() * 5
    ));
  }

  private animate = (timestamp: number) => {
    this.frameId = requestAnimationFrame(this.animate);
    
    const elapsed = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Remove restrictive frame rate control
    if (elapsed < 8) { // Only skip if seriously out of sync
      return;
    }

    // Performance monitoring less frequently
    this.performanceMonitor.measure(timestamp);
    if (timestamp - this.lastPerformanceCheck > this.PERFORMANCE_CHECK_INTERVAL) {
      this.adaptPerformance();
      this.lastPerformanceCheck = timestamp;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Update atmosphere (which now uses real time)
    this.ctx.save();
    this.atmosphereManager.update(timestamp);
    this.atmosphereManager.draw(this.ctx);
    this.ctx.restore();

    // Draw ground before other elements
    this.drawGround(this.ctx);

    // Add atmospheric haze
    if (!this.lowPerformanceMode) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * Math.sin(this.timeOfDay * Math.PI)})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw scene elements with performance considerations
    this.windManager.update();
    const windStrength = this.windManager.strength;
    
    // Batch similar draw operations
    this.ctx.save();
    this.clouds.forEach(cloud => {
      cloud.update(windStrength * 0.3);
      cloud.draw(this.ctx);
    });
    this.ctx.restore();

    this.ctx.save();
    this.trees.forEach(tree => {
      tree.update(windStrength);
      tree.draw(this.ctx);
    });
    this.ctx.restore();

    this.grassManager.draw(this.ctx, windStrength);

    // Group trees by their stored row index
    const treeRows: Tree[][] = Array(4).fill([]).map(() => []);
    this.trees.forEach(tree => {
      const rowIndex = tree.getRowIndex();
      treeRows[rowIndex].push(tree);
    });

    // Render alternating grass and tree rows from back to front
    for (let rowIndex = 3; rowIndex >= 0; rowIndex--) {
      // Draw grass behind this row of trees
      const grassBehind = this.grassManager.getGrassForTreeRow(rowIndex);
      this.ctx.save();
      this.drawGrassBlades(grassBehind, timestamp);
      this.ctx.restore();

      // Draw trees in this row
      const treesInRow = treeRows[rowIndex] || [];
      treesInRow.forEach(tree => tree.draw(this.ctx));

      // Draw grass in front of this row of trees (next row's grass)
      if (rowIndex > 0) {
        const grassInFront = this.grassManager.getGrassForTreeRow(rowIndex - 1);
        this.ctx.save();
        this.drawGrassBlades(grassInFront, timestamp);
        this.ctx.restore();
      }
    }

    this.drawGround(this.ctx);

    this.lastFrameTime = timestamp;
  };

  private adaptPerformance() {
    if (this.performanceMonitor.isLowPerformance && !this.lowPerformanceMode) {
      console.log('Switching to low performance mode');
      this.lowPerformanceMode = true;
      this.grassManager.reduceDensity();
      this.trees = this.trees.slice(0, Math.ceil(this.trees.length * 0.7));
    }
  }

  // Add private method for ground rendering
  private drawGround(ctx: CanvasRenderingContext2D) {
    const groundLevel = this.height * 0.8;
    const groundDepth = this.height * 0.3;
    const pathCenterX = this.width * 0.5;
    const pathWidth = this.width * 0.3;
    const vanishingPointY = groundLevel - (groundLevel * 0.3);
    
    const timeOfDay = this.atmosphereManager.getTimeOfDay();
    const isNight = timeOfDay < 0.2 || timeOfDay > 0.8;
    
    // Draw base grass layer first
    const grassGradient = ctx.createLinearGradient(0, groundLevel, 0, this.height);
    if (isNight) {
        grassGradient.addColorStop(0, '#2C3E50');
        grassGradient.addColorStop(1, '#1B2631');
    } else {
        grassGradient.addColorStop(0, '#496B2E');
        grassGradient.addColorStop(1, '#374F21');
    }
    
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, groundLevel, this.width, groundDepth);

    // Draw clean path with perspective
    ctx.beginPath();
    ctx.moveTo(pathCenterX - pathWidth/2, groundLevel);
    ctx.lineTo(pathCenterX - pathWidth/6, vanishingPointY);
    ctx.lineTo(pathCenterX + pathWidth/6, vanishingPointY);
    ctx.lineTo(pathCenterX + pathWidth/2, groundLevel);
    
    // Create and apply path gradient
    const pathGradient = ctx.createLinearGradient(0, groundLevel, 0, vanishingPointY);
    if (isNight) {
        pathGradient.addColorStop(0, '#3C2F2F');
        pathGradient.addColorStop(1, '#2C1810');
    } else {
        pathGradient.addColorStop(0, '#8B7355');
        pathGradient.addColorStop(1, '#6B4423');
    }
    ctx.fillStyle = pathGradient;
    ctx.fill();

    // Simple path edges
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}